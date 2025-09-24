import { api } from "../../api/client";
import routes from "../../api/routes";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GameCapsule from "./GameCapsule";

const GameCapsuleList = ({ searchQuery, layout = "grid", density = "cozy" }) => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch owned games
    useEffect(() => {
        setLoading(true);
        setError(null);
        api
            .get(routes.gameLibrary)
            .then(({ data }) => {
                const arr = Array.isArray(data) ? data : Array.isArray(data?.games) ? data.games : [];
                setGames(arr);
            })
            .catch(() => setError("Failed to fetch games"))
            .finally(() => setLoading(false));
    }, []);

    const safe = Array.isArray(games) ? games : [];
    const filtered = searchQuery
        ? safe.filter((g) => ((g.title || g.name || "").toLowerCase()).includes(searchQuery.toLowerCase()))
        : safe;

    if (loading) return <p className="app-subtle">Loading games…</p>;
    if (error) return <p style={{ color: "tomato" }}>{error}</p>;
    if (filtered.length === 0) {
        return (
            <p className="app-subtle">
                No games found{searchQuery ? ` matching “${searchQuery}”` : ` for your account`}
            </p>
        );
    }

    const isGrid = layout === "grid";
    const gap = density === "compact" ? "gap-3" : "gap-5";
    const containerClass = isGrid
        ? `mx-auto max-w-[1200px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gap}`
        : `mx-auto max-w-4xl flex flex-col ${gap}`;

    return (
        <>
            <h1 className="text-center text-2xl font-extrabold my-4">Game Library</h1>
            <div className={containerClass}>
                {filtered.map((g) => {
                    const title = g.title ?? g.name ?? "Untitled";
                    const imageUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`;
                    const itemWrapperClass = isGrid ? "justify-self-center" : "w-full";
                    return (
                        <Link
                            key={g.appid}
                            to={`/game/${g.appid}`}
                            className={itemWrapperClass}
                            style={{ textDecoration: "none" }}
                        >
                            <GameCapsule
                                title={title}
                                imageUrl={imageUrl}
                                category="Owned Game"
                                layout={layout}
                                density={density}
                            />
                        </Link>
                    );
                })}
            </div>
        </>
    );
};

export default GameCapsuleList;