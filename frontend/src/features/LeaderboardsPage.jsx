import React, { useEffect, useMemo, useState } from "react";
import routes from "../api/routes";
import { api } from '../api/client';
import { motion } from "framer-motion";

/* ----- Helpers ----- */
const ordinal = (n) => { const s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };
const neon = (hex) => ({ textShadow: `0 0 4px ${hex}, 0 0 8px ${hex}, 0 0 16px ${hex}` });

/* ----- Row colors ----- */
const rowColors = [
    { rank: 1, color: "#FFE44D" },
    { rank: 2, color: "#FF8A1E" },
    { rank: 3, color: "#FF4D4D" },
    { rank: 4, color: "#FF5E9C" },
    { rank: 5, color: "#FF69B4" }
];

/* ----- Score formatting ----- */
const minutesToHoursLabel = (mins) => {
    const h = (mins ?? 0) / 60;
    if (h < 10) return h.toFixed(1);
    if (h < 1000) return Math.round(h);
    return Math.round(h).toLocaleString();
};

/* ----- Utility: render text as per-character animated spans ----- */
function CharCascade({ text, stepMs = 100 }) {
    const chars = [...String(text ?? "")];
    return (
        <span className="inline-block align-baseline">
      {chars.map((ch, i) => (
          <span
              key={i}
              className="char-in"
              style={{ "--cd": `${i * stepMs}ms` }}
          >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
    );
}

/* ----- Row ----- */
function Row({ index, player, placeholder }) {
    const rank = index + 1;
    const color = rowColors[index]?.color || "#6EE7FF"; // cyan fallback

    const rankText = ordinal(rank).toUpperCase();
    const nameText = placeholder ? "" : (player.username ?? "Unknown");
    const scoreText = placeholder ? "" : minutesToHoursLabel(player.totalMinutes);

    return (
        <div className="grid grid-cols-[80px_1fr_160px] items-center px-6 py-2 select-none">
            <div className="font-extrabold tracking-[0.15em] text-2xl whitespace-nowrap" style={neon(color)}>
                <CharCascade text={rankText} />
            </div>
            <div className="font-extrabold tracking-[0.15em] text-3xl truncate" style={neon(color)}>
                <CharCascade text={nameText} />
            </div>
            <div className="text-right font-extrabold tracking-[0.15em] text-3xl font-mono tabular-nums whitespace-nowrap" style={neon(color)}>
                <CharCascade text={scoreText} />
            </div>
        </div>
    );
}

/* ----- Skeleton Row ----- */
function SkeletonRow({ index }) {
    const rank = index + 1;
    return (
        <div className="grid grid-cols-[80px_1fr_160px] items-center px-6 py-2">
            <div className="text-2xl font-extrabold tracking-[0.15em] text-white/20">{ordinal(rank).toUpperCase()}</div>
            <div className="h-7 rounded bg-white/10 animate-pulse" />
            <div className="h-7 rounded bg-white/10 animate-pulse" />
        </div>
    );
}

/* ----- Page ----- */
export default function LeaderboardsPage({ title = "LEADERBOARD" }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch("/api/leaderboards/top-time"); // backend route
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setRows(json.data ?? []);
        } catch (e) {
            setError(e.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const items = useMemo(() => rows.slice(0, 10), [rows]);
    const blanks = useMemo(() => Array.from({ length: Math.max(0, 10 - items.length) }), [items]);

    return (
        <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
            {/* ----- Local keyframes for row + character cascades ----- */}
            <style>{`
        @keyframes neonFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes rowPop   { 0%{opacity:0; transform:translateY(16px) scale(.98); filter:blur(4px)}
                              100%{opacity:1; transform:translateY(0) scale(1);  filter:blur(0)} }
        @keyframes charPop  { 0%{opacity:0; transform:translateY(8px) scale(.98); filter:blur(2px)}
                              100%{opacity:1; transform:translateY(0) scale(1);  filter:blur(0)} }
        .neon-title { animation: neonFloat 2.2s ease-in-out infinite; }
        .row-enter  { animation: rowPop .45s cubic-bezier(.2,.8,.2,1) both; }
        .stagger    { animation-delay: var(--d, 0ms); }
        .char-in    { display:inline-block; animation: charPop .34s cubic-bezier(.2,.8,.2,1) both;
                      animation-delay: var(--cd, 0ms); will-change: transform, filter, opacity; }
      `}</style>

            <div className="relative w-[740px] max-w-full rounded-3xl border border-zinc-700/60 bg-zinc-900 shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* ----- Inner bezel ----- */}
                <div className="absolute inset-0 rounded-3xl ring-1 ring-zinc-700/60 pointer-events-none" />

                {/* ----- Title ----- */}
                {title ? (
                    <div className="text-center pt-6 pb-2">
                        <h2 className="neon-title text-2xl font-black tracking-[0.2em]" style={neon("#7CFF6B")}>
                            {title}
                        </h2>
                    </div>
                ) : null}

                {/* ----- Header row ----- */}
                <div className="grid grid-cols-[80px_1fr_160px] px-6 pt-6 pb-2">
                    <div className="text-xl font-black tracking-[0.2em]" style={neon("#7CFF6B")}>RANK</div>
                    <div className="text-xl font-black tracking-[0.2em]" style={neon("#7CFF6B")}>USERNAME</div>
                    <div className="text-right text-xl font-black tracking-[0.2em]" style={neon("#7CFF6B")}>SCORE (HOURS)</div>
                </div>

                {/* ----- Divider ----- */}
                <div className="mx-6 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

                {/* ----- Rows (row cascade + per-character cascade) ----- */}
                <div className="py-3">
                    {loading &&
                        Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} index={i} />)}

                    {!loading && !error && items.map((p, i) => (
                        <div key={p.username ?? i} className="row-enter stagger" style={{ "--d": `${i * 120}ms` }}>
                            <Row index={i} player={p} />
                        </div>
                    ))}

                    {!loading && !error && blanks.map((_, i) => (
                        <div key={`blank-${i}`} className="row-enter stagger" style={{ "--d": `${(items.length + i) * 120}ms` }}>
                            <Row index={items.length + i} placeholder />
                        </div>
                    ))}

                    {!loading && error && (
                        <div className="px-6 py-8 text-center text-white/70 space-y-3">
                            <div>Failed to load leaderboard. ({error})</div>
                            <button onClick={fetchData} className="rounded px-3 py-1.5 bg-white/10 hover:bg-white/15 transition">
                                Retry
                            </button>
                        </div>
                    )}
                </div>

                {/* ----- Inner shadow ----- */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_0_40px_rgba(0,0,0,0.75)]" />
            </div>
        </div>
    );
}