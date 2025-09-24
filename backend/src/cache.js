// server/cache.js
import crypto from "crypto";

/* TTL cache */
class Cache {
    constructor({ max = 5000 } = {}) {
        this.store = new Map();     // key -> { val, exp, staleExp }
        this.inflight = new Map();  // key -> Promise
        this.max = max;
    }
    _now() { return Date.now(); }

    set(key, val, ttlMs = 60_000, swrMs = 0) {
        if (this.store.size >= this.max) {
            const first = this.store.keys().next().value;
            if (first) this.store.delete(first);
        }
        const now = this._now();
        this.store.set(key, { val, exp: now + ttlMs, staleExp: now + ttlMs + swrMs });
    }

    get(key) {
        const hit = this.store.get(key);
        if (!hit) return null;
        const now = this._now();
        if (now <= hit.exp) return { val: hit.val, state: "fresh" };
        if (now <= hit.staleExp) return { val: hit.val, state: "stale" };
        this.store.delete(key);
        return null;
    }

    del(key) { this.store.delete(key); }
    clear() { this.store.clear(); }

    async wrap(key, ttlMs, swrMs, fn) {
        const hit = this.get(key);
        if (hit?.state === "fresh") return hit.val;
        if (this.inflight.has(key)) return this.inflight.get(key);

        if (hit?.state === "stale") {
            const p = (async () => {
                try {
                    const val = await fn();
                    this.set(key, val, ttlMs, swrMs);
                    return val;
                } finally { this.inflight.delete(key); }
            })();
            this.inflight.set(key, p);
            return hit.val;
        }

        const p = (async () => {
            try {
                const val = await fn();
                this.set(key, val, ttlMs, swrMs);
                return val;
            } finally { this.inflight.delete(key); }
        })();
        this.inflight.set(key, p);
        return p;
    }
}

export const cache = new Cache();

export function etagFor(payload) {
    const buf = Buffer.isBuffer(payload)
        ? payload
        : Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload));
    const hash = crypto.createHash("md5").update(buf).digest("hex");
    return `"W/${hash}"`;
}

export function maybe304(req, res, payload) {
    const tag = etagFor(payload);
    res.set("ETag", tag);
    if (req.headers["if-none-match"] === tag) {
        res.status(304).end();
        return true;
    }
    return false;
}