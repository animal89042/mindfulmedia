import React, { useState } from "react";

/* Image with skeleton that respects theme tokens */
function GameImage({ src, alt, height = 450, rounded = "rounded-xl" }) {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className={`w-full overflow-hidden ${rounded}`}>
            {!loaded && (
                <div
                    className="w-full animate-pulse"
                    style={{ height, background: "rgb(var(--elevated))" }}
                />
            )}
            <img
                src={src}
                alt={alt}
                onLoad={() => setLoaded(true)}
                className={`w-full object-cover transition-transform duration-300 ${
                    loaded ? "block" : "hidden"
                }`}
                style={{ height }}
            />
        </div>
    );
}

export default function GameCapsule({
                                        title,
                                        imageUrl,
                                        category,
                                        rating,
                                        layout = "grid",
                                        density = "cozy",
}) {
    const isGrid = layout === "grid";
    const isCompact = density === "compact";

    if (isGrid) {
        const gridImgH = isCompact ? 380 : 450;
        return (
            <div className={`card shadow ${isCompact ? "w-[260px]" : "w-[300px]"} transition-transform duration-300 hover:scale-[1.02]`}>
                <GameImage src={imageUrl} alt={title} height={gridImgH} />
                <div className={(isCompact ? "p-3" : "p-4") + " flex-1 flex flex-col justify-between"}>
                    <h3 className={(isCompact ? "text-sm" : "text-base") + " m-0 font-semibold truncate"}>
                        {title}
                    </h3>
                    <div className="mt-3 flex items-center justify-between text-sm app-subtle">
                        <span>{category}</span>
                        {rating ? <span className="chip">{rating}</span> : <span />}
                    </div>
                </div>
            </div>
        );
    }

    // LIST
    const thumbH = isCompact ? 64 : 80;
    return (
        <div className="card px-3 py-2 flex items-center gap-3 w-full">
            <div className="shrink-0">
                <GameImage src={imageUrl} alt={title} height={thumbH} rounded="rounded-lg" />
            </div>

            <div className="min-w-0 flex-1">
                <h3 className={(isCompact ? "text-sm" : "text-base") + " m-0 font-semibold truncate"}>
                    {title}
                </h3>
                <div className={(isCompact ? "text-xs" : "text-sm") + " app-subtle"}>
                    {category}
                </div>
            </div>

            {rating ? (
                <div className={(isCompact ? "text-xs" : "text-sm") + " shrink-0 ml-2"}>
                    <span className="chip">{rating}</span>
                </div>
            ) : null}
        </div>
    );
}