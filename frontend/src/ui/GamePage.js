import React from 'react';
import { useParams } from 'react-router-dom';
import './GamePage.css';

const GamePage = ({ games }) => {
  const { id } = useParams();
  const game = games.find(g => g.id === parseInt(id));

  if (!game) return <div className="game-page"><h2>Game not found</h2></div>;

  return (
    <div className="game-page">
      <h1>{game.title}</h1>
      <img src={game.imageUrl} alt={game.title} className="game-page-image" />
      <p>Category: {game.category}</p>
      <p>More game info coming soon...</p>
    </div>
  );
};

export default GamePage;
