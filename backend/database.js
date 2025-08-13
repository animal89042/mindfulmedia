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
export async function ensureUser(conn, steamID, displayName) {
    // look for existing user+identity
    const [[row]] = await conn.query(
        `SELECT u.id AS user_id, ui.id AS identity_id
         FROM users u
                  JOIN user_identities ui ON ui.user_id = u.id
         WHERE ui.platform = 'steam'
           AND ui.platform_user_id = ? LIMIT 1`,
        [String(steamID)]
    );

    if (row) {
        if (displayName) {
            await conn.query(
                `UPDATE users
                 SET persona_name = ?
                 WHERE id = ?`,
                [displayName, row.user_id]
            );
        }
        return row; // { user_id, identity_id }
    }

    // create fresh user + identity
    const [userIns] = await conn.query(
        `INSERT INTO users (persona_name, role)
         VALUES (?, 'user')`,
        [displayName || null]
    );
    const userId = userIns.insertId;

    const [idIns] = await conn.query(
        `INSERT INTO user_identities (user_id, platform, platform_user_id)
         VALUES (?, 'steam', ?)`,
        [userId, String(steamID)]
    );

    return {user_id: userId, identity_id: idIns.insertId};
}

/* Upsert a game record. */
export async function upsertGame(conn, {appid, title, imageUrl, category}) {
    await conn.query(
        ` INSERT INTO games (appid, title, image_url, category)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY
        UPDATE
            title =
        VALUES (title), image_url =
        VALUES (image_url), category =
        VALUES (category)`,
        [appid, title, imageUrl, category]
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

/* Update a user's Steam profile fields. */
export async function upsertUserProfile(conn, steamID, {personaname, avatar, profileurl}) {
    await conn.query(
        `UPDATE users u
             JOIN user_identities ui
         ON ui.user_id = u.id
             SET u.persona_name = ?, u.avatar = ?, u.profile_url = ?
         WHERE ui.platform = 'steam'
           AND ui.platform_user_id = ?`,
        [personaname ?? null, avatar ?? null, profileurl ?? null, String(steamID)]
    );
}


/* =========================
   NEW helpers for multi-platform
   ========================= */

// Existing identity?
export async function getOrCreateSteamIdentity(steamID) {
    // 1) If identity exists, return it
    const [exists] = await pool.query(
        `SELECT ui.id AS identity_id
         FROM user_identities ui
         WHERE ui.platform = 'steam'
           AND ui.platform_user_id = ? LIMIT 1`,
        [String(steamID)]
    );
    if (exists.length) return exists[0].identity_id;

    // 2) Otherwise create a user and attach a steam identity
    const [userIns] = await pool.query(
        `INSERT INTO users (role)
         VALUES ('user')`
    );
    const userId = userIns.insertId;

    const [idIns] = await pool.query(
        `INSERT INTO user_identities (user_id, platform, platform_user_id)
         VALUES (?, 'steam', ?)`,
        [userId, String(steamID)]
    );
    return idIns.insertId;
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