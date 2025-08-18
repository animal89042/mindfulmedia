import { Router } from "express";
import { getOrCreateIdentity } from "../db/database.js";
import { isProd, FRONTEND_BASE } from "../config/env.js";
import passport from "passport";

const router = Router();

router.get("/auth/steam/login", passport.authenticate("steam"));

router.get(
    "/auth/steam/return",
    passport.authenticate("steam", {
        failureRedirect: `${FRONTEND_BASE}/?login=failed`,
        session: true,
    }),
    async (req, res) => {
        try {
            const steamId = req.user?.id || req.session?.passport?.user?.id || null;
            if (!steamId) return res.redirect(`${ FRONTEND_BASE }/?login=bad_profile`);

            const { identityId, userId } = await getOrCreateIdentity({
                platform: "steam",
                platformUserId: steamId,
                usernameHint: req.user?.displayName,
                gamertag: req.user?.displayName,
                avatarUrl: req.user?.photos?.[0]?.value,
                profileUrl: req.user?._json?.profileurl,
            });

            // Stash for convenience
            req.session.steam_id = String(steamId);
            req.session.identity_id = identityId;
            req.session.user_id = userId;

            return res.redirect(`${ FRONTEND_BASE }/`);
        } catch (e) {
            console.error("[steam return] handler error:", e);
            return res.redirect(`${ FRONTEND_BASE }/?login=error`);
        }
    }
);

// --- API: Test Endpoint ---
router.get("/test", (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    res.json({message: "Tunnel + Steam OAuth are working!"});
});

// Log Out
router.post("/logout", (req, res) => {
    req.logout(err => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        if (req.session) {
            req.session.destroy(() => {
                res.clearCookie("mm.sid", {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: isProd ? "none" : "lax",
                    path: "/",
                });
                res.json({ ok: true });
            });
        } else {
            res.clearCookie("mm.sid", {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? "none" : "lax",
                path: "/",
            });
            res.json({ ok: true });
        }
    });
});

export default router;