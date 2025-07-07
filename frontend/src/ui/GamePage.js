import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './GamePage.css';

const GamePage = ({ games }) => {
  const { id } = useParams();
  const game = games.find(g => g.id === parseInt(id));
  const storageKey = `journal-${id}`;

  // state for all entries, plus the draft text
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState('');

  // on mount/load id change, pull from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || [];
    setEntries(saved);
  }, [storageKey]);

  // const saveEntry = () => { } for mySQL later

  if (!game) return <div className="game-page"><h2>Game not found</h2></div>;

  return (
    <div className="game-page">
      <h1>{game.title}</h1>
      {/* wrap details + journal in a flex container */}
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
            onChange={e => setDraft(e.target.value)}
            placeholder="Write your thoughts..."
          />
          {/* <button onClick={saveEntry}>Save Entry</button> */}
          <button>Save Entry</button>

          <div className="entries">
            {entries.map((e, i) => (
              <div key={i} className="entry">
                <div className="entry-date">
                  {new Date(e.date).toLocaleString()}
                </div>
                <p>{e.text}</p>
              </div>
            ))}
            {entries.length === 0 && <p>No entries yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default GamePage;