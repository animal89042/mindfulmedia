import React, { useState } from "react";
import routes from "../../api/routes";
import { api } from "../../api/client";

const pickSaved = (d) => Array.isArray(d) ? d[0] : d?.entry ?? d?.row ?? d;
const normalizeEntry = (e) => ({ id: e.id ?? e.entry_id ?? e.journal_id, appid: Number(e.appid ?? e.app_id ?? e.game_appid), journal_title: e.journal_title ?? e.title ?? "", entry: e.entry ?? e.content ?? e.text ?? "", created_at: e.created_at ?? e.createdAt ?? new Date().toISOString(), edited_at: e.edited_at ?? e.updated_at ?? e.updatedAt ?? e.created_at ?? new Date().toISOString() });

const JournalEntry = ({ entry, setEntries }) => {
    const [editing, setEditing] = useState(entry.isNew || false);
    const [text, setText] = useState(entry.entry || "");
    const [title, setTitle] = useState(entry.journal_title || "");

    const refreshAll = async () => {
        try {
            const res = await api.get(routes.journals);
            const raw = Array.isArray(res.data) ? res.data : res.data?.entries || res.data?.rows || [];
            setEntries(raw.map(normalizeEntry));
        } catch {}
    };

    const save = async () => {
        try {
            let res;
            if (entry.isNew) res = await api.post(routes.journals, { appid: entry.appid, title, entry: text });
            else res = await api.put(routes.journalById(entry.id), { title, entry: text });
            const saved = normalizeEntry(pickSaved(res.data));
            setEntries((old) => [saved, ...old.filter((e) => e.id !== entry.id)]);
            setEditing(false);
            refreshAll();
        } catch (err) {
            console.error("Save failed:", err?.response?.data || err);
            alert("Failed to save entry.");
        }
    };

    const remove = async () => {
        if (!window.confirm("Delete this entry?")) return;
        try {
            if (entry.isNew) setEntries((old) => old.filter((e) => e.id !== entry.id));
            else { await api.delete(routes.journalById(entry.id)); setEntries((old) => old.filter((e) => e.id !== entry.id)); }
        } catch (err) {
            console.error("Delete failed:", err?.response?.data || err);
            alert("Failed to delete entry.");
        }
    };

    const cancelEdit = () => {
        if (!window.confirm("Discard changes?")) return;
        if (entry.isNew) setEntries((old) => old.filter((e) => e.id !== entry.id));
        else { setText(entry.entry || ""); setTitle(entry.journal_title || ""); setEditing(false); }
    };

    return (
        <div className="flex items-start justify-between gap-3 border-b app-border pb-3">
            {editing ? (
                <div className="flex-1">
                    <input type="text" placeholder="Entry Title" value={title} onChange={(e) => setTitle(e.target.value)} className="input mb-2" />
                    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your journal entry..." rows={4} className="input whitespace-pre-wrap" />
                    <div className="mt-2 flex gap-2">
                        <button onClick={save} className="btn">Save</button>
                        <button onClick={cancelEdit} className="btn-ghost">Discard</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 whitespace-pre-wrap break-words" onDoubleClick={() => setEditing(true)}>
                        <strong>{entry.journal_title || "(Untitled)"}</strong>
                        <br />
                        {entry.entry}
                    </div>

                    <div className="text-right min-w-[140px] text-xs app-subtle">
                        <div>Last Edited: {new Date(entry.edited_at).toLocaleDateString()}</div>
                        <div>Created: {new Date(entry.created_at).toLocaleDateString()}</div>
                    </div>

                    <div className="ml-2 flex gap-2">
                        <span role="button" aria-label="Edit entry" onClick={() => setEditing(true)} className="cursor-pointer">✏️</span>
                        <span role="button" aria-label="Delete entry" onClick={remove} className="cursor-pointer">🗑️</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default JournalEntry;