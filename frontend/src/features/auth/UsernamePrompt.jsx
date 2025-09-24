import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../app/Theme";
import { api } from "../../api/client";
import routes from "../../api/routes";

const isValid = (s) => /^[A-Za-z0-9_]{3,20}$/.test(String(s || ""));

export default function UsernamePrompt({ open, platformName, onClose, onSaved }) {
    const { theme } = useTheme();

    // light/dark tokens
    const t =
        theme === "dark"
            ? {
                backdrop: "rgba(0,0,0,0.5)",
                surface: "#0f1220",
                text: "#e5e7eb",
                sub: "#9ca3af",
                border: "rgba(255,255,255,.12)",
                inputBg: "#0b0f19",
                inputBorder: "rgba(255,255,255,.14)",
                inputText: "#e5e7eb",
                ghostBorder: "rgba(255,255,255,.16)",
                ghostText: "#e5e7eb",
                primaryBg: "#111827",
                primaryText: "#ffffff",
                error: "#fca5a5",
            }
            : {
                backdrop: "rgba(0,0,0,0.35)",
                surface: "#ffffff",
                text: "#111827",
                sub: "#6b7280",
                border: "rgba(0,0,0,.08)",
                inputBg: "#ffffff",
                inputBorder: "#e5e7eb",
                inputText: "#111827",
                ghostBorder: "#e5e7eb",
                ghostText: "#111827",
                primaryBg: "#111827",
                primaryText: "#ffffff",
                error: "#b00020",
            };

    const [mode, setMode] = useState(platformName ? "platform" : "custom"); // 'platform' | 'custom'
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const canSubmit = useMemo(() => {
        if (busy) return false;
        if (mode === "platform") return Boolean(platformName);
        return isValid(value);
    }, [busy, mode, value, platformName]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
            if (e.key === "Enter" && canSubmit) submit();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, canSubmit]); // tie to canSubmit for accessibility

    if (!open) return null;

    async function submit() {
        try {
            setBusy(true);
            setErr("");

            const payload =
                mode === "platform"
                    ? { choice: "platform" }
                    : { choice: "custom", username: value.trim() };

            // support routes.verifyMe as function or string
            const path =
                typeof routes.verifyMe === "function"
                    ? routes.verifyMe()
                    : routes.verifyMe || "/me/username";

            // axios-style client: POST with credentials
            const res = await api.post(path, payload, { withCredentials: true });
            const data = res?.data ?? {};
            onSaved?.(data.username);
            onClose?.();
        } catch (e) {
            const msg =
                e?.response?.data?.error ||
                e?.message ||
                "Could not save username";
            setErr(msg);
            setBusy(false);
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="username-prompt-title"
            style={{
                position: "fixed",
                inset: 0,
                background: t.backdrop,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    width: 420,
                    maxWidth: "90vw",
                    background: t.surface,
                    color: t.text,
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                    border: `1px solid ${t.border}`,
                }}
            >
                <h2 id="username-prompt-title" style={{ margin: 0 }}>
                    Pick your display username
                </h2>
                <p style={{ marginTop: 8, color: t.sub }}>
                    Choose a unique name for MindfulMedia, or use your platform name.
                </p>

                {platformName && (
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 12,
                            gap: 8,
                        }}
                    >
                        <input
                            type="radio"
                            name="mode"
                            checked={mode === "platform"}
                            onChange={() => setMode("platform")}
                        />
                        <span>
              Use platform name: <strong>{platformName}</strong>
            </span>
                    </label>
                )}

                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        marginTop: 12,
                        gap: 8,
                    }}
                >
                    <input
                        type="radio"
                        name="mode"
                        checked={mode === "custom"}
                        onChange={() => setMode("custom")}
                    />
                    <span>Create my own:</span>
                </label>

                <input
                    style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.inputBorder}`,
                        background: t.inputBg,
                        color: t.inputText,
                        outline: "none",
                        opacity: mode === "custom" ? 1 : 0.6,
                    }}
                    disabled={mode !== "custom" || busy}
                    placeholder="e.g. night_owl"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />
                <div style={{ fontSize: 12, color: t.sub, marginTop: 4 }}>
                    3–20 chars, letters/numbers/underscore
                </div>

                {err && (
                    <div style={{ marginTop: 10, color: t.error, fontSize: 13 }}>
                        {err}
                    </div>
                )}

                <div
                    style={{
                        marginTop: 18,
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                    }}
                >
                    <button
                        onClick={onClose}
                        disabled={busy}
                        style={{
                            background: "transparent",
                            border: `1px solid ${t.ghostBorder}`,
                            color: t.ghostText,
                            padding: "8px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!canSubmit}
                        style={{
                            background: t.primaryBg,
                            color: t.primaryText,
                            border: "none",
                            padding: "8px 12px",
                            borderRadius: 8,
                            cursor: canSubmit ? "pointer" : "not-allowed",
                            opacity: canSubmit ? 1 : 0.6,
                        }}
                    >
                        {busy ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}