import { Router } from "express";
import { requireSteamID } from "../middleware/AuthMiddleware.js";
import { pool } from "../db/database.js";

const router = Router();

//  ─── Journal: List entries ───────────────────────────────────────────
router .get("/journals", requireSteamID, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    const {appid} = req.query;
    const steam_id = req.steam_id;
    let conn;
    try {
        conn = await pool.getConnection();
        let rows;

        if (appid) {
            // only this game’s entries
            [rows] = await conn.query(
                ` SELECT j.id,
                             j.appid,
                             g.title AS game_title,
                             j.entry,
                             j.title AS journal_title,
                             j.created_at,
                             j.edited_at
                      FROM journals j
                               LEFT JOIN games g ON j.appid = g.appid
                      WHERE j.appid = ?
                        AND j.steam_id = ?`,
                [appid, steam_id]
            );
        } else {
            [rows] = await conn.query(
                `SELECT j.id,
                            j.appid,
                            g.title AS game_title,
                            j.entry,
                            j.title AS journal_title,
                            j.created_at,
                            j.edited_at
                     FROM journals j
                              LEFT JOIN games g ON j.appid = g.appid
                     WHERE j.steam_id = ?`,
                [steam_id]
            );
        }
        console.log(
            `Fetched ${rows.length} journal entries${appid ? ` for ${appid}` : ""}`
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching journal entries:", err);
        res.status(500).json({error: "Failed to fetch journal entries"});
    } finally {
        if (conn) conn.release();
    }
});

//  ─── Journal: Create a new entry ────────────────────────────────────
router.post("/journals", requireSteamID, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    const {appid, entry, title} = req.body;
    const steam_id = req.steam_id;

    if (!appid || !entry) {
        return res.status(400).json({error: "Both appid and entry are required"});
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const safe_title = title ?? "";
        const [result] = await conn.query(
            "INSERT INTO journals (steam_id, appid, entry, title) VALUES (?, ?, ?, ?)",
            [steam_id, appid, entry, safe_title]
        );
        const [[newEntry]] = await conn.query(
            `SELECT id, appid, entry, title AS journal_title, created_at, edited_at
                 FROM journals
                 WHERE id = ?`,
            [result.insertId]
        );
        res.json(newEntry);
    } catch (err) {
        console.error("Error saving journal entry:", err);
        res.status(500).json({error: "Failed to save journal entry"});
    } finally {
        if (conn) conn.release();
    }
});

//  ─── Journal: Delete a entry ────────────────────────────────────
router.delete("/journals/:id", requireSteamID, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    const steam_id = req.steam_id;
    const entryId = req.params.id;
    let conn;
    try {
        conn = await pool.getConnection();
        // Make sure the entry belongs to this user before deleting
        const [[entry]] = await conn.query(
            `SELECT id
                 FROM journals
                 WHERE id = ?
                   AND steam_id = ?`,
            [entryId, steam_id]
        );
        if (!entry) {
            return res.status(404).json({error: "Entry not found or access denied"});
        }
        await conn.query(`DELETE
                              FROM journals
                              WHERE id = ?`, [entryId]);
        res.json({success: true});
    } catch (err) {
        console.error("Error deleting journal entry:", err);
        res.status(500).json({error: "Failed to delete journal entry"});
    } finally {
        if (conn) conn.release();
    }
});

//  ─── Journal: Update a entry ────────────────────────────────────
router.put("/journals/:id", requireSteamID, async (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "Expires": "0",
        "CDN-Cache-Control": "no-store"
    });
    const steam_id = req.steam_id;
    const entryId = req.params.id;
    const {entry, title} = req.body;
    if (!entry) {
        return res.status(400).json({error: "Entry content is required"});
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const [[existing]] = await conn.query(
            `SELECT id
                 FROM journals
                 WHERE id = ?
                   AND steam_id = ?`,
            [entryId, steam_id]
        );
        if (!existing) {
            return res.status(404).json({error: "Entry not found or access denied"});
        }
        await conn.query(
            `UPDATE journals
                 SET entry     = ?,
                     title     = ?,
                     edited_at = NOW()
                 WHERE id = ?`,
            [entry, title || "", entryId]
        );
        const [[updatedEntry]] = await conn.query(
            `SELECT id, appid, entry, title AS journal_title, created_at, edited_at
                 FROM journals
                 WHERE id = ?`,
            [entryId]
        );

        res.json(updatedEntry);
    } catch (err) {
        console.error("Error updating journal entry:", err);
        res.status(500).json({error: "Failed to update journal entry"});
    } finally {
        if (conn) conn.release();
    }
})

export default router;