import React, { useState } from "react";

function GameImage({ src, alt }) {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className="w-full overflow-hidden rounded-md">
            {/* Skeleton while loading */}
            {!loaded && (
                <div className="w-full h-[450px] animate-pulse bg-zinc-800/60" />
            )}
            <img
                src={src}
                alt={alt}
                onLoad={() => setLoaded(true)}
                className={`w-full h-[450px] object-cover transition-transform duration-300 ${
                    loaded ? "block" : "hidden"
                }`}
            />
        </div>
    );
}

export default function GameCapsule({ title, imageUrl, category, rating }) {
    return (
        <div className="bg-zinc-900 text-zinc-100 w-[300px] rounded-xl shadow-lg m-5 transition-transform duration-300 hover:scale-[1.03] flex flex-col">
            <div className="relative">
                <GameImage src={imageUrl} alt={title} />
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between">
                <h3 className="m-0 text-base font-medium truncate">{title}</h3>

                <div className="mt-3 flex items-center justify-between text-sm text-zinc-400">
                    <span>{category}</span>
                    {rating ? <span className="text-yellow-400">{rating}</span> : <span />}
                </div>
            </div>
        </div>
    );
}