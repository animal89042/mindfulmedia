// server.js
import {dirname, resolve, join} from "path";
import {fileURLToPath} from "url";
import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import mysqlSessionPkg from 'express-mysql-session';
import {Strategy as SteamStrategy} from "passport-steam";
import {
    requireSteamID,
    requireAdmin
} from "./AuthMiddleware.js";

import {
    pool,
    initSchema,
    ensureUser,
    upsertGame,
    linkUserGame,
    getUserGames,
    upsertUserProfile,
    getOrCreateSteamIdentity,
    upsertPlatformGameSimple,
    linkLibrary,
} from "./database.js";

import {
    getOwnedGames,
    getGameData,
    getPlayerSummary,
    getUserStatsForGame,
} from "./SteamAPI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ENV
const {STEAM_API_KEY, PORT = 5000} = process.env;
const FRONTEND_BASE = process.env.NODE_ENV === "production" ? process.env.PUBLIC_URL : "http://localhost:3000";
const BACKEND_BASE = process.env.NODE_ENV === "production" ? process.env.PUBLIC_API_URL : `http://localhost:${PORT}`;

// Session Store (TiDB via mysql2 pool)
const MySQLStore = (mysqlSessionPkg.default || mysqlSessionPkg)(session);

const sessionStore = new MySQLStore(
    {
        createDatabaseTable: true,
        clearExpired: true,
        checkExpirationInterval: 1000 * 60 * 15,   // clean every 15 min
        expiration: 1000 * 60 * 60 * 24 * 7,       // 7 days
        schema: {
            tableName: "sessions",
            columnNames: {session_id: "session_id", expires: "expires", data: "data"},
        },
    },
    pool
);

// Surface store errors (helps catch DB issues fast)
sessionStore.on?.("error", (err) => {
    console.error("[session-store] error:", err);
});

