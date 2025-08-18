import React, { useEffect, useRef, useState } from "react";

const Settings = ({ theme, toggleTheme }) => {
    const [open, setOpen] = useState(false);
    const [compact, setCompact] = useState(() => localStorage.getItem("compactCapsules") === "true");
    const [listMode, setListMode] = useState(() => localStorage.getItem("listMode") === "true");
    const ref = useRef(null);

    useEffect(() => {
        const onClickAway = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
        document.addEventListener("mousedown", onClickAway);
        return () => document.removeEventListener("mousedown", onClickAway);
    }, []);

    useEffect(() => {
        document.body.classList.toggle("compact-capsules", compact);
        localStorage.setItem("compactCapsules", compact);
    }, [compact]);

    useEffect(() => {
        document.body.classList.toggle("list-modules", listMode);
        localStorage.setItem("listMode", listMode);
    }, [listMode]);

    return (
        <div className="relative" ref={ref}>
            <button
                className="nav-button rounded-md border border-white/20 bg-white/10 px-3 py-2"
                onClick={() => setOpen((o) => !o)}
            >
                Settings ⚙️
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-white/15 bg-zinc-900 text-zinc-100 shadow-xl">
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-white/10"
                        onClick={() => {
                            toggleTheme();
                            setOpen(false);
                        }}
                    >
                        {theme === "dark" ? "Light Mode ☀️" : "Dark Mode 🌙"}
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-white/10"
                        onClick={() => {
                            setCompact((c) => !c);
                            setOpen(false);
                        }}
                    >
                        {compact ? "Normal Capsules" : "Compact Capsules"}
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-white/10"
                        onClick={() => {
                            setListMode((l) => !l);
                            setOpen(false);
                        }}
                    >
                        {listMode ? "Grid View" : "List Modules"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Settings;
