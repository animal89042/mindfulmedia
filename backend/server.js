require('dotenv').config();

const localtunnel   = require('localtunnel');
const express       = require('express');
const cors          = require('cors');
const session       = require('express-session');
const passport      = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const { getGameData, getOwnedGames } = require('./SteamAPI');

const PORT = 5000;
const STEAM_API_KEY = process.env.STEAM_API_KEY;

(async () => {
    const tunnel = await localtunnel({
        port: PORT,
        subdomain: 'mindfulmedia'
    });
    const TUNNEL_URL = tunnel.url;
    console.log('🔨 Tunnel live at:', TUNNEL_URL);

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(session({
        secret: 'thisisarandoms3cr3Tstr1nG123!@#',
        resave: false,
        saveUninitialized: true
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser((id, done) => done(null, { id }));

    passport.use(new SteamStrategy({
            returnURL: `${TUNNEL_URL}/auth/steam/return`,
            realm:     TUNNEL_URL,
            apiKey:    STEAM_API_KEY,
            stateless: true
        }, (identifier, profile, done) => {
        // Your user handling logic
        return done(null, profile)
        }));

    app.get('/auth/steam/login', passport.authenticate('steam'));
    app.get(
        '/auth/steam/return',
        passport.authenticate('steam', { failureRedirect: '/' }),
        (req, res) => {
            const steamID = req.user?.id;
            if (!steamID) return res.redirect('/login/error');
            console.log('SteamID:', steamID);
            res.redirect(`http://localhost:3000/${req.user.id}`);
        }
    );

    app.get('/api/games/:steamid', async (req, res) => {
        const steamid = req.params.steamid;

        try {
            console.log('ENTERING OWNED GAMES ATTEMPT');
            const games = await getOwnedGames(steamid);
            res.json(games);
        }
        catch (err) {
            console.error('Error fetching games from Steam:', err.message);
            res.status(500).json({ err: 'Failed to fetch games from Steam' });
        }
    });

    app.get('/api/game/:id', async (req, res) => {
        try {
            console.log('Fetching game for id:', req.params.id);
            const game = await getGameData(req.params.id);
            if (!game) return res.status(404).json({ error: 'Game not found' });
            res.json(game);
        } catch (error) {
            console.error('Error in /api/game/:id:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/api/test', (req, res) => {
        res.json({ message: 'Tunnel + Steam OAuth are working!' });
    });

    app.listen(PORT, () => {
        console.log(`Backend listening on http://localhost:${PORT}`);
        console.log(`Steam login endpoint: ${TUNNEL_URL}/auth/steam/login`);
    });

    process.on('SIGINT', async () => {
        console.log('Closing tunnel...');
        await tunnel.close();
        process.exit();
    });
})();