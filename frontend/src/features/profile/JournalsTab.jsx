// JournalsTab.jsx — Animated Profile Journal with two-sided paper + spine shadow
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import routes from "../../api/routes";

/* ----- Utils ----- */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fmt = (d) => { const t = new Date(d); return isNaN(t) ? "" : t.toLocaleString(); };

/* ----- Looks (customize freely) ----- */
const LOOKS = {
    classic: { name: "Classic", paper: "#f7f4ea", line: "rgba(30,64,175,.22)", margin: "rgba(220,38,38,.35)", ink: "#111827" },
    dusk:    { name: "Dusk",    paper: "#1f2430", line: "rgba(203,213,225,.15)", margin: "rgba(250,204,21,.25)", ink: "#e5e7eb" },
    neon:    { name: "Neon",    paper: "#0b0c10", line: "rgba(59,130,246,.22)",  margin: "rgba(236,72,153,.35)", ink: "#c7d2fe" },
};
const paperVars = (look) => ({ "--paper-bg": look.paper, "--paper-line": look.line, "--paper-margin": look.margin });

/* ----- Per-character type-on ----- */
function CharCascade({ text = "", stepMs = 18, className = "" }) {
    const chars = [...String(text)];
    return (
        <span className={`inline-block align-baseline ${className}`}>
      {chars.map((ch, i) => (
          <span key={i} className="char-in" style={{ "--cd": `${i * stepMs}ms` }}>
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
    );
}

/* ----- Read-only page ----- */
function PageView({ entry, look }) {
    return (
        <div className="h-full w-full px-6 py-5 overflow-hidden">
            <div className="text-[11px] opacity-60">{fmt(entry.updated_at || entry.created_at || Date.now())}</div>
            <h3 className="mt-1 font-black tracking-wide text-lg" style={{ color: look.ink }}>
                <CharCascade text={entry.title || "Untitled"} stepMs={12} />
            </h3>
            <div className="mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: look.ink }}>
                <CharCascade text={entry.body || ""} stepMs={6} />
            </div>
        </div>
    );
}

/* ----- Editable page ----- */
function PageEdit({ entry, look, onChange }) {
    return (
        <div className="h-full w-full px-6 py-5 overflow-hidden">
            <div className="text-[11px] opacity-60">{fmt(entry.updated_at || entry.created_at || Date.now())}</div>
            <input
                value={entry.title || ""}
                onChange={(e) => onChange({ ...entry, title: e.target.value })}
                placeholder="Title"
                className="mt-1 w-full bg-transparent outline-none font-bold text-lg border-b border-black/10 dark:border-white/10 focus:border-black/30 dark:focus:border-white/30 pb-1"
                style={{ color: look.ink }}
            />
            <textarea
                value={entry.body || ""}
                onChange={(e) => onChange({ ...entry, body: e.target.value })}
                placeholder="Write your thoughts…"
                rows={12}
                className="mt-3 w-full bg-transparent outline-none leading-relaxed resize-none"
                style={{ color: look.ink }}
            />
        </div>
    );
}

/* ----- Main component (drop-in replacement) ----- */
export default function JournalsTab({ userId, compact = false, limit = 0 }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [index, setIndex] = useState(0);
    const [edit, setEdit] = useState(false);
    const [search, setSearch] = useState("");
    const [lookKey, setLookKey] = useState("classic");
    const [saving, setSaving] = useState(false);
    const look = LOOKS[lookKey];
    const flipRef = useRef(null);
    const pageSize = compact ? 8 : 100;

    // Fetch entries (keeps your existing API contract)
    const refresh = async () => {
        setLoading(true);
        try {
            const params = { page: 1, pageSize };
            if (userId) params.userId = String(userId);
            const { data } = await api.get(routes.journals, { params });
            const list = Array.isArray(data) ? data : (data?.items ?? data?.entries ?? []);
            const arr = Array.isArray(list) ? list : [];
            setEntries(limit ? arr.slice(0, limit) : arr);
            setIndex(0);
        } catch (e) {
            setError(e?.message || "Failed to load");
            setEntries([]);
        } finally { setLoading(false); }
    };
    useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

    // Filter by search
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter(e =>
            (e.title || "").toLowerCase().includes(q) ||
            (e.body || "").toLowerCase().includes(q)
        );
    }, [entries, search]);

    const cur = filtered.length ? filtered[clamp(index, 0, filtered.length - 1)] : null;

    // Page-flip animation on change
    useEffect(() => {
        if (!flipRef.current) return;
        flipRef.current.classList.remove("flip-now");
        void flipRef.current.offsetWidth;
        flipRef.current.classList.add("flip-now");
    }, [index, edit, lookKey]);

    // New entry
    const onNew = async () => {
        try {
            const payload = { title: "Untitled", body: "" };
            const { data } = await api.post(routes.journals, payload);
            const created = data?.data ?? data;
            if (!created) return;
            setEntries((prev) => [created, ...prev]);
            setSearch("");
            setIndex(0);
            setEdit(true);
        } catch (e) {
            console.error("journal create failed:", e?.message || e);
        }
    };

    // Debounced save
    const saveTimer = useRef(null);
    const onChangeEntry = (draft) => {
        setEntries((prev) => prev.map((e) => (e.id === draft.id ? draft : e)));
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                setSaving(true);
                await api.put(`${routes.journals}/${draft.id}`, { title: draft.title, body: draft.body });
            } catch (e) {
                console.error("journal update failed:", e?.message || e);
            } finally {
                setSaving(false);
            }
        }, 600);
    };

    // Keyboard nav
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "ArrowRight") setIndex((i) => clamp(i + 1, 0, Math.max(0, filtered.length - 1)));
            if (e.key === "ArrowLeft")  setIndex((i) => clamp(i - 1, 0, Math.max(0, filtered.length - 1)));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtered.length]);

    return (
        <div className="w-full">
            {/* ----- Local keyframes & paper rules (two-sided + spine/curl) ----- */}
            <style>{`
        @keyframes bookOpen { 0%{transform:rotateX(35deg) rotateY(18deg) translateY(10px); opacity:0}
                              100%{transform:rotateX(0) rotateY(0) translateY(0); opacity:1} }
        @keyframes flip { 0%{transform:rotateY(-90deg)} 100%{transform:rotateY(0)} }
        @keyframes charPop{ 0%{opacity:0; transform:translateY(8px) scale(.98); filter:blur(2px)}
                            100%{opacity:1; transform:translateY(0) scale(1); filter:blur(0)} }
        .char-in{ display:inline-block; animation:charPop .28s cubic-bezier(.2,.8,.2,1) both; animation-delay:var(--cd,0ms); }
        .book-3d{ transform-style:preserve-3d; animation:bookOpen .5s ease-out both; }
        .flip-now{ animation:flip .36s ease-out both; transform-origin:left center; }

        /* Base: thin horizontal rules + paper color */
        .paper{
          background:
            repeating-linear-gradient(to bottom, transparent 27px, var(--paper-line) 28px);
          background-color: var(--paper-bg);
        }
        /* Left-hand page: inside margin line near the spine (right edge) */
        .page-left.paper{
          background:
            repeating-linear-gradient(to bottom, transparent 27px, var(--paper-line) 28px),
            linear-gradient(90deg, transparent calc(100% - 43px), var(--paper-margin) calc(100% - 42px), transparent calc(100% - 41px));
          background-color: var(--paper-bg);
        }
        /* Right-hand page: inside margin line near the spine (left edge) */
        .page-right.paper{
          background:
            repeating-linear-gradient(to bottom, transparent 27px, var(--paper-line) 28px),
            linear-gradient(90deg, var(--paper-margin) 42px, transparent 43px);
          background-color: var(--paper-bg);
        }
      `}</style>

            {/* ----- Toolbar ----- */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setIndex(0); }}
                        placeholder="Search journal…"
                        className="rounded-xl px-3 py-1.5 bg-white/10 hover:bg-white/15 outline-none"
                    />
                    <select
                        value={lookKey}
                        onChange={(e) => setLookKey(e.target.value)}
                        className="rounded-xl px-3 py-1.5 bg-white/10 hover:bg-white/15 outline-none"
                    >
                        {Object.entries(LOOKS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`text-xs ${saving ? "text-yellow-300 animate-pulse" : "text-emerald-300"}`}>
                        {saving ? "Saving…" : "Saved"}
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="rounded-xl px-3 py-1.5 bg-white/10 hover:bg-white/15"
                            onClick={() => setEdit((v) => !v)}
                            disabled={!cur}
                        >
                            {edit ? "View" : "Edit"}
                        </button>
                        <button className="rounded-xl px-3 py-1.5 bg-white/10 hover:bg-white/15" onClick={onNew}>
                            New Entry
                        </button>
                    </div>
                </div>
            </div>

            {/* ----- Book container ----- */}
            <div
                ref={flipRef}
                className={`book-3d relative mx-auto w-full ${compact ? "max-w-3xl" : "max-w-4xl"} aspect-[16/9] rounded-3xl border border-white/10 bg-black/40 backdrop-blur shadow-[0_0_40px_rgba(0,0,0,.6)] overflow-hidden`}
            >
                {/* Two-page layout */}
                <div className="absolute inset-0 grid grid-cols-2">
                    {/* Left page */}
                    <div
                        className="page-left paper h-full w-full border-r border-black/20 dark:border-white/10"
                        style={{ ...paperVars(look), color: look.ink }}
                    >
                        {loading ? (
                            <div className="h-full w-full animate-pulse" />
                        ) : cur ? (
                            <PageView entry={cur} look={look} />
                        ) : (
                            <div className="h-full w-full grid place-items-center opacity-60">No entries</div>
                        )}
                    </div>

                    {/* Right page */}
                    <div
                        className="page-right paper h-full w-full"
                        style={{ ...paperVars(look), color: look.ink }}
                    >
                        {loading ? (
                            <div className="h-full w-full animate-pulse" />
                        ) : cur ? (
                            edit ? <PageEdit entry={cur} look={look} onChange={onChangeEntry} /> : <PageView entry={cur} look={look} />
                        ) : (
                            <div className="h-full w-full grid place-items-center opacity-60">Create a new entry to begin.</div>
                        )}
                    </div>
                </div>

                {/* ----- Spine + page-curl shadows ----- */}
                <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-20
                        bg-gradient-to-r from-black/20 via-black/45 to-black/20
                        mix-blend-multiply blur-md"></div>
                <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-[calc(50%+1px)] w-6
                        bg-gradient-to-l from-black/25 to-transparent mix-blend-multiply"></div>
                <div className="pointer-events-none absolute inset-y-0 left-1/2 translate-x-[calc(50%+1px)] w-6
                        bg-gradient-to-r from-black/25 to-transparent mix-blend-multiply"></div>

                {/* Navigation hit-areas */}
                <button
                    aria-label="Previous"
                    onClick={() => setIndex((i) => clamp(i - 1, 0, Math.max(0, filtered.length - 1)))}
                    className="absolute inset-y-0 left-0 w-1/5 hover:bg-white/5 transition"
                    disabled={index <= 0}
                />
                <button
                    aria-label="Next"
                    onClick={() => setIndex((i) => clamp(i + 1, 0, Math.max(0, filtered.length - 1)))}
                    className="absolute inset-y-0 right-0 w-1/5 hover:bg-white/5 transition"
                    disabled={index >= Math.max(0, filtered.length - 1)}
                />
            </div>

            {/* Footer page indicator */}
            <div className="mt-3 flex items-center justify-between text-sm opacity-70">
                <div>{filtered.length ? `Page ${index + 1} of ${filtered.length}` : "No entries"}</div>
                <div className="flex gap-2">
                    <button
                        className="rounded px-2 py-1 bg-white/10 hover:bg-white/15"
                        onClick={() => setIndex((i) => clamp(i - 1, 0, Math.max(0, filtered.length - 1)))}
                        disabled={index <= 0}
                    >
                        Prev
                    </button>
                    <button
                        className="rounded px-2 py-1 bg-white/10 hover:bg-white/15"
                        onClick={() => setIndex((i) => clamp(i + 1, 0, Math.max(0, filtered.length - 1)))}
                        disabled={index >= Math.max(0, filtered.length - 1)}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}