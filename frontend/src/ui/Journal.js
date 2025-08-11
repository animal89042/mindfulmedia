import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Journal.css";
import apiRoutes from "../apiRoutes";
import JournalGameGroup from "./JournalGameGroup";

const Journal = ({ searchTerm }) => {
  const [entries, setEntries] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [entriesRes, gamesRes] = await Promise.all([
          axios.get(apiRoutes.getJournal, { withCredentials: true }),
          axios.get(apiRoutes.getGames, { withCredentials: true }),
        ]);

        setEntries(entriesRes.data);
        setGames(gamesRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Could not load journal or games");
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  if (loading) return <p>Loading journal…</p>;
  if (error) return <p>{error}</p>;

  // Filter games by searchTerm
  const filteredGames = searchTerm
      ? games.filter((game) =>
          game.title?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      : games;

  // Group entries by game
  const groupedEntries = filteredGames.reduce((acc, game) => {
    const gameEntries = entries.filter((entry) => entry.appid === game.appid);
    acc[game.title || "Unknown Game"] = {
      appid: game.appid,
      entries: gameEntries,
    };
    return acc;
  }, {});

  return (
      <div className="journal-page">
        <h1>Journal</h1>
        {filteredGames.length === 0 ? (
            <p>No games found.</p>
        ) : (
            Object.entries(groupedEntries).map(([gameTitle, { appid, entries }]) => (
                <JournalGameGroup
                    key={appid}
                    game={gameTitle}
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