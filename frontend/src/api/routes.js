const routes = {
    // Auth
    loginSteam: '/auth/steam/login',
    logout: '/logout',

    // Admin
    adminUsers: '/admin/users',

    // User
    me: '/me',
    profile: '/profile',
    profileByUsername: (u) => `/users/${encodeURIComponent(u)}/profile`,

    // Games
    game: (appid) => `/game/${appid}`,
    games: '/games',
    gameStats: (appid) => `/game/${appid}/stats`,

    // Journals
    journals: '/journals',
    journalsByApp: (appid) => `/journals?appid=${appid}`,
    journalById: (id) => `/journals/${id}`,

    // Friends
    friends: '/friends',
    friendRequests: '/friends/requests',
    friendRequestTo: (id) => `/friends/request/${id}`,
    friendAccept: (id) => `/friends/accept/${id}`,
    friendDecline: (id) => `/friends/decline/${id}`,
    friendRemove: (id) => `/friends/${id}`,
    friendBlock: (id) => `/friends/block/${id}`,

    // Misc
    playerSummary: '/playersummary',
    test: '/test',
};

export default routes;
