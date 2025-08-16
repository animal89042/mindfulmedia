import { Router } from "express";
import { requireSteamID } from "../middleware/AuthMiddleware.js";
import { pool, getOrCreateSteamIdentity } from "../db/database.js"
import { getOwnedGames, getUserStatsForGame, getGameData } from "../platform/SteamAPI.js";

const router = Router();

// --- API: User's Owned Games ---
router.get("/games", requireSteamID, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });

    const steam_id = req.steam_id;
    if (!steam_id) return res.status(401).json({error: "Not logged in"});

    const forceRefresh = req.query.refresh === '1';

    try {
        // identity used by the new tables
        const identityId = await getOrCreateSteamIdentity(steam_id);

        // 1) Quick path: read cached rows first
        const [cached] = await pool.query(
            `SELECT game_id          AS appid,
                    game_name        AS title,
                    icon_url         AS imageUrl,
                    playtime_minutes AS playtime
             FROM v_identity_library
             WHERE identity_id = ?
               AND platform = 'steam'
             ORDER BY game_name`,
            [identityId]
        );

        // If we have cache and not forcing refresh, return immediately
        if (!forceRefresh && cached.length > 0) {
            return res.json(cached);
        }

        // 2) Sync from Steam only when empty or forced
        const owned = await getOwnedGames(steam_id); // [{appid, name, icon_url, playtime_forever}, ...]
        const list = (owned || []).filter(g => g?.appid);

        if (list.length > 0) {
            // 2a) Bulk upsert platform_games
            // Build value tuples
            const pgValues = list.map(g => ['steam', String(g.appid), g.name || null, g.icon_url || null]);
            await pool.query(
                `INSERT INTO platform_games (platform, platform_game_id, name, icon_url)
                 VALUES ${pgValues.map(() => "(?, ?, ?, ?)").join(",")}
                 ON DUPLICATE KEY UPDATE name      = VALUES(name),
                                         icon_url  = VALUES(icon_url),
                                         last_seen = NOW()`,
                pgValues.flat()
            );

            // 2b) Map appid -> platform_games.id
            const appids = [...new Set(list.map(g => String(g.appid)))];
            const [pgRows] = await pool.query(
                `SELECT id, platform_game_id
                 FROM platform_games
                 WHERE platform = 'steam'
                   AND platform_game_id IN (${appids.map(() => "?").join(",")})`,
                appids
            );
            const idByAppid = new Map(pgRows.map(r => [String(r.platform_game_id), r.id]));

            // 2c) Bulk upsert user_game_library
            const uglValues = list.map(g => [identityId, idByAppid.get(String(g.appid)), g.playtime_forever ?? 0]);
            const filtered = uglValues.filter(v => v[1]); // keep only rows with a mapped platform_game_id
            if (filtered.length) {
                await pool.query(
                    `INSERT INTO user_game_library (identity_id, platform_game_id, playtime_minutes, last_refreshed)
                     VALUES ${filtered.map(() => "(?, ?, ?, NOW())").join(",")}
                     ON DUPLICATE KEY UPDATE playtime_minutes = VALUES(playtime_minutes),
                                             last_refreshed   = VALUES(last_refreshed)`,
                    filtered.flat()
                );
            }
        }

        // 3) Return fresh rows
        const [rows] = await pool.query(
            `SELECT game_id          AS appid,
                    game_name        AS title,
                    icon_url         AS imageUrl,
                    playtime_minutes AS playtime
             FROM v_identity_library
             WHERE identity_id = ?
               AND platform = 'steam'
             ORDER BY game_name`,
            [identityId]
        );

        res.json(rows);
    } catch (err) {
        console.error("/api/games error:", err?.message, err);
        res.status(500).json({error: "Failed to fetch/sync games", details: err?.message});
    }
});

// --- API: Single Game Details ---
router.get("/game/:id", requireSteamID, async (req, res) => {
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
router.get("/game/:appid/stats", requireSteamID, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });

    const steam_id = req.steam_id;
    const appid = String(req.params.appid);

    try {
        // 1) Try DB first (fast)
        const [rows] = await pool.query(
            `SELECT ugl.playtime_minutes AS minutes
             FROM user_game_library ugl
                      JOIN platform_games pg ON pg.id = ugl.platform_game_id
             WHERE ugl.identity_id = (SELECT id
                                      FROM user_identities
                                      WHERE platform = 'steam'
                                        AND platform_user_id = ?
                                      LIMIT 1)
               AND pg.platform = 'steam'
               AND pg.platform_game_id = ?
             LIMIT 1`,
            [steam_id, appid]
        );

        let minutes = rows?.[0]?.minutes ?? null;

        // 2) Fallback to Steam if DB has no row
        if (minutes == null) {
            const owned = await getOwnedGames(steam_id); // [{appid, playtime_forever, name, ...}]
            const game = owned?.find(g => String(g.appid) === appid);
            if (game) minutes = game.playtime_forever ?? 0;
            else minutes = 0; // don’t 404; let UI show 0
        }

        // 3) Optional: achievements/extra stats
        let extraStats = {};
        try {
            const fetched = await getUserStatsForGame(steam_id, appid);
            if (fetched) extraStats = fetched;
        } catch (e) {
            // swallow; achievements are optional
        }

        return res.json({
            appid,
            playtimeMinutes: minutes,
            playtimeHours: Math.floor(minutes / 60),
            stats: extraStats
        });
    } catch (err) {
        console.error("Error in /api/game/:appid/stats:", err?.message || err);
        return res.status(503).json({ok: false, error: "Failed to fetch game stats"});
    }
});

export default router;