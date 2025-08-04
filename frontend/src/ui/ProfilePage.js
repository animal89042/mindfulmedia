import React, { useEffect } from 'react';
import axios from "axios";
import apiRoutes from "../apiRoutes";
import { useNavigate } from 'react-router-dom';

const ProfilePage = ({ user, checked, setUser }) => {
    const navigate = useNavigate();

    //Handle sign out
    const handleLogout = () => {
        axios
            .post(apiRoutes.logout, {}, {withCredentials: true})
            .finally(() => {
                setUser(null);
                navigate("/");
            });
    };

    useEffect(() => {
        if (checked && !user) {
            navigate("/");
        }
    }, [checked, user, navigate]);

    return (
        <div className="profile-page">
            <button onClick={handleLogout}>Sign Out</button>
        </div>
    );
};

export default ProfilePage;
