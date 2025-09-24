import { Router } from "express";
import { requireIdentity, withCacheHeaders } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";

const router = Router();

const sortPair = (a, b) => (a <= b ? [a, b] : [b, a]);

async function getFriendship(a, b) {
    const [rows] = await pool.query(
        "SELECT * FROM friendships WHERE user_a_id=? AND user_b_id=? LIMIT 1",
        [a, b]
    );
    return rows[0] || null;
}

async function upsertFriendship(a, b, fields) {
    const keys = Object.keys(fields);
    const cols = ["user_a_id", "user_b_id", ...keys];
    const vals = [a, b, ...keys.map((k) => fields[k])];
    await pool.query(
        `INSERT INTO friendships (${cols.join(",")})
     VALUES (${cols.map(() => "?").join(",")})
     ON DUPLICATE KEY UPDATE ${keys.map((k) => `${k}=VALUES(${k})`).join(",")}`,
        vals
    );
}

// Send friend request
router.post("/request/:targetUserId", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);
        const target = Number(req.params.targetUserId);
        if (!target || target === me) return res.status(400).json({ error: "Invalid target user." });

        const [a, b] = sortPair(me, target);
        const existing = await getFriendship(a, b);

        if (existing) {
            if (existing.status === "accepted") return res.status(409).json({ error: "Already friends." });
            if (existing.status === "pending") return res.status(409).json({ error: "Request already pending." });
            if (existing.status === "blocked") return res.status(403).json({ error: "Relationship is blocked." });
            await upsertFriendship(a, b, { status: "pending", requested_by: me, responded_by: null, responded_at: null });
            return res.json({ ok: true, status: "pending", requestId: existing.id });
        }

        await upsertFriendship(a, b, { status: "pending", requested_by: me });
        return res.json({ ok: true, status: "pending" });
    } catch (err) {
        console.error("[friends/request]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});

// Accept request
router.post("/accept/:targetUserId", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);
        const target = Number(req.params.targetUserId);
        const [a, b] = sortPair(me, target);

        const f = await getFriendship(a, b);
        if (!f || f.status !== "pending") return res.status(404).json({ error: "No pending request found." });
        if (f.requested_by === me) return res.status(400).json({ error: "You sent this request; wait for them to accept." });

        await upsertFriendship(a, b, { status: "accepted", responded_by: me, responded_at: new Date() });
        return res.json({ ok: true, status: "accepted" });
    } catch (err) {
        console.error("[friends/accept]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});

// Decline friend request
router.post("/decline/:targetUserId", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);
        const target = Number(req.params.targetUserId);
        const [a, b] = sortPair(me, target);

        const f = await getFriendship(a, b);
        if (!f || f.status !== "pending") return res.status(404).json({ error: "No pending request found." });
        if (f.requested_by === me) return res.status(400).json({ error: "You sent this request; you cannot decline it." });

        await upsertFriendship(a, b, { status: "declined", responded_by: me, responded_at: new Date() });
        return res.json({ ok: true, status: "declined" });
    } catch (err) {
        console.error("[friends/decline]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});

// Delete friend
router.delete("/:targetUserId", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);
        const target = Number(req.params.targetUserId);
        const [a, b] = sortPair(me, target);

        const f = await getFriendship(a, b);
        if (!f) return res.status(404).json({ error: "No relationship found." });

        const canDelete =
            f.status === "accepted" ||
            f.status === "declined" ||
            (f.status === "pending" && f.requested_by === me);

        if (!canDelete) return res.status(403).json({ error: "You cannot cancel this request (you weren’t the requester)." });

        await pool.query("DELETE FROM friendships WHERE id=?", [f.id]);
        return res.json({ ok: true, removed: true });
    } catch (err) {
        console.error("[friends/delete]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});

// Block User
router.post("/block/:targetUserId", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);
        const target = Number(req.params.targetUserId);
        const [a, b] = sortPair(me, target);

        const f = await getFriendship(a, b);
        if (!f) {
            await upsertFriendship(a, b, { status: "blocked", requested_by: me, blocked_by: me, responded_by: null, responded_at: null });
            return res.json({ ok: true, status: "blocked" });
        }
        await upsertFriendship(a, b, { status: "blocked", blocked_by: me, responded_by: null, responded_at: null });
        return res.json({ ok: true, status: "blocked" });
    } catch (err) {
        console.error("[friends/block]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});



// List my friends
router.get("/", requireIdentity, withCacheHeaders(async (req) => {
        const me = Number(req.user_id);
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
        const offset = (page - 1) * pageSize;

        const [friends] = await pool.query(
            `SELECT friend_id
         FROM v_user_friends
        WHERE user_id=?
        ORDER BY friend_id
        LIMIT ? OFFSET ?`,
            [me, pageSize, offset]
        );
        return { ok: true, page, pageSize, friends };
    }, { maxAge: 30, staleWhileRevalidate: 300 })
);

// Incoming/Outgoing requests
router.get("/requests", requireIdentity, withCacheHeaders(async (req) => {
        const me = Number(req.user_id);

        const [incoming] = await pool.query(
            `SELECT CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END AS from_user_id,
                    id,
                    requested_by,
                    requested_at
             FROM friendships
             WHERE status = 'pending'
               AND requested_by <> ?
               AND (user_a_id = ? OR user_b_id = ?)`,
            [me, me, me, me]
        );

        const [outgoing] = await pool.query(
            `SELECT CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END AS to_user_id,
                    id,
                    requested_by,
                    requested_at
             FROM friendships
             WHERE status = 'pending'
               AND requested_by = ?
               AND (user_a_id = ? OR user_b_id = ?)`,
            [me, me, me, me]
        );

        return { ok: true, incoming, outgoing };
    }, { maxAge: 15, staleWhileRevalidate: 120 })
);

// get friends that also own game
router.get(
    "/own/:platform/:gameId",
    requireIdentity,
    withCacheHeaders(async (req) => {
        const viewerUserId = Number(req.user_id);
        const platform = String(req.params.platform || "").toLowerCase();
        const gameId = String(req.params.gameId || "").trim();

        if (!viewerUserId) return { error: "Unauthorized" };
        if (!["steam", "xbox", "playstation", "nintendo"].includes(platform)) return { error: "Invalid platform" };
        if (!gameId) return { error: "Missing game id" };

        const [rows] = await pool.query(
            `WITH my_friends AS (SELECT friend_id
                                 FROM v_user_friends
                                 WHERE user_id = ?)
             SELECT u.id                                 AS friendId,
                    u.username                           AS name,
                    u.avatar                             AS avatarUrl,
                    COALESCE(SUM(v.playtime_minutes), 0) AS playtimeMinutes,
                    MAX(v.last_played_at)                AS lastPlayed
             FROM my_friends mf
                      JOIN users u ON u.id = mf.friend_id
                      JOIN user_identities ui ON ui.user_id = u.id
                      JOIN v_identity_library v
                           ON v.identity_id = ui.id
                               AND v.platform = ?
                               AND v.game_id = ?
             GROUP BY u.id, u.username, u.avatar
             HAVING playtimeMinutes > 0
             ORDER BY playtimeMinutes DESC, name ASC`,
            [viewerUserId, platform, gameId]
        );

        return rows.map((r) => ({
            id: r.friendId,
            name: r.name || "Friend",
            avatarUrl: r.avatarUrl || null,
            playtimeMinutes: Number(r.playtimeMinutes || 0),
            lastPlayed: r.lastPlayed || null,
        }));
    }, { maxAge: 30, staleWhileRevalidate: 300 })
);

export default router;