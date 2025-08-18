import { Router } from "express";
import { requireIdentity } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";
import { cache } from "../cache.js";

const router = Router();

function zapJournalCaches(identity_id, appid) {
    if (!identity_id) return;
    if (appid) {
        cache.del(`stats:${identity_id}:${appid}:ach=0`);
        cache.del(`stats:${identity_id}:${appid}:ach=1`);
    }
    cache.del(`games:${identity_id}:v1`);
}

// Helper: map appid -> platform_games.id (Steam)
async function getPlatformGameRowId(appid) {
    const [[pg]] = await pool.query(
        `SELECT id FROM platform_games
      WHERE platform='steam' AND platform_game_id=? LIMIT 1`,
        [String(appid)]
    );
    return pg?.id ?? null;
}

//  ─── Journal: List entries ───────────────────────────────────────────
router .get("/journals", requireIdentity, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });

    const identityId = req.identity_id;
    const { appid } = req.query;

    try {
        let rows;

        if (appid) {
            // Only this game's entries
            const pgRowId = await getPlatformGameRowId(appid);
            if (!pgRowId) return res.json([]); // unknown game => no rows

            [rows] = await pool.query(
                `SELECT j.id,
                    pg.platform_game_id AS appid,
                    COALESCE(pg.name, '') AS game_title,
                    j.entry,
                    j.title AS journal_title,
                    j.created_at,
                    j.edited_at
                FROM user_game_journals j
                JOIN platform_games pg ON pg.id = j.platform_game_id
                WHERE j.identity_id = ?
                AND j.platform_game_id = ?
                ORDER BY j.created_at DESC
                `, [identityId, pgRowId]
            );
        } else {
            // All entries for this identity (Steam only; easy to generalize later)
            [rows] = await pool.query(
                `SELECT j.id,
                    pg.platform_game_id AS appid,
                    COALESCE(pg.name, '') AS game_title,
                    j.entry,
                    j.title AS journal_title,
                    j.created_at,
                    j.edited_at
                FROM user_game_journals j
                JOIN platform_games pg ON pg.id = j.platform_game_id
                WHERE j.identity_id = ?
                AND pg.platform = 'steam'
                ORDER BY j.created_at DESC
                `, [identityId]
            );
        }

        res.json(rows);
    } catch (err) {
        console.error("Error fetching journal entries:", err);
        res.status(500).json({ error: "Failed to fetch journal entries" });
    }
});

//  ─── Journal: Create a new entry ────────────────────────────────────
router.post("/journals", requireIdentity, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });

    const identityId = req.identity_id;
    const { appid, entry, title } = req.body;

    if (!appid || !entry) {
        return res.status(400).json({error: "Both appid and entry are required"});
    }

    try {
        const pgRowId = await getPlatformGameRowId(appid);
        if (!pgRowId) {
            return res.status(400).json({ error: "Unknown appid (not in platform_games)" });
        }

        const [ins] = await pool.query(
            `
            INSERT INTO user_game_journals (identity_id, platform_game_id, title, entry)
            VALUES (?, ?, ?, ?)
            `, [identityId, pgRowId, title ?? "", entry]
        );

        const [[newRow]] = await pool.query(
            `SELECT j.id,
                    pg.platform_game_id AS appid,
                    COALESCE(pg.name, '') AS game_title,
                    j.entry,
                    j.title AS journal_title,
                    j.created_at,
                    j.edited_at
                FROM user_game_journals j
                JOIN platform_games pg ON pg.id = j.platform_game_id
                WHERE j.id = ?`,
            [ins.insertId]
        );

        res.json(newRow);
    } catch (err) {
        console.error("Error saving journal entry:", err);
        res.status(500).json({ error: "Failed to save journal entry" });
    }
});

router.post("/journals", requireIdentity, async (req, res) => {
    const identity_id = req.identity_id;
    const created = await createJournal(identity_id, req.body);
    const appid = String(req.body.appid ?? created?.appid ?? created?.game_id ?? "");
    zapJournalCaches(identity_id, appid);
    res.json(created);
});

//  ─── Journal: Delete a entry ────────────────────────────────────
router.delete("/journals/:id", requireIdentity, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    const identityId = req.identity_id;
    const entryId = Number(req.params.id);

    let conn;
    try {
        const [[own]] = await pool.query(
            `SELECT 1
             FROM user_game_journals
             WHERE id = ? AND identity_id = ?
             LIMIT 1`,
            [entryId, identityId]
        );
        if (!own) return res.status(404).json({ error: "Entry not found or access denied" });

        await pool.query(`DELETE FROM user_game_journals WHERE id = ?`, [entryId]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting journal entry:", err);
        res.status(500).json({ error: "Failed to delete journal entry" });
    }
});

router.delete("/journals/:id", requireIdentity, async (req, res) => {
    const identity_id = req.identity_id;
    const deleted = await deleteJournal(identity_id, req.params.id);
    const appid = String(deleted?.appid ?? deleted?.game_id ?? "");
    zapJournalCaches(identity_id, appid);
    res.json({ ok: true });
});

//  ─── Journal: Update a entry ────────────────────────────────────
router.put("/journals/:id", requireIdentity, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    const identityId = req.identity_id;
    const entryId = Number(req.params.id);
    const { entry, title } = req.body;

    if (!entry) {
        return res.status(400).json({error: "Entry content is required"});
    }

    try {
        const [[own]] = await pool.query(
            `SELECT 1
            FROM user_game_journals
            WHERE id = ? AND identity_id = ?
            LIMIT 1`,
            [entryId, identityId]
        );
        if (!own) return res.status(404).json({ error: "Entry not found or access denied" });

        await pool.query(
            `UPDATE user_game_journals
            SET entry = ?, title = ?, edited_at = NOW()
            WHERE id = ?`,
            [entry, title || "", entryId]
        );

        const [[row]] = await pool.query(
            `SELECT j.id,
                pg.platform_game_id AS appid,
                COALESCE(pg.name, '') AS game_title,
                j.entry,
                j.title AS journal_title,
                j.created_at,
                j.edited_at
            FROM user_game_journals j
            JOIN platform_games pg ON pg.id = j.platform_game_id
            WHERE j.id = ?`,
            [entryId]
        );

        res.json(row);
    } catch (err) {
        console.error("Error updating journal entry:", err);
        res.status(500).json({ error: "Failed to update journal entry" });
    }
});

router.put("/journals/:id", requireIdentity, async (req, res) => {
    const identity_id = req.identity_id;
    const updated = await updateJournal(identity_id, req.params.id, req.body);
    const appid = String(req.body.appid ?? updated?.appid ?? updated?.game_id ?? "");
    zapJournalCaches(identity_id, appid);
    res.json(updated);
});


export default router;