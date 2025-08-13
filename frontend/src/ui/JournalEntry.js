import React, {useState} from "react";
import axios from "axios";
import apiRoutes from "../apiRoutes";

const pickSaved = (data) => {
    // Accept common server shapes
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
    edited_at:
        e.edited_at ?? e.updated_at ?? e.updatedAt ?? e.created_at ?? new Date().toISOString(),
});

const JournalEntry = ({entry, setEntries}) => {
    const [editing, setEditing] = useState(entry.isNew || false);
    const [text, setText] = useState(entry.entry || "");
    const [title, setTitle] = useState(entry.journal_title || "");

    const refreshAll = async () => {
        // Fallback refresh to avoid stale/shape mismatch issues
        try {
            const res = await axios.get(apiRoutes.getJournal, { withCredentials: true });
            const raw = Array.isArray(res.data) ? res.data : res.data?.entries || res.data?.rows || [];
            setEntries(raw.map(normalizeEntry));
        } catch (e) {
            // oop
        }
    };

    // save changes
    const save = async () => {
        try {
            let res;
            if (entry.isNew) {
                res = await axios.post(
                    apiRoutes.postJournal,
                    { appid: entry.appid, title, entry: text },
                    { withCredentials: true }
                );
            } else {
                res = await axios.put(
                    apiRoutes.updateJournal(entry.id),
                    {title, entry: text},
                    {withCredentials: true}
                );
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

    // delete entry
    const remove = async () => {
        if (!window.confirm("Are you sure you want to delete this entry?")) return;
        try {
            if (entry.isNew) {
                //if jsut discarding new unsaved entry
                setEntries(old => old.filter(e => e.id !== entry.id));
            } else {
                await axios.delete(apiRoutes.deleteJournal(entry.id), { withCredentials: true });
            }
            setEntries((old) => old.filter((e) => e.id !== entry.id));
        } catch (err) {
            console.error("Delete failed:", err?.response?.data || err);
            alert("Failed to delete entry.");
        }
    };

    const cancelEdit = () => {
        if (!window.confirm("Discard changes?")) return;

        if (entry.isNew) {
            // forget the temp card
            setEntries(old => old.filter(e => e.id !== entry.id));
        } else {
            // restore original text
            setText(entry.entry || "");
            setTitle(entry.journal_title || "");
            setEditing(false);
        }
    };

    return (
        <div className="journal-entry">
            {editing ? (
                <div style={{flexGrow: 1}}>
                    <input
                        type="text"
                        placeholder="Entry Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{width: "100%", marginBottom: "6px", fontWeight: "bold"}}
                    />
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Write your journal entry..."
                        rows={4}
                        style={{width: "100%", fontFamily: "inherit"}}
                    />
                    <div className="edit-buttons">
                        <button onClick={save}>Save</button>
                        <button onClick={cancelEdit}>Discard</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="entry-text" onDoubleClick={() => setEditing(true)}>
                        <strong>{entry.journal_title || "(Untitled)"}</strong>
                        <br/>
                        {entry.entry}
                    </div>
                    <div className="entry-dates">
                        <div>Last Edited: {new Date(entry.edited_at).toLocaleDateString()}</div>
                        <div>Created: {new Date(entry.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="entry-icons" title="Edit entry">
            <span
                role="button"
                aria-label="Edit entry"
                onClick={() => setEditing(true)}
                style={{userSelect: "none"}}
            >
              ✏️
            </span>
                        <span
                            role="button"
                            aria-label="Delete entry"
                            onClick={remove}
                            style={{userSelect: "none"}}
                        >
              🗑️
            </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default JournalEntry;