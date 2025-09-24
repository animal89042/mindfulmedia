import { Router } from "express";
import { requireIdentity, requireAdmin } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";
import { getPlayerSummary } from "../platform/SteamAPI.js";

const router = Router();

async function upsertUserProfile(steamId, fresh) {
    // Map identity -> user_id
    const [[ui]] = await pool.query(
        `SELECT user_id FROM user_identities WHERE platform='steam' AND platform_user_id=? LIMIT 1`,
        [String(steamId)]
    );
    const userId = ui?.user_id;
    if (!userId) return;

    // Upsert minimal profile fields
    await pool.query(
        `UPDATE users
         SET avatar      = COALESCE(?, avatar),
             profile_url = COALESCE(?, profile_url),
             updated_at  = NOW()
         WHERE id = ?`,
        [fresh?.avatar || null, fresh?.profileurl || null, userId]
    );
}

// Help ensure username does not already exist
function sanitizeCandidate(s) {
    return String(s)
        .trim()
        .replace(/\s+/g, "_")       // spaces -> underscore
        .replace(/[^a-zA-Z0-9_]/g, "") // only letters, numbers, underscore
        .slice(0, 20);
}

function isValidUsername(s) {
    return /^[A-Za-z0-9_]{3,20}$/.test(s);
}

// --- API: Verify Login ---
router.get("/me", requireIdentity, async (req, res) => {
    res.set({ "Cache-Control": "no-store", "Pragma": "no-cache", "Expires": "0", "CDN-Cache-Control": "no-store" });

    try {
        const identityId = req.identity_id;
        const steamId = String(req.steam_id);

        // app user record
        const [[userRow]] = await pool.query(
            `SELECT u.id, u.username, u.avatar, u.profile_url, u.role
             FROM users u
                      JOIN user_identities ui ON ui.user_id = u.id
             WHERE ui.id = ?
             LIMIT 1`,
            [identityId]
        );

        // platform persona (what they signed in with)
        const [[idRow]] = await pool.query(
            `SELECT gamertag AS platform_username
             FROM user_identities
             WHERE id = ?
             LIMIT 1`,
            [identityId]
        );

        const platformName = idRow?.platform_username || null;
        const username = userRow?.username || null;

        const needs_username = !username || username.trim().length < 3;

        res.json({
            steam_id: steamId,
            username,
            role: userRow?.role || "user",
            avatar: userRow?.avatar || null,
            profileUrl: userRow?.profile_url || null,
            platformName,
            needs_username,
        });
    } catch (err) {
        console.error("Could not fetch user profile:", err);
        res.status(500).json({ error: "Unable to fetch user" });
    }
});

// Ensure unique username
router.post("/me/username", requireIdentity, async (req, res) => {
    res.set({ "Cache-Control": "no-store", "Pragma": "no-cache", "Expires": "0", "CDN-Cache-Control": "no-store" });

    try {
        const userId = Number(req.user_id);
        const identityId = Number(req.identity_id);
        const choice = String(req.body.choice || "custom"); // 'platform' | 'custom'
        let desired = String(req.body.username || "");

        if (choice === "platform") {
            const [[idRow]] = await pool.query(
                `SELECT gamertag AS platform_username
                 FROM user_identities
                 WHERE id = ?
                 LIMIT 1`,
                [identityId]
            );
            if (!idRow?.platform_username)
                return res.status(400).json({ error: "No platform name available" });
            desired = idRow.platform_username;
        }

        desired = sanitizeCandidate(desired);
        if (!isValidUsername(desired)) {
            return res.status(400).json({ error: "Usernames must be 3–20 chars (letters, numbers, underscore)" });
        }

        // uniqueness check (case-insensitive)
        const [[exists]] = await pool.query(
            `SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1`,
            [desired, userId]
        );
        if (exists) {
            // small convenience: try appending a number if platform choice collides
            if (choice === "platform") {
                for (let n = 2; n <= 9999; n++) {
                    const candidate = sanitizeCandidate(`${ desired }${n}`);
                    const [[dupe]] = await pool.query(
                        `SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1`,
                        [candidate, userId]
                    );
                    if (!dupe) {
                        desired = candidate;
                        break;
                    }
                }
            } else {
                return res.status(409).json({ error: "Username already taken" });
            }
        }

        await pool.query(`UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?`, [desired, userId]);

        res.json({ ok: true, username: desired });
    } catch (err) {
        console.error("Username update failed:", err);
        res.status(500).json({ error: "Failed to set username" });
    }
});

/* Fetch users for admins */
router.get("/admin/users", requireIdentity, requireAdmin, async (_req, res) => {
    res.set({ "Cache-Control": "no-store", "Pragma": "no-cache", "Expires": "0", "CDN-Cache-Control": "no-store" });

    try {
        const [rows] = await pool.query(
            `SELECT
                 ui.id                                         AS id,
                 u.username                                    AS username,
                 COALESCE(NULLIF(ui.gamertag,''), NULLIF(u.username,'')) AS display_name,
                 ui.gamertag                                   AS personaname,
                 u.role                                        AS role,
                 COALESCE(u.avatar, ui.avatar_url)             AS avatar
             FROM user_identities ui
                      JOIN users u ON u.id = ui.user_id
             ORDER BY display_name ASC, username ASC`
        );

        res.json({
            users: rows.map(r => ({
                id: r.id,
                username: r.username || null,
                display_name: r.display_name || null,   // what AdminSidebar prefers
                personaname: r.personaname || null,     // extra fallback the component also checks
                personaName: r.personaname || null,     // casing variant
                role: r.role,
                avatar: r.avatar || null,
            })),
        });
    } catch (err) {
        console.error("Error fetching users for admin:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;