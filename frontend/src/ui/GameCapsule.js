import React from 'react';
import './GameCapsule.css';
import GameImage from './GameImage';

const GameCapsule = ({ title, imageUrl, category, rating }) => {
  return (
    <div className="game-capsule">
      <div className="game-image">
        <GameImage src={imageUrl} alt={title} />
      </div>
      <div className="game-info">
        <h3>{title}</h3>
        <div className="game-meta">
          <span className="game-category">{category}</span>
          <span className="game-rating">{rating}</span>
        </div>
      </div>
    </div>
  );
};

export default GameCapsule;