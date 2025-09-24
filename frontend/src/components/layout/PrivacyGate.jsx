import React, { useState } from "react";
import routes from "../../api/routes";
import { api } from "../../api/client";

/* ----- Infer public from reason/flags/minutes ----- */
const looksPublic = (payload = {}) => {
    const r = String(payload.reason || "").toLowerCase();
    if (r.includes("game:visible")) return true;
    if (payload.privacy === "public" && payload.privacyBlocked === false) return true;
    if (Number.isFinite(payload.playtimeMinutes) && payload.playtimeMinutes > 0) return true;
    return false;
};

/* ----- Copy text for reasons ----- */
const COPY = {
    default: {
        title: "Content is hidden by Steam privacy settings.",
        body: "Set Game Details to Public, then click Recheck Privacy.",
    },
};

/* ----- Component ----- */
export default function PrivacyGate({
                                        allowed,
                                        appid,
                                        reason = "restricted",
                                        onRecheck,
                                    }) {
    const [busy, setBusy] = useState(false);

    /* ----- Unmount if already allowed ----- */
    if (allowed) return null;

    const text = COPY[reason] || COPY.default;

    /* ----- Merge headers + normalize payload ----- */
    const pushReason = (resp, payload) => {
        const hdr = resp?.headers?.["x-privacy-reason"];
        if (hdr && !payload.reason)
            payload.reason = hdr;
        const hdrTs = resp?.headers?.["x-checked-at"];
        if (looksPublic(payload)) {
            payload.privacy = "public";
            payload.privacyBlocked = false;
        }
        return payload;
    };

    /* ----- Route payload to correct callback ----- */
    const fanout = (payload) => {
        onRecheck?.(payload);
    };

    /* ----- Manual Re-check (single request) ----- */
    async function handleRecheck() {
        if (!appid) return;
        setBusy(true);
        const url = `${routes.gameStats(appid)}?refresh=1&_=${Date.now()}`;
        try {
            const resp = await api.get(url);
            fanout(pushReason(resp, resp?.data || {}));
        } finally {
            setBusy(false);
            setTimeout(() => 1200);
        }
    }

    /* ----- UI ----- */
    return (
        <div className="rounded-lg border app-border bg-yellow-50/70 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100 p-4 text-center space-y-3">
            <div>
                <div className="font-semibold">{text.title}</div>
                <div className="mt-1">{text.body}</div>

                <div className="mt-2">
                    <a className="underline" href="https://steamcommunity.com/my/edit/settings" target="_blank" rel="noreferrer">
                        Steam Profile Settings
                    </a>
                </div>
            </div>

            {/* Re-check block */}
            {appid && (
                <div className="flex items-center justify-center gap-3">
                    <button className="btn-subtle" onClick={ handleRecheck } disabled={ busy }>
                        {busy ? "Rechecking…" : "Recheck Privacy"}
                    </button>
                </div>
            )}
        </div>
    );
}