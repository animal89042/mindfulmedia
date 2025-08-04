// server.js
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import localtunnel from "localtunnel";
import mysql from "mysql2/promise";
import { Strategy as SteamStrategy } from "passport-steam";
import { getOwnedGames, getGameData, getPlayerSummary } from "./SteamAPI.js";
import {
  initSchema,
  ensureUser,
  upsertGame,
  linkUserGame,
  getUserGames,
  upsertUserProfile,
} from "./database.js";
import { requireSteamID } from './AuthMiddleware.js';
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASS,
  DB_NAME,
  STEAM_API_KEY,
  PORT = 5000,
} = process.env;


async function startServer() {
  // 1) Ensure schema (CREATE/ALTER) is applied
  await initSchema(
    {
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASS,
      multipleStatements: true,
    },
    resolve(__dirname, "init.sql")
  );

  // 2) Create MySQL pool
  const pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // 3) Expose via localtunnel
  const tunnel = await localtunnel({ port: PORT, subdomain: "mindfulmedia" });
  const BASE_URL = process.env.USE_LT === "TRUE" ? tunnel.url : process.env.PUBLIC_URL; //oo fancy I like
  const TUNNEL_URL = tunnel.url; //FIXME delete? BASE_URL covers practical use.
  console.log(`Tunnel live at: ${TUNNEL_URL}`); // ^

  // 4) Verify connection
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    console.log("MySQL pool connected");
    conn.release();
  } catch (err) {
    console.error("MySQL pool failed:", err);
    process.exit(1);
  }
  //test deplot=y
  // 5) Express setup
  const app = express();

  app.set('trust proxy', 1);

  const allowedOrigins = [
      'http://localhost:3000',
    'https://mindfulmedia.loca.lt',
    'https://mindfulmedia.vercel.app',
    'https://mindfulmedia-dm83.vercel.app',
    'https://mindfulmedia-dm83-git-cookiesurg-brody-michaels-projects.vercel.app',
    'https://mindfulmedia-dm83-od3hzia0e-brody-michaels-projects.vercel.app',
    'https://mindfulmedia-dm83-brody-michaels-projects.vercel.app',
    /^https:\/\/mindfulmedia-[^.]+\.vercel\.app$/,
    /^https:\/\/.*\.loca\.lt$/
  ];
  app.use(cors({
    origin: function (origin, callback) {
      console.log("CORS CHECK:", origin); // log every request
      if (!origin) return callback(null, true); // allow server-to-server or curl requests
      const isAllowed = allowedOrigins.some(o =>
          typeof o === 'string' ? o === origin : o.test(origin)
      );
      if (!isAllowed) {
        console.log("CORS BLOCKED:", origin);
        return callback(new Error("CORS policy violation"), false);
      }
      return callback(null, true);
    },
    credentials: true, // allow cookies and credentials
  }));
  app.use(express.json());
  app.use(
    session({
      secret: "thisisarandoms3cr3Tstr1nG123!@#",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
      }
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
  passport.use(
    new SteamStrategy(
      {
        returnURL: `${BASE_URL}/api/auth/steam/return`,
        realm: BASE_URL,
        apiKey: STEAM_API_KEY,
      },
      (identifier, profile, done) => done(null, profile)
    )
  );

  // --- OAuth Endpoints ---
  app.get("/api/auth/steam/login", passport.authenticate("steam"));
  app.get(
      "/api/auth/steam/return",
      passport.authenticate("steam", { failureRedirect: "/" }),
      (req, res, next) => {
        const steam_id = req.user?.id;
        if (!steam_id) return res.redirect("/login/error");

        // Manually login to save session and send cookie
        req.login(req.user, async (err) => {
          if (err) {
            console.error("Login error:", err);
            return next(err);
          }

          console.log("SteamID:", steam_id);
          console.log("BEFORE SESSION LOGIN RETURN");
          console.log("SESSION AT LOGIN RETURN:", req.session);
          console.log("AFTER SESSION LOGIN RETURN");
          console.log("USER AT LOGIN RETURN:", req.user);
          console.log("SESSION PASSPORT:", req.session.passport?.user);

          try {
            const profile = await getPlayerSummary(steam_id);
            if (profile) {
              const conn = await pool.getConnection();
              await conn.query(
                  `INSERT IGNORE INTO users (steam_id, persona_name, avatar, profile_url)
             VALUES (?, ?, ?, ?)`,
                  [steam_id, profile.persona_name, profile.avatar, profile.profile_url]
              );
              await upsertUserProfile(conn, steam_id, profile);
              conn.release();
            }
          } catch (err) {
            console.error("Could not fetch/store Steam profile:", err);
          }

          req.session.save((err) => {
            if (err) {
              console.error("Session save error:", err);
              return next(err);
            }
            console.log("✅ Session saved, redirecting");
            const REDIR_URL = process.env.USE_LT === "TRUE" ? BASE_URL : process.env.STEAM_REDIRECT; //oo fancy I like
            res.redirect(REDIR_URL);
          });
        });
      }
  );
  // --- API: Verify Login ---
  app.get('/api/me', requireSteamID, (req, res) => {
    const user = req.session.passport.user;
    res.json({
      steam_id: user.id,
      display_name: user.displayName,
      avatar: user.photos?.[0]?.value //only grab avatar url if it exists
    });
  });
  // --- API: Player Summary ---
  app.get("/api/playersummary", requireSteamID, async (req, res) => {
    const steam_id = req.steam_id;
    let conn;
    try {
      conn = await pool.getConnection();
      const [[userRow]] = await conn.query(
        ` SELECT display_name, persona_name, avatar, profile_url
          FROM users
          WHERE steam_id = ?`,
        [steam_id]
      );

      let profile = userRow;
      if (!userRow || !userRow.avatar) {
        const fresh = await getPlayerSummary(steam_id);
        if (fresh) {
          await upsertUserProfile(conn, steam_id, fresh);
          profile = {
            display_name: fresh.personaname,
            persona_name: fresh.personaname,
            avatar: fresh.avatar,
            profile_url: fresh.profileurl,
          };
        }
      }
      conn.release();

      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        personaName: profile.persona_name,
        avatar: profile.avatar,
        profileUrl: profile.profile_url,
        avatarFound: Boolean(profile.avatar),
      });
    } catch (err) {
      if (conn) {
        conn.release();
      }
      console.error("Error fetching player summary:", err);
      res.status(500).json({ error: "Failed to fetch player summary" });
    }
  });

  // --- API: User's Owned Games ---
  app.get("/api/games", requireSteamID, async (req, res) => {
    const steam_id = req.steam_id;
    let conn;
    try {
      const owned = await getOwnedGames(steam_id);
      conn = await pool.getConnection();
      await conn.beginTransaction();

      await ensureUser(conn, steam_id, null); // simplified ensureUser

      for (const { appid } of owned) {
        if (!appid) continue;

        // check cache
        const [[existing]] = await conn.query(
          ` SELECT title
            FROM games
            WHERE appid = ?`,
          [appid]
        );
        if (existing && existing.title && existing.title !== "Unknown") {
          await linkUserGame(conn, steam_id, appid);
          continue;
        }

        // fetch & upsert
        const gameData = await getGameData(appid);
        if (gameData) {
          await upsertGame(conn, gameData);
        }
        await linkUserGame(conn, steam_id, appid);
      }

      await conn.commit();
      conn.release();

      const rows = await getUserGames(pool, steam_id);
      res.json(rows);
    } catch (err) {
      if (conn) {
        await conn.rollback().catch(() => {});
        conn.release();
      }
      console.error("Error in /api/games:", err);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  // --- API: Single Game Details ---
  app.get("/api/game/:id", requireSteamID, async (req, res) => {
    try {
      const game = await getGameData(req.params.id);
      if (!game) return res.status(404).json({ error: "Game not found" });
      res.json(game);
    } catch (err) {
      console.error("Error in /api/game/:id:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- API: Test Endpoint ---
  app.get("/api/test", (req, res) => {
    res.json({ message: "Tunnel + Steam OAuth are working!" });
  });

  //  ─── Journal: List entries ───────────────────────────────────────────
  app.get("/api/journals", requireSteamID, async (req, res) => {
    const { appid } = req.query;
    const steam_id = req.steam_id;
    let conn;
    try {
      conn = await pool.getConnection();
      let rows;

      if (appid) {
        // only this game’s entries
        [rows] = await conn.query(
          ` SELECT j.id, j.appid, g.title AS game_title, j.entry,
            j.title AS journal_title, j.created_at, j.edited_at
            FROM journals j
            LEFT JOIN games g ON j.appid = g.appid
            WHERE j.appid = ? AND j.steam_id = ?`,
          [appid, steam_id]
        );
      } else {
        [rows] = await conn.query(
            `SELECT j.id, j.appid, g.title AS game_title, j.entry,
            j.title AS journal_title, j.created_at, j.edited_at
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
      res.status(500).json({ error: "Failed to fetch journal entries" });
    } finally {
      if (conn) conn.release();
    }
  });

  //  ─── Journal: Create a new entry ────────────────────────────────────
  app.post("/api/journals", requireSteamID, async (req, res) => {
    const { appid, entry, title } = req.body;
    const steam_id = req.steam_id;

    if (!appid || !entry) {
      return res.status(400).json({ error: "Both appid and entry are required" });
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
       FROM journals WHERE id = ?`,
          [result.insertId]
      );
      res.json(newEntry);
    } catch (err) {
      console.error("Error saving journal entry:", err);
      res.status(500).json({ error: "Failed to save journal entry" });
    } finally {
      if (conn) conn.release();
    }
  });

  //  ─── Journal: Delete a entry ────────────────────────────────────
  app.delete("/api/journals/:id", requireSteamID, async (req, res) => {
    const steam_id = req.steam_id;
    const entryId = req.params.id;
    let conn;
    try {
      conn = await pool.getConnection();
      // Make sure the entry belongs to this user before deleting
      const [[entry]] = await conn.query(
          `SELECT id FROM journals WHERE id = ? AND steam_id = ?`,
          [entryId, steam_id]
      );
      if (!entry) {
        return res.status(404).json({ error: "Entry not found or access denied" });
      }
      await conn.query(`DELETE FROM journals WHERE id = ?`, [entryId]);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting journal entry:", err);
      res.status(500).json({ error: "Failed to delete journal entry" });
    } finally {
      if (conn) conn.release();
    }
  });

  //  ─── Journal: Update a entry ────────────────────────────────────
  app.put("/api/journals/:id", requireSteamID, async (req, res) => {
    const steam_id = req.steam_id;
    const entryId = req.params.id;
    const { entry, title } = req.body;

    if (!entry) {
      return res.status(400).json({ error: "Entry content is required" });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const [[existing]] = await conn.query(
          `SELECT id FROM journals WHERE id = ? AND steam_id = ?`,
          [entryId, steam_id]
      );
      if (!existing) {
        return res.status(404).json({ error: "Entry not found or access denied" });
      }
      await conn.query(
          `UPDATE journals SET entry = ?, title = ?, edited_at = NOW() WHERE id = ?`,
          [entry, title || "", entryId]
      );

      const [[updatedEntry]] = await conn.query(
          `SELECT id, appid, entry, title AS journal_title, created_at, edited_at
       FROM journals WHERE id = ?`,
          [entryId]
      );

      res.json(updatedEntry);
    } catch (err) {
      console.error("Error updating journal entry:", err);
      res.status(500).json({ error: "Failed to update journal entry" });
    } finally {
      if (conn) conn.release();
    }
  });

  const buildPath = path.resolve(__dirname, '../frontend/build');
  app.use(express.static(buildPath));

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'), (err) => {
      if (err) {
        console.error("Error serving index.html:", err);
        res.status(500).send(err);
      }
    });
  });

  // Start listening
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
    console.log(`Steam login endpoint: ${BASE_URL}/api/auth/steam/login`);
  });

  process.on("SIGINT", async () => {
    console.log("Closing tunnel...");
    await tunnel.close();
    process.exit();
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
