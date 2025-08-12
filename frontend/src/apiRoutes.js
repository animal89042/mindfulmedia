const BASE = process.env.REACT_APP_API_BASE_URL;

// Login must be full backend URL in dev
let LOGIN_BASE;
if (process.env.NODE_ENV === "production") {
    LOGIN_BASE = BASE;
} else {
    LOGIN_BASE = "http://localhost:5000/api";
}

const apiRoutes = {
    login: `${LOGIN_BASE}/auth/steam/login`,
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