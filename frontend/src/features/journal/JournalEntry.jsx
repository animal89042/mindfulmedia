import React, { useState } from "react";
import axios from "axios";
import routes from "../../api/routes";

const pickSaved = (data) => {
    if (Array.isArray(data)) return data[0];
    if (data?.entry) return data.entry;
    if (data?.row) return data.row;
    return data;
};
const normalizeEntry = (e) => ({
    id: e.id ?? e.entry_id ?? e.journal_id,
    appid: Number(e.appid ?? e.app_id ?? e.game_appid),
    journal_title: e.journal_title ?? e.title ?? "",
    entry: e.entry ?? e.content ?? e.text ?? "",
    created_at: e.created_at ?? e.createdAt ?? new Date().toISOString(),
    edited_at: e.edited_at ?? e.updated_at ?? e.updatedAt ?? e.created_at ?? new Date().toISOString(),
});

const JournalEntry = ({ entry, setEntries }) => {
    const [editing, setEditing] = useState(entry.isNew || false);
    const [text, setText] = useState(entry.entry || "");
    const [title, setTitle] = useState(entry.journal_title || "");

    const refreshAll = async () => {
        try {
            const res = await axios.get(routes.getJournal, { withCredentials: true });
            const raw = Array.isArray(res.data) ? res.data : res.data?.entries || res.data?.rows || [];
            setEntries(raw.map(normalizeEntry));
        } catch {}
    };

    const save = async () => {
        try {
            let res;
            if (entry.isNew) {
                res = await axios.post(
                    routes.postJournal,
                    { appid: entry.appid, title, entry: text },
                    { withCredentials: true }
                );
            } else {
                res = await axios.put(routes.updateJournal(entry.id), { title, entry: text }, { withCredentials: true });
            }
            const saved = normalizeEntry(pickSaved(res.data));
            setEntries((old) => {
                const without = old.filter((e) => e.id !== entry.id);
                return [saved, ...without];
            });
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
            if (entry.isNew) {
                setEntries((old) => old.filter((e) => e.id !== entry.id));
            } else {
                await axios.delete(routes.deleteJournal(entry.id), { withCredentials: true });
                setEntries((old) => old.filter((e) => e.id !== entry.id));
            }
        } catch (err) {
            console.error("Delete failed:", err?.response?.data || err);
            alert("Failed to delete entry.");
        }
    };

    const cancelEdit = () => {
        if (!window.confirm("Discard changes?")) return;
        if (entry.isNew) {
            setEntries((old) => old.filter((e) => e.id !== entry.id));
        } else {
            setText(entry.entry || "");
            setTitle(entry.journal_title || "");
            setEditing(false);
        }
    };

    return (
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
            {editing ? (
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Entry Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full mb-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-white outline-none"
                    />
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Write your journal entry..."
                        rows={4}
                        className="w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-white outline-none whitespace-pre-wrap"
                    />
                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={save}
                            className="rounded-md bg-white/10 border border-white/20 px-3 py-2 hover:bg-white/15"
                        >
                            Save
                        </button>
                        <button
                            onClick={cancelEdit}
                            className="rounded-md border border-white/20 px-3 py-2"
                        >
                            Discard
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 whitespace-pre-wrap break-words" onDoubleClick={() => setEditing(true)}>
                        <strong>{entry.journal_title || "(Untitled)"}</strong>
                        <br />
                        {entry.entry}
                    </div>

                    <div className="text-right min-w-[140px] text-xs text-white/60">
                        <div>Last Edited: {new Date(entry.edited_at).toLocaleDateString()}</div>
                        <div>Created: {new Date(entry.created_at).toLocaleDateString()}</div>
                    </div>

                    <div className="ml-2 flex gap-2 text-white/80">
            <span role="button" aria-label="Edit entry" onClick={() => setEditing(true)} className="cursor-pointer">
              ✏️
            </span>
                        <span role="button" aria-label="Delete entry" onClick={remove} className="cursor-pointer">
              🗑️
            </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default JournalEntry;
