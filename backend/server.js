import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import localtunnel from "localtunnel";
import mysql from "mysql2/promise";
import { Strategy as SteamStrategy } from "passport-steam";
import { getGameData, getOwnedGames } from "./SteamAPI.js";
import {
  initSchema,
  ensureUser,
  upsertGame,
  linkUserGame,
  getUserGames,
} from "./database.js";

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

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function startServer() {
  const tunnel = await localtunnel({ port: PORT, subdomain: "mindfulmedia" });
  const TUNNEL_URL = tunnel.url;
  console.log(`Tunnel live at: ${TUNNEL_URL}`);

  try {
    const conn = await pool.getConnection();
    await conn.ping();
    console.log("MySQL pool connected");
    conn.release();
  } catch (err) {
    console.error("MySQL pool failed:", err);
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
      const games = await getOwnedGames(steamID);
      conn = await pool.getConnection();
      await conn.beginTransaction();

      // 1) ensure user exists
      await ensureUser(conn, steamID, req.user?.displayName);

      // 2) upsert each game + link
      for (const g of games) {
        await upsertGame(conn, {
          appid: g.appid,
          title: g.title,
          imageUrl: g.imageUrl,
          category: g.category,
        });
        await linkUserGame(conn, steamID, g.appid);
      }

      await conn.commit();
      conn.release();

      // 3) fetch & return stored games
      const rows = await getUserGames(pool, steamID);
      res.json(rows);
    } catch (err) {
      if (conn) {
        await conn.rollback().catch(() => {});
        conn.release();
      }
      console.error("Error fetching games:", err);
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
      console.error("Error in /api/game/:id:", err);
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
