// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getUser, logout as logoutUser } from '../services/microservices'; // Import new functions
import { toast } from 'sonner';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // 'auth', 'guest', or null
    const [userMode, setUserMode] = useState(() => localStorage.getItem('userMode') || null);
    const navigate = useNavigate();

    const updateUserMode = (mode) => {
        if (mode) {
            localStorage.setItem('userMode', mode);
        } else {
            localStorage.removeItem('userMode');
        }
        setUserMode(mode);
    };

    const checkUserStatus = useCallback(async () => {
        setLoading(true);
        try {
            const response = await getUser();
            if (response.data) {
                setUser(response.data);
                // Fake token for local dev; server handles real auth via httpOnly cookie
                setToken('fake-local-token'); 
            } else {
                setUser(null);
                setToken(null);
            }
        } catch (error) {
            setUser(null);
            setToken(null);
            console.error("No active session or user not found:", error.response?.data?.detail || error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkUserStatus();
    }, [checkUserStatus]);

    const login = (userData, userToken) => {
        setUser(userData);
        setToken(userToken);
    };

    const logout = async () => {
        try {
            await logoutUser();
            setUser(null);
            setToken(null);
            toast.success('Вы успешно вышли из системы.');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Ошибка при выходе из системы.');
        }
    };
    
    const isAuthenticated = !!user;

    const value = useMemo(() => ({
        user,
        userMode,
        login,
        logout,
        loading,
        isAuthenticated,
        checkUserStatus,
        setGuestMode
    }), [user, userMode, loading, isAuthenticated, checkUserStatus]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
