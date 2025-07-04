import React from 'react';
import { Link } from 'react-router-dom';
import './NavigationBar.css';

const NavigationBar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="nav-button">Home</Link>
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
        <button className="nav-button sign-in"
            onClick={() => {
                window.location.href = 'http://localhost:5000/auth/steam/login';
        }}
        >
          <img
            src="https://steamcommunity-a.akamaihd.net/public/images/signinthroughsteam/sits_01.png"
            alt="Sign in through Steam"
            style={{ height: '32px' }}
          />
        </button>
        {/* <button className="nav-button sign-in">Sign In</button> */}
      </div>
    </nav>
  );
};

export default NavigationBar;