import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import Settings from './Settings';
import './NavigationBar.css';

const NavigationBar = () => {
  const location = useLocation();
  const [savedSteamID, setSavedSteamID] = useState(() => localStorage.getItem('steamid'));
  const [avatarFound, setAvatarFound] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  // Persist SteamID from URL
  useEffect(() => {
    const match = location.pathname.match(/^\/(\d{17,})$/);
    if (match) {
      const id = match[1];
      localStorage.setItem('steamid', id);
      setSavedSteamID(id);
    }
  }, [location.pathname]);

  // Fetch avatar when signed in
  useEffect(() => {
    if (!savedSteamID) return;

    axios.get(`http://localhost:5000/api/playersummary/${savedSteamID}`)
      .then(res => {
        const { avatarFound, avatarfull, avatar } = res.data;
        setAvatarFound(avatarFound);
        setAvatarUrl(avatarfull || avatar || '');
      })
      .catch(err => {
        console.error('Failed to fetch avatar for navigation', err);
        setAvatarFound(false);
      });
  }, [savedSteamID]);

  // Determine home link
  const homeLink = savedSteamID ? `/${savedSteamID}` : '/';

  // Theme toggle
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(curr => (curr === 'dark' ? 'light' : 'dark'));

  // Placeholder click handler for avatar button
  const handleAvatarClick = () => {
    // TODO: Implement future navigation or dropdown
    console.log('Avatar button clicked');
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to={homeLink} className="nav-button">Home</Link>
        <button className="nav-button">Browse</button>
        <button className="nav-button">Categories</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search games..."
          className="search-input"
        />
        <button className="search-button">🔍</button>
      </div>

      <div className="navbar-right">
        <Settings theme={theme} toggleTheme={toggleTheme} />
        {(savedSteamID && avatarFound && (location.pathname === `/${savedSteamID}`)) || (location.pathname.match(/^\/GamePage(?:\/|$)/)) ? (
          <button
            className="avatar-button"
            onClick={handleAvatarClick}
          >
            <img
              src={avatarUrl}
              alt="User Avatar"
              className="avatar-image"
            />
          </button>
        ) : (
          <button
            className="nav-button sign-in"
            onClick={() => window.location.href = 'http://localhost:5000/auth/steam/login'}
          >
            <img
              src="https://steamcommunity-a.akamaihd.net/public/images/signinthroughsteam/sits_01.png"
              alt="Sign in through Steam"
              style={{ height: '32px' }}
            />
          </button>
        )}
      </div>
    </nav>
  );
};

export default NavigationBar;
