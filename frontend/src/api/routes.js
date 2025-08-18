// Path-only routes. Your API client will prepend its baseURL.
const routes = {
    // Auth
    loginSteam: '/auth/steam/login',
    logout: '/logout',

    // User
    me: '/me',

    // Games
    game: (appid) => `/game/${appid}`,
    games: '/games',
    gameStats: (appid) => `/game/${appid}/stats`,

    // Journals
    journals: '/journals',
    journalsByApp: (appid) => `/journals?appid=${appid}`,
    journalById: (id) => `/journals/${id}`,

    // Admin
    adminUsers: '/admin/users',

    // Misc
    playerSummary: '/playersummary',
    test: '/test',
};

export default routes;
