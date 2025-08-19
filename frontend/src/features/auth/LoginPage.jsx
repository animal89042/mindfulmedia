import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage({ user, checked }) {
    const navigate = useNavigate();
    useEffect(() => { if (checked && user) navigate("/", { replace: true }); }, [checked, user, navigate]);
    if (!checked) return null;

    if (!user) {
        return (
            <div className="min-h-[60vh] grid place-items-center p-6">
                <div className="w-[420px] app-elevated app-border p-6 text-center">
                    <h2 className="text-2xl font-bold mb-3">Sign in</h2>
                    <p className="app-subtle mb-6">Use Steam to access your library and stats.</p>
                    <a href="/api/auth/steam/login" className="btn">Sign in with Steam</a>
                </div>
            </div>
        );
    }
    return null;
}