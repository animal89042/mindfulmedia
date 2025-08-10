// database.js
import mysql from "mysql2/promise";

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASS,
  DB_NAME,
  TIDB_ENABLE_SSL,
} = process.env;

const wantTLS =
    String(TIDB_ENABLE_SSL ?? (DB_HOST?.includes("tidbcloud.com") ? "true" : "false"))
        .toLowerCase() === "true";

// 1) Create MySQL pool
export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT || 4000),
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: wantTLS ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
});

/* Run init.sql (with CREATE/ALTER statements) once at startup. */
export async function initSchema(sqlFilePath) {
    const fs = await import("fs");
    const raw = fs.readFileSync(sqlFilePath, "utf8");
    const conn = await pool.getConnection();
    try {
        // optional: ensure utf8mb4
        await conn.query("SET NAMES utf8mb4");
        // split into individual statements and run them one at a time
        const statements = raw
            .split(/;\s*[\r\n]+/g)
            .map(s => s.trim())
            .filter(Boolean);
        for (const stmt of statements) {
            await conn.query(stmt);
        }
    } finally {
        conn.release();
    }
}

/* Ensure a user row exists. */
export async function ensureUser(conn, steamID, displayName) {
  await conn.query(
    ` INSERT IGNORE INTO users (steam_id, display_name)
        VALUES (?, ?)`,
    [steamID, displayName || null]
  );
}

/* Upsert a game record. */
export async function upsertGame(conn, { appid, title, imageUrl, category }) {
  await conn.query(
    ` INSERT INTO games (appid, title, image_url, category)
        VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title     = VALUES(title),
        image_url = VALUES(image_url),
        category  = VALUES(category)`,
    [appid, title, imageUrl, category]
  );
}

/* Link a user to a game. */
export async function linkUserGame(conn, steamID, appid) {
  await conn.query(
    ` INSERT IGNORE INTO user_games (steam_id, appid)
        VALUES (?, ?)`,
    [steamID, appid]
  );
}

/* Get all games for a user. */
export async function getUserGames(pool, steamID) {
  const [rows] = await pool.query(
    ` SELECT
        g.appid,
        g.title,
        g.image_url AS imageUrl,
        g.category
      FROM games g
      JOIN user_games ug ON ug.appid = g.appid
      WHERE ug.steam_id = ?`,
    [steamID]
  );
  return rows;
}

/* Update a user's Steam profile fields. */
export async function upsertUserProfile(
  conn,
  steamID,
  { personaname, avatar, profileurl }
) {
  await conn.query(
    ` UPDATE users
        SET persona_name = ?,
            avatar       = ?,
            profile_url  = ?
      WHERE steam_id = ?`,
    [personaname, avatar, profileurl, steamID]
  );
}
