import React, {useState, useEffect} from 'react';
import axios from 'axios';

import './App.css';
import GameCapsule from './ui/GameCapsule';
import NavigationBar from './ui/NavigationBar';

import cyberpunkImage from './ui/assets/cyberpunk-2077.jpg';
import destinyImage from './ui/assets/destiny-2.jpg';
import doomImage from './ui/assets/doom.jpg';
import doomDarkAgesImage from './ui/assets/doom-the-dark-ages.jpg';
import rainbowSixImage from './ui/assets/tom-clancys-rainbow-six-siege-x.jpg';
import valheimImage from './ui/assets/valheim.jpg';

function App() {

  const [backendMessage, setBackendMessage] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/test')
        .then(response => setBackendMessage(response.data.message))
        .catch(error => console.error('COULDNT SIEZE THE BACKEND ARGHHHH', error));
  }, []);

  const games = [
    {
      title: "Destiny 2",
      imageUrl: destinyImage,
      category: "FPS/RPG",
      //rating: "★★★★☆"
    },
    {
      title: "Cyberpunk 2077",
      imageUrl: cyberpunkImage,
      category: "RPG",
      // rating: "★★★☆☆"
    },
    {
      title: "Doom",
      imageUrl: doomImage,
      category: "FPS",
      //rating: "★★★★★"
    },
    {
      title: "Doom the Dark Ages",
      imageUrl: doomDarkAgesImage, 
      category: "FPS",
      //rating: "Coming Soon"
    },
    {
      title: "Tom Clancy's Rainbow Six Siege",
      imageUrl: rainbowSixImage,
      category: "Tactical FPS",
      //rating: "★★★★☆"
    },
    {
      title: "Valheim",
      imageUrl: valheimImage,
      category: "Survival",
      //rating: "★★★★★"
    }
  ];

  return (
    <div className="App">
      <NavigationBar />
      <h1>Game Collection</h1>

      {/* TESTING MESSAGES TO BACKEND API */}
      <div style={{ marginBottom: '20px', fontStyle: 'italic', color: '#555' }}>
        Backend says: {backendMessage || 'Feeding the starving port channels...'}
      </div>

      <div className="content">
        <div className="games-container">
          {games.map((game, index) => (
            <GameCapsule 
              key={index}
              title={game.title}
              imageUrl={game.imageUrl}
              category={game.category}
              //rating={game.rating}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;