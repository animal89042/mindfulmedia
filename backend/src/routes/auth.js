import { Router } from "express";
import { pool, ensureUser, upsertUserProfile, extractSteamId } from "../db/database.js";
import { isProd, FRONTEND_BASE } from "../config/env.js";
import passport from "passport";

const router = Router();

router.get("/auth/steam/login", passport.authenticate("steam"));

router.get(
    "/auth/steam/return",
    passport.authenticate("steam", {
        failureRedirect: `${FRONTEND_BASE}/?login=failed`,
        session: true, // default, but keep explicit
    }),
    async (req, res) => {
        try {
            const steam_id = extractSteamId(req);
            if (!steam_id) return res.redirect(`${ FRONTEND_BASE }/?login=bad_profile`);

            // Stash for convenience
            req.session.steam_id = steam_id;
            req.steam_id = steam_id;

            // Optional: persist/refresh user profile
            const conn = await pool.getConnection();
            try {
                await ensureUser(conn, steam_id, req.user?.displayName || null);
                await upsertUserProfile(conn, steam_id, {
                    avatar: req.user?.photos?.[0]?.value || null,
                    profileurl: req.user?._json?.profileurl || null,
                });
            } finally {
                conn.release();
            }

            // Success → go to app
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