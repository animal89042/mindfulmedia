const BASE = process.env.REACT_APP_BASE || 'https://mindfulmedia.loca.lt/api';

const apiRoutes = {
    login: `${BASE}/auth/steam/login`,
    getUser: (steamid) => `${BASE}/users/${steamid}`,
    getGame: (appid) => `${BASE}/game/${appid}`, //fetch game details
    getGames: (appid) => `${BASE}/games/${appid}`,
    getJournalApp: (appid) => `${BASE}/journals?appid=${appid}`,
    getJournal: `${BASE}/journals`,
    postJournal: `${BASE}/journals`,
    getPlayerSummary: (steamid) => `${BASE}/playersummary/${steamid}`,
    getTestConnection: `${BASE}/test`,
};

export default apiRoutes;