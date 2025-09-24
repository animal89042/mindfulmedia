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
import UsernamePrompt from "../features/auth/UsernamePrompt";
import ThemeProvider from "./Theme";
import LeaderboardPage from "../features/LeaderboardsPage";

export default function App() {
    const [user, setUser] = useState(null);
    const [checked, setChecked] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [adminOpen, setAdminOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        api.get(routes.me) // GET /api/me
            .then((res) => setUser(res.data))
            .catch(() => setUser(null))
            .finally(() => setChecked(true));
    }, []);

    useEffect(() => {
        if (checked && user?.needs_username) setShowPrompt(true);
    }, [checked, user]);

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
        <ThemeProvider>
            <Router>

                <AdminSidebar open={adminOpen} onClose={() => setAdminOpen(false)} />

                <div className="App">

                    <UsernamePrompt
                        open={showPrompt}
                        platformName={user?.platformName}
                        onClose={() => setShowPrompt(false)}
                        onSaved={(username) => {
                               setUser((u) => ({ ...(u || {}), username, needs_username: false }));
                               setShowPrompt(false);
                        }}
                        routes={routes}
                    />

                    <Navbar user={user} checked={checked} setUser={setUser} onSearch={setSearchQuery} />

                    {checked && user && isAdmin ? (
                        <button
                            onClick={() => setAdminOpen(true)}
                            className=
                                "fixed left-4 bottom-4 z-50 flex items-center gap-2
                                px-4 py-2 rounded-full shadow-lg text-sm font-medium
                                bg-zinc-900 text-white hover:bg-zinc-800
                                border border-black/10
                                dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:border-white/20
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
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

                        {/* Game Details */}
                        <Route
                            path="/game/:id"
                            element={RequireAuth(<GamePage user={user} checked={checked} />)}
                        />

                        {/* Profile */}
                        <Route
                            path="/profile"
                            element={RequireAuth(
                                <ProfilePage user={user} setUser={setUser} checked={checked} />
                            )}
                        />

                        {/* Leaderboards */}
                        <Route path="/leaderboards/top-time" element={<LeaderboardPage />} />

                        {/* 404 */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </div>
            </Router>
        </ThemeProvider>
    );
}