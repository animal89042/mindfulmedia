import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { api } from "../api/client";
import routes from "../api/routes";

import Navbar from "../components/layout/Navbar";
import LoginPage from "../features/auth/LoginPage";
import GamePage from "../features/game/GamePage";
import ProfilePage from "../features/profile/ProfilePage";
import Journal from "../features/journal/Journal";
import LibraryPage from "../features/library/LibraryPage";
import AdminSidebar from "../components/admin/AdminSidebar";

export default function App() {
    const [user, setUser] = useState(null);
    const [checked, setChecked] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [adminOpen, setAdminOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        api.get(routes.me) // GET /api/me
            .then((res) => setUser(res.data))
            .catch(() => setUser(null))
            .finally(() => setChecked(true));
    }, []);

    useEffect(() => {
        if (!checked || !user) {
            setIsAdmin(false);
            return;
        }
        setIsAdmin(String(user?.role || "").toLowerCase() === "admin");
    }, [checked, user]);

    // Guard wrapper
    const RequireAuth = (el) =>
        checked ? (user ? el : <Navigate to="/login" replace />) : <></>;

    return (
        <Router>
            <AdminSidebar open={adminOpen} onClose={() => setAdminOpen(false)} />
            <div className="App">
                <Navbar user={user} checked={checked} setUser={setUser} onSearch={setSearchQuery} />

                {checked && user && isAdmin ? (
                    <button
                        onClick={() => setAdminOpen(true)}
                        className="fixed left-4 bottom-4 z-50 rounded-full px-4 py-2 bg-white/10 text-white border border-white/20"
                    >
                        Admin
                    </button>
                ) : null}

                <Routes>
                    {/* Login */}
                    <Route path="/login" element={<LoginPage user={user} checked={checked} />} />

                    {/* Home (library) */}
                    <Route
                        path="/"
                        element={RequireAuth(
                            <LibraryPage user={user} checked={checked} searchQuery={searchQuery} />
                        )}
                    />

                    {/* Game detail */}
                    <Route
                        path="/game/:id"
                        element={RequireAuth(<GamePage user={user} checked={checked} />)}
                    />

                    {/* Journal */}
                    <Route
                        path="/journal"
                        element={RequireAuth(<Journal user={user} checked={checked} />)}
                    />

                    {/* Profile */}
                    <Route
                        path="/profile"
                        element={RequireAuth(
                            <ProfilePage user={user} setUser={setUser} checked={checked} />
                        )}
                    />

                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </div>
        </Router>
    );
}