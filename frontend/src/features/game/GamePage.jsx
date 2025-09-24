import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import routes from "../../api/routes";
import { api } from "../../api/client";
import PrivacyGate from "../../components/layout/PrivacyGate";
import TrophyRoom from "./TrophyRoom";

/* ----- Utilities ----- */
const steamHeader = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

/* ----- Helpers (normalize + formatting) ----- */
const normalizeGame = (raw = {}, appid) => {
    const name = raw.name ?? raw.title ?? raw?.game?.name ?? raw?.data?.name ?? raw?.appinfo?.name ?? "Game";
    const header_image =
        raw.header_image ?? raw.headerImage ?? raw.capsule_image ?? raw.capsule ?? raw?.data?.header_image ?? (appid ? steamHeader(appid) : undefined);
    let categories = raw.categories ?? raw.tags ?? raw.genres ?? raw.category ?? raw?.data?.categories ?? [];
    if (typeof categories === "string") categories = categories.split(/\s*,\s*/).filter(Boolean);
    if (!Array.isArray(categories)) categories = [];
    return { ...raw, name, header_image, categories };
};

function formatMinutes(mins) {
    const m = Math.max(0, Math.round(mins || 0));
    if (m < 60) return { value: m, unit: "mins" };
    const h = m / 60;
    if (h < 100) return { value: Number(h.toFixed(1)), unit: "hrs" };
    return { value: Math.round(h), unit: "hrs" };
}

function timeAgo(dateStr) {
    try {
        const then = new Date(dateStr);
        const sec = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
        if (sec < 60) return `${sec}s ago`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const d = Math.floor(hr / 24);
        if (d < 30) return `${d}d ago`;
        const mo = Math.floor(d / 30);
        if (mo < 12) return `${mo}mo ago`;
        const y = Math.floor(mo / 12);
        return `${y}y ago`;
    } catch {
        return "";
    }
}

