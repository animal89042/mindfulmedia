import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import axios from "axios";

import "./App.css";
import NavigationBar from "./ui/NavigationBar";
import GamePage from "./ui/GamePage";
import Journal from "./ui/Journal"; //Import the dynamic list for users
import apiRoutes from "./apiRoutes";
import HomePage from "./HomePage";
import AdminSidebar from './AdminSidebar';

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
//this is a test for autodeploying using vercel
  return (
    <Router>
      <AdminSidebar />
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
            path="/"
            element={<HomePage searchQuery={searchQuery} />}
          />

          <Route path="/journal" element={<Journal />} />

          {/* Default page */}
          <Route
            path="*"
            element={
              <p>
                Page Not Found: Error 404
              </p>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
