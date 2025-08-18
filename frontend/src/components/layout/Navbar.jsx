import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Settings from "../settings/Settings";
import { api } from "../../api/client";
import routes from "../../api/routes";

export default function NavigationBar({ user, checked, setUser, onSearch }) {
    const [q, setQ] = useState("");
    const navigate = useNavigate();
    const { pathname } = useLocation();

    if (!checked || !user) return null;

    useEffect(() => {
        const id = setTimeout(() => onSearch?.(q.trim()), 200);
        return () => clearTimeout(id);
    }, [q, onSearch]);

    const handleLogout = async () => {
        try {
            await api.post(routes.logout);
        } catch (err) {
            console.warn("logout failed", err);
        } finally {
            setUser?.(null);
            navigate("/login", { replace: true });
        }
    };

    const onProfilePage = pathname === "/profile";

    return (
        <header className="sticky top-0 z-50 backdrop-blur bg-black/50 border-b border-white/10">
            <nav className="mx-auto max-w-[1200px] grid grid-cols-[180px_1fr_auto] items-center gap-3 px-4 py-2">
                <Link to="/" className="text-white font-bold no-underline">
                    MindfulMedia
                </Link>

                <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search your library…"
                    className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-white/60 px-3 py-2 outline-none"
                />

                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => navigate("/profile")}
                        className="rounded-lg border border-white/20 bg-white/10 text-white px-3 py-2"
                    >
                        Profile
                    </button>

                    {onProfilePage && (
                        <button
                            onClick={handleLogout}
                            className="rounded-lg border border-white/20 bg-white/10 text-white px-3 py-2"
                        >
                            Sign Out
                        </button>
                    )}

                    <Settings />
                </div>
            </nav>
        </header>
    );
}