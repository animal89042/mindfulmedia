import axios from "axios";
import http from "http";
import https from "https";
import { cache } from "../cache.js";

const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Reuse sockets (keep-alive) to reduce latency
const httpAgent  = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const httpClient = axios.create({
    timeout: 8000,
    httpAgent,
    httpsAgent,
    headers: { "Accept-Encoding": "gzip, deflate, br" },
});

// tiny retry with backoff
async function withRetry(fn, { retries = 2, delayMs = 400 } = {}) {
    let err;
    for (let i = 0; i <= retries; i++) {
        try { return await fn(); } catch (e) {
            err = e;
            if (i < retries) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        }
    }
    throw err;
}

export async function getOwnedGames(steamID) {
    const key = `steam:owned:${steamID}`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
        const params = {
            key: STEAM_API_KEY,
            steamid: steamID,
            include_appinfo: 1,
            include_played_free_games: 1,
        };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        const games = data?.response?.games ?? [];
        return games.map(g => ({
            appid: g.appid,
            name: g.name || null,
            img_icon_url: g.img_icon_url || null,
            icon_url: g.img_icon_url
                ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
                : null,
            playtime_forever: g.playtime_forever ?? 0,
        }));
    });
}

export async function getGameData(appid) {
    const key = `steam:details:${appid}`;
    return cache.wrap(key, 5 * 60_000, 10 * 60_000, async () => {
        const url = "https://store.steampowered.com/api/appdetails";
        const params = { appids: appid };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        const item = data?.[appid];
        if (!item?.success || !item?.data) return null;
        const categories = item.data.categories
            ? item.data.categories.map(c => c.description).join(", ")
            : "Uncategorized";
        return {
            appid,
            title: item.data.name || "Unknown",
            imageUrl: item.data.header_image || "",
            category: categories,
        };
    });
}

export async function getPlayerSummary(steamID) {
    const key = `steam:summary:${steamID}`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/";
        const params = { key: STEAM_API_KEY, steamids: steamID };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        const p = data?.response?.players?.[0];
        if (!p) return null;
        return { personaname: p.personaname, avatar: p.avatar, avatarfull: p.avatarfull };
    });
}

export async function getUserStatsForGame(steamID, appid) {
    const key = `steam:userstats:${steamID}:${appid}`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const url = "https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/";
        const params = { key: STEAM_API_KEY, steamid: steamID, appid };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        return data?.playerstats ?? {};
    });
}

export async function getPlaytimeForApp(steamID, appid) {
    const key = `steam:playtime:${steamID}:${appid}`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
        const params = {
            key: STEAM_API_KEY,
            steamid: steamID,
            include_appinfo: 0,
            include_played_free_games: 1,
            "appids_filter[0]": String(appid),
        };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        return data?.response?.games?.[0]?.playtime_forever ?? 0;
    });
}