let BASE;
if (process.env.NODE_ENV === "production") {
    BASE = "https://mindfulmedia-production-6737.up.railway.app/api";
} else {
    BASE = "http://localhost:5000/api";
}

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