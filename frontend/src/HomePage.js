import React, { useEffect, useState } from "react";
import axios from "axios";
import GameCapsuleList from "./GameCapsuleList";
import apiRoutes from "./apiRoutes";

const HomePage = ({ searchQuery }) => {
    const [user, setUser] = useState(null);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        axios
            .get(apiRoutes.getUser, { withCredentials: true })
            .then((res) => {
                console.log('👤 /api/me →', res.data);
                setUser(res.data);
                setChecked(true);
            })
            .catch(() => {
                setUser(null);
                setChecked(true);
            });
    }, []);
    // if (!checked) {console.log("YOU FAILED THE CHECK YOU FUCKING LOSER HAHAHA")}
    if (!checked) return <p>Loading...</p>;

    return (
        <div style={{position: "relative"}}>
            {!user && (
                <p style={{ fontStyle: "italic", color: "#777", textAlign: "center" }}>
                    Please log in to view your game library.
                </p>
            )}
            <GameCapsuleList searchQuery={searchQuery} />
        </div>
    );
};

export default HomePage;