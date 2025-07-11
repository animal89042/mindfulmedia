import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import GameCapsule from './ui/GameCapsule'; //formatting for games data

const GameCapsuleList = ({ searchQuery }) => {
    const { steamid } = useParams();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch owned games
    useEffect(() => {
        if (!steamid) return;
        setLoading(true);
        setError(null);

        axios.get(`http://localhost:5000/api/games/${steamid}`)
            .then(res => {
                setGames(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch games', err);
                setError('Failed to fetch games');
                setLoading(false);
            });
    }, [steamid]);

    // filter by name if there's a query
    const filteredGames = searchQuery
        ? games.filter(game =>
            game.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : games;
    
    if (loading) return <p>Loading games...</p>;
    if (error) return <p>{error}</p>;
    if (filteredGames.length === 0) {
        return (
            <p>
                No games found
                {searchQuery
                    ? ` matching “${searchQuery}”`
                    : ` for SteamID: ${steamid}`}
            </p>
        );
    }

    return (
        <>
            <h1>Game Collection for {steamid}</h1>

            <div className="games-container">
                {filteredGames.map(game => (
                    <Link
                        key={game.appid}
                        to={`/GamePage/${game.appid}`}
                        style={{ textDecoration: 'none' }}
                    >
                        <GameCapsule
                            title={game.name}
                            imageUrl={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`}
                            category="Owned Game"
                        />
                    </Link>
                ))}
            </div>
        </>
    );
};

export default GameCapsuleList;