import React, { useEffect, useState } from "react";
import routes from "../../api/routes";
import { api } from "../../api/client";

/* ----- Trophy Room (renders only when game details are public) ----- */
export default function TrophyRoom({ appid, onUpdate }) {

    /* ----- State ----- */
    const [data, setData] = useState(null); // achievements bundle
    const [loading, setLoading] = useState(true); // loading flag
    const [error, setError] = useState(null); // error string

    /* ----- Fetch achievements once mounted ----- */
    useEffect(() => {
        if (!appid) return;
        let alive = true;
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const resp = await api.get(`${routes.gameAchievements(appid)}?refresh=1`, { signal: ac.signal });
                if (!alive) return;
                const payload = resp?.data || null;
                setData(payload);
            } catch (err) {
                if (!alive) return;
                setError(err?.response?.data?.error || "Failed to load achievements");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; ac.abort(); };
    }, [appid]);

    /* ----- Helpers ----- */
    const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : null);

    const fmtPct = (p) => {
        const val = typeof p === "number" ? p : parseFloat(p);
        return Number.isFinite(val) ? `${val.toFixed(1)}%` : "—";
    };

    const safePct = (p) => {
        const v = typeof p === "number" ? p : parseFloat(p);
        return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
    };

    /* ----- BG ----- */
    const wallpaper = { backgroundImage: `
    radial-gradient( circle at 25% 20%, rgba(0,0,0,0.10), transparent 55% ),
    radial-gradient( circle at 75% 80%, rgba(0,0,0,0.08), transparent 55% ),
    repeating-linear-gradient( 45deg, rgba(255,255,255,0.06) 0 2px, rgba(0,0,0,0.03) 2px 4px ),
    linear-gradient(180deg, #5a4634 0%, #4a3a2c 100%)` };

    const payload = data && typeof data === "object" ? data : {};
    const totals = payload.totals || { unlocked: 0, total: 0 };
    const achievements = Array.isArray(payload.achievements) ? payload.achievements : [];

    /* ----- UI: Loading ----- */
    if (loading) {
        return (
            <section className="rounded-2xl p-6" style={wallpaper}>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-yellow-200">Trophy Room</h2>
                    <span className="text-sm text-yellow-100/70">Loading achievements…</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-xl bg-black/20 animate-pulse" />
                    ))}
                </div>
            </section>
        );
    }

    /* ----- UI: Error ----- */
    if (error) {
        return (
            <section className="rounded-2xl p-6" style={wallpaper}>
                <h2 className="text-2xl font-semibold text-yellow-200 drop-shadow mb-3">Trophy Room</h2>
                <div className="rounded-lg border border-yellow-900/40 bg-yellow-900/25 text-yellow-100 p-3 text-sm">
                    {String(error)}
                </div>
            </section>
        );
    }

    /* ----- Frame styles ----- */
    const frameOuter = (unlocked) => ({
        backgroundImage: `
      linear-gradient(145deg, ${unlocked ? "#FFD700" : "#3d2f22"}, ${unlocked ? "#DAA520" : "#2d241b"}),
      radial-gradient(circle at 10% 10%, rgba(255,255,255,0.25), transparent 40%)`
    });

    const frameBevel = (unlocked) => ({
        backgroundImage: `
      linear-gradient(135deg, ${unlocked ? "#FFF4B2" : "#6d5a46"} 0%, ${unlocked ? "#FFD700" : "#4c3e31"} 100%)`
    });
    const matBG = {
        backgroundImage: `
      radial-gradient( circle at 30% 25%, rgba(0,0,0,0.08), transparent 55% ),
      linear-gradient(180deg, #a58357 0%, #8f6e47 100%)`
    };

    /* ----- UI: Grid ----- */
    return (
        <section className="rounded-2xl p-6" style={ wallpaper }>
            <div className="mb-5 flex flex-col items-center text-center">
                <h2 className="text-3xl font-semibold text-yellow-200 drop-shadow">Trophy Room</h2>
                <span className="mt-1 text-sm text-yellow-100/80">{ totals.unlocked }/{ totals.total } Unlocked</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {achievements.map((a) => {
                    const unlocked = !!a.unlocked;
                    const progressPct = safePct(a.progressPct);
                    const untilPct    = progressPct == null ? null : Math.max(0, 100 - progressPct);
                    const globalPct   = safePct(a.percent ?? a.rarity ?? a.playerPercentUnlocked);

                    return (
                        <div key={a.apiName} className="group relative">

                            {/* outer frame */}
                            <div
                                className={`rounded-[22px] p-1 transition-transform duration-200
                                    ${unlocked ? "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(255,215,0,0.6),0_10px_24px_rgba(0,0,0,0.45)]"
                                    : "ring-1 ring-black/40 shadow-[0_10px_24px_rgba(0,0,0,0.45)]"} group-hover:-translate-y-0.5`}
                                style={frameOuter(unlocked)}
                            >
                                <div className="rounded-[18px] p-1" style={frameBevel(unlocked)}>
                                    <div
                                        className={`rounded-[14px] p-2 aspect-square flex items-center justify-center overflow-hidden
                                            ${unlocked ? "" : "grayscale-[0.85] opacity-80"}`}
                                        style={matBG}
                                    >
                                        <img
                                            src={unlocked ? (a.icon || a.iconGray) : (a.iconGray || a.icon)}
                                            alt={a.name || a.apiName}
                                            className="h-[78%] w-[78%] object-contain drop-shadow-lg"
                                            loading="lazy"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* plaque + hover */}
                            <div className="mt-2 text-center">
                                <div
                                    className={`inline-block rounded-md px-2 py-1 text-[11px] leading-none tracking-wide
                                        ${ unlocked ? "bg-yellow-400/30 text-yellow-50 ring-1 ring-yellow-300 shadow-[0_0_6px_rgba(255,215,0,0.5)]"
                                        : "bg-black/30 text-yellow-100/60 ring-1 ring-black/40"}`}
                                    style={{ fontVariantCaps: "all-small-caps", letterSpacing: "0.06em" }}
                                    title={ a.name || a.apiName }
                                >
                                    { a.name || a.apiName }
                                </div>
                            </div>

                            {/* ----- progress bar (locked only, when progress known) ----- */}
                            {!unlocked && progressPct != null ? (
                                <div className="mx-1 mt-2">
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30 ring-1 ring-black/40">
                                      <div
                                          className="h-full rounded-full bg-yellow-400/80"
                                          style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                    <div className="mt-1 text-[10px] leading-none text-yellow-100/80 text-center">
                                        {fmtPct(progressPct)} complete
                                    </div>
                                </div>
                            ) : null}

                            <div
                                className="pointer-events-none absolute left-1/2 top-0 z-10 hidden w-56 -translate-x-1/2 -translate-y-3
                                    rounded-xl border border-black/30 bg-[rgba(27,20,13,0.96)] p-3 text-center text-yellow-100 shadow-2xl
                                    group-hover:block"
                            >
                                <div className="text-sm font-semibold">{ a.name || a.apiName }</div>
                                { a.desc ? <div className="mt-1 text-xs opacity-90">{ a.desc }</div> : null}

                                {/* always show global rarity */}
                                <div className="mt-2 flex items-center justify-between text-xs">
                                    <span className="opacity-80">Global Rarity</span>
                                    <span className="font-medium">{ fmtPct(globalPct) }</span>
                                </div>

                                {/* show unlock date if you have it; else "–" when locked */}
                                <div className="mt-1 flex items-center justify-between text-xs">
                                    <span className="opacity-80">Unlock Date</span>
                                    <span className="font-medium">{ unlocked ? fmtDate(a.unlockTime) : "—" }</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}