// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { botService } from '../services/microservices';
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
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

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
        botService.get('/auth/vk/login') // Используем новый, унифицированный URL
            .then(response => {
                if (response.data.auth_url) {
                    window.location.href = response.data.auth_url;
                }
            })
            .catch(error => {
                console.error("VK login error:", error);
                toast.error('Ошибка при входе через VK Live.');
            });
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

    const value = {
        user,
        isAuthenticated,
        isLoading,
        loginWithTwitch,
        loginWithVk,
        logout,
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
