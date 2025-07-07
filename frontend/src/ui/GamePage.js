import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './GamePage.css';


const GamePage = () => {
  const { id } = useParams();  // grabs :id from /GamePage/:id URL
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const storageKey = `journal-${id}`;
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState('');

  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);
  console.log(`Route param id: ${id}`);


  useEffect(() => {
    console.log('[GamePage] useEffect running with id:', id);
    setLoading(true);
    setError(null);

    console.log('Entering GamePage Get');
    axios.get(`http://localhost:5000/api/game/${id}`)
        .then(response => {
          setGame(response.data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.response?.data?.error || 'Failed to load game');
          setLoading(false);
        });
  }, [id]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || [];
    setEntries(saved);
  }, [storageKey]);

  if (loading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error}</div>;
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
                onChange={e => setDraft(e.target.value)}
                placeholder="Write your thoughts..."
            />
            <button>Save Entry</button>

            <div className="entries">
              {entries.length === 0 && <p>No entries yet.</p>}
              {entries.map((e, i) => (
                  <div key={i} className="entry">
                    <div className="entry-date">
                      {new Date(e.date).toLocaleString()}
                    </div>
                    <p>{e.text}</p>
                  </div>
              ))}
            </div>
          </section>
        </div>
      </div>
  );
};

export default GamePage;