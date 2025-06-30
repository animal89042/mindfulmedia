import React, { useState } from 'react';
import './GameImage.css';

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

export default GameImage;