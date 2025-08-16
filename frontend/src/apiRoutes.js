const isProd = process.env.NODE_ENV === 'production';

const BASE = isProd ? "https://mindfulmedia-production-g.up.railway.app/api": "/api";


const apiRoutes = {
    login: `${BASE}/auth/steam/login`,
    getUser: `${BASE}/me`,
    getGame: (appid) => `${BASE}/game/${appid}`, //fetch game details
    getGames:  `${BASE}/games`,
    getJournalApp: (appid) => `${BASE}/journals?appid=${appid}`,
    getJournal: `${BASE}/journals`,
    getAdminUsers: `${BASE}/admin/users`,
    postJournal: `${BASE}/journals`,
    deleteJournal: (jnl_id) => `${BASE}/journals/${jnl_id}`,
    updateJournal: (jnl_id) => `${BASE}/journals/${jnl_id}`,
    getPlayerSummary: `${BASE}/playersummary`,
    getTestConnection: `${BASE}/test`,
    logout: `${BASE}/logout`,
};

export default apiRoutes;
