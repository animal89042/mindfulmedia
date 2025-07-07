import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';

import './App.css';
import NavigationBar from './ui/NavigationBar';
import GamePage from './ui/GamePage';
import GameCapsuleList from './GameCapsuleList';  //Import the dynamic list for users

function App() {
  const [backendMessage, setBackendMessage] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/test')
        .then(response => setBackendMessage(response.data.message))
        .catch(error => console.error('COULDNT SIEZE THE BACKEND ARGHHHH', error));
  }, []);

  return (
      <Router>
        <div className="App">
          <NavigationBar />
          <div style={{ marginBottom: '20px', fontStyle: 'italic', color: '#555' }}>
            Backend says: {backendMessage || 'Feeding the starving port channels...'}
          </div>

          <Routes>
            {/* Route for individual game page */}
            <Route path="/GamePage/:id" element={<GamePage />} />

            {/* Route for SteamID-specific game list */}
            <Route path="/:steamid" element={<GameCapsuleList />} />

            {/* Default page */}
            <Route
                path="/"
                element={<p>Please login or enter your SteamID in the URL to see your game collection.</p>}
            />
          </Routes>
        </div>
      </Router>
  );
}

export default App;