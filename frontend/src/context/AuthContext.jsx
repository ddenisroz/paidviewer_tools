// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { botService, loginVk } from '../services/microservices';
import { toast } from 'sonner';

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [integrationsNeedRefresh, setIntegrationsNeedRefresh] = useState(false);

    const checkAuthStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await botService.get('/api/auth/status');
            const { authenticated, user: userData, integrations } = response.data;

            
            if (authenticated) {
                setIsAuthenticated(true);
                // Добавляем поле integrations в объект user для удобства
                setUser({ ...userData, integrations }); 
            } else {
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            // Только при HTTP 401/403 считаем, что пользователь не аутентифицирован
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                setIsAuthenticated(false);
                setUser(null);
            } else {
            }
            // При других ошибках (сеть, 500, etc) не меняем состояние аутентификации
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    // Очистка legacy сессий при аутентификации
    useEffect(() => {
        if (isAuthenticated && user?.id && user?.id > 0) {
            // Вызываем endpoint для очистки legacy сессий
            botService.post('/api/sessions/clear-legacy')
                .then(() => {
                    // Legacy sessions cleared
                })
                .catch((error) => {
                    // Legacy sessions cleanup skipped
                });
        }
    }, [isAuthenticated, user?.id]);

    const loginWithTwitch = () => {
        botService.get('/auth/twitch/login')
            .then(response => {
                if (response.data.auth_url) {
                    window.location.href = response.data.auth_url;
                }
            })
            .catch(error => {
                console.error("Twitch login error:", error);
                toast.error('Ошибка при входе через Twitch.');
            });
    };

    const loginWithVk = () => {
        try {
            loginVk();
        } catch (error) {
            console.error("VK login error:", error);
            toast.error('Ошибка при входе через VK Live.');
        }
    };

    const logout = async () => {
        try {
            await botService.post('/api/auth/logout');
            setIsAuthenticated(false);
            setUser(null);
            toast.success('Вы успешно вышли из системы.');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Ошибка при выходе из системы.');
        }
    };

    const markIntegrationsRefreshed = () => {
        setIntegrationsNeedRefresh(false);
    };
    
    // Функция для вызова обновления интеграций
    const triggerIntegrationsRefresh = () => {
        setIntegrationsNeedRefresh(true);
    };

    const setGuestMode = async (guestData) => {
        try {
            // Устанавливаем гостевой режим
            setIsAuthenticated(true);
            setUser({
                id: -1, // Специальный ID для гостевого пользователя
                username: guestData.username,
                is_admin: false,
                is_guest: true,
                platform: guestData.platform,
                integrations: {}
            });
            
            // Можно добавить дополнительную логику для гостевого режима
        } catch (error) {
            console.error('Failed to set guest mode:', error);
            throw error;
        }
    };

    const value = {
        user,
        isAuthenticated,
        isLoading,
        loginWithTwitch,
        loginWithVk,
        logout,
        setGuestMode,
        integrationsNeedRefresh,
        markIntegrationsRefreshed,
        triggerIntegrationsRefresh,
        refreshAuthStatus: checkAuthStatus // Экспортируем функцию для обновления
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
