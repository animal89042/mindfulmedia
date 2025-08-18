import { Router } from "express";
import { requireIdentity, requireAdmin } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";
import { getPlayerSummary } from "../platform/SteamAPI.js";

const router = Router();

// --- API: Verify Login ---
router.get("/me", requireIdentity, async (req, res) => {
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
        const [[row]] = await pool.query(
            `SELECT u.role
             FROM users u
             JOIN user_identities ui ON ui.user_id = u.id
             WHERE ui.id = ?
             LIMIT 1`,
            [req.identity_id]
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
router.get("/admin/users", requireIdentity, requireAdmin, async (_req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store",
    });

    try {
        // users: username, avatar, profile_url, role
        // user_identities: id (identity id), user_id (FK -> users.id)
        const [rows] = await pool.query(
            `
                SELECT
                    ui.id            AS id,
                    u.username       AS username,
                    u.username       AS display_name,
                    u.role           AS role,
                    u.avatar         AS avatar
                FROM user_identities ui
                         JOIN users u ON u.id = ui.user_id
                ORDER BY u.username ASC
            `
        );

        res.json({
            users: rows.map((r) => ({
                id: r.id,
                username: r.username,
                display_name: r.display_name, // for the sidebar
                role: r.role,
                avatar: r.avatar || null,
            })),
        });
    } catch (err) {
        console.error("Error fetching users for admin:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- API: Player Summary ---
router.get("/playersummary", requireIdentity, async (req, res) => {
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

        const [[userRow]] = await pool.query(
            `SELECT u.username AS persona_name,
                    u.avatar,
                    u.profile_url
            FROM users u
            JOIN user_identities ui ON ui.user_id = u.id
            WHERE ui.id = ?
            `, [req.identity_id]
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

export default router;