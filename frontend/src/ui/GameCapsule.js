import React, { useState } from 'react';
import './GameCapsule.css';

const GameImage = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <div className="image-placeholder"></div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{ display: loaded ? 'block' : 'none' }}
        className="game-image-content"
      />
    </>
  );
};

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