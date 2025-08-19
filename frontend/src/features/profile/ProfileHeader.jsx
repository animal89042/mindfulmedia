import { useMemo } from 'react';
import { api } from '../../api/client';
import routes from '../../api/routes';

// Normalize common ID shapes
const pickId = (u) => u?.id ?? u?.user_id ?? u?.identity_id ?? u?.steam_id ?? null;

export default function ProfileHeader({ viewer, user, isSelf, onTabChange, activeTab }) {
    // Normalize stats
    const stats = useMemo(() => {
        const s = user?.stats ?? {};
        const friends = s.friends ?? s.friendCount ?? user?.friends ?? 0;
        const journals = s.journals ?? s.journalCount ?? user?.journals ?? 0;
        const playtimeMinutes = s.playtimeMinutes ?? s.play_minutes ?? user?.playtimeMinutes ?? 0;
        return { friends, journals, playtimeMinutes };
    }, [user]);

    const uid = pickId(user); // ← define uid once

    // Display name + handle with fallbacks
    const displayName =
        user?.displayName ??
        user?.display_name ??
        user?.name ??
        user?.username ??
        (uid ? `User #${uid}` : 'User');

    const handleText = user?.username ? `@${user.username}` : (user?.name && !user?.username ? user.name : '');

    // Format playtime
    const minutes = stats.playtimeMinutes || 0;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;

    // Friend actions (no-op on self)
    const onAddFriend    = async () => { if (!isSelf && uid) await api.post(routes.friendRequestTo(uid)); };
    const onRemoveFriend = async () => { if (!isSelf && uid) await api.delete(routes.friendRemove(uid)); };
    const onAccept       = async () => { if (!isSelf && uid) await api.post(routes.friendAccept(uid)); };
    const onDecline      = async () => { if (!isSelf && uid) await api.post(routes.friendDecline(uid)); };

    return (
        <div className="card p-4">
            {/* Identity row */}
            <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden" style={{ background: "rgb(var(--elevated))" }}>
                    {user?.avatar ? (
                        <img src={user.avatar} alt="avatar" className="h-full w-full object-cover" />
                    ) : null}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-extrabold">{displayName}</h1>
                        {handleText ? <span className="app-subtle">{handleText}</span> : null}
                    </div>
                    {user?.bio && <p className="mt-1 app-subtle">{user.bio}</p>}
                    <div className="flex gap-4 mt-2 text-sm app-subtle">
                        <span><strong className="text-[color:rgb(var(--text))]">{stats.friends}</strong> friends</span>
                        <span><strong className="text-[color:rgb(var(--text))]">{stats.journals}</strong> journals</span>
                        <span><strong className="text-[color:rgb(var(--text))]">{hours}h {remMin}m</strong> played</span>
                    </div>
                </div>

                {!isSelf && (
                    <div className="flex gap-2">
                        <button onClick={onAddFriend} className="btn">Add Friend</button>
                        <button onClick={onAccept} className="btn-ghost">Accept</button>
                        <button onClick={onDecline} className="btn-ghost">Decline</button>
                        <button onClick={onRemoveFriend} className="btn-ghost">Remove</button>
                    </div>
                )}
                {isSelf && (
                    <div className="flex gap-2">
                        <a href="/settings" className="btn-ghost">Edit Profile</a>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="mt-4 flex gap-2">
                {['overview','friends','journals'].map(k => (
                    <button
                        key={k}
                        onClick={() => onTabChange(k)}
                        className={`btn-ghost ${activeTab===k ? 'btn' : ''}`}
                    >{k[0].toUpperCase()+k.slice(1)}</button>
                ))}
            </div>
        </div>
    );
}