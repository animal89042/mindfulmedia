import { pool } from '../db/database.js';

export const requireSteamID = (req, res, next) => {
    const steamId =
        req.user?.id ||
        req.session?.passport?.user?.id ||
        null;

    if (!steamId) {
        return res.status(401).json({error: "Not authenticated"});
    }
    req.steam_id = steamId;
    next();
};

export async function requireAdmin(req, res, next) {
    const steam_id = req.steam_id;
    if (!steam_id) return res.status(401).json({error: "Not authenticated"});

    try {
        const [[row]] = await pool.query(
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

        if (!row) return res.status(403).json({error: "No user record"});
        if (row.role !== "admin") {
            return res.status(403).json({error: "Admin only"});
        }
        next();
    } catch (err) {
        console.error("[requireAdmin] error:", err);
        res.status(500).json({error: "Authorization check failed"});
    }
}