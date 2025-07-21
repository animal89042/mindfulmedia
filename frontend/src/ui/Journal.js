import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Journal.css";
import apiRoutes from "../apiRoutes";
import JournalGameGroup from "./JournalGameGroup";

const Journal = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get(apiRoutes.getJournal, { withCredentials: true })
      .then((res) => {
        setEntries(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch journals:", err);
        setError("Could not load journal entries");
        setLoading(false);
      });
  }, []);

  const groupedEntries = entries.reduce((acc, entry) => {
    const game = entry.game_title || "Unknown Game";
    const appid = entry.appid || null;
    if (!acc[game]) {
      acc[game] = {
        appid,
        entries: [],
      };
    }
    acc[game].entries.push(entry);
    return acc;
  }, {});

  if (loading) return <p>Loading journal…</p>;
  if (error) return <p>{error}</p>;

  return (
      <div className="journal-page">
        <h1>Journal</h1>
        {entries.length === 0 ? (
            <p>No entries yet.</p>
        ) : (
            Object.entries(groupedEntries).map(([game, { appid, entries }]) => (
                <JournalGameGroup
                    key={game}
                    game={game}
                    appid={appid}
                    entries={entries}
                    setEntries={setEntries}
                />
            ))
        )}
      </div>
  );
};


export default Journal;
