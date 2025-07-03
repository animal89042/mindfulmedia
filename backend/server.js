require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;

const app = express();
const PORT = 5000;

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const NGROK_URL = process.env.NGROK_URL;

app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'thisisarandoms3cr3Tstr1nG123!@#',
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

passport.use(new SteamStrategy({
    returnURL: `${NGROK_URL}/auth/steam/return`,
    realm: `${NGROK_URL}/`,
    apiKey: STEAM_API_KEY,
}, (identifier, profile, done) => {
    // Your user handling logic
    return done(null, profile);
}));

app.get('/auth/steam/login', passport.authenticate('steam'));

app.get('/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => {
        const steamID = req.user?.id;
        if (!steamID) return res.redirect('/login/error');
        console.log('SteamID:', steamID);
        res.redirect(`http://localhost:3000/dashboard?steamid=${steamID}`);
    }
);

app.get('/api/test', (req, res) => {
    res.json({ message: 'To infinity... and hopefully not beyond our data!' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Use this URL for Steam auth: ${NGROK_URL}/auth/steam/login`);
});