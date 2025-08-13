import React, { useState } from "react";
import JournalEntry from "./JournalEntry";

const JournalGameGroup = ({ game, appid, entries, setEntries }) => {
    const [expanded, setExpanded] = useState(true);

    const toggleExpanded = () => setExpanded((e) => !e);

    const addEntry = () => {
        const now = new Date().toISOString();
        const temp = {
            id: `new-${Date.now()}`,   // temp id; replaced after POST
            appid,
            game_title: game,
            journal_title: "",
            entry: "",
            created_at: now,
            edited_at: now,
            isNew: true,
        };

        setEntries(old => [temp, ...old]);
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
                >
                    +
                </button>
            </div>
            {expanded && (
                <div className="entry-list">
                    {entries.map((entry) => (
                        <JournalEntry key={entry.id} entry={entry} setEntries={setEntries} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default JournalGameGroup;