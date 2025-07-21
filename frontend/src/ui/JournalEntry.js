import React, { useState } from "react";
import axios from "axios";
import apiRoutes from "../apiRoutes";

const JournalEntry = ({ entry, setEntries }) => {
    const [editing, setEditing] = useState(entry.isNew || false);
    const [text, setText] = useState(entry.entry || "");
    const [title, setTitle] = useState(entry.journal_title || "");

    // save changes
    const save = async () => {
        try {
            let res;
            if (entry.isNew) {
                // new entry
                res = await axios.post(apiRoutes.postJournal, {
                    game_title: entry.appid,
                    journal_title: title,
                    entry: text,
                }, { withCredentials: true });
            } else {
                // existing entry edited
                res = await axios.put(apiRoutes.updateJournal(entry.id), {
                    journal_title: title,
                    entry: text,
                }, { withCredentials: true });
            }
            const updatedEntry = res.data;

            setEntries((oldEntries) => {
                //remov tmep entry
                const filtered = oldEntries.filter((e) => e.id !== entry.id);
                //replace or add entry
                return [updatedEntry, ...filtered];
            });
            setEditing(false);
        } catch (err) {
            alert("Failed to save entry");
            console.error(err);
        }
    };

    // delete entry
    const remove = async () => {
        if (!window.confirm("Are you sure you want to delete this entry?")) return;
        try {
            if (entry.isNew) {
                //if jsut discarding new unsaved entry
                setEntries((oldEntries) =>
                    oldEntries.filter((e) => e.id !== entry.id)
                );
            } else {
                await axios.delete(apiRoutes.deleteJournal(entry.id), {
                    withCredentials: true,
                });
                setEntries((oldEntries) =>
                    oldEntries.filter((e) => e.id !== entry.id)
                );
            }
        } catch (err) {
            alert("Failed to delete entry");
            console.error(err);
        }
    };

    const cancelEdit = () => {
        if (
            window.confirm(
                "Discard changes?"
            )
        ) {
            if (entry.isNew) {
                setEntries((oldEntries) =>
                    oldEntries.filter((e) => e.id !== entry.id)
                );
            } else {
                setText(entry.entry);
                setTitle(entry.journal_title);
                setEditing(false);
            }
        }
    };

    return (
        <div className="journal-entry">
            {editing ? (
                <div style={{ flexGrow: 1 }}>
                    <input
                        type="text"
                        placeholder="Entry Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ width: "100%", marginBottom: "6px", fontWeight: "bold" }}
                    />
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Write your journal entry..."
                        rows={4}
                        style={{ width: "100%", fontFamily: "inherit" }}
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
                        <br />
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
                style={{ userSelect: "none" }}
            >
              ✏️
            </span>
                        <span
                            role="button"
                            aria-label="Delete entry"
                            onClick={remove}
                            style={{ userSelect: "none" }}
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