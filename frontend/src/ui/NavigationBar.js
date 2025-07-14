// NavigationBar.js
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import Settings from "./Settings";
import "./NavigationBar.css";

const NavigationBar = ({ onSearch }) => {
  const location = useLocation();

  // SteamID saved in localStorage
  const [savedSteamID, setSavedSteamID] = useState(() =>
    localStorage.getItem("steamid")
  );
  const [avatarFound, setAvatarFound] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [displayName, setDisplayName] = useState(""); // ← new

  // Persist SteamID from URL into localStorage
  useEffect(() => {
    const match = location.pathname.match(/^\/(\d{17,})$/);
    if (match) {
      const id = match[1];
      localStorage.setItem("steamid", id);
      setSavedSteamID(id);
    }
  }, [location.pathname]);

  // Fetch Steam profile summary (avatar + persona name)
  useEffect(() => {
    if (!savedSteamID) return;

    axios
      .get(`http://localhost:5000/api/playersummary/${savedSteamID}`)
      .then((res) => {
        const { avatarFound: af, avatarfull, avatar, personaName } = res.data;
        setAvatarFound(af);
        setAvatarUrl(avatarfull || avatar || "");
        setDisplayName(personaName || ""); // ← set personaName
      })
      .catch((err) => {
        console.error("Failed to fetch player summary:", err);
        setAvatarFound(false);
      });
  }, [savedSteamID]);

  // Home link changes if signed in
  const homeLink = savedSteamID ? `/${savedSteamID}` : "/";

  // Theme toggle (existing)
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark"
  );
  useEffect(() => {
    document.body.classList.toggle("light-theme", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () =>
    setTheme((curr) => (curr === "dark" ? "light" : "dark"));

  // Placeholder for avatar click
  const handleAvatarClick = () => {
    console.log("Avatar button clicked");
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to={homeLink} className="nav-button">
          Home
        </Link>
        <button className="nav-button">Journal</button>
        <button className="nav-button">Goals</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search games..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onSearch(e.target.value);
          }}
        />
        <button className="search-button" onClick={() => onSearch(searchTerm)}>
          🔍
        </button>
      </div>

      <div className="navbar-right">
        <Settings theme={theme} toggleTheme={toggleTheme} />

        {savedSteamID &&
        avatarFound &&
        (location.pathname === `/${savedSteamID}` ||
          !!location.pathname.match(/^\/GamePage(?:\/|$)/)) ? (
          <button className="avatar-button" onClick={handleAvatarClick}>
            <img src={avatarUrl} alt="User Avatar" className="avatar-image" />
            {/* <span className="nav-displayname">{displayName}</span> */}
          </button>
        ) : (
          <button
            className="nav-button sign-in"
            onClick={() =>
              (window.location.href = "http://localhost:5000/auth/steam/login")
            }
          >
            <img
              src="https://steamcommunity-a.akamaihd.net/public/images/signinthroughsteam/sits_01.png"
              alt="Sign in through Steam"
              style={{ height: "32px" }}
            />
          </button>
        )}
      </div>
    </nav>
  );
};

export default NavigationBar;
