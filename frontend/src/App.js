import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import axios from "axios";

import ProfilePage from './ui/ProfilePage';
import "./App.css";
import NavigationBar from "./ui/NavigationBar";
import GamePage from "./ui/GamePage";
import Journal from "./ui/Journal"; //Import the dynamic list for users
import apiRoutes from "./apiRoutes";
import HomePage from "./HomePage";
import AdminSidebar from './AdminSidebar';

function App() {
  // 1) Central auth state
  const [user, setUser]       = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    axios
      .get(apiRoutes.getUser, { withCredentials: true })
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    axios
      .get(apiRoutes.getTestConnection)
  }, []);

  //this is a test for autodeploying using vercel
  return (
    <Router>
      <AdminSidebar user={user} checked={checked} />
      <div className="App">
        {/* pass down the setter so Navbar can publish search terms */}
        <NavigationBar
            user={user}
            checked={checked}
            onSearch={setSearchQuery}
        />

        <div
          style={{ marginBottom: "20px", fontStyle: "italic", color: "#555" }}
        >
        </div>

        <Routes>
          {/* Home, gaurded by checked/user props*/}
          <Route
              path="/"
              element={
                <HomePage
                  user={user}
                  checked={checked}
                  searchQuery={searchQuery}
                />
              }
          />

          {/* Route for individual game page */}
          <Route
              path="/GamePage/:id"
              element={
                <GamePage user={user} checked={checked} />
              }
          />

          {/* Route for Journal Listings */}
          <Route
              path="/journal"
              element={
                <Journal user={user} checked={checked} />
              }
          />

          {/* Route for Profile Page*/}
          <Route
              path="profile"
              element={
                <ProfilePage
                    user={user}
                    setUser={setUser}
                    checked={checked}
                />
              }
          />

          <Route path="/journal" element={<Journal searchTerm={searchQuery} />} />

          {/* Catch-all */}
          <Route
              path="*"
              element={<p>Page Not Found: Error 404</p>}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
