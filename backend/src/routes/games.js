import { Router } from "express";
import { requireIdentity, withCacheHeaders } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";
import {
    getOwnedGames,
    getGameData,
    getPlaytimeForApp,
    getUserStatsForGame,
    getAchievementsBundle,
    detectPrivacy,
} from "../platform/SteamAPI.js";

import { cache } from "../cache.js";

const router = Router();

const STAT_TTL = 60_000;     // 1 min fresh
const STAT_SWR = 5 * 60_000; // 5 min serve-stale while revalidating
const statKey = (identity_id, appid, ach) =>
    `stats:${ identity_id }:${ appid }:ach=${ach ? 1 : 0}`;

const minutesToHours = (m) => Math.round(((Number(m) || 0) / 60) * 10) / 10;

/* GET /api/games — library list */
router.get(
    "/games",
    requireIdentity,
    withCacheHeaders(async (req) => {
        const identity_id = Number(req.identity_id);
        const steam_id = String(req.steam_id);
        const refresh = req.query.refresh === "1";

        // optional: refresh snapshot from Steam, then read via view
        if (refresh) {
            const owned = await getOwnedGames(steam_id).catch(() => []);
            if (owned?.length) {
                // Upsert platform_games (tolerate schema differences)
                const rows = owned.filter(g => g?.appid);
                if (rows.length) {
                    const vals = rows.map(g => ["steam", String(g.appid), g.name || null, g.icon_url || null]);
                    try {
                        await pool.query(
                            `INSERT INTO platform_games (platform, platform_game_id, name, icon_url)
                             VALUES ${vals.map(() => "(?, ?, ?, ?)").join(",")}
                             ON DUPLICATE KEY UPDATE name=VALUES(name),
                                                     icon_url=VALUES(icon_url),
                                                     last_seen=NOW()`,
                            vals.flat()
                        );
                    } catch { /* ignore */ }

                    // Upsert user_game_library (schema A or B)
                    try {
                        const appids = rows.map(g => String(g.appid));
                        const [pg] = await pool.query(
                            `SELECT id, platform_game_id
                             FROM platform_games
                             WHERE platform = 'steam'
                               AND platform_game_id IN (${appids.map(() => "?").join(",")})`,
                            appids
                        );
                        const idBy = new Map(pg.map(r => [String(r.platform_game_id), r.id]));
                        const uglA = rows
                            .map(g => [identity_id, idBy.get(String(g.appid)), g.playtime_forever ?? 0])
                            .filter(v => v[1]);
                        if (uglA.length) {
                            await pool.query(
                                `INSERT INTO user_game_library (identity_id, platform_game_id, playtime_minutes, last_refreshed)
                                 VALUES ${uglA.map(() => "(?, ?, ?, NOW())").join(",")}
                                 ON DUPLICATE KEY UPDATE playtime_minutes=VALUES(playtime_minutes),
                                                         last_refreshed=VALUES(last_refreshed)`,
                                uglA.flat()
                            );
                        } else {
                            const uglB = rows.map(g => [identity_id, "steam", String(g.appid), g.playtime_forever ?? 0]);
                            await pool.query(
                                `INSERT INTO user_game_library (identity_id, platform, game_id, playtime_minutes, last_refreshed)
                                 VALUES ${uglB.map(() => "(?, ?, ?, ?, NOW())").join(",")}
                                 ON DUPLICATE KEY UPDATE playtime_minutes=VALUES(playtime_minutes),
                                                         last_refreshed=VALUES(last_refreshed)`,
                                uglB.flat()
                            );
                        }
                    } catch { /* ignore */ }
                }
            }
        }

        // read via view (preferred)
        try {
            const [rows] = await pool.query(
                `SELECT v.game_id                      AS appid,
                        COALESCE(pg.name, v.game_name) AS title,
                        pg.icon_url                    AS imageUrl,
                        v.playtime_minutes
                 FROM v_identity_library v
                          LEFT JOIN platform_games pg
                                    ON pg.platform = v.platform AND pg.platform_game_id = v.game_id
                 WHERE v.identity_id = ?
                   AND v.platform = 'steam'
                 ORDER BY title ASC`,
                [identity_id]
            );
            return rows.map(r => ({
                appid: String(r.appid),
                title: r.title,
                imageUrl: r.imageUrl,
                playtimeMinutes: r.playtime_minutes ?? 0,
                playtimeHours: minutesToHours(r.playtime_minutes ?? 0),
            }));
        } catch {
            // fallback (schema B)
            const [rowsB] = await pool.query(
                `SELECT pg.platform_game_id AS appid,
                        pg.name             AS title,
                        pg.icon_url         AS imageUrl,
                        ugl.playtime_minutes
                 FROM user_game_library ugl
                          LEFT JOIN platform_games pg
                                    ON pg.platform = ugl.platform AND pg.platform_game_id = ugl.game_id
                 WHERE ugl.identity_id = ?
                   AND ugl.platform = 'steam'
                 ORDER BY title ASC`,
                [identity_id]
            );
            return rowsB.map(r => ({
                appid: String(r.appid),
                title: r.title,
                imageUrl: r.imageUrl,
                playtimeMinutes: r.playtime_minutes ?? 0,
                playtimeHours: minutesToHours(r.playtime_minutes ?? 0),
            }));
        }
    }, { maxAge: 120, staleWhileRevalidate: 30 })
);

/* GET /api/game/:id — store details */
router.get(
    "/game/:id",
    requireIdentity,
    withCacheHeaders(async (req) => {
        const appid = req.params.id;
        const data = await getGameData(appid);
        if (!data) return { error: "Game not found" };
        return data;
    }, { maxAge: 600, staleWhileRevalidate: 120 })
);

