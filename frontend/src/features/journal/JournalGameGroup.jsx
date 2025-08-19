import React, { useState } from "react";
import JournalEntry from "./JournalEntry";

const JournalGameGroup = ({ game, appid, entries, setEntries }) => {
    const [expanded, setExpanded] = useState(true);

    const addEntry = () => {
        const now = new Date().toISOString();
        const temp = { id: `new-${Date.now()}`, appid, game_title: game, journal_title: "", entry: "", created_at: now, edited_at: now, isNew: true };
        setEntries((old) => [temp, ...old]);
    };

    return (
        <section className="border-b app-border py-4">
            <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center gap-2 text-left font-semibold">
                <span className="select-none app-subtle">{expanded ? "▾" : "▸"}</span>
                <span className="flex-1">{game}</span>
                <span className="text-sm app-subtle">({entries.length})</span>
                <span onClick={(e) => { e.stopPropagation(); addEntry(); }} className="ml-2 inline-flex items-center justify-center w-7 h-7 rounded-md btn-ghost" title="New entry">+</span>
            </button>

            {expanded && (
                <div className="mt-3 space-y-3 pl-6">
                    {entries.map((entry) => (
                        <JournalEntry key={entry.id} entry={entry} setEntries={setEntries} />
                    ))}
                </div>
            )}
        </section>
    );
};

export default JournalGameGroup;