import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import routes from '../../api/routes';

export default function JournalsTab({ userId, compact = false, limit = 0 }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const pageSize = compact ? 5 : 10;

    const fmtDate = (d) => {
        const t = new Date(d);
        return isNaN(t) ? '' : t.toLocaleDateString();
    };

    const refresh = async () => {
        setLoading(true);
        try {
            const params = { page, pageSize };
            if (userId) params.userId = String(userId);
            const { data } = await api.get(routes.journals, { params });
            const list = Array.isArray(data) ? data : (data?.items ?? data?.entries ?? []);
            setItems(Array.isArray(list) ? list : []);
        } catch (e) {
            setItems([]); // fixed: was setE([])
            // eslint-disable-next-line no-console
            console.error('journals refresh failed:', e?.message || e);
        } finally { setLoading(false); }
    };

    useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId, page]);

    const visible = limit ? items.slice(0, limit) : items;

    if (loading) return <div className="p-4 animate-pulse app-subtle">Loading journals…</div>;

    return (
        <div>
            <ul className={compact ? 'space-y-2' : 'space-y-3'}>
                {visible.map((j) => (
                    <li key={j.id} className="card p-3">
                        <div className="flex items-center justify-between">
                            <div className="font-semibold">{j.title || 'Untitled'}</div>
                            <div className="text-xs app-subtle">{fmtDate(j.created_at || j.updated_at)}</div>
                        </div>
                        <div className="mt-1 text-sm app-subtle line-clamp-3">{j.body || ''}</div>
                        <div className="mt-2 text-xs flex gap-2 app-subtle">
                            {j.game_title ? <span className="chip">{j.game_title}</span> : null}
                            {j.session_minutes ? <span className="chip">{j.session_minutes} min</span> : null}
                            {j.visibility ? <span className="chip">{j.visibility}</span> : null}
                        </div>
                    </li>
                ))}
                {visible.length === 0 && <li className="text-sm app-subtle">No journal entries yet.</li>}
            </ul>

            {!compact && (
                <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm app-subtle">Page {page}</div>
                    <div className="flex gap-2">
                        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                        <button className="btn" onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}