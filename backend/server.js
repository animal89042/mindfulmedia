// server.js
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
import { getOwnedGames, getGameData, getPlayerSummary } from "./SteamAPI.js";
import {
  initSchema,
  ensureUser,
  upsertGame,
  linkUserGame,
  getUserGames,
  upsertUserProfile,
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

async function startServer() {
  // 1) Ensure schema (CREATE/ALTER) is applied
  await initSchema(
    {
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      multipleStatements: true,
    },
    resolve(__dirname, "init.sql")
  );

  // 2) Create MySQL pool
  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // 3) Expose via localtunnel
  const tunnel = await localtunnel({ port: PORT, subdomain: "mindfulmedia" });
  const TUNNEL_URL = tunnel.url;
  console.log(`Tunnel live at: ${TUNNEL_URL}`);

  // 4) Verify connection
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    console.log("MySQL pool connected");
    conn.release();
  } catch (err) {
    console.error("MySQL pool failed:", err);
    process.exit(1);
  }

  // 5) Express setup
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

  // --- OAuth Endpoints ---
  app.get("/auth/steam/login", passport.authenticate("steam"));
  app.get(
    "/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: "/" }),
    async (req, res) => {
      const steamID = req.user?.id;
      if (!steamID) return res.redirect("/login/error");
      console.log("SteamID:", steamID);

      // Fetch and persist profile data
      try {
        const profile = await getPlayerSummary(steamID);
        if (profile) {
          const conn = await pool.getConnection();
          await conn.query(
            ` INSERT IGNORE INTO users (steam_id, persona_name, avatar, avatarfull, profile_url)
                VALUES (?, ?, ?, ?, ?)`,
            [
              steamID,
              profile.personaname,
              profile.avatar,
              profile.avatarfull,
              profile.profileurl,
            ]
          );
          await upsertUserProfile(conn, steamID, profile);
          conn.release();
        }
      } catch (err) {
        console.error("Could not fetch/store Steam profile:", err);
      }

      res.redirect(`http://localhost:3000/${steamID}`);
    }
  );

  // --- API: Player Summary ---
  app.get("/api/playersummary/:steamid", async (req, res) => {
    const steamID = req.params.steamid;
    let conn;
    try {
      conn = await pool.getConnection();
      const [[userRow]] = await conn.query(
        ` SELECT display_name, persona_name, avatar, avatarfull, profile_url
          FROM users
          WHERE steam_id = ?`,
        [steamID]
      );

      let profile = userRow;
      if (!userRow || !userRow.avatarfull) {
        const fresh = await getPlayerSummary(steamID);
        if (fresh) {
          await upsertUserProfile(conn, steamID, fresh);
          profile = {
            display_name: fresh.personaname,
            persona_name: fresh.personaname,
            avatar: fresh.avatar,
            avatarfull: fresh.avatarfull,
            profile_url: fresh.profileurl,
          };
        }
      }
      conn.release();

      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        personaName: profile.persona_name,
        avatar: profile.avatar,
        avatarfull: profile.avatarfull,
        profileUrl: profile.profile_url,
        avatarFound: Boolean(profile.avatar || profile.avatarfull),
      });
    } catch (err) {
      if (conn) {
        conn.release();
      }
      console.error("Error fetching player summary:", err);
      res.status(500).json({ error: "Failed to fetch player summary" });
    }
  });

  // --- API: User's Owned Games ---
  app.get("/api/games/:steamid", async (req, res) => {
    const steamID = req.params.steamid;
    let conn;
    try {
      const owned = await getOwnedGames(steamID);
      conn = await pool.getConnection();
      await conn.beginTransaction();

      await ensureUser(conn, steamID, req.user?.displayName);

      for (const { appid } of owned) {
        if (!appid) continue;

        // check cache
        const [[existing]] = await conn.query(
          ` SELECT title
            FROM games
            WHERE appid = ?`,
          [appid]
        );
        if (existing && existing.title && existing.title !== "Unknown") {
          await linkUserGame(conn, steamID, appid);
          continue;
        }

        // fetch & upsert
        const gameData = await getGameData(appid);
        if (gameData) {
          await upsertGame(conn, gameData);
        }
        await linkUserGame(conn, steamID, appid);
      }

      await conn.commit();
      conn.release();

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

  // --- API: Single Game Details ---
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

  // --- API: Test Endpoint ---
  app.get("/api/test", (req, res) => {
    res.json({ message: "Tunnel + Steam OAuth are working!" });
  });

  //  ─── Journal: List entries ───────────────────────────────────────────
  app.get("/api/journals", async (req, res) => {
    const { appid } = req.query;
    if (!appid) {
      return res
        .status(400)
        .json({ error: "appid query parameter is required" });
    }
    let conn;
    try {
      conn = await pool.getConnection();
      const [rows] = await conn.query(
        "SELECT appid, entry FROM journals WHERE appid = ?",
        [appid]
      );
      res.json(rows);
      console.log(`Fetched ${rows.length} journal entries for appid ${appid}`);
    } catch (err) {
      console.error("Error fetching journal entries:", err);
      res.status(500).json({ error: "Failed to fetch journal entries" });
    } finally {
      if (conn) conn.release();
    }
  });

  //  ─── Journal: Create a new entry ────────────────────────────────────
  app.post("/api/journals", async (req, res) => {
    const { appid, entry } = req.body;
    if (!appid || !entry) {
      return res
        .status(400)
        .json({ error: "Both appid and entry are required" });
    }
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.query("INSERT INTO journals (appid, entry) VALUES (?, ?)", [
        appid,
        entry,
      ]);
      // echo back what was saved
      res.json({ appid, entry });
    } catch (err) {
      console.error("Error saving journal entry:", err);
      res.status(500).json({ error: "Failed to save journal entry" });
    } finally {
      if (conn) conn.release();
    }
  });

  // Start listening
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

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
