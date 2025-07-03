import React, {useState, useEffect} from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';

import './App.css';
import GameCapsule from './ui/GameCapsule';
import NavigationBar from './ui/NavigationBar';
import GamePage from './ui/GamePage';

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
      id: 1,
      title: "Destiny 2",
      imageUrl: destinyImage,
      category: "FPS/RPG",
      //rating: "★★★★☆"
    },
    {
      id: 2,
      title: "Cyberpunk 2077",
      imageUrl: cyberpunkImage,
      category: "RPG",
      // rating: "★★★☆☆"
    },
    {
      id: 3,
      title: "Doom",
      imageUrl: doomImage,
      category: "FPS",
      //rating: "★★★★★"
    },
    {
      id: 4,
      title: "Doom the Dark Ages",
      imageUrl: doomDarkAgesImage, 
      category: "FPS",
      //rating: "Coming Soon"
    },
    {
      id: 5,
      title: "Tom Clancy's Rainbow Six Siege",
      imageUrl: rainbowSixImage,
      category: "Tactical FPS",
      //rating: "★★★★☆"
    },
    {
      id: 6,
      title: "Valheim",
      imageUrl: valheimImage,
      category: "Survival",
      //rating: "★★★★★"
    }
  ];

  return (
    <Router>
      <div className="App">
        <NavigationBar />
        
        <Routes>
          <Route
            path="/"
            element={
              <>
                <h1>Game Collection</h1>

                {/* TESTING MESSAGES TO BACKEND API */}
                <div style={{ marginBottom: '20px', fontStyle: 'italic', color: '#555' }}>
                  Backend says: {backendMessage || 'Feeding the starving port channels...'}
                </div>

                <div className="content">
                  <div className="games-container">
                    {games.map((game) => (
                      <Link key={game.id} to={`/GamePage/${game.id}`} style={{ textDecoration: 'none' }}>
                        <GameCapsule 
                          title={game.title}
                          imageUrl={game.imageUrl}
                          category={game.category}
                          //rating={game.rating}
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            }
          />
          <Route path="/GamePage/:id" element={<GamePage games={games} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;