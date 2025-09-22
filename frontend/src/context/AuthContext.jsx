// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout as logoutUser } from '../services/microservices';
import api from '../services/api'; // Import the api instance
import { useToast } from '../components/ui/toast';

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
    
    const setGuestMode = async (guestData = null) => {
        if (guestData) {
            // Проверяем, не заблокирован ли канал для гостевого режима
            try {
                const response = await api.get(`/api/chat/guest/check-blocked?channel_name=${guestData.username}`);
                if (response.data.blocked) {
                    throw new Error('Этот канал заблокирован для гостевого режима. Пожалуйста, авторизуйтесь через Twitch.');
                }
            } catch (error) {
                if (error.message.includes('заблокирован')) {
                    throw error;
                }
                // Если ошибка не связана с блокировкой, продолжаем
                console.warn('Could not check channel block status:', error);
            }

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
                console.log('AuthContext: Saved guest data to cookie:', cookieData);
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
            // Очищаем TTS health статус при отключении гостевого режима
            localStorage.removeItem('tts_health_status');
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
                console.log('AuthContext: Checking guest mode, savedUserMode:', savedUserMode);
                if (savedUserMode === 'guest') {
                    const guestData = getCookie('guestData');
                    console.log('AuthContext: Guest data from cookie:', guestData);
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
                        
                        // Проверяем статус верификации гостевого режима
                        try {
                            const statusResponse = await api.get(`/api/chat/guest/status?channel_name=${guestData.username}`);
                            console.log('AuthContext: Guest status check:', statusResponse.data);
                            if (statusResponse.data.verified && statusResponse.data.connected) {
                                // Гость верифицирован и бот подключен, восстанавливаем режим
                                console.log('AuthContext: Guest mode verified and bot connected, restoring guest mode');
                            } else {
                                // Гость не верифицирован или бот не подключен, сбрасываем режим
                                console.log('AuthContext: Guest mode not verified or bot not connected, clearing guest data');
                                updateUserMode(null);
                                document.cookie = 'guestData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                                setUser(null);
                            }
                        } catch (error) {
                            console.error('Failed to check guest verification status:', error);
                            // При ошибке сбрасываем режим гостя
                            updateUserMode(null);
                            document.cookie = 'guestData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                            setUser(null);
                        }
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
                    
                    // НЕ подключаем бота автоматически - пользователь должен пройти верификацию заново
                    console.log('Guest mode restored, but bot reconnection requires new verification');
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
    }, []); // Remove checkUserStatus from dependencies to prevent infinite loop

    const login = async () => {
        console.log('🔐 Попытка входа через Twitch...');
        try {
            // Получаем URL авторизации от API
            const response = await api.get('/api/auth/twitch/login');
            const { auth_url } = response.data;
            
            // Перенаправляем на Twitch OAuth
            window.location.href = auth_url;
        } catch (error) {
            console.error('❌ Ошибка при получении URL авторизации:', error);
            // Fallback на старый способ
            window.location.href = 'http://localhost:8000/auth/twitch';
        }
    };

    const logout = async () => {
        // Если пользователь в гостевом режиме, отключаем бота от канала
        if (user && user.isGuest && user.username) {
            try {
                await api.post('/api/chat/guest/disconnect', {
                    channel_name: user.username
                });
                console.log('Bot disconnected from channel:', user.username);
            } catch (error) {
                console.error('Failed to disconnect bot from channel:', error);
            }
        }
        
        try {
            await logoutUser(); // Вызываем logout на сервере для очистки сессии
        } catch (error) {
            console.error('Server logout failed, proceeding with client-side logout:', error);
        }
        
        // Очищаем состояние на клиенте
        setUser(null);
        updateUserMode(null);
        
        // Удаляем все гостевые данные
        document.cookie = 'guestData=; max-age=0; path=/';
        localStorage.removeItem('userMode');
        
        // Очищаем TTS health статус из localStorage
        localStorage.removeItem('tts_health_status');
        
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
