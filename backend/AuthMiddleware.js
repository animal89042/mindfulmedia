export const requireSteamID = (req, res, next) => {
    console.log(req.session?.passport?.user?.id)
    console.log ("USER ID")
    console.log(req.session?.user?.id)
    console.log ("NO PASSPORT USER ID")
    console.log(req.session?.user)
    console.log ("NO PASSPORT OR ID JUST USER")

    console.log('SESSION:', req.session);
    console.log('SESSION PASSPORT:', req.session.passport);
    console.log('USER:', req.session.passport?.user);
    const steam_id = req.session?.passport?.user?.id;
    if (!steam_id) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    req.steam_id = steam_id;
    next();
};