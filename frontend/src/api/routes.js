const routes = {
    // Auth
    loginSteam: '/auth/steam/login',
    logout: '/logout',

    // Admin
    adminUsers: '/admin/users',

    // User
    me: '/me',
    verifyMe: '/me/username',
    profile: '/profile',
    profileByUsername: (u) => `/users/${encodeURIComponent(u)}/profile`,

    // Games
    game: (appid) => `/game/${appid}`,
    gameStats: (appid) => `/game/${appid}/stats`,
    gameAchievements: (appid) => `/game/${appid}/achievements`,
    gameFriends: (platform, gameId) => `/friends/own/${platform}/${gameId}`,
    gameLibrary: '/games',

    // Journals
    journals: '/journals',
    journalsByApp: (appid) => `/journals/${appid}`,
    journalById: (id) => `/journals/${id}`,

    // Friends
    friends: '/friends',
    friendRequests: '/friends/requests',
    friendRequestTo: (id) => `/friends/request/${id}`,
    friendAccept: (id) => `/friends/accept/${id}`,
    friendDecline: (id) => `/friends/decline/${id}`,
    friendRemove: (id) => `/friends/${id}`,
    friendBlock: (id) => `/friends/block/${id}`,

    leaderboardsTT: '/leaderboards/top-time',

    // Test
    test: '/test',
};

export default routes;
