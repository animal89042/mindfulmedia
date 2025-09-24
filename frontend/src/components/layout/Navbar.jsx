import { Link } from "react-router-dom";
import SettingsMenu from "./SettingsMenu";
import logo from "../../assets/logo.svg";

export default function Navbar({ user }) {
    const displayName =
        user?.display_name || user?.displayName || user?.username || "Profile";
    const avatar = user?.avatar || null;

    return (
        <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur">
            {/* Full width; just give side padding that scales */}
            <div className="w-full px-4 sm:px-6 lg:px-10">
                {/* Grid keeps brand centered without hacks */}
                <div className="grid grid-cols-3 items-center h-14">

                    {/* Left side: */}
                    <div className="flex items-center gap-3">
                        <Link
                            to="/leaderboards/top-time"
                            className="text-lg font-bold tracking-wide text-blue-400 hover:text-blue-300 transition"
                        >
                            Leaderboard
                        </Link>
                    </div>

                    {/* Centered brand */}
                    <Link to="/" className="justify-self-center group inline-flex items-center gap-2 select-none">
                        <img
                            src={logo}
                            alt="MindfulMedia Logo"
                            className="h-8 w-8 transition-transform duration-300 ease-out group-hover:rotate-12 group-hover:scale-110 drop-shadow"
                        />
                        <div className="relative">
                            <h1 className="text-2xl font-extrabold tracking-wide transition-all duration-300 text-blue-400 group-hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.55)]">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-400 group-hover:from-blue-400 group-hover:to-cyan-300 transition-colors duration-300">
                                    MindfulMedia
                                </span>
                            </h1>
                            <span className="pointer-events-none absolute -bottom-1 left-0 block h-[2px] w-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 transition-transform duration-300 group-hover:scale-x-100" />
                        </div>
                    </Link>

                    {/* Right side: settings + profile */}
                    <div className="justify-self-end flex items-center gap-4 min-w-0">
                        <SettingsMenu />

                        <Link to="/profile" className="group flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-white/10 ring-1 ring-white/15
                              transition transform group-hover:scale-[1.03] group-hover:ring-white/30">
                                {avatar ? (
                                    <img src={avatar} alt={displayName} className="h-full w-full object-cover" draggable={false} />
                                ) : (
                                    <div className="grid h-full w-full place-items-center text-[11px] text-white/80">
                                        {displayName.slice(0, 1).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="text-sm text-white/80 group-hover:text-white truncate max-w-[140px]">
                                {displayName}
                            </span>
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
}