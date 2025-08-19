import React, { useEffect, useState } from "react";
import GameCapsuleList from "./GameCapsuleList";

const LS = {
    layout: "mm:libraryLayout",       // 'grid' | 'list'
    density: "mm:capsuleDensity",     // 'cozy' | 'compact'
};

export default function LibraryPage() {
    const [query, setQuery] = useState("");
    const [layout, setLayout] = useState(() => localStorage.getItem(LS.layout) || "grid");
    const [density, setDensity] = useState(() => localStorage.getItem(LS.density) || "cozy");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const q = params.get("q");
        if (q) setQuery(q);
    }, []);

    useEffect(() => {
        localStorage.setItem(LS.layout, layout);
        window.dispatchEvent(new CustomEvent("mm:settings", { detail: { key: "libraryLayout", value: layout } }));
    }, [layout]);

    useEffect(() => {
        localStorage.setItem(LS.density, density);
        window.dispatchEvent(new CustomEvent("mm:settings", { detail: { key: "capsuleDensity", value: density } }));
    }, [density]);

    return (
        <div className="p-4 space-y-3">
            {/* Search */}
            <div>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your library…"
                    className="input"
                    aria-label="Search your library"
                />
            </div>

            {/* Filter boxes */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* View */}
                <div className="flex items-center gap-2 rounded-xl app-border border px-2 py-1">
                    <span className="text-xs app-subtle">View</span>
                    <Segmented
                        value={layout}
                        onChange={setLayout}
                        options={[
                            { value: "grid", label: "Grid" },
                            { value: "list", label: "List" },
                        ]}
                    />
                </div>

                {/* Density */}
                <div className="flex items-center gap-2 rounded-xl app-border border px-2 py-1">
                    <span className="text-xs app-subtle">Density</span>
                    <Segmented
                        value={density}
                        onChange={setDensity}
                        options={[
                            { value: "cozy", label: "Comfortable" },
                            { value: "compact", label: "Compact" },
                        ]}
                    />
                </div>
            </div>

            {/* Library */}
            <GameCapsuleList searchQuery={query} layout={layout} density={density} />
        </div>
    );
}

/* ---- UI helpers ---- */

function Segmented({ value, onChange, options }) {
    return (
        <div className="inline-flex rounded-lg p-0.5" style={{ background: "rgb(var(--elevated))" }}>
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={
                            "px-2.5 py-1 text-xs rounded-md transition " +
                            (active ? "btn-primary" : "btn-ghost")
                        }
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}