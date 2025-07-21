import React, { useState } from "react";
import JournalEntry from "./JournalEntry";

const JournalGameGroup = ({ game, appid, entries, setEntries }) => {
    const [expanded, setExpanded] = useState(true);

    const toggleExpanded = () => setExpanded((e) => !e);

    const addEntry = () => {
        const newEntry = {
            id: `new-${Date.now()}`, // temp ID to replace with server ID on save
            game_title: game,
            journal_title: "",
            entry: "",
            created_at: new Date().toISOString(),
            edited_at: new Date().toISOString(),
            isNew: true,
            appid: appid
        };
        setEntries((oldEntries) => [newEntry, ...oldEntries]);
    };

    return (
        <div className="game-group">
            <div className="game-header" onClick={toggleExpanded}>
                <span className="toggle-icon">{expanded ? "▾" : "▸"}</span>
                <span className="game-title">{game}</span>
                <span className="entry-count">({entries.length})</span>
                <button
                    className="add-entry-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        addEntry();
                    }}
                    aria-label={`Add entry to ${game}`}
                >
                    +
                </button>
            </div>
            {expanded && (
                <div className="entry-list">
                    {entries.map((entry) => (
                        <JournalEntry
                            key={entry.id}
                            entry={entry}
                            setEntries={setEntries}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default JournalGameGroup;