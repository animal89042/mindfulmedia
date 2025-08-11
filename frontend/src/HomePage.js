import React from "react";
import GameCapsuleList from "./GameCapsuleList";

const HomePage = ({ user, checked, searchQuery }) => {
  
    // Not logged-in
    if (!user || !checked) {
        return (
            <div>
                <p style={{fontStyle: "italic", color: "#777", textAlign: "center"}}>
                    Please log in to view your game library.
                </p>
            </div>
        );
    }

    // Logged-in
    return (
        <div>
            <GameCapsuleList searchQuery={searchQuery}/>
        </div>
    );
};

export default HomePage;