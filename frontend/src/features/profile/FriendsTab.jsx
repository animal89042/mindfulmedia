import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import routes from '../../api/routes';

export default function FriendsTab({ userId, isSelf = false, showOnlyList = false, limit = 0 }) {
    const [friends, setFriends] = useState([]);
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [queryId, setQueryId] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 24;

    const refresh = async () => {
        setLoading(true);
        try {
            const { data: f } = await api.get(routes.friends, { params: { page, pageSize } });
            setFriends(f.friends || []);
            if (isSelf && !showOnlyList) {
                const { data: r } = await api.get(routes.friendRequests, { params: {} });
                setIncoming(r.incoming || []);
                setOutgoing(r.outgoing || []);
            }
        } catch (e) {
            setFriends([]); setIncoming([]); setOutgoing([]);
            // eslint-disable-next-line no-console
            console.error("friends refresh failed:", e?.message || e);
        } finally { setLoading(false); }
    };

    useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [page, userId, isSelf, showOnlyList]);
    const visibleFriends = useMemo(() => limit ? (friends || []).slice(0, limit) : friends, [friends, limit]);

    if (loading) return <div className="p-4 animate-pulse app-subtle">Loading friends…</div>;

    return (
        <div>
            {!showOnlyList && (
                <div className="mb-4 flex gap-2">
                    <input
                        className="input flex-1"
                        placeholder="Add friend by user ID"
                        value={queryId}
                        onChange={e => setQueryId(e.target.value)}
                    />
                    <button
                        className="btn"
                        onClick={async () => {
                            const id = Number(queryId);
                            if (!id) return;
                            await api.post(routes.friendRequestTo(id));
                            setQueryId('');
                            await refresh();
                        }}
                    >Add</button>
                </div>
            )}

            {/* Friends grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {visibleFriends.map(f => (
                    <div key={f.friend_id} className="card p-3 flex items-center justify-between">
                        <div>
                            <div className="font-semibold">User #{f.friend_id}</div>
                            <div className="text-xs app-subtle">Friend</div>
                        </div>
                        <div className="flex gap-2">
                            {isSelf && !showOnlyList && (
                                <>
                                    <button className="btn-ghost text-xs" onClick={async () => { await api.delete(routes.friendRemove(f.friend_id)); await refresh(); }}>Remove</button>
                                    <button className="btn-ghost text-xs" onClick={async () => { await api.post(routes.friendBlock(f.friend_id)); await refresh(); }}>Block</button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {!showOnlyList && (
                <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm app-subtle">Page {page}</div>
                    <div className="flex gap-2">
                        <button className="btn" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</button>
                        <button className="btn" onClick={() => setPage(p => p+1)}>Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}