import React, { useEffect, useMemo, useState } from "react";
import JournalGameGroup from "./JournalGameGroup";
import routes from "../../api/routes";
import { api } from "../../api/client";

const normalizeEntry = (e) => ({ id: e.id ?? e.entry_id ?? e.journal_id, appid: Number(e.appid ?? e.app_id ?? e.game_appid), journal_title: e.journal_title ?? e.title ?? "", entry: e.entry ?? e.content ?? e.text ?? "", created_at: e.created_at ?? e.createdAt ?? new Date().toISOString(), edited_at: e.edited_at ?? e.updated_at ?? e.updatedAt ?? e.created_at ?? new Date().toISOString() });
const normalizeGame  = (g) => ({ appid: Number(g.appid ?? g.app_id ?? g.id), title: g.title ?? g.name ?? g.game_title ?? "(Unknown)", imageUrl: g.imageUrl ?? g.img ?? g.icon_url, playtime: g.playtime ?? g.playtime_minutes ?? 0 });
const coerceArray = (d, k) => Array.isArray(d) ? d : Array.isArray(d?.[k]) ? d[k] : Array.isArray(d?.rows) ? d.rows : [];

const Journal = ({ searchTerm = "" }) => {
    const [entries, setEntries] = useState([]);
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [entriesRes, gamesRes] = await Promise.all([api.get(routes.journals), api.get(routes.games)]);
                setEntries(coerceArray(entriesRes.data, "entries").map(normalizeEntry));
                setGames(coerceArray(gamesRes.data, "games").map(normalizeGame));
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError("Could not load journal or games");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filteredGames = useMemo(() => {
        const term = (searchTerm ?? "").toString().trim().toLowerCase();
        if (!term) return games;
        return games.filter((g) => (g.title || "").toLowerCase().includes(term));
    }, [games, searchTerm]);

    const groupedEntries = useMemo(() => {
        const gameById = new Map(games.map((g) => [g.appid, g]));
        const result = {};
        entries.forEach((e) => {
            const inFiltered = filteredGames.some((g) => g.appid === e.appid);
            if (!inFiltered) return;
            const game = gameById.get(e.appid);
            const name = game?.title ?? "(Unknown)";
            if (!result[name]) result[name] = { appid: e.appid, entries: [] };
            result[name].entries.push(e);
        });
        return result;
    }, [entries, games, filteredGames]);

    if (loading) return <p className="p-6 app-subtle">Loading journal…</p>;
    if (error) return <p className="p-6" style={{ color: 'tomato' }}>{error}</p>;

    const names = Object.keys(groupedEntries).sort((a, b) => a.localeCompare(b));

    return (
        <div className="max-w-3xl mx-auto px-5 py-8">
            <h1 className="text-3xl font-semibold mb-6">Journal</h1>
            {names.length === 0 ? (
                <p className="app-subtle">No games found.</p>
            ) : (
                names.map((gameTitle) => (
                    <JournalGameGroup
                        key={groupedEntries[gameTitle].appid || gameTitle}
                        game={gameTitle}
                        appid={groupedEntries[gameTitle].appid}
                        entries={groupedEntries[gameTitle].entries}
                        setEntries={setEntries}
                    />
                ))
            )}
        </div>
    );
};

export default Journal;