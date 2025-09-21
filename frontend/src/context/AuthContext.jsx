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
    
    // Функция для чтения cookies
    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            try {
                return JSON.parse(decodeURIComponent(parts.pop().split(';').shift()));
            } catch (error) {
                console.warn(`Failed to parse cookie ${name}:`, error);
                return null;
            }
        }
        return null;
    };
    
    const setGuestMode = (guestData = null) => {
        if (guestData) {
            const userData = {
                id: 'guest',
                username: guestData.username,
                platform: guestData.platform,
                isGuest: true,
                display_name: guestData.username
            };
            setUser(userData);
            // Сохраняем данные гостя в cookies
            try {
                const cookieData = JSON.stringify({
                    username: guestData.username,
                    platform: guestData.platform
                });
                // Устанавливаем сессионный cookie (до закрытия браузера)
                document.cookie = `guestData=${encodeURIComponent(cookieData)}; path=/; SameSite=Lax`;
            } catch (error) {
                console.warn('Failed to save guest data to cookies:', error);
            }
        } else {
            setUser({
                id: 'guest',
                username: 'guest',
                platform: 'twitch',
                isGuest: true,
                display_name: 'Гость'
            });
            // Удаляем cookie
            document.cookie = 'guestData=; max-age=0; path=/';
        }
        updateUserMode('guest');
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
                // Если нет авторизованного пользователя, проверяем режим гостя
                const savedUserMode = localStorage.getItem('userMode');
                if (savedUserMode === 'guest') {
                    const guestData = getCookie('guestData');
                    if (guestData && guestData.username) {
                        const guestUser = {
                            id: 'guest',
                            username: guestData.username,
                            platform: guestData.platform,
                            isGuest: true,
                            display_name: guestData.username
                        };
                        setUser(guestUser);
                        updateUserMode('guest');
                    } else {
                        setUser(null);
                    }
                } else {
                    setUser(null);
                }
            }
        } catch (error) {
            // 401 ошибка нормальна для гостей, не логируем как ошибку
            if (error.response?.status !== 401) {
                console.error("Session check failed:", error);
            }
            // При ошибке тоже проверяем режим гостя
            const savedUserMode = localStorage.getItem('userMode');
            if (savedUserMode === 'guest') {
                const guestData = getCookie('guestData');
                if (guestData && guestData.username) {
                    const guestUser = {
                        id: 'guest',
                        username: guestData.username,
                        platform: guestData.platform,
                        isGuest: true,
                        display_name: guestData.username
                    };
                    setUser(guestUser);
                    updateUserMode('guest');
                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
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
        // Удаляем cookie
        document.cookie = 'guestData=; max-age=0; path=/';
        navigate('/login');
    };
    
    const isAuthenticated = !!user && user.id !== 'guest';

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
