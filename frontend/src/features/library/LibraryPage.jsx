import React from "react";
import GameCapsuleList from "./GameCapsuleList";

const LibraryPage = ({ user, checked, searchQuery }) => {
    return (
        <div>
            <GameCapsuleList searchQuery={searchQuery} />
        </div>
    );
};

export default LibraryPage;