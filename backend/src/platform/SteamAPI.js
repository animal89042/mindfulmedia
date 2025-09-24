import axios from "axios";
import http from "http";
import https from "https";
import { cache } from "../cache.js";

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_KEY_OWNER = "76561199095588644" || null;

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

/* ----- Bypass Steam API Key edge case ----- */
async function communityHasGame(steamID, appid, { probe = false } = {}) {
    const cachebuster = Date.now();
    const url = `https://steamcommunity.com/profiles/${steamID}/games/?tab=all&xml=1&t=${cachebuster}`; //
    const headers = probe
        ? {
            "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        } : undefined;

    const xml = await httpClient
        .get(url, { headers, responseType: "text" })
        .then((r) => (typeof r.data === "string" ? r.data : String(r.data)))
        .catch(() => "");

    const privacyMatch = xml.match(/<privacyState>([^<]+)<\/privacyState>/i);
    if (privacyMatch && String(privacyMatch[1]).toLowerCase() !== "public") return false;

    const needle = `<appID>${Number(appid)}</appID>`;
    return xml.includes(needle);
}

/* ---------- Owned Games (full library) ---------- */
export async function getOwnedGames( steamID ) {
    const key = `steam:owned:${ steamID }`;
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

/* ---------- Game details from Steam store ---------- */
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

/* ---------- Player summary (avatar, persona) ---------- */
export async function getPlayerSummary(steamID) {
    const key = `steam:summary:${steamID}`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/";
        const params = { key: STEAM_API_KEY, steamids: steamID, _: Date.now() };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        const p = data?.response?.players?.[0];
        if (!p) return null;
        return {
            personaname: p.personaname,
            avatar: p.avatar,
            avatarfull: p.avatarfull,
            profileurl: p.profileurl,
            communityvisibilitystate: Number(p.communityvisibilitystate ?? 0),
        };
    });
}

/* ---------- User stats for a game (raw) ---------- */
export async function getUserStatsForGame(steamID, appid) {
    const key = `steam:userstats:${ steamID }:${ appid }`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const url = "https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/";
        const params = { key: STEAM_API_KEY, steamid: steamID, appid };
        try {
            const data = await withRetry(() =>
                httpClient.get(url, { params }).then(r => r.data)
            );
            return data?.playerstats ?? {};
        } catch {
            return {}; // private/missing schema → safe empty
        }
    });
}

/* ---------- Playtime for multiple apps (robust) ---------- */
export async function getPlaytimeForApps(steamID, appids) {
    if (!Array.isArray(appids) || appids.length === 0) return {};
    const key = `steam:playtimeBatch:${ steamID }:${ appids.slice().sort().join(",") }`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const ownedUrl  = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
        const result = {};
        const wanted = appids.map(Number);
        const wantedSet = new Set(wanted);

        const fillFrom = (games = []) => {
            for (const g of games) {
                const id = Number(g.appid);
                if (!wantedSet.has(id)) continue;
                result[id] = Number(g.playtime_forever || 0);
            }
        };

        // 1) Fast path: filtered
        const filteredParams = {
            key: STEAM_API_KEY,
            steamid: steamID,
            include_appinfo: 1,
            include_played_free_games: 1,
        };
        wanted.forEach((id, i) => { filteredParams[`appids_filter[${i}]`] = String(id); });
        const first = await withRetry(() =>
            httpClient.get(ownedUrl, { params: filteredParams }).then(r => r.data)
        ).catch(() => null);
        fillFrom(first?.response?.games || []);

        // 2) Fallback: full library (unfiltered)
        if (Object.keys(result).length !== wanted.length) {
            const fullParams = {
                key: STEAM_API_KEY,
                steamid: steamID,
                include_appinfo: 0,
                include_played_free_games: 1,
            };
            const full = await withRetry(() =>
                httpClient.get(ownedUrl, { params: fullParams }).then(r => r.data)
            ).catch(() => null);
            fillFrom(full?.response?.games || []);
        }

        for (const id of wanted) if (!(id in result)) result[id] = 0;
        return result;
    });
}

/* ---------- Playtime for a single app (delegates) ---------- */
export async function getPlaytimeForApp(steamID, appid) {
    const all = await getPlaytimeForApps(steamID, [appid]);
    return all[Number(appid)] || 0;
}

