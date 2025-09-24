import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client";
import routes from "../../api/routes";

function looksLikeSteamId(s) {
    if (!s) return false;
    const str = String(s).trim();
    // steam_abcdef..., 17-digit steamid64, or long hex-y handles
    return (
        /^steam_[a-z0-9]+$/i.test(str) ||
        /^[0-9]{17}$/.test(str) ||
        /^(?:[a-f0-9]{10,})$/i.test(str)
    );
}

function maskId(id) {
    if (!id) return "User";
    const s = String(id);
    return `User #${s.slice(-4)}`;
}

function pickDisplayName(u) {
    // Prefer human-friendly names first
    const candidates = [
        u.username,
        u.display_name,
        u.displayName,
        u.personaname,   // Steam
        u.personaName,   // Steam (alt casing)
        u.name,
        u.email
    ].filter(Boolean);

    // First non-empty candidate that doesn't look like a Steam ID
    const nice = candidates.find((c) => !looksLikeSteamId(c));
    if (nice) return nice;

    // Fall back to persona name if we only had IDs elsewhere
    if (u.personaname && !looksLikeSteamId(u.personaname)) return u.personaname;
    if (u.personaName && !looksLikeSteamId(u.personaName)) return u.personaName;

    // Final fallback: masked id or generic
    const anyId = u.id ?? u.user_id ?? u.identity_id ?? u.uid ?? u.account_id;
    return maskId(anyId);
}

export default function AdminSidebar({ open, onClose }) {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [error, setError] = useState(null);

    const close = useCallback(() => {
        if (typeof onClose === "function") onClose();
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        let alive = true;

        (async () => {
            setLoading(true);
            setError(null);
            setUsers([]);

            try {
                const listPath = routes?.adminUsers || "/admin/users";
                const { data } = await api.get(listPath, { withCredentials: true });

                const list = Array.isArray(data?.users)
                    ? data.users
                    : Array.isArray(data)
                        ? data
                        : [];

                const normalized = (list || []).map((u) => {
                    const id =
                        u.id ?? u.user_id ?? u.identity_id ?? u.uid ?? u.account_id ?? null;

                    const name = pickDisplayName({ ...u, id });

                    const avatar = u.avatarfull ?? u.avatar_url ?? u.avatar ?? null;
                    const role = u.role ?? u.user_role ?? "user";
                    return { id, name, avatar, role };
                });

                if (alive) {
                    setUsers(normalized);
                    if (normalized.length === 0) setError("No users found.");
                }
            } catch (e) {
                if (!alive) return;
                const status = e?.response?.status;
                if (status === 401) setError("Please sign in to view users.");
                else if (status === 403) setError("Admin only.");
                else if (status === 404) setError("Admin users endpoint not found.");
                else setError("Failed to load users.");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [open]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 transition-opacity ${
                    open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                } z-[49]`}
                onClick={close}
                aria-hidden={!open}
            />

            {/* Panel (theme-aware) */}
            <aside
                className={`fixed top-0 right-0 h-full w-[360px] bg-white text-zinc-900
                    dark:bg-zinc-900 dark:text-zinc-100
                    border-l border-zinc-200 dark:border-white/10
                    transform transition-transform duration-200 ${
                    open ? "translate-x-0" : "translate-x-full"
                } z-[50] shadow-xl`}
                role="dialog"
                aria-modal="true"
                aria-label="Admin"
            >
                <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-200 dark:border-white/10">
                    <h2 className="text-lg font-semibold">Admin</h2>
                    <button
                        onClick={close}
                        className="px-3 py-1.5 rounded-md
                            bg-zinc-800 text-white hover:bg-zinc-700
                            dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200
                            border border-transparent shadow-sm"
                        aria-label="Close admin panel"
                    >
                        Close
                    </button>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
                    {loading && <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>}
                    {!loading && error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
                    {!loading && !error && users.length === 0 && (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">No users found.</div>
                    )}

                    {!loading &&
                        !error &&
                        users.map((u) => (
                            <div
                                key={u.id ?? `${u.name}-${Math.random()}`}
                                className="flex items-center gap-3 p-2 rounded-lg
                           bg-zinc-50 border border-zinc-200
                           dark:bg-white/5 dark:border-white/10"
                            >
                                {u.avatar ? (
                                    <img
                                        src={u.avatar}
                                        alt=""
                                        className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-white/10"
                                        onError={(e) => (e.currentTarget.style.display = "none")}
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-zinc-200 text-zinc-500
                                  dark:bg-white/10 dark:text-zinc-400
                                  border border-zinc-200 dark:border-white/10
                                  grid place-items-center text-xs">
                                        ?
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="font-medium leading-tight truncate">{u.name}</div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{u.role}</div>
                                </div>
                            </div>
                        ))}
                </div>
            </aside>
        </>
    );
}