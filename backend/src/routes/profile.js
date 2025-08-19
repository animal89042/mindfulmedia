// backend/src/routes/profile.js
import {Router} from "express";
import {pool} from "../db/database.js";
import {requireIdentity} from "../middleware/AuthMiddleware.js";

const router = Router();

/* Shape a DB row to the UI's user object */
function shapeUser(u) {
    if (!u) return null;
    return {
        id: u.id,
        username: u.username ?? null,
        displayName: u.displayName ?? u.username ?? null,
        avatar: u.avatar ?? null,
        bio: u.bio ?? null,
        profile_url: u.profile_url ?? null,
    };
}

/* Map Steam OpenID (passport profile id) -> user_id via user_identities */
async function userIdFromSteamId(steamId64) {
    if (!steamId64) return null;
    const [[row]] = await pool.query(
        `SELECT user_id
         FROM user_identities
         WHERE platform = 'steam'
           AND platform_user_id = ?
         LIMIT 1`,
        [steamId64]
    );
    return row?.user_id ?? null;
}

/* Map identity_id (row id in user_identities) -> user_id */
async function userIdFromIdentityId(identityId) {
    if (!identityId) return null;
    const [[row]] = await pool.query(
        `SELECT user_id
         FROM user_identities
         WHERE id = ?
         LIMIT 1`,
        [identityId]
    );
    return row?.user_id ?? null;
}

/* Resolve viewer's user_id from whatever auth put on the request */
async function resolveViewerUserId(req) {
    // If your auth already stored a numeric user id:
    if (typeof req.user?.id === "number") return req.user.id;
    if (req.user_id) return req.user_id;

    // Most common: Steam OpenID stored on req.user.id (string)
    const steamId = req.user?.id || req.session?.passport?.user?.id || null;
    let uid = await userIdFromSteamId(steamId);
    if (uid) return uid;

    // Fallback: identity_id set by requireIdentity middleware
    if (req.identity_id) {
        uid = await userIdFromIdentityId(req.identity_id);
        if (uid) return uid;
    }
    return null;
}

/* Fetch a "user header" by user id; fall back to any identity row if users row is missing */
async function fetchUserShapeByUserId(userId) {
    const [[u]] = await pool.query(
        `SELECT id, username, username AS displayName, avatar, profile_url, NULL AS bio
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId]
    );
    if (u) return shapeUser(u);

    const [[i]] = await pool.query(
        `SELECT ui.user_id AS id,
                NULL       AS username,
                NULL       AS displayName,
                NULL       AS avatar,
                NULL       AS profile_url,
                NULL       AS bio
         FROM user_identities ui
         WHERE ui.user_id = ?
         LIMIT 1`,
        [userId]
    );
    return i ? shapeUser(i) : null;
}

/* Lookup user row by username */
async function findUserByUsername(username) {
    const [[u]] = await pool.query(
        `SELECT id, username, username AS displayName, avatar, profile_url, NULL AS bio
       FROM users
      WHERE username = ?
      LIMIT 1`,
        [username]
    );
    return u || null;
}

/* Build full profile payload */
async function buildProfile(viewerUserId, targetUserId) {
    // identity header
    const user = await fetchUserShapeByUserId(targetUserId);
    if (!user) return null;

    // aggregated stats
    const [[{total_minutes = 0}]] = await pool.query(
        `SELECT COALESCE(SUM(ugl.playtime_minutes), 0) AS total_minutes
         FROM user_game_library ugl
                  JOIN user_identities ui ON ui.id = ugl.identity_id
         WHERE ui.user_id = ?`,
        [targetUserId]
    );

    const [[{journals = 0}]] = await pool.query(
        `SELECT COUNT(*) AS journals
         FROM user_game_journals j
                  JOIN user_identities ui ON ui.id = j.identity_id
         WHERE ui.user_id = ?`,
        [targetUserId]
    );

    const [[{friends = 0}]] = await pool.query(
        `SELECT COUNT(*) AS friends
         FROM friendships
         WHERE status = 'accepted'
           AND (user_a_id = ? OR user_b_id = ?)`,
        [targetUserId, targetUserId]
    );

    // relationship with viewer
    let relationship = "none";
    if (viewerUserId === targetUserId) {
        relationship = "self";
    } else if (viewerUserId) {
        const [rels] = await pool.query(
            `SELECT user_a_id, user_b_id, status, requested_by
         FROM friendships
        WHERE (user_a_id = ? AND user_b_id = ?)
           OR (user_a_id = ? AND user_b_id = ?)
        ORDER BY id DESC
        LIMIT 1`,
            [viewerUserId, targetUserId, targetUserId, viewerUserId]
        );
        if (rels[0]) {
            const r = rels[0];
            if (r.status === "blocked") relationship = "blocked";
            else if (r.status === "accepted") relationship = "accepted";
            else if (r.status === "pending") {
                relationship = r.requested_by === viewerUserId ? "pending_out" : "pending_in";
            }
        }
    }

    // top 3 games by playtime (across all identities for this user)
    const [tg] = await pool.query(
        `SELECT pg.platform_game_id                                    AS appid,
                COALESCE(pg.name, CONCAT('App ', pg.platform_game_id)) AS name,
                SUM(ugl.playtime_minutes)                              AS playtime_minutes
         FROM user_game_library ugl
                  JOIN user_identities ui ON ui.id = ugl.identity_id
                  JOIN platform_games pg ON pg.id = ugl.platform_game_id
         WHERE ui.user_id = ?
         GROUP BY pg.platform_game_id, pg.name
         ORDER BY playtime_minutes DESC
         LIMIT 3`,
        [targetUserId]
    );

    return {
        user,
        stats: {friends, journals, playtimeMinutes: Number(total_minutes)},
        relationship,
        topGames: tg, // [{ appid, name, playtime_minutes }]
    };
}

/* Self profile */
router.get("/profile", requireIdentity, async (req, res) => {
    try {
        const viewerUserId = await resolveViewerUserId(req);
        if (!viewerUserId) return res.status(404).json({error: "Profile not found"});

        const out = await buildProfile(viewerUserId, viewerUserId);
        if (!out) return res.status(404).json({error: "Profile not found"});

        res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=300");
        return res.json(out);
    } catch (err) {
        console.error("[/profile] failed:", err);
        return res.status(500).json({error: "Internal error"});
    }
});

/* Other user's profile by username */
router.get("/users/:username/profile", requireIdentity, async (req, res) => {
    try {
        const viewerUserId = await resolveViewerUserId(req);
        const u = await findUserByUsername(req.params.username);
        if (!u) return res.status(404).json({error: "User not found"});

        const out = await buildProfile(viewerUserId, u.id);
        res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=300");
        return res.json(out);
    } catch (err) {
        console.error("[/users/:username/profile] failed:", err);
        return res.status(500).json({error: "Internal error"});
    }
});

export default router;