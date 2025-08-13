import React, {useEffect, useState, useMemo } from "react";
import axios from "axios";
import "./Journal.css";
import apiRoutes from "../apiRoutes";
import JournalGameGroup from "./JournalGameGroup";

const normalizeEntry = (e) => ({
    id: e.id ?? e.entry_id ?? e.journal_id,
    appid: Number(e.appid ?? e.app_id ?? e.game_appid),
    journal_title: e.journal_title ?? e.title ?? "",
    entry: e.entry ?? e.content ?? e.text ?? "",
    created_at: e.created_at ?? e.createdAt ?? new Date().toISOString(),
    edited_at:
        e.edited_at ?? e.updated_at ?? e.updatedAt ?? e.created_at ?? new Date().toISOString(),
});

const normalizeGame = (g) => ({
    appid: Number(g.appid ?? g.app_id ?? g.id),
    title: g.title ?? g.name ?? g.game_title ?? "(Unknown)",
    imageUrl: g.imageUrl ?? g.img ?? g.icon_url,
    playtime: g.playtime ?? g.playtime_minutes ?? 0,
});

const coerceArray = (data, key) =>
    Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : Array.isArray(data?.rows) ? data.rows : [];

const Journal = ({ searchTerm = "" }) => {
    const [entries, setEntries] = useState([]);
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const run = async () => {
            try {
                const [entriesRes, gamesRes] = await Promise.all([
                    axios.get(apiRoutes.getJournal, {withCredentials: true}),
                    axios.get(apiRoutes.getGames, {withCredentials: true}),
                ]);

                const rawEntries = coerceArray(entriesRes.data, "entries").map(normalizeEntry);
                const rawGames   = coerceArray(gamesRes.data, "games").map(normalizeGame);

                setEntries(rawEntries);
                setGames(rawGames);
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError("Could not load journal or games");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, []);

    // Filter games by searchTerm
    const filteredGames = useMemo(() => {
        const term = (searchTerm ?? "").toString().trim().toLowerCase();
        if (!term) return games;
        return games.filter((g) => (g.title || "").toLowerCase().includes(term));
    }, [games, searchTerm]);

    // Group entries by game
    const groupedEntries = useMemo(() => {
        const gameById = new Map(games.map((g) => [g.appid, g]));
        const result = {};

        entries.forEach((e) => {
            // If search is filtering by games, skip entries whose game isn’t in the filtered list
            const inFiltered = filteredGames.some((g) => g.appid === e.appid);
            if (!inFiltered) return;

            const game = gameById.get(e.appid);
            const name = game?.title ?? "(Unknown)";
            if (!result[name]) result[name] = { appid: e.appid, entries: [] };
            result[name].entries.push(e);
        });
        return result;
    }, [entries, games, filteredGames]);

    if (loading) return <p>Loading journal…</p>;
    if (error) return <p>{error}</p>;

    const names = Object.keys(groupedEntries).sort((a, b) => a.localeCompare(b));

    return (
        <div className="journal-page">
            <h1>Journal</h1>
            {names.length === 0 ? (
                <p>No games found.</p>
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