async function startServer() {
    // 1) Express setup
    const app = express();

    // 2) Trust Railway's proxy so secure cookies work
    app.set('trust proxy', 1);

    // 3) CORS (exact origins + credentials)
    const allowedOrigins = [
        'http://localhost:3000',
        FRONTEND_BASE,
        /\.vercel\.app$/,
    ];

    app.use(
        cors({
            origin(origin, callback) {
                if (!origin) return callback(null, true); // allow server-to-server or curl requests
                const ok = allowedOrigins.some(o => typeof o === 'string' ? o === origin : o.test(origin));
                if (!ok) {
                    console.log("CORS BLOCKED:", origin);
                    return callback(new Error("CORS policy violation"), false);
                }
                return callback(null, true);
            },
            credentials: true, // allow cookies and credentials
        })
    );

    app.use(express.json());

    // 4) Sessions (TiDB-backed)
    app.use(session({
        store: sessionStore,             // your existing store
        name: "mm.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        proxy: true,                   // important when setting secure cookies behind proxy
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",  // true on Vercel/Railway
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7
            // DO NOT set `domain` for *.vercel.app — it's a public suffix and will be rejected
        }
    }));

    // 5) Passport (Steam OpenID)
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    passport.use(
        new SteamStrategy(
            {
                returnURL: `${FRONTEND_BASE}/api/auth/steam/return`,
                realm: FRONTEND_BASE,
                apiKey: STEAM_API_KEY,
            },
            (identifier, profile, done) => done(null, profile)
        )
    );

    // 6) OAuth Endpoints
    app.get("/api/auth/steam/login", passport.authenticate("steam"));

    app.get(
        "/api/auth/steam/return",
        passport.authenticate("steam", {failureRedirect: "/"}),
        (req, res, next) => {
            res.set({
                "Cache-Control": "no-store",
                "Pragma": "no-cache",
                "Expires": "0",
                "CDN-Cache-Control": "no-store"
            });
            const steam_id = req.user?.id;
            if (!steam_id) return res.redirect("/login/error");
            req.login(req.user, async (err) => {
                if (err) {
                    console.error("Login error:", err);
                    return next(err);
                }
                let conn;
                try {
                    const profile = await getPlayerSummary(steam_id);
                    conn = await pool.getConnection();
                    await ensureUser(conn, steam_id);
                    if (profile) {
                        await upsertUserProfile(conn, steam_id, profile);
                    }
                } catch (e) {
                    console.error("Could not fetch/store Steam profile:", e);
                } finally {
                    conn?.release();
                }
                // Make sure session is saved before redirect
                await new Promise((resolve, reject) =>
                    req.session.save((e2) => (e2 ? reject(e2) : resolve()))
                );
                res.redirect(FRONTEND_BASE);
            });
        }
    );

    // --- API: Verify Login ---
    app.get("/api/me", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        const steam_id = req.steam_id;
        let conn;
        try {
            conn = await pool.getConnection();
            const [[row]] = await conn.query(
                `
                    SELECT u.role
                    FROM users u
                             JOIN user_identities ui ON ui.user_id = u.id
                    WHERE ui.platform = 'steam'
                      AND ui.platform_user_id = ?
                    LIMIT 1
                `,
                [steam_id]
            );
            res.json({
                steam_id,
                display_name:
                    req.user?.displayName ||
                    req.session?.passport?.user?.displayName ||
                    null,
                avatar:
                    req.user?.photos?.[0]?.value ||
                    req.session?.passport?.user?.photos?.[0]?.value ||
                    null,
                role: row?.role || "user",
            });
        } catch (err) {
            console.error("Could not fetch user profile:", err);
            res.status(500).json({error: "Unable to fetch user role"});
        } finally {
            conn?.release();
        }
    });

    // --- Admin: list all users ---
    app.get("/api/admin/users", requireSteamID, requireAdmin, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        try {
            const [rows] = await pool.query(
                `
                    SELECT ui.platform_user_id AS id,
                           u.username          AS name,
                           u.role
                    FROM users u
                             JOIN user_identities ui ON ui.user_id = u.id
                    WHERE ui.platform = 'steam'
                `
            );
            res.json(rows);
        } catch (err) {
            console.error("Error fetching users for admin:", err);
            res.status(500).json({error: "Internal server error"});
        }
    });

    // --- API: Player Summary ---
    app.get("/api/playersummary", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        const steam_id = req.steam_id;
        let conn;
        try {
            conn = await pool.getConnection();

            const [[userRow]] = await conn.query(
                `
                    SELECT u.username AS persona_name,
                           u.avatar,
                           u.profile_url
                    FROM users u
                             JOIN user_identities ui ON ui.user_id = u.id
                    WHERE ui.platform = 'steam'
                      AND ui.platform_user_id = ?
                `,
                [steam_id]
            );

            let profile = userRow;
            if (!userRow || !userRow.avatar) {
                const fresh = await getPlayerSummary(steam_id);
                if (fresh) {
                    await upsertUserProfile(conn, steam_id, fresh);
                    profile = {
                        persona_name: fresh.personaname,
                        avatar: fresh.avatar,
                        profile_url: fresh.profileurl,
                    };
                }
            }
            conn.release();

            if (!profile) {
                return res.status(404).json({error: "User not found"});
            }
            res.json({
                personaName: profile.persona_name,
                avatar: profile.avatar,
                profileUrl: profile.profile_url,
                avatarFound: Boolean(profile.avatar),
            });
        } catch (err) {
            conn?.release();
            console.error("Error fetching player summary:", err);
            res.status(500).json({error: "Failed to fetch player summary"});
        }
    });

    // --- API: User's Owned Games ---
    app.get("/api/games", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        const steam_id = req.steam_id;
        if (!steam_id) return res.status(401).json({error: "Not logged in"});
        try {
            // 0) Ensure identity_id for this Steam user
            const identityId = await getOrCreateSteamIdentity(steam_id);
            if (!identityId)
                return res.status(400).json({error: "No user record for this Steam ID"});
            // 1) Fetch owned games (appid + playtime)
            const owned = await getOwnedGames(steam_id); // [{ appid, playtime_forever }, ...]
            // 2) Upsert catalog + user library
            for (const g of owned || []) {
                if (!g.appid) continue;
                const pgId = await upsertPlatformGameSimple("steam", g.appid, g.name, g.icon_url);
                await linkLibrary(identityId, pgId, g.playtime_forever ?? 0);
            }
            // 3) Return the user's library from new tables
            const [rows] = await pool.query(
                `SELECT pg.platform_game_id                                    AS appid,
                        COALESCE(pg.name, CONCAT('App ', pg.platform_game_id)) AS title,
                        pg.icon_url                                            AS imageUrl,
                        ugl.playtime_minutes                                   AS playtime
                 FROM user_game_library ugl
                          JOIN platform_games pg ON pg.id = ugl.platform_game_id
                 WHERE ugl.identity_id = ?
                   AND pg.platform = 'steam'
                 ORDER BY pg.name IS NULL, pg.name`,
                [identityId]
            );
            res.json(rows);
        } catch (err) {
            console.error("/api/games error:", err);
            res.status(500).json({error: "Failed to sync games"});
        }
    });


    // --- API: Single Game Details ---
    app.get("/api/game/:id", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        try {
            const game = await getGameData(req.params.id);
            if (!game) return res.status(404).json({error: "Game not found"});
            res.json(game);
        } catch (err) {
            console.error("Error in /api/game/:id:", err);
            res.status(500).json({error: "Internal server error"});
        }
    });

    // --- API: User's Game Stats (playtime + achievements)
    app.get("/api/game/:appid/stats", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        try {
            const steam_id = req.steam_id;
            const appid = String(req.params.appid);

            // 1) Get playtime from cached owned games
            const owned = await getOwnedGames(steam_id);
            const game = owned.find(g => String(g.appid) === appid);
            if (!game) return res.status(404).json({ error: "Game not found" });

            // 2) Try to get additional stats from Steam API
            let extraStats = {};
            try {
                const fetched = await getUserStatsForGame(steam_id, appid);
                if (fetched) extraStats = fetched;
            } catch (err) {
                console.warn(`No extra stats for appid ${appid}:`, err?.message || err);
            }

            const minutes = game.playtime_forever ?? 0;

            res.json({
                appid,
                name: game.name,
                playtimeMinutes: minutes,
                playtimeHours: Math.floor(minutes / 60),
                stats: extraStats,
            });
        } catch (err) {
            console.error("Error in /api/game/:appid/stats:", err);
            res.status(500).json({ error: "Failed to fetch game stats" });
        }
    });


    // --- API: Test Endpoint ---
    app.get("/api/test", (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        res.json({message: "Tunnel + Steam OAuth are working!"});
    });

    //  ─── Journal: List entries ───────────────────────────────────────────
    app.get("/api/journals", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        const {appid} = req.query;
        const steam_id = req.steam_id;
        let conn;
        try {
            conn = await pool.getConnection();
            let rows;

            if (appid) {
                // only this game’s entries
                [rows] = await conn.query(
                    ` SELECT j.id,
                             j.appid,
                             g.title AS game_title,
                             j.entry,
                             j.title AS journal_title,
                             j.created_at,
                             j.edited_at
                      FROM journals j
                               LEFT JOIN games g ON j.appid = g.appid
                      WHERE j.appid = ?
                        AND j.steam_id = ?`,
                    [appid, steam_id]
                );
            } else {
                [rows] = await conn.query(
                    `SELECT j.id,
                            j.appid,
                            g.title AS game_title,
                            j.entry,
                            j.title AS journal_title,
                            j.created_at,
                            j.edited_at
                     FROM journals j
                              LEFT JOIN games g ON j.appid = g.appid
                     WHERE j.steam_id = ?`,
                    [steam_id]
                );
            }
            console.log(
                `Fetched ${rows.length} journal entries${appid ? ` for ${appid}` : ""}`
            );
            res.json(rows);
        } catch (err) {
            console.error("Error fetching journal entries:", err);
            res.status(500).json({error: "Failed to fetch journal entries"});
        } finally {
            if (conn) conn.release();
        }
    });

    //  ─── Journal: Create a new entry ────────────────────────────────────
    app.post("/api/journals", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        const {appid, entry, title} = req.body;
        const steam_id = req.steam_id;

        if (!appid || !entry) {
            return res.status(400).json({error: "Both appid and entry are required"});
        }

        let conn;
        try {
            conn = await pool.getConnection();
            const safe_title = title ?? "";
            const [result] = await conn.query(
                "INSERT INTO journals (steam_id, appid, entry, title) VALUES (?, ?, ?, ?)",
                [steam_id, appid, entry, safe_title]
            );
            const [[newEntry]] = await conn.query(
                `SELECT id, appid, entry, title AS journal_title, created_at, edited_at
                 FROM journals
                 WHERE id = ?`,
                [result.insertId]
            );
            res.json(newEntry);
        } catch (err) {
            console.error("Error saving journal entry:", err);
            res.status(500).json({error: "Failed to save journal entry"});
        } finally {
            if (conn) conn.release();
        }
    });

    //  ─── Journal: Delete a entry ────────────────────────────────────
    app.delete("/api/journals/:id", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        const steam_id = req.steam_id;
        const entryId = req.params.id;
        let conn;
        try {
            conn = await pool.getConnection();
            // Make sure the entry belongs to this user before deleting
            const [[entry]] = await conn.query(
                `SELECT id
                 FROM journals
                 WHERE id = ?
                   AND steam_id = ?`,
                [entryId, steam_id]
            );
            if (!entry) {
                return res.status(404).json({error: "Entry not found or access denied"});
            }
            await conn.query(`DELETE
                              FROM journals
                              WHERE id = ?`, [entryId]);
            res.json({success: true});
        } catch (err) {
            console.error("Error deleting journal entry:", err);
            res.status(500).json({error: "Failed to delete journal entry"});
        } finally {
            if (conn) conn.release();
        }
    });

    //  ─── Journal: Update a entry ────────────────────────────────────
    app.put("/api/journals/:id", requireSteamID, async (req, res) => {
        res.set({
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Expires": "0",
            "CDN-Cache-Control": "no-store"
        });
        const steam_id = req.steam_id;
        const entryId = req.params.id;
        const {entry, title} = req.body;
        if (!entry) {
            return res.status(400).json({error: "Entry content is required"});
        }

        let conn;
        try {
            conn = await pool.getConnection();
            const [[existing]] = await conn.query(
                `SELECT id
                 FROM journals
                 WHERE id = ?
                   AND steam_id = ?`,
                [entryId, steam_id]
            );
            if (!existing) {
                return res.status(404).json({error: "Entry not found or access denied"});
            }
            await conn.query(
                `UPDATE journals
                 SET entry     = ?,
                     title     = ?,
                     edited_at = NOW()
                 WHERE id = ?`,
                [entry, title || "", entryId]
            );
            const [[updatedEntry]] = await conn.query(
                `SELECT id, appid, entry, title AS journal_title, created_at, edited_at
                 FROM journals
                 WHERE id = ?`,
                [entryId]
            );

            res.json(updatedEntry);
        } catch (err) {
            console.error("Error updating journal entry:", err);
            res.status(500).json({error: "Failed to update journal entry"});
        } finally {
            if (conn) conn.release();
        }
    })

    // --- Static (dev-only)
    if (process.env.NODE_ENV === 'production') {
        const buildPath = resolve(__dirname, '../frontend/build');
        app.use(express.static(buildPath));
        app.get(/^\/(?!api).*/, (req, res) => {
                res.sendFile(join(buildPath, 'index.html'), (err) => {
                    if (err) {
                        console.error("Error serving index.html:", err);
                        res.status(500).send(err);
                    }
                });
            }
        )
    }

    // Log Out
    app.post('/api/logout', (req, res, next) => {
        const cookieOpts = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
        };

        req.logout(err => {
            if (err) return next(err);
            req.session.destroy(err2 => {
                if (err2) return next(err2);
                res.clearCookie('mm.sid', cookieOpts);
                res.redirect('/');
            });
        });
    });

    // Start listening
    app.listen(PORT, () => {
        console.log(`Backend listening on :${PORT}`);
        warmup();
    });

    process.on("SIGINT", async () => {
        console.log("Closing...");
        process.exit();
    });
}

// Background warmup: optional migrations + open DB/session paths
async function warmup() {
    const t0 = Date.now();
    try {
        await initSchema(resolve(__dirname, "init.sql"));
        await pool.query("SELECT 1");
        console.log("DB warmup complete in", Date.now() - t0, "ms");
    } catch (err) {
        console.error("DB warmup failed:", err);
    }
}

startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});