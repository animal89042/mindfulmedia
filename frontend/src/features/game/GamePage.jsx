import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import routes from "../../api/routes";
import {api} from "../../api/client";

// Fallback Steam header image by appid
const steamHeader = (appid) =>
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

// Normalize backend responses to consistent fields
const normalizeGame = (raw = {}, appid) => {
    const name =
        raw.name ??
        raw.title ??
        raw?.game?.name ??
        raw?.data?.name ??
        raw?.appinfo?.name ??
        "Game";

    const header_image =
        raw.header_image ??
        raw.headerImage ??
        raw.capsule_image ??
        raw.capsule ??
        raw?.data?.header_image ??
        (appid ? steamHeader(appid) : undefined); // rock-solid fallback

    let categories =
        raw.categories ??
        raw.tags ??
        raw.genres ??
        raw.category ??
        raw?.data?.categories ??
        [];

    if (typeof categories === "string") {
        categories = categories.split(/\s*,\s*/).filter(Boolean);
    }
    if (!Array.isArray(categories)) categories = [];

    return { ...raw, name, header_image, categories };
};

const normalizeEntry = (raw = {}) => ({
    id: raw.jnl_id ?? raw.id ?? raw.entry_id ?? null,
    title: raw.title ?? "",
    body: raw.body ?? raw.entry ?? "",
    created_at: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
});

