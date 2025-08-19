import { useEffect, useRef, useState } from "react";
import gearPng from "../../assets/gear.png";

export default function SettingsMenu() {
    const [open, setOpen] = useState(false);
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem("theme");
        if (saved === "light" || saved === "dark") return saved;
        // fall back to system
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    });
    const ref = useRef(null);

    // APPLY THEME to <html data-theme="..."> and persist
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Close on outside click + Esc (single effect)
    useEffect(() => {
        const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        if (open) {
            window.addEventListener("mousedown", onClick);
            window.addEventListener("keydown", onKey);
        }
        return () => {
            window.removeEventListener("mousedown", onClick);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            {/* Trigger */}
            <button
                className="btn-ghost h-12 w-12 grid place-items-center"  // bigger clickable box
                onClick={() => setOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                title="Settings"
            >
                <img
                    src={gearPng}
                    alt="Settings"
                    className={`h-6 w-6 object-contain ${open ? "animate-[spin_3s_linear_infinite]" : ""}`}
                />
                <span className="sr-only">Open settings</span>
            </button>

            {/* Dropdown */}
            <div
                role="menu"
                className={`absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border app-border p-1 shadow-2xl z-50 transition-all duration-200 ease-out ${
                    open ? "" : "hidden"
                }`}
                style={{ background: "rgb(var(--surface))" }}
            >
                <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider app-subtle">
                    Theme
                </div>

                <button
                    role="menuitemradio"
                    aria-checked={theme === "light"}
                    onClick={() => { setTheme("light"); setOpen(false); }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-[rgb(var(--text)/.06)]"
                >
                    Light {theme === "light" && <span className="text-xs">✓</span>}
                </button>

                <button
                    role="menuitemradio"
                    aria-checked={theme === "dark"}
                    onClick={() => { setTheme("dark"); setOpen(false); }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-[rgb(var(--text)/.06)]"
                >
                    Dark {theme === "dark" && <span className="text-xs">✓</span>}
                </button>
            </div>
        </div>
    );
}