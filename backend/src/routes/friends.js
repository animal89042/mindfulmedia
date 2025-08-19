import { Router } from "express";
import { requireIdentity } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";

const router = Router();

// Utility to sort a pair so (min,max) is consistent
const sortPair = (a, b) => (a <= b ? [a, b] : [b, a]);

// Send friend request
router.post("/request/:targetUserId", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);
        const target = Number(req.params.targetUserId);

        if (!target || target === me) {
            return res.status(400).json({ error: "Invalid target user." });
        }

        const [a, b] = sortPair(me, target);

        // Check existing relationship
        const [rows] = await pool.query(
            "SELECT * FROM friendships WHERE user_a_id=? AND user_b_id=?",
            [a, b]
        );

        if (rows.length) {
            const f = rows[0];
            if (f.status === "accepted") {
                return res.status(409).json({ error: "Already friends." });
            }
            if (f.status === "pending") {
                return res.status(409).json({ error: "Request already pending." });
            }
            if (f.status === "blocked") {
                return res.status(403).json({ error: "Relationship is blocked." });
            }
            // If declined, allow re-request by updating the row
            await pool.query(
                `UPDATE friendships
         SET status='pending', requested_by=?, responded_by=NULL, responded_at=NULL
         WHERE id=?`,
                [me, f.id]
            );
            return res.json({ ok: true, status: "pending", requestId: f.id });
        }

        // Insert new pending relationship
        const [result] = await pool.query(
            `INSERT INTO friendships
       (user_a_id, user_b_id, status, requested_by)
       VALUES (?,?, 'pending', ?)`,
            [a, b, me]
        );

        return res.json({ ok: true, status: "pending", requestId: result.insertId });
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

        // Only accept if there's a pending where requested_by = target
        const [rows] = await pool.query(
            `SELECT * FROM friendships
       WHERE user_a_id=? AND user_b_id=? AND status='pending'`,
            [a, b]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "No pending request found." });
        }

        const f = rows[0];
        if (f.requested_by === me) {
            return res.status(400).json({ error: "You sent this request; wait for them to accept." });
        }

        await pool.query(
            `UPDATE friendships
       SET status='accepted', responded_by=?, responded_at=CURRENT_TIMESTAMP
       WHERE id=?`,
            [me, f.id]
        );

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

        const [rows] = await pool.query(
            `SELECT * FROM friendships
       WHERE user_a_id=? AND user_b_id=? AND status='pending'`,
            [a, b]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "No pending request found." });
        }

        const f = rows[0];
        if (f.requested_by === me) {
            return res.status(400).json({ error: "You sent this request; you cannot decline it." });
        }

        await pool.query(
            `UPDATE friendships
       SET status='declined', responded_by=?, responded_at=CURRENT_TIMESTAMP
       WHERE id=?`,
            [me, f.id]
        );

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

        const [rows] = await pool.query(
            "SELECT * FROM friendships WHERE user_a_id=? AND user_b_id=?",
            [a, b]
        );
        if (!rows.length) {
            return res.status(404).json({ error: "No relationship found." });
        }

        const f = rows[0];

        // Allow delete if accepted OR (pending & I am the requester) OR declined
        const canDelete =
            f.status === "accepted" ||
            f.status === "declined" ||
            (f.status === "pending" && f.requested_by === me);

        if (!canDelete) {
            return res
                .status(403)
                .json({ error: "You cannot cancel this request (you weren’t the requester)." });
        }

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

        const [rows] = await pool.query(
            "SELECT * FROM friendships WHERE user_a_id=? AND user_b_id=?",
            [a, b]
        );

        if (!rows.length) {
            const [result] = await pool.query(
                `INSERT INTO friendships
         (user_a_id,user_b_id,status,requested_by,blocked_by)
         VALUES (?,?, 'blocked', ?, ?)`,
                [a, b, me, me]
            );
            return res.json({ ok: true, status: "blocked", id: result.insertId });
        } else {
            await pool.query(
                `UPDATE friendships
         SET status='blocked', blocked_by=?, responded_by=NULL, responded_at=NULL
         WHERE id=?`,
                [me, rows[0].id]
            );
            return res.json({ ok: true, status: "blocked" });
        }
    } catch (err) {
        console.error("[friends/block]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});



// List my friends
router.get("/", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
        const offset = (page - 1) * pageSize;

        // Use the view for simplicity
        const [friends] = await pool.query(
            `SELECT friend_id
       FROM v_user_friends
       WHERE user_id=?
       ORDER BY friend_id
       LIMIT ? OFFSET ?`,
            [me, pageSize, offset]
        );

        // If you want richer friend profiles, join to your users table here.
        return res.json({ ok: true, page, pageSize, friends });
    } catch (err) {
        console.error("[friends/list]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});

// Pending requests
router.get("/requests", requireIdentity, async (req, res) => {
    try {
        const me = Number(req.user_id);

        const [incoming] = await pool.query(
            `SELECT
         CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END AS from_user_id,
         id, requested_by, requested_at
       FROM friendships
       WHERE status='pending' AND requested_by <> ?
         AND (user_a_id=? OR user_b_id=?)`,
            [me, me, me, me]
        );

        const [outgoing] = await pool.query(
            `SELECT
         CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END AS to_user_id,
         id, requested_by, requested_at
       FROM friendships
       WHERE status='pending' AND requested_by = ?
         AND (user_a_id=? OR user_b_id=?)`,
            [me, me, me, me]
        );

        return res.json({ ok: true, incoming, outgoing });
    } catch (err) {
        console.error("[friends/requests]", err);
        return res.status(500).json({ error: "Internal error." });
    }
});

export default router;