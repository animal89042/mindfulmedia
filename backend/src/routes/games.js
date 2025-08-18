import { Router } from "express";
import { requireIdentity } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";
import {
    getOwnedGames,
    getPlaytimeForApp,
    getUserStatsForGame,
    getGameData,
} from "../platform/SteamAPI.js";
import { cache, maybe304 } from "../cache.js";

const router = Router();

const STAT_TTL = 60_000;     // 1 min fresh
const STAT_SWR = 5 * 60_000; // 5 min serve-stale while revalidating
const statKey = (identity_id, appid, ach) =>
    `stats:${identity_id}:${appid}:ach=${ach ? 1 : 0}`;

/* -------------------------------------------
   GET /api/games  — library list (cached + optional refresh)
--------------------------------------------*/
router.get("/games", requireIdentity, async (req, res) => {
    res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=300");

    const identity_id = req.identity_id;
    const steam_id = req.steam_id;
    const refresh = req.query.refresh === "1";

    const key = `games:${identity_id}:v1`;

    try {
        // If cached body exists and matches client's ETag, 304 immediately
        const hit = cache.get(key);
        if (hit && maybe304(req, res, hit.val)) return;

        const body = await cache.wrap(key, 60_000, 5 * 60_000, async () => {
            // 0) Optionally refresh snapshots from Steam
            if (refresh && steam_id) {
                const owned = await getOwnedGames(steam_id).catch(() => []);
                const list = (owned || []).filter((g) => g?.appid);

                if (list.length > 0) {
                    // Upsert platform_games with latest names/icons
                    const pgValues = list.map((g) => [
                        "steam",
                        String(g.appid),
                        g.name || null,
                        g.icon_url || null,
                    ]);
                    await pool
                        .query(
                            `INSERT INTO platform_games (platform, platform_game_id, name, icon_url)
               VALUES ${pgValues.map(() => "(?, ?, ?, ?)").join(",")}
               ON DUPLICATE KEY UPDATE name=VALUES(name),
                                       icon_url=VALUES(icon_url),
                                       last_seen=NOW()`,
                            pgValues.flat()
                        )
                        .catch(() => { /* tolerate schema differences */ });

                    // Try to load FK ids (schema A)
                    let idByAppid = new Map();
                    try {
                        const appids = [...new Set(list.map((g) => String(g.appid)))];
                        if (appids.length) {
                            const [pgRows] = await pool.query(
                                `SELECT id, platform_game_id
                   FROM platform_games
                  WHERE platform='steam'
                    AND platform_game_id IN (${appids.map(() => "?").join(",")})`,
                                appids
                            );
                            idByAppid = new Map(
                                pgRows.map((r) => [String(r.platform_game_id), r.id])
                            );
                        }
                    } catch {
                        /* ignore */
                    }

                    // Upsert user_game_library using whichever schema works
                    const uglValuesA = list
                        .map((g) => [
                            identity_id,
                            idByAppid.get(String(g.appid)),
                            g.playtime_forever ?? 0,
                        ])
                        .filter((v) => v[1]);

                    if (uglValuesA.length) {
                        // Schema A: FK to platform_games.id
                        await pool
                            .query(
                                `INSERT INTO user_game_library (identity_id, platform_game_id, playtime_minutes, last_refreshed)
                 VALUES ${uglValuesA.map(() => "(?, ?, ?, NOW())").join(",")}
                 ON DUPLICATE KEY UPDATE playtime_minutes=VALUES(playtime_minutes),
                                         last_refreshed=VALUES(last_refreshed)`,
                                uglValuesA.flat()
                            )
                            .catch(() => { /* fall back below */ });
                    } else {
                        // Schema B: no FK; store platform+game_id directly
                        const uglValuesB = list.map((g) => [
                            identity_id,
                            "steam",
                            String(g.appid),
                            g.playtime_forever ?? 0,
                        ]);
                        await pool
                            .query(
                                `INSERT INTO user_game_library (identity_id, platform, game_id, playtime_minutes, last_refreshed)
                 VALUES ${uglValuesB.map(() => "(?, ?, ?, ?, NOW())").join(",")}
                 ON DUPLICATE KEY UPDATE playtime_minutes=VALUES(playtime_minutes),
                                         last_refreshed=VALUES(last_refreshed)`,
                                uglValuesB.flat()
                            )
                            .catch(() => { /* tolerate */ });
                    }
                }
            }

            // 1) Read current snapshot via view (your schema: v.game_name)
            try {
                const [rows] = await pool.query(
                    `SELECT v.game_id AS appid,
                  COALESCE(pg.name, v.game_name) AS title,
                  pg.icon_url                    AS imageUrl,
                  v.playtime_minutes
             FROM v_identity_library v
        LEFT JOIN platform_games pg
               ON pg.platform = v.platform
              AND pg.platform_game_id = v.game_id
            WHERE v.identity_id = ?
              AND v.platform = 'steam'
            ORDER BY title ASC`,
                    [identity_id]
                );

                return rows.map((r) => ({
                    appid: String(r.appid),
                    title: r.title,
                    imageUrl: r.imageUrl,
                    playtimeMinutes: r.playtime_minutes ?? 0,
                    playtimeHours:
                        Math.round(((r.playtime_minutes ?? 0) / 60) * 10) / 10,
                }));
            } catch {
                // 2) Fallback join if view shape differs or doesn't exist
                try {
                    // Schema A: FK join
                    const [rowsA] = await pool.query(
                        `SELECT pg.platform_game_id AS appid,
                    pg.name              AS title,
                    pg.icon_url          AS imageUrl,
                    ugl.playtime_minutes AS playtime_minutes
               FROM user_game_library ugl
               JOIN platform_games pg
                 ON pg.id = ugl.platform_game_id
              WHERE ugl.identity_id = ?
                AND pg.platform = 'steam'
              ORDER BY pg.name ASC`,
                        [identity_id]
                    );
                    if (rowsA?.length) {
                        return rowsA.map((r) => ({
                            appid: String(r.appid),
                            title: r.title,
                            imageUrl: r.imageUrl,
                            playtimeMinutes: r.playtime_minutes ?? 0,
                            playtimeHours:
                                Math.round(((r.playtime_minutes ?? 0) / 60) * 10) / 10,
                        }));
                    }
                } catch {
                    /* keep falling back */
                }

                // Schema B: platform + game_id
                const [rowsB] = await pool.query(
                    `SELECT pg.platform_game_id AS appid,
                  pg.name              AS title,
                  pg.icon_url          AS imageUrl,
                  ugl.playtime_minutes AS playtime_minutes
             FROM user_game_library ugl
        LEFT JOIN platform_games pg
               ON pg.platform = ugl.platform
              AND pg.platform_game_id = ugl.game_id
            WHERE ugl.identity_id = ?
              AND ugl.platform = 'steam'
            ORDER BY title ASC`,
                    [identity_id]
                );

                return rowsB.map((r) => ({
                    appid: String(r.appid),
                    title: r.title,
                    imageUrl: r.imageUrl,
                    playtimeMinutes: r.playtime_minutes ?? 0,
                    playtimeHours:
                        Math.round(((r.playtime_minutes ?? 0) / 60) * 10) / 10,
                }));
            }
        });

        if (maybe304(req, res, body)) return;
        res.json(body);
    } catch (err) {
        console.error("Error in /api/games:", err?.message || err);
        res.status(500).json({ error: "Failed to fetch games" });
    }
});