/* ---------- Achievements schema ---------- */
export async function getSchemaForGame(appid) {
    const key = `steam:schema:${ appid }`;
    return cache.wrap(key, 10 * 60_000, 30 * 60_000, async () => {
        const url = "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/";
        const params = { key: STEAM_API_KEY, appid };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        return data || null;
    });
}

/* ---------- Player achievements ---------- */
export async function getPlayerAchievements(steamID, appid) {
    const key = `steam:ach:${steamID}:${ appid }`;
    return cache.wrap(key, 60_000, 5 * 60_000, async () => {
        const url = "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/";
        const params = { key: STEAM_API_KEY, steamid: steamID, appid };
        try {
            const data = await withRetry(() =>
                httpClient.get(url, { params }).then(r => r.data)
            );
            return data || null;
        } catch {
            return null;
        }
    });
}

/* ---------- Global rarity ---------- */
export async function getGlobalAchievementPercentages(appid) {
    const key = `steam:achglobal:${ appid }`;
    return cache.wrap(key, 10 * 60_000, 30 * 60_000, async () => {
        const url = "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/";
        const params = { gameid: appid };
        const data = await withRetry(() =>
            httpClient.get(url, { params }).then(r => r.data)
        );
        return data || null;
    });
}

/* ---------- Achievements bundle ---------- */
export async function getAchievementsBundle(steamID, appid) {
    const keyOf = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");

    // fetch schema, player, global, and stats in parallel /* ----- */
    const [schema, player, global, stats] = await Promise.all([
        getSchemaForGame(appid).catch(() => null),
        getPlayerAchievements(steamID, appid).catch(() => null),
        getGlobalAchievementPercentages(appid).catch(() => null),
        getUserStatsForGame(steamID, appid).catch(() => null),
    ]);

    // if everything failed, return restricted stub
    if (!schema && !player && !global && !stats) {
        return {
            appid: String(appid),
            totals: { unlocked: 0, total: 0 },
            achievements: [],
            privacy: "restricted",
            privacyBlocked: true,
        };
    }

    const byKey = new Map();

    // seed from schema
    (schema?.game?.availableGameStats?.achievements || []).forEach((a) => {
        const k = keyOf(a.name);
        byKey.set(k, {
            apiName: a.name,
            name: a.displayName || a.name,
            desc: a.description || "",
            icon: a.icon || "",
            iconGray: a.icongray || "",
            hidden: !!a.hidden,
            unlocked: false,
            unlockTime: null,
            percent: null,
            progressPct: null,
        });
    });

    // helper to merge unlocks from player/stats
    const mergeUnlocks = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((a) => {
            const api = a.apiname || a.name;
            const k = keyOf(api);
            const prev = byKey.get(k) || {
                apiName: api,
                name: api,
                desc: "",
                icon: "",
                iconGray: "",
                hidden: false,
                unlocked: false,
                unlockTime: null,
                percent: null,
                progressPct: null,
            };

            const achieved =
                a.achieved === 1 || a.achieved === "1" || a.achieved === true ||
                (a.unlocktime && Number(a.unlocktime) > 0);

            const ut = a.unlocktime ? Number(a.unlocktime) : null;
            const unlockTime =
                ut ? (ut > 10_000_000_000 ? ut : ut * 1000) : prev.unlockTime;

            byKey.set(k, {
                ...prev,
                apiName: prev.apiName || api,
                unlocked: prev.unlocked || !!achieved,
                unlockTime,
            });
        });
    };

    // merge player unlocks + fallback stats /* ----- */
    mergeUnlocks(player?.playerstats?.achievements);
    mergeUnlocks(stats?.playerstats?.achievements);

    // merge global rarity, coercing percent (handles "12.3" strings) /* ----- */
    (global?.achievementpercentages?.achievements || []).forEach((a) => {
        const k = keyOf(a.name);
        const prev = byKey.get(k) || {
            apiName: a.name,
            name: a.name,
            desc: "",
            icon: "",
            iconGray: "",
            hidden: false,
            unlocked: false,
            unlockTime: null,
            percent: null,
            progressPct: null,
        };
        const pRaw = a?.percent;
        const pNum = typeof pRaw === "number" ? pRaw : Number.parseFloat(pRaw);
        byKey.set(k, {
            ...prev,
            percent: Number.isFinite(pNum) ? pNum : prev.percent,
        });
    });

    const defStats = new Map();
    (schema?.game?.availableGameStats?.stats || []).forEach((s) => {
        const maxRaw = s?.max;
        const maxNum = typeof maxRaw === "number" ? maxRaw : Number.parseFloat(maxRaw);
        if (Number.isFinite(maxNum) && maxNum > 0) defStats.set(keyOf(s.name), { max: maxNum });
    });

    const userStats = new Map();
    (stats?.playerstats?.stats || []).forEach((s) => {
        const v = typeof s?.value === "number" ? s.value : Number.parseFloat(s?.value);
        if (Number.isFinite(v)) userStats.set(keyOf(s.name), v);
    });

    const candidatesFor = (api) => {
        const b = keyOf(api);
        return [b, `${b}_progress`, `${b}_stat`, `stat_${b}`, `${b}_count`, `${b}_total`];
    };

    byKey.forEach((obj, k) => {
        if (obj.unlocked) return;

        const names = candidatesFor(obj.apiName);
        for (const n of names) {
            if (userStats.has(n)) {
                const val = userStats.get(n);
                const def = defStats.get(n);
                if (def && Number.isFinite(def.max) && def.max > 0) {
                    const pct = Math.min(100, Math.max(0, (val / def.max) * 100));
                    byKey.set(k, { ...obj, progressPct: pct });
                    break;
                }
            }
        }
    });

    // finalize list
    const achievements = Array.from(byKey.values()).sort(
        (a, b) =>
            Number(b.unlocked) - Number(a.unlocked) ||
            (a.name || "").localeCompare(b.name || "")
    );

    return {
        appid: String(appid),
        totals: {
            unlocked: achievements.filter((x) => x.unlocked).length,
            total: achievements.length,
        },
        achievements,
    };
}

