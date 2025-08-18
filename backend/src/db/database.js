import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Load backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

export async function initSchema(initFilePath) {
    const sqlPath = initFilePath || resolve(__dirname, "init.sql"); // lives in /src/db/
    if (!fs.existsSync(sqlPath)) {
        console.warn("[initSchema] No init.sql found at", sqlPath);
        return;
    }
    const raw = fs.readFileSync(sqlPath, "utf8");
    const statements = raw
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

export async function getOrCreateIdentity({
    platform,
    platformUserId,
    usernameHint,
    gamertag,
    avatarUrl,
    profileUrl,
}) {
    if (!platform || platformUserId == null) {
        throw new Error("getOrCreateIdentity: platform and platformUserId are required")
    }
    const plat = String(platform).toLowerCase();
    const platUId = String(platformUserId);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Identity already exists
        const [[existing]] = await conn.query(
            `SELECT id AS identityId, user_id AS userId
            FROM user_identities
            WHERE platform = ? AND platform_user_id = ?
            LIMIT 1`,
            [plat, platUId]
        );
        // Refresh user contect
        if (existing) {
            if (gamertag || avatarUrl) {
                await conn.query(
                    `UPDATE user_identities
                    SET gamertag = COALESCE(?, gamertag),
                    avatar_url = COALESCE(?, avatar_url)
                    WHERE id = ?`,
                    [gamertag ?? null, avatarUrl ?? null, existing.identityId]
                );
            }
            if (profileUrl) {
                await conn.query(
                    `UPDATE users u
                    JOIN user_identities ui ON ui.user_id = u.id
                    SET u.profile_url = COALESCE(?, u.profile_url)
                    WHERE ui.id = ?`,
                    [profileUrl, existing.identityId]
                );
            }
            await conn.commit();
            return { identityId: existing.identityId, userId: existing.userId, platform: plat, platformUserId: platUId };
        }

        //Ensure User
        const fallbackUsername = `${plat}_${platUId}`;
        const desiredUsername = (usernameHint || fallbackUsername).trim().slice(0, 255);

        let userId;
        {
            const [[u]] = await conn.query(
              `SELECT id FROM users WHERE username=? LIMIT 1`, [desiredUsername]
            );
            if (u) {
                userId = u.id;
            } else {
                const [ins] = await conn.query(
                    `INSERT INTO users (username, avatar, profile_url, role) VALUES (?, ?, ?, 'user')`,
                    [desiredUsername, avatarUrl ?? null, profileUrl ?? null]
                );
                userId = ins.insertId;
            }
        }

        // Create identity (unique on platform+platform_user_id)
        let identityId;
        try {
            const [insId] = await conn.query(
                `INSERT INTO user_identities (user_id, platform, platform_user_id, gamertag, avatar_url)
                VALUES (?, ?, ?, ?, ?)`,
                [userId, plat, platUId, gamertag ?? null, avatarUrl ?? null]
            );
            identityId = insId.insertId;
        } catch (e) {
            // Check if user was created in parallel
            const [[r]] = await conn.query(
                `SELECT id AS identityId FROM user_identities WHERE platform=? AND platform_user_id=? LIMIT 1`,
                [plat, platUId]
            );
            if (!r) throw e;
            identityId = r.identityId;
        }

        await conn.commit();
        return { identityId, userId, platform: plat, platformUserId: platUId };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

// Checks that a game exists on a platform
export async function ensureGame(platform, platformGameId, name, iconUrl) {
    const [r] = await pool.query(
        `INSERT INTO platform_games (platform, platform_game_id, name, icon_url)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            icon_url = VALUES(icon_url),
            last_seen = NOW()`,
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
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            playtime_minutes = VALUES(playtime_minutes),
            last_refreshed   = NOW()`,
        [identityId, platformGameRowId, minutes ?? 0]
    );
}

export async function getLibraryByIdentityId(identityId, platform = "steam") {
    const [rows] = await pool.query(
        `SELECT vil.game_id          AS appid,
                vil.game_name        AS title,
                vil.icon_url         AS imageUrl,
                vil.playtime_minutes AS playtime
        FROM v_identity_library vil
        WHERE vil.identity_id = ?
        AND vil.platform = ?
        ORDER BY vil.game_name`,
        [identityId, platform]
    );
    return rows;
}