export default function GamePage() {
    const { id } = useParams(); // Steam appid as a string

    // Game
    const [game, setGame] = useState(null);
    const [loadingGame, setLoadingGame] = useState(true);
    const [errorGame, setErrorGame] = useState(null);

    // Journal
    const [title, setTitle] = useState("");
    const [draft, setDraft] = useState("");
    const [entries, setEntries] = useState([]);
    const [saving, setSaving] = useState(false);
    const [errorSave, setErrorSave] = useState(null);

    // Stats
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);

    // Fetch game
    useEffect(() => {
        let ignore = false;
        const ac = new AbortController();

        setLoadingGame(true);
        api.get(routes.game(id), { signal: ac.signal })
            .then(({ data }) => { if (!ignore) setGame(normalizeGame(data, id)); })
            .catch((err) => { if (!ignore) setErrorGame(err.response?.data?.error || "Failed to load game"); })
            .finally(() => { if (!ignore) setLoadingGame(false); });

        return () => { ignore = true; ac.abort(); };
    }, [id]);

    // Fetch entries
    useEffect(() => {
        api.get(routes.journalsByApp(id))
            .then(({ data }) => {
                const list = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.entries)
                        ? data.entries
                        : [];
                setEntries(list.map(normalizeEntry));
            })
            .catch(() => {})
            .finally(() => {});
    }, [id]);

    // Fetch stats
    useEffect(() => {
        let alive = true;
        (async () => {
            setLoadingStats(true);
            try {
                // Force-sync library minutes from Steam → DB
                await api.get(`${routes.games}?refresh=1`);   // ensures v_identity_library is current

                // fetch game's stats
                const { data } = await api.get(routes.gameStats(id));
                if (alive) setStats(data);
            } catch (err) {
                if (alive) setStats(null);
                console.error("Stats fetch failed:", err?.response?.data || err.message);
            } finally {
                if (alive) setLoadingStats(false);
            }
        })();
        return () => { alive = false; };
    }, [id]);

    const handleSaveEntry = async () => {
        const content = draft.trim();
        const titleText = title.trim();
        if (!content || !titleText) return;
        setSaving(true);
        setErrorSave(null);
        try {
            const payload = {
                appid: Number(id),
                title: titleText,
                content,
            };
            const { data } = await api.post(routes.journals, payload);
            const saved = normalizeEntry(
                Array.isArray(data) ? data[0] : data?.journal ?? data
            );
            setEntries((prev) => [saved, ...prev]);
            setTitle("");
            setDraft("");
        } catch (err) {
            setErrorSave(err.response?.data?.error ?? "Could not save entry");
        } finally {
            setSaving(false);
        }
    };

    if (loadingGame) return <div className="p-6 text-zinc-300">Loading…</div>;
    if (errorGame) return <div className="p-6 text-red-400">{errorGame}</div>;
    if (!game) return <div className="p-6 text-zinc-300">Game not found</div>;

    const minutes = stats?.playtimeMinutes ?? stats?.playtime_forever ?? 0;
    const hours = Math.floor(minutes / 60);
    const hrLabel = hours === 1 ? "hr" : "hrs";
    const minLabel = minutes === 1 ? "minute" : "minutes";

    const hero = game.header_image || steamHeader(id);

    return (
        <div className="max-w-[1200px] mx-auto px-6 py-10 text-zinc-100">

            {/* Grid layout: left | middle | right (collapses on mobile) */}
            <div className="grid gap-5 items-start grid-cols-1 lg:[grid-template-columns:360px_minmax(540px,1fr)_220px]">
                {/* LEFT: title + art + category */}
                <section>
                    <h1 className="text-left text-3xl lg:text-4xl font-extrabold tracking-tight mb-3">
                        {game.name}
                    </h1>
                    <div className="overflow-hidden rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                        <img
                            className="w-full h-auto block"
                            src={hero}
                            alt={`${game.name} header`}
                            onError={(e) => {
                                e.currentTarget.src = steamHeader(id);
                            }}
                            loading="lazy"
                        />
                    </div>

                    {game?.categories?.length > 0 && (
                        <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                            <h3 className="m-0 text-sm opacity-90">Category</h3>
                            <p className="m-0 leading-relaxed opacity-95">
                                {game.categories.join(", ")}
                            </p>
                        </div>
                    )}
                </section>

                {/* MIDDLE: journal */}
                <section className="rounded-2xl bg-white/5 border border-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                    <h2 className="text-center text-xl font-semibold mb-3">My Journal</h2>
                    <input
                        type="text"
                        placeholder="Entry Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full h-10 mb-2 rounded-lg border border-white/15 bg-white/10 px-3 text-white outline-none"
                    />
                    <textarea
                        placeholder="Write your thoughts..."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="w-full min-h-[150px] text-base mb-3 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white outline-none resize-y whitespace-pre-wrap break-words"
                    />
                    <button
                        onClick={handleSaveEntry}
                        disabled={saving || !(title.trim() && draft.trim())}
                        className="inline-flex items-center rounded-xl bg-white/10 border border-white/20 px-4 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.24)] hover:shadow-[0_8px_22px_rgba(0,0,0,0.28)] active:translate-y-[1px] disabled:opacity-60"
                    >
                        {saving ? "Saving…" : "Save Entry"}
                    </button>

                    {errorSave && (
                        <div className="mt-2 text-red-400">{String(errorSave)}</div>
                    )}

                    <div className="mt-4">
                        {entries.length ? (
                            <ul className="divide-y divide-white/10">
                                {entries.map((e) => (
                                    <li key={e.id ?? `${e.created_at}-${Math.random()}`} className="py-3">
                                        <div className="text-xs text-white/60 mb-1">
                                            {new Date(e.created_at).toLocaleString()}
                                        </div>
                                        {e.title && <strong className="block">{e.title}</strong>}
                                        <div className="whitespace-pre-wrap">{e.body || e.entry}</div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="opacity-85">No entries yet.</p>
                        )}
                    </div>
                </section>

                {/* RIGHT: stats */}
                <aside className="flex justify-start lg:justify-start">
                    <div className="w-full max-w-[220px] h-[150px] rounded-2xl bg-white/5 border border-white/10 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.28)] flex flex-col items-center justify-center gap-1">
                        <h3 className="m-0 text-2xl leading-none opacity-90">Total Playtime:</h3>
                        <p className="m-0 text-3xl font-extrabold leading-none">
                            {hours} {hrLabel}
                        </p>
                        <small className="opacity-85">
                            ({minutes} {minLabel})
                        </small>
                    </div>
                </aside>
            </div>
        </div>
    );
}