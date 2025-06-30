import React from 'react';
import './NavigationBar.css';

const NavigationBar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="nav-button">Home</button>
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
        <button className="nav-button sign-in">Sign In</button>
      </div>
    </nav>
  );
};

export default NavigationBar;