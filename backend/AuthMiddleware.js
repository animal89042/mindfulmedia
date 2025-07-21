export const requireSteamID = (req, res, next) => {

    const steam_id = req.session?.passport?.user?.id;
    if (!steam_id) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    req.steam_id = steam_id;
    next();
};