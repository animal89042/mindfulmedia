import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import mysqlSessionPkg from 'express-mysql-session';
import { Strategy as SteamStrategy } from "passport-steam";

import { PORT, STEAM_API_KEY, BACKEND_BASE, FRONTEND_BASE, SESSION_SECRET, isProd } from "./config/env.js";

import authRoutes from "../src/routes/auth.js";
import gamesRoutes from "../src/routes/games.js";
import journalRoutes from "./routes/journals.js";
import userRoutes from "../src/routes/user.js";
import profileRouter from "../src/routes/profile.js";
import friendsRoutes from "../src/routes/friends.js";

import {
    pool,
    initSchema,
} from "./db/database.js";

// Background warmup: optional migrations + open DB/session paths
async function warmup() {
    const t0 = Date.now();
    try {
        await initSchema();
        await pool.query("SELECT 1");
        console.log("DB warmup complete in", Date.now() - t0, "ms");
    } catch (err) {
        console.error("DB warmup failed:", err);
    }
}

// Session Store (TiDB via mysql2 pool)
const MySQLStore = (mysqlSessionPkg.default || mysqlSessionPkg)(session);

const sessionStore = new MySQLStore(
    {
        createDatabaseTable: true,
        clearExpired: true,
        checkExpirationInterval: 1000 * 60 * 15,   // clean every 15 min
        expiration: 1000 * 60 * 60 * 24 * 7,       // 7 days
        schema: {
            tableName: "sessions",
            columnNames: {session_id: "session_id", expires: "expires", data: "data"},
        },
    },
    pool
);

// Surface store errors (helps catch DB issues fast)
sessionStore.on?.("error", (err) => {
    console.error("[session-store] error:", err);
});

async function startServer() {
    // 1) Express setup
    const app = express();

    // 2) Trust Railway's proxy so secure cookies work
    app.set('trust proxy', 1);

    // 3) CORS (exact origins + credentials)
    const allowedOrigins = [
        FRONTEND_BASE,
        BACKEND_BASE,
        /\.vercel\.app$/,
    ];

    app.use(
        cors({
            origin(origin, callback) {
                if (!origin) return callback(null, true); // allow server-to-server or curl requests
                const ok = allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin);
                if (ok) return callback(null, true);
                callback(new Error(`CORS blocked origin: ${origin}`));
            },
            credentials: true, // allow cookies and credentials
        })
    );

    app.use(express.json());

    // 4) Sessions (TiDB-backed)
    app.use(session({
        name: 'mm.sid',
        secret: SESSION_SECRET || "mindfulmediaBMG",
        resave: false,
        saveUninitialized: false,
        store: sessionStore,              // your MySQL/TiDB session store
        cookie: {
            httpOnly: true,
            secure: isProd,               // true in prod, false in dev
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    }));

    // 5) Passport (Steam OpenID)
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    const stripSlash = (u) => u.replace(/\/+$/, '');

    passport.use(new SteamStrategy(
        {
            returnURL: `${ stripSlash(BACKEND_BASE) }/api/auth/steam/return`,
            realm: stripSlash(BACKEND_BASE),
            apiKey: process.env.STEAM_API_KEY,
        },
        (identifier, profile, done) => done(null, profile)
    ));

    console.log('[Bases]', { FRONTEND_BASE, BACKEND_BASE, PORT, NODE_ENV: process.env.NODE_ENV });

    app.use('/api', authRoutes);
    app.use('/api', gamesRoutes);
    app.use('/api', journalRoutes);
    app.use('/api', userRoutes);
    app.use('/api', profileRouter);
    app.use('/api/friends', friendsRoutes);

    // Start listening
    app.listen(PORT, () => {
        console.log(`Backend listening on :${PORT}`);
        warmup();
    });

    process.on("SIGINT", async () => {
        console.log("Closing...");
        process.exit();
    });
}

startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});