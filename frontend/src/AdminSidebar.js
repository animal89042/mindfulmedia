import React, { useState, useEffect } from 'react';
import apiRoutes from './apiRoutes';
import axios from 'axios';
import './AdminSidebar.css';

const AdminSidebar = () => {
    const [users, setUsers] = useState([]);
    const [opened, setOpened] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        axios.get(apiRoutes.getUser, { withCredentials: true })
            .then(res => {
                if (res.data.role === 'admin') setIsAdmin(true);
            })
            .catch(err => console.error('Failed to fetch user role', err));
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        axios.get(apiRoutes.getAdminUsers, { withCredentials: true })
            .then(res => setUsers(res.data))
            .catch(err => console.error('Failed to fetch admin users', err));
    }, [isAdmin]);

    if (!isAdmin) return null;

    return (
        <>
            <button
                className="admin-btn"
                onClick={() => setOpened(true)}
            >
                Admin
            </button>
            {opened && (
                <>
                    {/* dark overlay to dim the page */}
                    <div
                        className="admin-overlay"
                        onClick={() => setOpened(false)}
                    />
                    <div className="admin-panel">
                        <div className="admin-panel-header">
                            <span>Users</span>
                            <button onClick={() => setOpened(false)}>×</button>
                        </div>
                        <div className="admin-panel-body">
                            {users.length > 0 ? (
                                users.map(u => (
                                    <div key={u.id} className="admin-user-row">
                                        <span>{u.name}</span>
                                        <span className="admin-user-role">{u.role}</span>
                                    </div>
                                ))
                            ) : (
                                <p>No users found.</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default AdminSidebar;
