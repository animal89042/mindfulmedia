import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";


export default function LoginPage({ user, checked }) {
    const navigate = useNavigate();

    useEffect(() => {
        if (checked && user) navigate("/", { replace: true });
    }, [checked, user, navigate]);

    if (!checked) return null;

    if (!user) {
        return (
            <div className="min-h-[60vh] grid place-items-center p-6 text-zinc-100">
                <div className="w-[420px] rounded-xl border border-white/15 bg-zinc-900 p-6 shadow-card text-center">
                    <h2 className="text-2xl font-bold mb-3">Sign in</h2>
                    <p className="text-white/80 mb-6">Use Steam to access your library and stats.</p>
                    <a href="/api/auth/steam/login" className="inline-block rounded-lg border border-white/20 bg-white/10 px-4 py-2 no-underline">
                        Sign in with Steam
                    </a>
                </div>
            </div>
        );
    }
    return null;
}
