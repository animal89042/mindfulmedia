import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./GamePage.css";
import apiRoutes from "../apiRoutes";

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

const GamePage = () => {
    const {id} = useParams(); // Steam appid as a string

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
        setLoadingGame(true);
        axios
            .get(apiRoutes.getGame(id), {withCredentials: true})
            .then(({data}) => setGame(normalizeGame(data, id)))
            .catch((err) =>
                setErrorGame(err.response?.data?.error || "Failed to load game")
            )
            .finally(() => setLoadingGame(false));
    }, [id]);

    // Fetch entries
    useEffect(() => {
        axios
            .get(apiRoutes.getJournalApp(id), { withCredentials: true })
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
        setLoadingStats(true);
        axios
            .get(apiRoutes.getGameStats(id), { withCredentials: true })
            .then(({ data }) => setStats(data))
            .catch(err => console.error('[stats]', err?.response?.status || err.message))
            .finally(() => setLoadingStats(false));
    }, [id]);

    const handleSaveEntry = async () => {
        const body = draft.trim();
        if (!body) return;
        setSaving(true);
        setErrorSave(null);
        try {
            const payload = {
                appid: Number(id),          // some backends require number
                entry: body,                // if server expects 'entry'
                body,                       // if server expects 'body'
                title: title.trim() || null
            };
            const { data } = await axios.post(
                apiRoutes.postJournal,
                payload,
                { withCredentials: true }
            );

            const saved = normalizeEntry(data?.journal ?? data);
            setEntries(prev => [saved, ...prev]);
            setTitle("");
            setDraft("");
        } catch (err) {
            setErrorSave(err.response?.data?.error ?? "Could not save entry");
        } finally {
            setSaving(false);
        }
    };

    if (loadingGame) return <div className="game-page loading">Loading…</div>;
    if (errorGame) return <div className="game-page error">{errorGame}</div>;
    if (!game) return <div className="game-page error">Game not found</div>;

    const minutes = stats?.playtimeMinutes ?? stats?.playtime_forever ?? 0;
    const hours = Math.floor(minutes / 60);
    const hrLabel = hours === 1 ? "hr" : "hrs";
    const minLabel = minutes === 1 ? "minute" : "minutes";

    return (
        <div className="game-page">
            <div className="game-page-content">

                {/* LEFT: title above image */}
                <section className="left-col">
                    <h1 className="game-title">{game.name}</h1>

                    <div className="art-card">
                        <img
                            className="art-img"
                            src={game.header_image}
                            alt={`${game.name} header`}
                            onError={(e) => {
                                e.currentTarget.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
                            }}
                            loading="lazy"
                        />
                    </div>

                    {game?.categories?.length > 0 && (
                        <div className="meta-card">
                            <h3 className="meta-title">Category</h3>
                            <p className="meta-text">{game.categories.join(", ")}</p>
                        </div>
                    )}
                </section>

                {/* MIDDLE: journal */}
                <section className="mid-col journal-card">
                    <h2>My Journal</h2>
                    <input
                        type="text"
                        placeholder="Entry Title (optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <textarea
                        placeholder="Write your thoughts..."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <button
                        className="primary-btn"
                        onClick={handleSaveEntry}
                        disabled={saving || !draft.trim()}
                    >
                        {saving ? "Saving…" : "Save Entry"}
                    </button>
                    <div className="entries">
                        {entries.length ? (
                            entries.map(e => (
                                <div className="entry" key={e.id ?? e.jnl_id ?? `${e.created_at}-${Math.random()}`}>
                                    <div className="entry-date">{new Date(e.created_at).toLocaleString()}</div>
                                    {e.title && <strong>{e.title}</strong>}
                                    <div>{e.body || e.entry}</div>
                                </div>
                            ))
                        ) : (
                            <p className="no-entries">No entries yet.</p>
                        )}
                    </div>
                </section>

                {/* RIGHT: stats */}
                <aside className="right-col">
                    <div className="stats-card">
                        <h3>Total Playtime:</h3>
                        <>
                            <p className="stats-hours">
                                {Math.floor((stats?.playtimeMinutes ?? stats?.playtime_forever ?? 0) / 60)}{" "}
                                {Math.floor((stats?.playtimeMinutes ?? stats?.playtime_forever ?? 0) / 60) === 1 ? "hr" : "hrs"}
                            </p>
                            <small>
                                ({(stats?.playtimeMinutes ?? stats?.playtime_forever ?? 0)}{" "}
                                {(stats?.playtimeMinutes ?? stats?.playtime_forever ?? 0) === 1 ? "minute" : "minutes"})
                            </small>
                        </>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default GamePage;