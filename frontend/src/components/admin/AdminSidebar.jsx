import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client";
import routes from "../../api/routes";

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
                // Strictly hit the admin list; rely on HTTP status for auth
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

                    const name =
                        u.username ??
                        u.display_name ??
                        u.displayName ??
                        u.personaname ??
                        u.personaName ??
                        u.name ??
                        u.email ??
                        (id ? `User #${id}` : "Unknown");

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

        return () => { alive = false; };
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

            {/* Panel */}
            <aside
                className={`fixed top-0 right-0 h-full w-[360px] bg-zinc-900 text-zinc-100 border-l border-white/10 transform transition-transform duration-200 ${
                    open ? "translate-x-0" : "translate-x-full"
                } z-[50] shadow-xl`}
                role="dialog"
                aria-modal="true"
                aria-label="Admin"
            >
                <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                    <h2 className="text-lg font-semibold">Admin</h2>
                    <button
                        onClick={close}
                        className="px-2 py-1 rounded-md bg-white/10 border border-white/20 hover:bg-white/15"
                        aria-label="Close admin panel"
                    >
                        Close
                    </button>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
                    {loading && <div className="text-sm text-zinc-400">Loading…</div>}
                    {!loading && error && <div className="text-sm text-red-400">{error}</div>}
                    {!loading && !error && users.length === 0 && (
                        <div className="text-sm text-zinc-400">No users found.</div>
                    )}
                    {!loading && !error &&
                        users.map((u) => (
                            <div
                                key={u.id ?? Math.random()}
                                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10"
                            >
                                {u.avatar ? (
                                    <img
                                        src={u.avatar}
                                        alt=""
                                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                                        onError={(e) => (e.currentTarget.style.display = "none")}
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 grid place-items-center text-xs text-zinc-400">
                                        ?
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="font-medium leading-tight">{u.name}</div>
                                    <div className="text-xs text-zinc-400">{u.role}</div>
                                </div>
                            </div>
                        ))}
                </div>
            </aside>
        </>
    );
}