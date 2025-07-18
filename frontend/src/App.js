import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import axios from "axios";

import "./App.css";
import NavigationBar from "./ui/NavigationBar";
import GamePage from "./ui/GamePage";
import GameCapsuleList from "./GameCapsuleList";
import Journal from "./ui/Journal"; //Import the dynamic list for users
import apiRoutes from "./apiRoutes";

function App() {
  const [backendMessage, setBackendMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    axios
      .get(apiRoutes.getTestConnection)
      .then((response) => setBackendMessage(response.data.message))
      .catch((error) =>
        console.error("COULDNT SIEZE THE BACKEND ARGHHHH", error)
      );
  }, []);

  return (
    <Router>
      <div className="App">
        {/* pass down the setter so Navbar can publish search terms */}
        <NavigationBar onSearch={setSearchQuery} />

        <div
          style={{ marginBottom: "20px", fontStyle: "italic", color: "#555" }}
        >
          Backend says:{" "}
          {backendMessage || "Feeding the starving port channels..."}
        </div>

        <Routes>
          {/* Route for individual game page */}
          <Route path="/GamePage/:id" element={<GamePage />} />

          {/* Route for SteamID-specific game list */}
          <Route
            path="/:steamid"
            element={<GameCapsuleList searchQuery={searchQuery} />}
          />

          <Route path="/journal" element={<Journal />} />

          {/* Default page */}
          <Route
            path="/"
            element={
              <p>
                Please login or enter your SteamID in the URL to see your game
                collection.
              </p>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
