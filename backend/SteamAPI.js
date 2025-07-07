const axios = require('axios');
const STEAM_API_KEY = process.env.STEAM_API_KEY;

async function getOwnedGames(steamID) {
    try {
        const response = await axios.get('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/', {
            params: {
                key: STEAM_API_KEY,
                steamid: steamID,
                include_appinfo: true,
                include_played_free_games: true,
            },
        });
        console.log(response.data.response);
        return response.data.response.games || [];
    } catch (error) {
        console.error('Error fetching owned games:', error.message);
        throw error;
    }
}

async function getGameData(id) {
    try {
        const response = await axios.get('https://store.steampowered.com/api/appdetails', {
            params: { appids: id }
        });

        const data = response.data[id];
        if (!data.success) return null;

        const categories = data.data.categories
            ? data.data.categories.map(c => c.description).join(', ')
            : 'N/A';

        return {
            id: id,
            title: data.data.name,
            imageUrl: data.data.header_image, // large banner image
            category: categories
        };
    } catch (error) {
        console.error('Steam API error:', error);
        return null;
    }
}

module.exports = {getOwnedGames, getGameData};