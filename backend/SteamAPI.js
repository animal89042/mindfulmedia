import axios from "axios";

const STEAM_API_KEY = process.env.STEAM_API_KEY;

// axios instance with timeout & tiny retry helper
const http = axios.create({
    timeout: 8000,
    headers: { "Accept-Encoding": "gzip, deflate, br" },
});

async function withRetry(fn, { retries = 2, delayMs = 400 } = {}) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i === retries) break;
            await new Promise(r => setTimeout(r, delayMs * (i + 1))); // backoff
        }
    }
    throw lastErr;
}

const cache = new Map();

function getCache(key) {
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.val;
    cache.delete(key);
    return null;
}

function setCache(key, val, ttlMs = 60_000) {
    cache.set(key, { val, exp: Date.now() + ttlMs });
}

function iconUrl(appid, hash) {
    return hash
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`
        : null;
}

export async function getOwnedGames(steamID) {
    const cacheKey = `owned:${steamID}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
    const params = {
        key: process.env.STEAM_API_KEY,
        steamid: steamID,
        include_appinfo: 1,
        include_played_free_games: 1,
    };

    const data = await withRetry(async () => (await http.get(url, { params })).data);
    const games = data?.response?.games ?? [];

    const normalized = games.map(g => ({
        appid: g.appid,
        name: g.name || null,
        img_icon_url: g.img_icon_url || null,
        icon_url: iconUrl(g.appid, g.img_icon_url),   // convenience
        playtime_forever: g.playtime_forever ?? 0,
    }));

    setCache(cacheKey, normalized, 60_000);
    return normalized;
}

export async function getGameData(appid) {
    const cacheKey = `details:${appid}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const url = "https://store.steampowered.com/api/appdetails";
    const params = { appids: appid };

    const data = await withRetry(async () => (await http.get(url, { params })).data);
    const item = data?.[appid];

    if (!item?.success || !item?.data) return null;

    const categories = item.data.categories
        ? item.data.categories.map((c) => c.description).join(", ")
        : "Uncategorized";

    const result = {
        appid,
        title: item.data.name || "Unknown",
        imageUrl: item.data.header_image || "",
        category: categories,
    };

    setCache(cacheKey, result, 5 * 60_000);
    return result;
}

export async function getPlayerSummary(steamID) {
    const cacheKey = `summary:${steamID}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/";
    const params = { key: STEAM_API_KEY, steamids: steamID };

    const data = await withRetry(async () => (await http.get(url, { params })).data);
    const p = data?.response?.players?.[0];
    if (!p) return null;

    const result = {
        personaname: p.personaname,
        avatar: p.avatar,
        avatarfull: p.avatarfull,
        profileurl: p.profileurl,
    };
    setCache(cacheKey, result, 60_000);
    return result;
}

export async function getUserStatsForGame(steamId, appid) {
    const res = await fetch(
        `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=${appid}&key=${process.env.STEAM_API_KEY}&steamid=${steamId}`
    );
    if (!res.ok) throw new Error(`Steam stats API error: ${res.statusText}`);
    const data = await res.json();
    return data?.playerstats || {};
}