import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./GamePage.css";
import apiRoutes from "../apiRoutes";

const GamePage = () => {
  const { id } = useParams(); // this is your appid
  const [game, setGame] = useState(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [errorGame, setErrorGame] = useState(null);

  const [title, setTitle] = useState("");
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [errorEntries, setErrorEntries] = useState(null);

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorSave, setErrorSave] = useState(null);

  // 1) fetch game details
  useEffect(() => {
    setLoadingGame(true);
    axios
      .get(apiRoutes.getGame(id), { withCredentials: true })
      .then(({ data }) => {
        setGame(data);
        setLoadingGame(false);
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Failed to load game";
        setErrorGame(msg);
        setLoadingGame(false);
      });
  }, [id]);

  // 2) load journal entries from backend
  useEffect(() => {
    setLoadingEntries(true);
    setErrorEntries(null);

    axios
      .get(apiRoutes.getJournalApp(id), { withCredentials: true })
      .then(({ data }) => {
        setEntries(data);
        setLoadingEntries(false);
      })
      .catch((err) => {
        console.error("Failed to fetch journals:", err);
        setErrorEntries("Could not load journal entries");
        setLoadingEntries(false);
      });
  }, [id]);

  // 3) save a new journal entry
  const handleSaveEntry = () => {
    if (!draft.trim()) return;
    setSaving(true);
    setErrorSave(null);

    axios
      .post(apiRoutes.postJournal, {
        appid: id,
        entry: draft.trim(),
        title: title.trim(),
      }, { withCredentials: true })
      .then(({ data }) => {
        // optimistic: prepend the newly created entry
        setEntries((prev) => [data, ...prev]);
        setDraft("");
        setTitle("");
      })
      .catch((err) => {
        console.error("Failed to save journal:", err);
        setErrorSave("Could not save entry");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  if (loadingGame) return <div>Loading game...</div>;
  if (errorGame)
    return (
      <div>
        {errorGame === "Game not found"
          ? "Game not found"
          : `Error: ${errorGame}`}
      </div>
    );
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
          <input
              type="text"
              placeholder="Entry Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your thoughts..."
            disabled={saving}
          />
          <button onClick={handleSaveEntry} disabled={saving}>
            {saving ? "Saving…" : "Save Entry"}
          </button>
          {errorSave && <p className="error">{errorSave}</p>}

          {loadingEntries ? (
            <p>Loading entries…</p>
          ) : errorEntries ? (
            <p className="error">{errorEntries}</p>
          ) : entries.length === 0 ? (
            <p>No entries yet.</p>
          ) : (
              entries.map((e, i) => (
                  <div key={i} className="entry">
                    <h4>{e.journal_title || "(Untitled)"}</h4>
                    <p>{e.entry}</p>
                    <small>Last edited: {new Date(e.edited_at).toLocaleString()}</small>
                  </div>
              ))
          )}
        </section>
      </div>
    </div>
  );
};

export default GamePage;