/* -------------------------------------------
   GET /api/game/:id   — single game details
--------------------------------------------*/
router.get("/game/:id", requireIdentity, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
        "CDN-Cache-Control": "no-store",
    });
    try {
        const game = await getGameData(req.params.id);
        if (!game) return res.status(404).json({ error: "Game not found" });
        res.json(game);
    } catch (err) {
        console.error("Error in /api/game/:id:", err?.message || err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/* -------------------------------------------
   GET /api/game/:appid/stats  — playtime + achievements (cached)
--------------------------------------------*/
router.get("/game/:appid/stats", requireIdentity, async (req, res) => {
    res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=300");

    const identity_id = req.identity_id;
    const steam_id = req.steam_id;
    const appid = String(req.params.appid);
    const fast = req.query.fast === "1";
    const withAch = req.query.achievements !== "0"; // default true

    if (!identity_id || !steam_id)
        return res.status(401).json({ error: "Not logged in" });

    const key = statKey(identity_id, appid, withAch);

    if (fast) {
        const hit = cache.get(key);
        if (hit) return res.json(hit.val);
    }

    try {
        const payload = await cache.wrap(key, STAT_TTL, STAT_SWR, async () => {
            const [rows] = await pool.query(
                `SELECT playtime_minutes
           FROM v_identity_library
          WHERE identity_id = ?
            AND platform = 'steam'
            AND game_id = ?
          LIMIT 1`,
                [identity_id, appid]
            );
            let minutes = Number(rows?.[0]?.playtime_minutes || 0);
            let stats = {};

            const tasks = [getPlaytimeForApp(steam_id, appid).catch(() => 0)];
            if (withAch)
                tasks.push(getUserStatsForGame(steam_id, appid).catch(() => ({})));

            const [liveMinutes, liveStats] = await Promise.all(tasks);
            if (Number(liveMinutes) > 0) minutes = Number(liveMinutes);
            if (withAch && liveStats) stats = liveStats;

            return {
                appid,
                playtimeMinutes: minutes,
                playtimeHours: Math.round((minutes / 60) * 10) / 10,
                stats,
                source:
                    Number(liveMinutes) > (rows?.[0]?.playtime_minutes || 0)
                        ? "steam"
                        : "db",
            };
        });

        res.json(payload);
    } catch (err) {
        console.error("Error in /api/game/:appid/stats:", err?.message || err);
        res.status(503).json({ error: "Failed to fetch game stats" });
    }
});

/* -------------------------------------------
   GET /api/game/stats?appids=…  — batch stats (cached)
--------------------------------------------*/
router.get("/game/stats", requireIdentity, async (req, res) => {
    res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=300");

    const identity_id = req.identity_id;
    const steam_id = req.steam_id;
    const ids = (req.query.appids || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const fast = req.query.fast === "1";

    if (!ids.length) return res.json({});

    const out = {};
    try {
        await Promise.all(
            ids.map(async (a) => {
                const app = String(a);
                const key = statKey(identity_id, app, false);

                if (fast) {
                    const hit = cache.get(key);
                    if (hit) {
                        out[app] = hit.val;
                        return;
                    }
                }

                out[app] = await cache.wrap(key, STAT_TTL, STAT_SWR, async () => {
                    const [rows] = await pool.query(
                        `SELECT playtime_minutes
               FROM v_identity_library
              WHERE identity_id = ?
                AND platform = 'steam'
                AND game_id = ?
              LIMIT 1`,
                        [identity_id, app]
                    );
                    let minutes = Number(rows?.[0]?.playtime_minutes || 0);
                    const live = await getPlaytimeForApp(steam_id, app).catch(() => 0);
                    if (Number(live) > 0) minutes = Number(live);
                    return {
                        appid: app,
                        playtimeMinutes: minutes,
                        playtimeHours: Math.round((minutes / 60) * 10) / 10,
                        stats: {},
                        source:
                            Number(live) > (rows?.[0]?.playtime_minutes || 0) ? "steam" : "db",
                    };
                });
            })
        );

        res.json(out);
    } catch (err) {
        console.error("Error in /api/game/stats (batch):", err?.message || err);
        res.status(503).json({ error: "Failed to fetch batch stats" });
    }
});

export default router;