/* ----- Main Page ----- */
export default function GamePage() {
    const { id } = useParams();
    const gameId = id;

    /* ----- State ----- */
    const [game, setGame] = useState(null);
    const [platform, setPlatform] = useState("steam");
    const [statsMinutes, setStatsMinutes] = useState(0);
    const [friends, setFriends] = useState([]);
    const [loadingGame, setLoadingGame] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingFriends, setLoadingFriends] = useState(true);
    const [title, setTitle] = useState("");
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [errorSave, setErrorSave] = useState(null);
    const [errorGame, setErrorGame] = useState(null);
    const [statsMeta, setStatsMeta] = useState(null);
    const [statLock, setStatLock] = useState(null);

    /* ----- Fetch game ----- */
    useEffect(() => {
        let alive = true;
        const ac = new AbortController();
        (async () => {
            setLoadingGame(true);
            setErrorGame(null);
            try {
                const { data } = await api.get(routes.game(gameId), { signal: ac.signal });
                if (!alive) return;
                const g = normalizeGame(data, gameId);
                setGame(g);
                setPlatform(String(g.platform || "steam").toLowerCase());
            } catch (err) {
                if (!alive) return;
                setErrorGame(err?.response?.data?.error || "Failed to load game");
            } finally {
                if (alive) setLoadingGame(false);
            }
        })();
        return () => {
            alive = false;
            ac.abort();
        };
    }, [gameId]);

    /* ----- Initial fetch of playtime (single call) ----- */
    useEffect(() => {
        let alive = true;
        const ac = new AbortController();
        (async () => {
            setLoadingStats(true);
            try {
                const resp = await api.get(`${routes.gameStats(gameId)}?refresh=1`, { signal: ac.signal });
                if (!alive) return;
                const data = resp?.data || {};
                const mins = Number(data?.playtimeMinutes ?? data?.playtime_forever);

                setStatsMinutes((prev) => (Number.isFinite(mins) && mins > 0 ? mins : Number.isFinite(prev) ? prev : 0));
                setStatsMeta({
                    privacy: data?.privacy,
                    privacyBlocked: !!data?.privacyBlocked,
                    reason: data?.reason || resp?.headers?.["x-privacy-reason"] || null,
                    checkedAt: data?.checkedAt || resp?.headers?.["x-checked-at"] || null,
                });
            } catch {
                if (!alive) return;
                setStatsMinutes(0);
                setStatsMeta(null);
            } finally {
                if (alive) setLoadingStats(false);
            }
        })();
        return () => {
            alive = false;
            ac.abort();
        };
    }, [gameId]);

    /* ----- Friends ----- */
    useEffect(() => {
        if (!platform) return;
        let alive = true;
        const ac = new AbortController();
        (async () => {
            setLoadingFriends(true);
            try {
                const { data } = await api.get(routes.gameFriends(platform, gameId), { signal: ac.signal });
                if (!alive) return;
                setFriends(Array.isArray(data) ? data : []);
            } catch {
                if (!alive) return;
                setFriends([]);
            } finally {
                if (alive) setLoadingFriends(false);
            }
        })();
        return () => {
            alive = false;
            ac.abort();
        };
    }, [platform, gameId]);

    /* ----- Save Journal ----- */
    const handleSaveEntry = async () => {
        const content = draft.trim();
        const titleText = title.trim();
        if (!content || !titleText) return;
        setSaving(true);
        setErrorSave(null);
        try {
            await api.post(routes.journals, { appid: Number(gameId), title: titleText, entry: content });
            setTitle("");
            setDraft("");
        } catch (err) {
            setErrorSave(err?.response?.data?.error ?? "Could not save entry");
        } finally {
            setSaving(false);
        }
    };

    if (loadingGame) return <div className="p-6 app-subtle">Loading…</div>;
    if (errorGame) return <div className="p-6" style={{ color: "tomato" }}>{errorGame}</div>;
    if (!game) return <div className="p-6 app-subtle">Game not found</div>;

    const hero = game.header_image || steamHeader(gameId);
    const play = formatMinutes(statsMinutes);
    const minutesLabel = statsMinutes === 1 ? "minute" : "minutes";

    const playReason = statLock?.reason || statsMeta?.reason || statsMeta?.privacy || "restricted";

    /* ----- Public inference (accept minutes or reason: game:visible) ----- */
    const inferredPublic =
        (typeof statsMeta?.reason === "string" && statsMeta.reason.toLowerCase().includes("game:visible")) ||
        (Number.isFinite(statsMinutes) && statsMinutes > 0);

    const isPublic = (statsMeta?.privacy === "public" && !statsMeta?.privacyBlocked) || inferredPublic;

    /* ----- Render ----- */
    return (
        <div className="flex flex-col space-y-8 px-6 md:px-12 lg:px-20 py-6">
            {/* ----- Title ----- */}
            <h1 className="text-center text-5xl font-extrabold text-blue-600 tracking-wide drop-shadow-lg">{game?.name}</h1>

            {/* ----- Two Columns ----- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                {/* ----- Left Column ----- */}
                <section className="flex flex-col space-y-8">

                    {/* ----- Header Image ----- */}
                    <div className="overflow-hidden rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                        <img
                            className="w-full h-auto block"
                            src={hero}
                            alt={`${game.name} header`}
                            onError={(e) => {
                                e.currentTarget.src = steamHeader(gameId);
                            }}
                            loading="lazy"
                        />
                    </div>

                    {/* ----- Category Card ----- */}
                    {!!game?.categories?.length && (
                        <div className="card p-2 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                            <h3 className="m-2 text-2xl text-center app-subtle">Category</h3>
                            <p className="m-0 text-center leading-relaxed">{game.categories.join(", ")}</p>
                            {game.platform && (
                                <p className="m-0 mt-1 text-xs app-subtle">Platform: {String(game.platform).toUpperCase()}</p>
                            )}
                        </div>
                    )}

                    {/* ----- Playtime Card ----- */}
                    <section className="card p-6 shadow-[0_10px_30px_rgba(0,0,0,0.28)] flex flex-col items-center gap-2">
                        <h3 className="m-0 text-2xl app-subtle">Total Playtime:</h3>

                        {!isPublic ? (
                            <PrivacyGate
                                allowed={false}
                                appid={gameId}
                                reason={playReason}
                                onRecheck={(data) => {
                                    const mins = Number(data?.playtimeMinutes);
                                    setStatsMinutes((prev) =>
                                        Number.isFinite(mins) && mins > 0 ? mins : Number.isFinite(prev) ? prev : 0
                                    );
                                    setStatsMeta((prev) => ({
                                        privacy: data?.privacy,
                                        privacyBlocked: !!data?.privacyBlocked,
                                        reason: data?.reason || prev?.reason || null,
                                    }));
                                    if (
                                        data?.privacy === "public" ||
                                        data?.privacyBlocked === false ||
                                        (Number.isFinite(mins) && mins > 0) ||
                                        (typeof data?.reason === "string" && data.reason.toLowerCase().includes("game:visible"))
                                    ) {
                                        setStatLock(null);
                                    } else {
                                        setStatLock({ reason: data?.privacy || data?.reason || "restricted" });
                                    }
                                }}
                            />
                        ) : (
                            <>
                                <p className="m-0 text-4xl font-extrabold tabular-nums">
                                    { play.value } <span className="text-lg font-semibold uppercase app-subtle">{ play.unit }</span>
                                </p>
                                <small className="app-subtle">
                                    ({ statsMinutes } { minutesLabel }
                                    { loadingStats ? " • fetching…" : "" })
                                </small>

                                {loadingStats && (
                                    <div className="mt-1 text-xs px-2 py-0.5 rounded-full border app-border inline-block">Refreshing…</div>
                                )}

                                {statsMeta?.checkedAt && (
                                    <div className="mt-1 text-xs px-2 py-0.5 rounded-full border app-border inline-block">
                                        Last Checked: { new Date(statsMeta.checkedAt).toLocaleTimeString() }
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* ----- Friends Card ----- */}
                    <section className="card p-6 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="m-0 text-lg font-semibold">Friends</h3>
                            <span className="text-xs app-subtle">
                                {loadingFriends ? "Loading…" : `${friends.length} ${friends.length === 1 ? "friend" : "friends"}`}
                            </span>
                        </div>
                        {loadingFriends && <FriendsSkeleton />}
                        {!loadingFriends && friends.length === 0 && (
                            <div className="py-2 text-center text-sm app-subtle">None of your friends own this game yet.</div>
                        )}
                        {!loadingFriends && friends.length > 0 && (
                            <ul className="divide-y app-border">
                                {friends
                                    .slice()
                                    .sort((a, b) => (b?.playtimeMinutes || 0) - (a?.playtimeMinutes || 0))
                                    .map((f) => (
                                        <FriendRow key={f.id} friend={f} />
                                    ))}
                            </ul>
                        )}
                    </section>
                </section>

                {/* ----- Right Column (Journal) ----- */}
                <section className="flex flex-col">
                    <div className="card p-6 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                        <h2 className="text-center text-2xl font-semibold mb-5">My Journal</h2>

                        <input
                            type="text"
                            placeholder="Entry Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input h-10 mb-5"
                        />

                        <textarea
                            placeholder="Write your thoughts..."
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="input h-[340px] md:h-[360px] text-base whitespace-pre-wrap break-words resize-y mb-5"
                        />

                        <div className="flex justify-center">
                            <button onClick={handleSaveEntry} disabled={saving || !(title.trim() && draft.trim())} className="btn">
                                {saving ? "Saving…" : "Save Entry"}
                            </button>
                        </div>

                        {errorSave && (
                            <div className="text-sm text-center mt-3" style={{ color: "tomato" }}>
                                {String(errorSave)}
                            </div>
                        )}
                    </div>
                </section>

                {/* ----- Bottom Trophy Room ----- */}
                <div className="lg:col-span-2 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.28)] relative overflow-hidden">

                    {isPublic ? (
                        <TrophyRoom
                            appid={gameId}
                            onRecheck={(data) => {
                                const mins = Number(data?.playtimeMinutes);
                                if (Number.isFinite(mins) && mins > 0) {
                                    setStatsMinutes((prev) => (mins > 0 ? mins : Number.isFinite(prev) ? prev : 0));
                                }
                                setStatsMeta((prev) => ({
                                    ...prev,
                                    reason: prev?.reason || data?.reason || null,
                                    checkedAt: prev?.checkedAt || data?.checkedAt || null,
                                }));
                            }}
                        />
                    ) : (
                        <PrivacyGate
                            allowed={false}
                            appid={gameId}
                            reason={statsMeta?.reason || statsMeta?.privacy || "restricted"}
                            onRecheck={(payload) => {
                                const mins = Number(payload?.playtimeMinutes);
                                if (Number.isFinite(mins) && mins > 0) {
                                    setStatsMinutes((prev) => (mins > 0 ? mins : Number.isFinite(prev) ? prev : 0));
                                }
                                setStatsMeta((prev) => ({
                                    privacy:
                                        (typeof payload?.reason === "string" && payload.reason.toLowerCase().includes("game:visible")) ||
                                        (Number.isFinite(mins) && mins > 0)
                                            ? "public"
                                            : payload?.privacy,
                                    privacyBlocked: Number.isFinite(mins) && mins > 0 ? false : !!payload?.privacyBlocked,
                                    reason: payload?.reason || prev?.reason || null,
                                }));
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function makeInitialAvatar(name = "") {
    const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
    const svg = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
       <rect width='64' height='64' fill='#444'/>
       <circle cx='32' cy='32' r='30' fill='#666'/>
       <text x='32' y='38' font-size='28' text-anchor='middle' fill='#fff' font-family='sans-serif'>${letter}</text>
     </svg>`
    );
    return `data:image/svg+xml;charset=utf-8,${svg}`;
}

/* ----- Friend Row ----- */
function FriendRow({ friend }) {
    const pt = formatMinutes(friend?.playtimeMinutes || 0);
    return (
        <li className="py-2">
            <div className="w-full flex items-center gap-3 text-left group">
                <img
                    src={friend?.avatarUrl || makeInitialAvatar(friend?.name)}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover border app-border"
                    loading="lazy"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium text-sm">
                            <span className="group-hover:underline">{friend?.name || "Friend"}</span>
                        </p>
                        <p className="text-xs tabular-nums app-subtle">
                            {pt.value} <span className="uppercase">{pt.unit}</span>
                        </p>
                    </div>
                    {friend?.lastPlayed && (
                        <p className="text-[11px] app-subtle truncate">Last played {timeAgo(friend.lastPlayed)}</p>
                    )}
                </div>
            </div>
        </li>
    );
}

/* ----- Friends Skeleton Loader ----- */
function FriendsSkeleton() {
    return (
        <ul className="animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                    <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
                        <div className="h-2 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
                    </div>
                    <div className="h-3 w-10 rounded bg-neutral-200 dark:bg-neutral-800" />
                </li>
            ))}
        </ul>
    );
}