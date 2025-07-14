import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import localtunnel from "localtunnel";

// mySQL
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

import { Strategy as SteamStrategy } from "passport-steam";
import { getGameData, getOwnedGames } from "./SteamAPI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

const {
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  STEAM_API_KEY,
  PORT = 5000,
} = process.env;

async function initSchema() {
  // connect _without_ database name
  const initConn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    // allow semi-colon separated statements
    multipleStatements: true,
  });

  const ddl = fs.readFileSync(path.resolve(__dirname, "init.sql"), "utf8");
  await initConn.query(ddl);
  await initConn.end();

  console.log("init.sql applied (database + tables created if missing)");

}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function startServer() {
  await initSchema();

  const tunnel = await localtunnel({ port: PORT, subdomain: "mindfulmedia" });
  const TUNNEL_URL = tunnel.url;
  console.log(`Tunnel live at: ${TUNNEL_URL}`);

  try {
    const conn = await pool.getConnection();
    await conn.ping();
    console.log("MySQL pool connected");
    conn.release();
  } catch (err) {
    console.error("MySQL pool failed");
    // console.error("MySQL pool failed:", err);
    process.exit(1);
  }

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(
    session({
      secret: "thisisarandoms3cr3Tstr1nG123!@#",
      resave: false,
      saveUninitialized: true,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => done(null, { id }));
  passport.use(
    new SteamStrategy(
      {
        returnURL: `${TUNNEL_URL}/auth/steam/return`,
        realm: TUNNEL_URL,
        apiKey: STEAM_API_KEY,
        stateless: true,
      },
      (identifier, profile, done) => done(null, profile)
    )
  );

  app.get("/auth/steam/login", passport.authenticate("steam"));
  app.get(
    "/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: "/" }),
    (req, res) => {
      if (!req.user?.id) return res.redirect("/login/error");
      console.log("SteamID:", req.user.id);
      res.redirect(`http://localhost:3000/${req.user.id}`);
    }
  );

  app.get("/api/games/:steamid", async (req, res) => {
    const steamID = req.params.steamid;
    let conn;
    try {
      const owned = await getOwnedGames(steamID);
      conn = await pool.getConnection();
      await conn.beginTransaction();

      // ensure the user exists
      await conn.query(
        `INSERT IGNORE INTO users (steam_id, display_name) VALUES (?, ?)`,
        [steamID, req.user?.displayName || null]
      );

      for (const g of owned) {
        const appid = g.appid;
        if (!appid) continue;

        // 1) See if we already have a “good” title in games

        // console.log(`Checking game ${appid} in DB...`);
        const [[existing]] = await conn.query(
          `SELECT title, image_url, category
           FROM games
          WHERE appid = ?`,
          [appid]
        );

        console.log("Existing game data:", existing.title);

        let gameData;
        if (existing && existing.title && existing.title !== "Unknown") {
        // console.log(
        //   "Existing game data:    id: ",
        //   existing.appid,
        //   ",    title: ",
        //   existing.title
        // );

        let gameData;
        if (existing && existing.title && existing.title !== "Unknown") {
          // reuse cached row
          gameData = {
            appid,
            title: existing.title,
            imageUrl: existing.image_url,
            category: existing.category,
          };
        } else if (existing.title == "Unknown") {
          gameData = await getGameData(appid);
<<<<<<< HEAD
          await conn.query(
            `UPDATE games SET title = ?, image_url = ?, category = ?
             WHERE appid = ?`,
            [gameData.title, gameData.imageUrl, gameData.category, appid]
          );
        } else {
          // need to fetch fresh data
          gameData = await getGameData(appid);
          if (!gameData) {
            // fallback if Steam API fails
            gameData = {
              appid,
              title: "Unknown",
              imageUrl: "null",
              category: "null",
            };
          }
=======
          if (gameData !== null) {
            await conn.query(
              `UPDATE games SET title = ?, image_url = ?, category = ?
             WHERE appid = ?`,
              [gameData.title, gameData.imageUrl, gameData.category, appid]
            );
          }
        } else {
          // need to fetch fresh data
          gameData = await getGameData(appid);
          // if (!gameData) {
          //   // fallback if Steam API fails
          //   gameData = {
          //     appid,
          //     title,
          //     imageUrl,
          //     category,
          //   };
          // }
          // upsert into games table
          await conn.query(
            `INSERT INTO games (appid, title, image_url, category)
                   VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              title     = VALUES(title),
              image_url = VALUES(image_url),
              category  = VALUES(category)`,
            [
              gameData.appid,
              gameData.title,
              gameData.imageUrl,
              gameData.category,
            ]
          );
          console.log(`Inserted game ${gameData.appid} - ${gameData.title}`);
        }

        // 2) Link user → game (no change)
        await conn.query(
          `INSERT IGNORE INTO user_games (steam_id, appid) VALUES (?, ?)`,
          [steamID, appid]
        );
      }

      await conn.commit();
      conn.release();

      // finally, fetch back all user’s games and return
      const [rows] = await pool.query(
        `SELECT g.appid, g.title, g.image_url AS imageUrl, g.category
         FROM games g
         JOIN user_games ug ON ug.appid = g.appid
         WHERE ug.steam_id = ?`,
        [steamID]
      );
      res.json(rows);
    } catch (err) {
      if (conn) {
        await conn.rollback().catch(() => {});
        conn.release();
      }
      // console.error("Error fetching games:", err);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  // Single game details route
  app.get("/api/game/:id", async (req, res) => {
    try {
      const game = await getGameData(req.params.id);
      if (!game) return res.status(404).json({ error: "Game not found" });
      res.json(game);
    } catch (err) {
      console.error("Error in /api/game/:id:", req.params.id);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test endpoint
  app.get("/api/test", (req, res) => {
    res.json({ message: "Tunnel + Steam OAuth are working!" });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
    console.log(`Steam login endpoint: ${TUNNEL_URL}/auth/steam/login`);
  });

  process.on("SIGINT", async () => {
    console.log("Closing tunnel...");
    await tunnel.close();
    process.exit();
  });
}

// Launch
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
