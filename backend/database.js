// database.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import {dirname, resolve} from "path";
import {fileURLToPath} from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Always load the backend/.env
dotenv.config({path: resolve(__dirname, ".env")});

const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASS,
    DB_NAME,
    TIDB_ENABLE_SSL,
} = process.env;

// TiDB Cloud usually requires TLS but allows without custom CA.
const tls = String(TIDB_ENABLE_SSL || "").toLowerCase() === "true" ?
    {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
    }
    : null;

export const pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT || 4000),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: tls || undefined,
});

console.log("[DB] host:", DB_HOST, "port:", DB_PORT, "TLS:", TIDB_ENABLE_SSL);

// Run init.sql once on boot
export async function initSchema(initFilePath) {
    const sqlPath = initFilePath || resolve(__dirname, "init.sql");
    if (!fs.existsSync(sqlPath)) {
        console.warn("[initSchema] No init.sql found at", sqlPath);
        return;
    }
    const raw = fs.readFileSync(sqlPath, "utf8");
    const statements = raw
        // naive split on semicolon at end-of-line; keep your statements simple
        .split(/;\s*$/m)
        .map((s) => s.trim())
        .filter(Boolean);
    const conn = await pool.getConnection();
    try {
        for (const stmt of statements) {
            await conn.query(stmt);
        }
    } finally {
        conn.release();
    }
    console.log("[initSchema] Applied", statements.length, "statements");
}

/* =========================
   Legacy helpers (kept)
   ========================= */

/* Ensure a user row exists. */
// 1) Create (or fetch) a user for a Steam account in a way that always satisfies NOT NULL/UNIQUE(username)
export async function ensureUser(conn, steamID, displayName) {
    // If an identity already exists, return that user
    const [idRows] = await conn.query(
        `SELECT ui.user_id AS id
         FROM user_identities ui
         WHERE ui.platform='steam' AND ui.platform_user_id=?
             LIMIT 1`,
        [String(steamID)]
    );
    if (idRows.length) return idRows[0].id;

    // Create a user with a guaranteed-unique username
    const seedUsername = `steam_${String(steamID)}`;
    await conn.query(
        `INSERT IGNORE INTO users (username, role) VALUES (?, 'user')`,
        [seedUsername]
    );

    // Look up the user id (works whether the row was inserted just now or already existed)
    const [uRows] = await conn.query(
        `SELECT id, username FROM users WHERE username=? LIMIT 1`,
        [seedUsername]
    );
    const userId = uRows[0].id;

    // Create the identity row (idempotent)
    await conn.query(
        `INSERT IGNORE INTO user_identities (user_id, platform, platform_user_id)
     VALUES (?, 'steam', ?)`,
        [userId, String(steamID)]
    );

    // Optionally try to rename username to Steam display name if it's free
    const pretty = (displayName || '').trim();
    if (pretty) {
        await conn.query(
            `UPDATE users u
             SET u.username = ?
             WHERE u.id = ?
               AND NOT EXISTS (SELECT 1 FROM users x WHERE x.username = ? AND x.id <> u.id)`,
            [pretty, userId, pretty]
        );
    }

    return userId;
}

// Only update columns that exist in prod: avatar/profile_url (no persona_name)
export async function upsertUserProfile(conn, steamID, { avatar, profileurl }) {
    await conn.query(
        `UPDATE users u
            JOIN user_identities ui
            ON ui.user_id = u.id
         SET u.avatar = ?, u.profile_url = ?
         WHERE ui.platform='steam' AND ui.platform_user_id=?`,
        [avatar ?? null, profileurl ?? null, String(steamID)]
    );
}

/* Link a user to a game. */
export async function linkUserGame(conn, steamID, appid) {
    await conn.query(
        ` INSERT
              IGNORE INTO user_games (steam_id, appid)
          VALUES (?, ?)`,
        [steamID, appid]
    );
}

/* Get all games for a user. */
export async function getUserGames(_pool, steamID) {
    const [rows] = await pool.query(
        `
            SELECT vil.game_id          AS appid,
                   vil.game_name        AS title,
                   vil.icon_url         AS imageUrl,
                   vil.playtime_minutes AS playtime
            FROM v_identity_library vil
                     JOIN user_identities ui
                          ON ui.id = vil.identity_id
            WHERE ui.platform = 'steam'
              AND ui.platform_user_id = ?
            ORDER BY vil.game_name
        `,
        [String(steamID)]
    );
    return rows;
}
/* =========================
   NEW helpers for multi-platform
   ========================= */

// Existing identity?
export async function getOrCreateSteamIdentity(steamID) {
    const conn = await pool.getConnection();
    try {
        const userId = await ensureUser(conn, steamID, null);
        // return the identity id (create if missing)
        const [idRows] = await conn.query(
            `SELECT id FROM user_identities 
        WHERE platform='steam' AND platform_user_id=? LIMIT 1`,
            [String(steamID)]
        );
        return idRows[0]?.id ?? null;
    } finally {
        conn.release();
    }
}

export async function upsertPlatformGameSimple(platform, platformGameId, name, iconUrl) {
    const [r] = await pool.query(
        `INSERT INTO platform_games (platform, platform_game_id, name, icon_url)
         VALUES (?, ?, ?, ?) ON DUPLICATE KEY
        UPDATE name=
        VALUES (name), icon_url=
        VALUES (icon_url), last_seen=NOW()`,
        [platform, String(platformGameId), name || null, iconUrl || null]
    );
    if (r.insertId) return r.insertId;
    const [[row]] = await pool.query(
        `SELECT id
         FROM platform_games
         WHERE platform = ?
           AND platform_game_id = ? LIMIT 1`,
        [platform, String(platformGameId)]
    );
    return row.id;
}

export async function linkLibrary(identityId, platformGameRowId, minutes) {
    await pool.query(
        `INSERT INTO user_game_library (identity_id, platform_game_id, playtime_minutes, last_refreshed)
         VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY
        UPDATE playtime_minutes=
        VALUES (playtime_minutes), last_refreshed=NOW()`,
        [identityId, platformGameRowId, minutes ?? 0]
    );
}