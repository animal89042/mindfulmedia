import { Router } from "express";
import { pool } from "../db/database.js";
import { requireIdentity, withCacheHeaders } from "../middleware/AuthMiddleware.js";

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

/* Fetch a compact user header */
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
    const user = await fetchUserShapeByUserId(targetUserId);
    if (!user) return null;

    const [[{ total_minutes = 0 }]] = await pool.query(
        `SELECT COALESCE(SUM(ugl.playtime_minutes), 0) AS total_minutes
         FROM user_game_library ugl
                  JOIN user_identities ui ON ui.id = ugl.identity_id
         WHERE ui.user_id = ?`,
        [targetUserId]
    );

    const [[{ journals = 0 }]] = await pool.query(
        `SELECT COUNT(*) AS journals
         FROM user_game_journals j
                  JOIN user_identities ui ON ui.id = j.identity_id
         WHERE ui.user_id = ?`,
        [targetUserId]
    );

    const [[{ friends = 0 }]] = await pool.query(
        `SELECT COUNT(*) AS friends
         FROM friendships
         WHERE status = 'accepted'
           AND (user_a_id = ? OR user_b_id = ?)`,
        [targetUserId, targetUserId]
    );

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
        stats: { friends, journals, playtimeMinutes: Number(total_minutes) },
        relationship,
        topGames: tg,
    };
}

/* Self profile */
router.get("/profile", requireIdentity, withCacheHeaders(async (req) => {
        const viewerUserId = Number(req.user_id); // provided by requireIdentity
        const out = await buildProfile(viewerUserId, viewerUserId);
        return out || { error: "Profile not found" };
    }, { maxAge: 30, staleWhileRevalidate: 300 })
);

/* Other user's profile by username */
router.get("/users/:username/profile", requireIdentity, withCacheHeaders(async (req) => {
        const viewerUserId = Number(req.user_id);
        const u = await findUserByUsername(req.params.username);
        if (!u) return { error: "User not found" };
        return await buildProfile(viewerUserId, u.id);
    }, { maxAge: 30, staleWhileRevalidate: 300 })
);

export default router;