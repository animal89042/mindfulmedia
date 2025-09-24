import { Router } from "express";
import { pool } from "../db/database.js";

const router = Router();

/* ----- Top total playtime leaderboard ----- */
router.get("/top-time", async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50); // clamp 1..50
        const [rows] = await pool.query(
            `SELECT u.username,
                    COALESCE(SUM(ugl.playtime_minutes), 0) AS total_minutes
             FROM users AS u
                      JOIN user_identities AS ui
                           ON ui.user_id = u.id
                      JOIN user_game_library AS ugl
                           ON ugl.identity_id = ui.id
             GROUP BY u.id, u.username
             ORDER BY total_minutes DESC
             LIMIT ?
            `, [limit]
        );

        const result = rows.map((r) => ({
            username: r.username || "Unknown",
            totalMinutes: Number(r.total_minutes) || 0,
        }));

        res.set("Cache-Control", "public, max-age=60"); // tiny cache
        res.json({ ok: true, data: result });
    } catch (err) {
        console.error("leaderboard /top-time error", err);
        res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
});

export default router;