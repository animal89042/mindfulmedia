import { pool } from './database.js';

export const requireSteamID = (req, res, next) => {

    const steam_id = req.session?.passport?.user?.id;
    if (!steam_id) {
        return;
    }
    req.steam_id = steam_id;
    next();
};

export async function requireAdmin(req, res, next) {
    const steam_id = req.steam_id;    // ← use the same one you set above
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
        `SELECT role FROM users WHERE steam_id = ?`,
        [steam_id],
    );
    conn.release();

    if (!rows.length || rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Not Admin' });
    }
    next();
}