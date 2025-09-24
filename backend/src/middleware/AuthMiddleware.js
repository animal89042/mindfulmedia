import { pool, getOrCreateIdentity } from '../db/database.js';
import { createHash } from 'crypto';

/* ----- computeETag ----- */
function computeETag(payload) {
    const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return 'W/"' + createHash('sha1').update(json).digest('hex') + '"';
}

/* ----- maybe304 ----- */
function maybe304(req, res, etag) {
    if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return true;
    }
    return false;
}

/* ----- withCacheHeaders ----- */
export function withCacheHeaders(getPayload, { maxAge = 300, staleWhileRevalidate = 60 } = {}) {
    return async (req, res, next) => {
        try {
            const payload = await getPayload(req, res);
            const etag = computeETag(payload);

            if (maybe304(req, res, etag)) return;

            res.set('ETag', etag);
            res.set(
                'Cache-Control',
                `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
            );

            res.json(payload);
        } catch (err) {
            next(err);
        }
    };
}

export async function requireIdentity(req, res, next) {
    try {
        const steamId = req.user?.id || req.session?.passport?.user?.id || null;

        if (!steamId) {
            return res.status(401).json({error: "Not authenticated"});
        }

        const {identityId, userId, platformUserId} = await getOrCreateIdentity({
            platform: "steam",
            platformUserId: steamId,
            usernameHint: req.user?.displayName,
            gamertag: req.user?.displayName,
            avatarUrl: req.user?.photos?.[0]?.value,
            profileUrl: req.user?._json?.profileurl,
        });

        // Attach for downstream handlers
        req.identity_id = identityId;
        req.user_id = userId;
        req.platform = "steam";
        req.platform_user_id = String(platformUserId);
        req.steam_id = String(platformUserId); // back-compat for existing code

        // Persist on session for quicker access later
        req.session.identity_id = identityId;
        req.session.user_id = userId;
        req.session.steam_id = String(platformUserId);

        next();
    } catch (err) {
        console.error("[requireIdentity] error:", err);
        res.status(500).json({error: "Failed to resolve identity"});
    }
};

export async function requireAdmin(req, res, next) {
    try {
        const identityId = req.identity_id || req.session?.identity_id;
        if (!identityId) return res.status(401).json({error: "Not authenticated"});

        const [[row]] = await pool.query(
            `
                SELECT u.role
                FROM users u
                JOIN user_identities ui ON ui.user_id = u.id
                WHERE ui.id = ?
                LIMIT 1
            `,
            [identityId]
        );

        const role = String(row?.role || "").toLowerCase();
        if (!role) return res.status(403).json({error: "No user record"});
        if (role !== "admin") return res.status(403).json({error: "Admin only"});

        next();
    } catch (err) {
        console.error("[requireAdmin] error:", err);
        res.status(500).json({error: "Authorization check failed"});
    }
}