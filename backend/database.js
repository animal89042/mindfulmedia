import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

export async function initSchema(config, initFilePath) {
  // connect without specifying database name
  const connection = await mysql.createConnection({
    ...config,
    multipleStatements: true,
  });
  const ddl = fs.readFileSync(path.resolve(initFilePath), "utf8");
  await connection.query(ddl);
  await connection.end();
  console.log("Database schema initialized");
}

/* Ensure a user row exists */
export async function ensureUser(conn, steamID, displayName = null) {
  await conn.query(
    `INSERT IGNORE INTO users (steam_id, display_name) VALUES (?, ?)`,
    [steamID, displayName]
  );
}

/* Upsert a game metadata row */
export async function upsertGame(conn, { appid, title, imageUrl, category }) {
  await conn.query(
    `INSERT INTO games (appid, title, image_url, category)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       image_url = VALUES(image_url),
       category = VALUES(category)`,
    [appid, title, imageUrl, category]
  );
}

/* Link a user and a game */
export async function linkUserGame(conn, steamID, appid) {
  await conn.query(
    `INSERT IGNORE INTO user_games (steam_id, appid) VALUES (?, ?)`,
    [steamID, appid]
  );
}

/* Fetch all games saved for a given user */
export async function getUserGames(pool, steamID) {
  const [rows] = await pool.query(
    `SELECT g.appid, g.title, g.image_url AS imageUrl, g.category
       FROM games g
       JOIN user_games ug ON ug.appid = g.appid
      WHERE ug.steam_id = ?`,
    [steamID]
  );
  return rows;
}

/* Retrieve a game record by appid, if it exists. */
export async function getGameRecord(conn, appid) {
  const [[row]] = await conn.query(
    `SELECT appid, title, image_url, category
       FROM games
      WHERE appid = ?`,
    [appid]
  );
  return row || null;
}

/* Update metadata fields for an existing game. */
export async function updateGame(conn, { appid, title, imageUrl, category }) {
  await conn.query(
    `UPDATE games
       SET title = ?, image_url = ?, category = ?
     WHERE appid = ?`,
    [title, imageUrl, category, appid]
  );
}

/* Fetch fresh data for an appid via fetchFn and upsert it into the games table. */
export async function fetchAndCacheGame(conn, appid, fetchFn) {
  const gameData = await fetchFn(appid);
  if (gameData) {
    await upsertGame(conn, gameData);
  }
  return gameData;
}
