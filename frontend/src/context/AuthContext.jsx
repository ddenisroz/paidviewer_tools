// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout as logoutUser } from '../services/microservices';
import api from '../services/api'; // Import the api instance
import { toast } from 'sonner';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
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
    
    const setGuestMode = () => {
        updateUserMode('guest');
        navigate('/dashboard');
    };
    
    // Функция для обновления данных пользователя после авторизации
    const refreshUser = useCallback(async () => {
        try {
            const response = await getUser();
            if (response.data) {
                setUser(response.data);
                updateUserMode('auth');
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Failed to fetch user:", error);
            setUser(null);
        }
    }, []);

    const checkUserStatus = useCallback(async () => {
        setLoading(true);
        
        try {
            const response = await getUser();
            if (response.data) {
                setUser(response.data);
                updateUserMode('auth');
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Session check failed:", error);
            setUser(null);
        }
        
        setLoading(false);
    }, []);

    useEffect(() => {
        checkUserStatus();
    }, [checkUserStatus]);

    const login = () => {
        console.log('🔐 Попытка входа через Twitch...');
        // Перенаправляем на страницу авторизации Twitch
        window.location.href = 'http://localhost:8000/api/auth/twitch/login';
    };

    const logout = async () => {
        try {
            await logoutUser(); // Вызываем logout на сервере для очистки сессии
        } catch (error) {
             console.error('Server logout failed, proceeding with client-side logout:', error);
        }
        
        // Очищаем состояние на клиенте
        setUser(null);
        updateUserMode(null);
        navigate('/login');
    };
    
    const isAuthenticated = !!user;

    const value = useMemo(() => ({
        user,
        userMode,
        login,
        refreshUser,
        logout,
        loading,
        isAuthenticated,
        checkUserStatus,
        setGuestMode
    }), [user, userMode, loading, isAuthenticated, checkUserStatus, login, refreshUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
