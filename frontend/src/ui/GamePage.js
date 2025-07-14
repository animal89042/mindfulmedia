import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./GamePage.css";

const GamePage = () => {
  const { id } = useParams();
  const storageKey = `journal-${id}`;

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState("");

  // Fetch game details
  useEffect(() => {
    setLoading(true);
    setError(null);

    axios
      .get(`http://localhost:5000/api/game/${id}`)
      .then(({ data }) => {
        setGame(data);
        setLoading(false);
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Failed to load game";
        setError(msg);
        setLoading(false);
      });
  }, [id]);

  // Load saved journal entries
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || [];
    setEntries(saved);
  }, [storageKey]);

  // Save a new journal entry
  const handleSaveEntry = () => {
    if (!draft.trim()) return;
    const newEntry = { date: new Date().toISOString(), text: draft.trim() };
    const updated = [newEntry, ...entries];
    setEntries(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setDraft("");
  };

  if (loading) return <div>Loading game...</div>;
  if (error) {
    return (
      <div>
        {error === "Game not found" ? "Game not found" : `Error: ${error}`}
      </div>
    );
  }
  if (!game) return <div>Game not found</div>;

  return (
    <div className="game-page">
      <h1>{game.title}</h1>

      <div className="game-page-content">
        <div className="game-details">
          <img
            src={game.imageUrl}
            alt={game.title}
            className="game-page-image"
          />
          <p>Category: {game.category}</p>
        </div>

        <section className="journal">
          <h2>My Journal</h2>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your thoughts..."
          />
          <button onClick={handleSaveEntry}>Save Entry</button>

          <div className="entries">
            {entries.length === 0 ? (
              <p>No entries yet.</p>
            ) : (
              entries.map((e, i) => (
                <div key={i} className="entry">
                  <div className="entry-date">
                    {new Date(e.date).toLocaleString()}
                  </div>
                  <p>{e.text}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default GamePage;
