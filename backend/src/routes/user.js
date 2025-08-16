import { Router } from "express";
import { requireSteamID, requireAdmin } from "../middleware/AuthMiddleware.js";
import { pool, upsertUserProfile } from "../db/database.js";
import { getPlayerSummary } from "../platform/SteamAPI.js";

const router = Router();

// --- API: Verify Login ---
router.get("/me", requireSteamID, async (req, res) => {
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
        const [[row]] = await conn.query(
            `
                    SELECT u.role
                    FROM users u
                             JOIN user_identities ui ON ui.user_id = u.id
                    WHERE ui.platform = 'steam'
                      AND ui.platform_user_id = ?
                    LIMIT 1
                `,
            [steam_id]
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
router.get("/admin/users", requireSteamID, requireAdmin, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    try {
        const [rows] = await pool.query(
            `
                    SELECT ui.platform_user_id AS id,
                           u.username          AS name,
                           u.role
                    FROM users u
                             JOIN user_identities ui ON ui.user_id = u.id
                    WHERE ui.platform = 'steam'
                `
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching users for admin:", err);
        res.status(500).json({error: "Internal server error"});
    }
});

// --- API: Player Summary ---
router.get("/playersummary", requireSteamID, async (req, res) => {
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

        const [[userRow]] = await conn.query(
            `
                    SELECT u.username AS persona_name,
                           u.avatar,
                           u.profile_url
                    FROM users u
                             JOIN user_identities ui ON ui.user_id = u.id
                    WHERE ui.platform = 'steam'
                      AND ui.platform_user_id = ?
                `,
            [steam_id]
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