// Fetch stat for one game
async function fetchPlaytimeOne({ identity_id, steam_id, appid, withAch = false }) {
    let base = 0;
    try {
        const [rows] = await pool.query(
            `SELECT playtime_minutes
             FROM v_identity_library
             WHERE identity_id = ?
               AND platform = 'steam'
               AND game_id = ?
             LIMIT 1`,
            [identity_id, appid]
        );
        base = Number(rows?.[0]?.playtime_minutes || 0);
    } catch {
        const [rowsB] = await pool.query(
            `SELECT playtime_minutes
             FROM user_game_library
             WHERE identity_id = ?
               AND platform = 'steam'
               AND game_id = ?
             LIMIT 1`,
            [identity_id, appid]
        );
        base = Number(rowsB?.[0]?.playtime_minutes || 0);
    }

    let live = 0;
    let stats = {};
    const tasks = [getPlaytimeForApp(steam_id, appid).catch(() => 0)];
    if (withAch) tasks.push(getUserStatsForGame(steam_id, appid).catch(() => ({})));

    const [liveMinutes, achStats] = await Promise.all(tasks);
    live = Number(liveMinutes || 0);
    if (withAch) stats = achStats || {};

    const minutes = live > 0 ? live : base;
    return {
        appid: String(appid),
        playtimeMinutes: minutes,
        playtimeHours: minutesToHours(minutes),
        stats: withAch ? stats : {},
        source: live > base ? "steam" : "db",
    };
}

/* GET /api/game/:appid/stats — single app */
router.get("/game/:appid/stats", requireIdentity, async (req, res) => {
    const fresh = "refresh" in req.query;
    if (fresh) res.set("Cache-Control", "no-store");

    const identity_id = req.identity_id;
    const steam_id = req.steam_id;
    const appid = String(req.params.appid);
    const probe = true;

    // 1) Privacy check (profile + per-game visibility)
    const vis = await detectPrivacy(steam_id, Number(appid), { probe, scope: "stats" })
        .catch(() => ({ restricted: true, reason: "privacy:unknown_error" }));

    // Always surface reason for easy debugging
    res.set("X-Privacy-Reason", vis.reason || "unknown");
    res.set("X-Checked-At", new Date().toISOString());
    res.set("X-Privacy-Checked-By", "detectPrivacy+isGameVisible");

    // 2) If restricted, hard-block minutes
    if (vis.restricted) {
        return res.json({
                appid,
                playtimeMinutes: 0,
                playtimeHours: 0,
                stats: {},
                source: "blocked",
                privacy: "restricted",
                privacyBlocked: true,
                reason: vis.reason,
                checkedAt: new Date().toISOString(),
        });
    }

    // 3) Public: read LIVE only (no DB). Keep your normal TTL/SWR caching.
    const force = req.query.refresh === "1"; // bypass SWR if forced refresh
    const key =
        statKey(identity_id, appid, true) +
        `:privacy=public` +                 // vis.restricted is false here
        (force ? ":f" : "");

    try {
        const payload = await cache.wrap(key, STAT_TTL, STAT_SWR, async () => {
            const live = await getPlaytimeForApp(steam_id, appid).catch(() => 0);
            const minutes = Number(live || 0);  // strictly live minutes

            return {
                appid,
                playtimeMinutes: minutes,
                playtimeHours: Math.round((minutes / 60) * 10) / 10,
                stats: {},
                source: "steam",
                privacy: "public",
                privacyBlocked: false,
                reason: vis.reason,
                checkedAt: new Date().toISOString(),
            };
        });

        return res.json(payload);
    } catch (err) {
        console.error("stats error", err?.message || err);
        return res.status(503).json({ error: "Failed to fetch game stats" });
    }
});

/* GET /api/game/:appid/achievements */
router.get("/game/:appid/achievements", requireIdentity, async (req, res) => {
    const fresh = "refresh" in req.query;
    if (fresh) res.set("Cache-Control", "no-store");

    const steam_id = req.steam_id;
    const appid = String(req.params.appid || "").trim();
    const probe = true;

    // 1) Privacy check (profile + per-game visibility)
    const vis = await detectPrivacy(steam_id, Number(appid), { probe, scope: "achievements" })
        .catch(() => ({ restricted: true, reason: "privacy:unknown_error" }));

    // Always set header for quick DevTools debugging
    res.set("X-Privacy-Reason", vis.reason || "unknown");
    res.set("X-Checked-At", new Date().toISOString());
    res.set("X-Privacy-Checked-By", "detectPrivacy+isGameVisible");

    // 2) If restricted, hard-block: do NOT fetch or return any cached achievements
    if (vis.restricted) {
        return res.json({
            appid,
            totals: { unlocked: 0, total: 0 },
            achievements: [],
            source: "blocked",
            privacy: "restricted",
            privacyBlocked: true,
            reason: vis.reason,
            checkedAt: new Date().toISOString(),
        });
    }

    // 3) Public: fetch live/bundled data; keep your normal TTL/SWR caching
    const force = req.query.refresh === "1";
    const key = `ach:${steam_id}:${appid}` + (force ? ":f" : "");

    try {
        const bundle = await cache.wrap(key, 60_000, 5 * 60_000, async () => {
            const b = await getAchievementsBundle(steam_id, appid).catch(() => null);
            // Ensure a safe empty structure if Steam fails transiently
            return b || { appid, totals: { unlocked: 0, total: 0 }, achievements: [] };
        });

        return res.json({
            ...bundle,
            privacy: "public",
            privacyBlocked: false,
            source: "steam",          // explicitly mark as live/platform-sourced
            reason: vis.reason,
            checkedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("achievements error", err?.message || err);
        return res.status(503).json({ error: "Failed to fetch achievements" });
    }
});

export default router;