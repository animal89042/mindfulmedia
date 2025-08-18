import React, {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {api} from "../../api/client";
import routes from "../../api/routes";

// small horizontal Steam capsule
const capsule184 = (appid) =>
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_184x69.jpg`;
const capsule231 = (appid) =>
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`;
const header460 = (appid) =>
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
const steamCapsule = (appid) =>
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_184x69.jpg`;
const steamHeader = (appid) =>
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

// --- A single journal item with inline edit/delete ---
function JournalItem({ entry, onUpdated, onDeleted }) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(entry.title || "");
    const [body, setBody] = useState(entry.body || "");
    const [saving, setSaving] = useState(false);

    const canSave = !saving && title.trim() && body.trim();

    const save = async () => {
        if (!canSave) return;           // guard
        setSaving(true);
        try {
            const payload = { title: title.trim(), content: body.trim() };
            const { data } = await api.put(routes.journalById(entry.id), payload);
            const updated = {
                ...entry,
                ...(data?.journal ?? data ?? {}),
                title: payload.title,
                body: payload.content,
            };
            onUpdated(updated);
            setEditing(false);
        } catch (e) {
            console.error("Update failed", e);
            alert("Failed to update journal.");
        } finally {
            setSaving(false);
        }
    };

    const del = async () => {
        if (typeof window !== "undefined" && !window.confirm("Delete this journal entry?")) {
            return;
        }
        try {
            await api.delete(routes.journalById(entry.id));
            onDeleted(entry.id);
        } catch (e) {
            console.error("Delete failed", e);
            alert("Failed to delete journal.");
        }
    };

    if (editing) {
        return (
            <li className="py-3">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full h-9 mb-2 rounded-md border border-white/15 bg-white/10 px-3 text-white outline-none"
                />
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full min-h-[100px] mb-3 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-white outline-none"
                />
                <div className="flex gap-2">
                    <button
                        onClick={save}
                        disabled={!canSave}
                        className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 disabled:opacity-60"
                    >
                        Save
                    </button>
                    <button
                        onClick={() => setEditing(false)}
                        className="rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={del}
                        className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-red-300"
                    >
                        Delete
                    </button>
                </div>
            </li>
        );
    }

    return (
        <li className="py-3">
            <div className="text-xs text-white/60 mb-1">
                {new Date(entry.created_at).toLocaleString()}
            </div>
            {entry.title && <strong className="block">{entry.title}</strong>}
            <div className="whitespace-pre-wrap">{entry.body}</div>
            <div className="mt-2 flex gap-2">
                <button onClick={() => setEditing(true)}
                        className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
                    Edit
                </button>
                <button onClick={del} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-red-300">
                    Delete
                </button>
            </div>
        </li>
    );
}

// --- Add-new form inside each game's section ---
function NewEntryForm({appid, onCreated}) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [saving, setSaving] = useState(false);

    const canSave = !saving && title.trim() && body.trim();

    const create = async () => {
        if (!canSave) return;            // guard: require title + body
        setSaving(true);
        try {
            const payload = { appid: Number(appid), title: title.trim(), content: body.trim() };
            const { data } = await api.post(routes.journals, payload);
            const saved = Array.isArray(data) ? data[0] : data?.journal ?? data;
            onCreated({
                id: saved?.jnl_id ?? saved?.id ?? Math.random(),
                appid,
                title: saved?.title ?? payload.title,
                body: saved?.body ?? saved?.entry ?? payload.content,
                created_at: saved?.created_at ?? saved?.createdAt ?? new Date().toISOString(),
            });
            setTitle("");
            setBody("");
        } catch (e) {
            console.error("Create failed", e);
            alert("Failed to save journal.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 mt-3">
            <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full h-9 mb-2 rounded-md border border-white/15 bg-white/10 px-3 text-white outline-none"
            />
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your thoughts…"
                className="w-full min-h-[90px] rounded-md border border-white/15 bg-white/10 px-3 py-2 text-white outline-none"
            />
            <div className="mt-2">
                <button
                    onClick={create}
                    disabled={!canSave}
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 disabled:opacity-60"
                >
                    {saving ? "Saving…" : "Add Entry"}
                </button>
            </div>
        </div>
    );
}

export default function ProfilePage({user, checked, setUser}) {
    const navigate = useNavigate();

    const [games, setGames] = useState([]);            // [{ appid, title, imageUrl }]
    const [entries, setEntries] = useState([]);        // raw journals
    const [expanded, setExpanded] = useState(() => new Set()); // which appids are open
    const [loading, setLoading] = useState(true);

    // Guard: if not signed in, bounce (router should also guard)
    useEffect(() => {
        if (checked && !user) {
            setUser?.(null);
            navigate("/login", {replace: true});
        }
    }, [checked, user, navigate, setUser]);

    // Load games + journals
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        Promise.all([
            api.get(routes.games),     // GET /api/games
            api.get(routes.journals),  // GET /api/journals
        ])
            .then(([gRes, jRes]) => {
                const gArr = Array.isArray(gRes.data)
                    ? gRes.data
                    : Array.isArray(gRes.data?.games)
                        ? gRes.data.games
                        : [];
                const normGames = gArr.map((g) => ({
                    appid: String(g.appid ?? g.game_id ?? g.id),
                    title: g.title ?? g.name ?? "Untitled",
                    imageUrl:
                        g.imageUrl ??
                        steamCapsule(g.appid ?? g.game_id ?? g.id) ??
                        steamHeader(g.appid ?? g.game_id ?? g.id),
                }));

                const rawJ = Array.isArray(jRes.data)
                    ? jRes.data
                    : Array.isArray(jRes.data?.entries)
                        ? jRes.data.entries
                        : [];
                const normJ = rawJ.map((r) => ({
                    id: r.jnl_id ?? r.id ?? r.entry_id ?? Math.random(),
                    appid: String(r.appid ?? r.game_id ?? r.platform_game_id ?? ""),
                    title: r.title ?? "",
                    body: r.body ?? r.entry ?? "",
                    created_at: r.created_at ?? r.createdAt ?? new Date().toISOString(),
                }));

                setGames(normGames);
                setEntries(normJ);
            })
            .catch((e) => {
                console.error("Profile load failed", e);
                setGames([]);
                setEntries([]);
            })
            .finally(() => setLoading(false));
    }, [user]);

    // Group journals by appid; include all owned games (even with 0)
    const grouped = useMemo(() => {
        const map = new Map();
        for (const g of games) map.set(String(g.appid), {game: g, items: []});
        for (const e of entries) {
            const key = String(e.appid || "");
            if (!map.has(key)) {
                // if journal belongs to a game not in current owned list, still show it
                map.set(key, {
                    game: {
                        appid: key,
                        title: "(Unknown game)",
                        imageUrl: steamCapsule(key),
                    },
                    items: [],
                });
            }
            map.get(key).items.push(e);
        }
        // Sort games alphabetically
        return Array.from(map.values()).sort((a, b) =>
            (a.game.title || "").localeCompare(b.game.title || "")
        );
    }, [games, entries]);

    const toggle = (appid) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(appid)) next.delete(appid);
            else next.add(appid);
            return next;
        });

    // Mutators passed into children
    const addEntry = (appid) => (newEntry) => {
        setEntries((prev) => [newEntry, ...prev]);
    };
    const updateEntry = (appid) => (updated) => {
        setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    };
    const deleteEntry = (appid) => (id) => {
        setEntries((prev) => prev.filter((e) => e.id !== id));
    };

    if (!checked) return null; // wait for auth probe

    return (
        <div className="max-w-[1000px] mx-auto px-6 py-8 text-zinc-100">

            {/* Header card */}
            <div className="rounded-xl border border-white/15 bg-zinc-900 p-5 shadow-card mb-6">
                <h2 className="text-2xl font-bold text-center mb-2">Profile</h2>
                <div className="text-center text-white/80">
                    {user ? `Signed in as ${user.name || "User"}` : "Not signed in"}
                </div>
            </div>

            {/* Games grouped with collapsible journals */}
            <div className="rounded-xl border border-white/15 bg-zinc-900 p-4 shadow-card">
                <h3 className="text-xl font-semibold text-center mb-4">My Journals</h3>

                {loading ? (
                    <div className="text-white/70 text-center">Loading…</div>
                ) : (
                    <ul className="space-y-3">
                        {grouped.map(({game, items}) => {
                            const appid = String(game.appid);
                            const isOpen = expanded.has(appid);
                            const count = items.length;

                            return (
                                <li key={appid} className="rounded-lg border border-white/10 bg-white/5">
                                    {/* Header row */}
                                    <button
                                        onClick={() => toggle(appid)}
                                        className="w-full flex items-center gap-3 p-3 text-left"
                                    >
                                        <img
                                            src={capsule184(appid)}
                                            srcSet={`
                                                ${capsule184(appid)} 184w,
                                                ${capsule231(appid)} 231w,
                                                ${header460(appid)} 460w
                                            `}
                                            sizes="138px"
                                            width={138}
                                            height={52}
                                            alt={game.title}
                                            className="w-[138px] h-[52px] object-contain rounded-md border border-white/10"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => {
                                                // last-ditch fallback if any size 404s
                                                e.currentTarget.src = header460(appid);
                                                e.currentTarget.srcset = "";
                                            }}
                                        />
                                        <div className="flex-1">
                                            <div className="font-semibold leading-tight">{game.title}</div>
                                            <div className="text-white/60 text-sm">
                                                {count} {count === 1 ? "entry" : "entries"}
                                            </div>
                                        </div>
                                        <a
                                            href={`/game/${appid}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded-md border border-white/20 bg-white/10 px-3 py-2 no-underline"
                                        >
                                            View Game
                                        </a>
                                        <span className="ml-2 text-white/60">
                      {isOpen ? "▾" : "▸"}
                    </span>
                                    </button>

                                    {/* Collapsible content */}
                                    {isOpen && (
                                        <div className="px-4 pb-4">
                                            {count ? (
                                                <ul className="divide-y divide-white/10">
                                                    {items
                                                        .slice()
                                                        .sort(
                                                            (a, b) =>
                                                                new Date(b.created_at) - new Date(a.created_at)
                                                        )
                                                        .map((e) => (
                                                            <JournalItem
                                                                key={e.id}
                                                                entry={e}
                                                                onUpdated={updateEntry(appid)}
                                                                onDeleted={deleteEntry(appid)}
                                                            />
                                                        ))}
                                                </ul>
                                            ) : (
                                                <div className="text-white/70">No entries yet.</div>
                                            )}

                                            {/* Add new */}
                                            <NewEntryForm appid={appid} onCreated={addEntry(appid)}/>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
