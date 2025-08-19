import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ProfileHeader from './ProfileHeader';
import FriendsTab from './FriendsTab';
import JournalsTab from './JournalsTab';
import { api } from '../../api/client';
import routes from '../../api/routes';

export default function ProfilePage({ user: userProp, setUser }) {
    const { username } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const qs = new URLSearchParams(location.search);
    const initialTab = qs.get('tab') || 'overview';

    const [tab, setTab] = useState(initialTab);
    const [viewer, setViewer] = useState(null);
    const [profileUser, setProfileUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const pickUser = (resOrObj) => {
        const d = resOrObj?.data ?? resOrObj;
        const u = d?.user ?? d?.me ?? d;
        if (!u || typeof u !== 'object') return null;
        const id = u.id ?? u.user_id ?? u.identity_id ?? u.steam_id ?? null;
        const displayName = u.displayName ?? u.display_name ?? u.name ?? u.username ?? null;
        const usernameNorm = u.username ?? (u.name && !u.display_name ? u.name : null);
        return { ...u, id, displayName, username: usernameNorm ?? u.username };
    };

    const isSelf = useMemo(() => {
        if (!username) return true;
        if (!viewer || !profileUser) return false;
        const aId = viewer.id ?? viewer.user_id ?? viewer.identity_id;
        const bId = profileUser.id ?? profileUser.user_id ?? profileUser.identity_id;
        if (aId && bId && String(aId) === String(bId)) return true;
        const aU = viewer.username ?? viewer.name;
        const bU = profileUser.username ?? profileUser.name;
        return !!aU && !!bU && aU === bU;
    }, [username, viewer, profileUser]);

    const fmtMinutes = (m) => {
        const v = Number(m) || 0;
        return `${Math.floor(v / 60)}h ${v % 60}m`;
    };

    const setFromProfilePayload = (data, { isSelfView = false } = {}) => {
        setProfileUser(data?.user ? { ...data.user, stats: data.stats, topGames: data.topGames } : null);
        if (isSelfView) setViewer(data?.user || null);
    };

    const renderTopGamesCard = () => (
        <div className="card p-4">
            <h3 className="font-semibold mb-2">Top Games by Playtime</h3>
            <ul className="space-y-2">
                {(profileUser?.topGames || []).map((g, idx) => (
                    <li key={g.appid ?? idx} className="flex items-center justify-between border rounded-xl p-2 app-border">
                        <div className="flex items-center gap-3">
                            <div className="w-6 text-right text-xs app-subtle">{idx + 1}.</div>
                            <div className="font-medium">{g.name}</div>
                        </div>
                        <div className="text-xs app-subtle">{fmtMinutes(g.playtime_minutes)}</div>
                    </li>
                ))}
                {(!profileUser?.topGames || profileUser.topGames.length === 0) && (
                    <li className="text-sm app-subtle">No games yet.</li>
                )}
            </ul>
        </div>
    );

    // Keep tab in URL for refresh/back
    useEffect(() => {
        const p = new URLSearchParams(location.search);
        if ((p.get('tab') || 'overview') !== tab) {
            p.set('tab', tab);
            navigate({ pathname: location.pathname, search: p.toString() }, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                if (!username) {
                    const { data } = await api.get(routes.profile);
                    if (cancelled) return;
                    setFromProfilePayload(data, { isSelfView: true });
                } else {
                    const { data } = await api.get(routes.profileByUsername(username));
                    if (cancelled) return;
                    setFromProfilePayload(data, { isSelfView: false });
                    setViewer(null);
                }
            } catch (e) {
                if (!cancelled) setError(e?.message || 'Failed to load profile');
                setProfileUser(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [username]);

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto p-4 animate-pulse">
                <div className="h-24 rounded-xl mb-4" style={{ background: "rgb(var(--elevated))" }} />
                <div className="h-10 rounded-lg w-56" style={{ background: "rgb(var(--elevated))" }} />
            </div>
        );
    }

    if (error) return <div className="max-w-3xl mx-auto p-4" style={{ color: "tomato" }}>{error}</div>;
    if (!profileUser) return <div className="max-w-3xl mx-auto p-4">Profile not found.</div>;

    return (
        <div className="max-w-5xl mx-auto p-4">
            <ProfileHeader
                viewer={viewer}
                user={profileUser}
                isSelf={isSelf}
                onTabChange={setTab}
                activeTab={tab}
            />

            <div className="mt-4">
                {tab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderTopGamesCard()}
                        <div className="card p-4">
                            <h3 className="font-semibold mb-2">Friends</h3>
                            <FriendsTab userId={profileUser.id} showOnlyList limit={8} isSelf={isSelf} />
                        </div>
                    </div>
                )}

                {tab === 'friends' && <FriendsTab userId={profileUser.id} isSelf={isSelf} />}

                {tab === 'journals' && <JournalsTab userId={profileUser.id} />}
            </div>
        </div>
    );
}