/* ---------- Helper: is a specific app visible to this profile? ---------- */
async function isGameVisible(steamID, appid, { probe = false } = {}) {
    const appidNum = Number(appid) || 0;
    if (!appidNum) return false;

    // If key owner is the target, only trust community (prevents self-bypass)
    if (STEAM_KEY_OWNER && String(STEAM_KEY_OWNER) === String(steamID)) {
        return communityHasGame(steamID, appidNum, { probe });
    }

    const url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
    const params = {
        key: STEAM_API_KEY,
        steamid: steamID,
        include_appinfo: 0,
        include_played_free_games: 1,
    };
    params["appids_filter[0]"] = String(appidNum);

    const headers = probe
        ? { "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate", Pragma: "no-cache", Expires: "0" }
        : undefined;

    let apiVisible = false;
    try {
        const data = await withRetry(() => httpClient.get(url, { params, headers }).then((r) => r.data));
        const games = Array.isArray(data?.response?.games) ? data.response.games : [];
        apiVisible = games.some((g) => Number(g.appid) === appidNum);
    } catch { apiVisible = false; }

    // Sanity check: public community view must agree
    if (apiVisible) {
        const publicVisible = await communityHasGame(steamID, appidNum, { probe });
        if (!publicVisible) return false;
    }
    return apiVisible;
}

/* ---------- Privacy Detection ---------- */
export async function detectPrivacy(steamID, appid, { probe = false, scope = "stats" } = {}) {
    const appidNum = Number(appid) || 0;

    // 1) profile visibility (probe => no-store)
    const sumUrl = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/";
    const sumParams = { key: STEAM_API_KEY, steamids: steamID, _: probe ? Date.now() : undefined };
    const sumHeaders = probe
        ? { "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate", Pragma: "no-cache", Expires: "0" }
        : undefined;

    let profilePublic = false;
    try {
        const data = await httpClient.get(sumUrl, { params: sumParams, headers: sumHeaders }).then((r) => r.data);
        profilePublic = Number(data?.response?.players?.[0]?.communityvisibilitystate) === 3;
    } catch { /* ignore */ }

    if (!profilePublic) return { restricted: true, reason: "profile_state_0" };

    // 2) per-game visibility
    let visible = false, reason = "game:hidden";
    try {
        visible = await isGameVisible(steamID, appidNum, { probe });
        reason = visible ? "game:visible:self" : "game:hiddenself";
    } catch { reason = "steam_unavailable"; }

    return { restricted: !visible, reason };
}