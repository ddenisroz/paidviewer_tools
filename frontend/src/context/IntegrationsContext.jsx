import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { botService } from '../services/microservices';

const IntegrationsContext = createContext();

export const useIntegrations = () => useContext(IntegrationsContext);

export const IntegrationsProvider = ({ children }) => {
    const { isAuthenticated, integrationsNeedRefresh, markIntegrationsRefreshed, loginWithTwitch, loginWithVk } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [integrations, setIntegrations] = useState({
        twitch: { enabled: false },
        vk: { enabled: false },
    });

    const fetchIntegrations = useCallback(async () => {
        if (!isAuthenticated) {
            setIntegrations({ twitch: { enabled: false }, vk: { enabled: false } });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            // Используем эндпоинт, который обращается к базе данных
            const response = await botService.get('/api/auth/status');
            if (response.data && response.data.integrations) {
                setIntegrations({
                    twitch: { enabled: !!response.data.integrations.twitch },
                    vk: { enabled: !!response.data.integrations.vk },
                });
            } else {
                 setIntegrations({ twitch: { enabled: false }, vk: { enabled: false } });
            }
        } catch (error) {
            console.error('Error fetching integrations status:', error);
            setIntegrations({ twitch: { enabled: false }, vk: { enabled: false } });
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations, isAuthenticated]);

    useEffect(() => {
        if (integrationsNeedRefresh) {
            fetchIntegrations();
            markIntegrationsRefreshed();
        }
    }, [integrationsNeedRefresh, fetchIntegrations, markIntegrationsRefreshed]);

    const updateTwitchIntegration = async (enabled) => {
        if (enabled) {
            // Подключить Twitch интеграцию - перенаправить на OAuth
            loginWithTwitch();
        } else {
            // Отключить Twitch интеграцию
            try {
                setIsLoading(true);
                await botService.post('/api/integrations/twitch/disconnect');
                await fetchIntegrations(); // Обновить состояние
            } catch (error) {
                console.error('Error disconnecting Twitch:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const updateVkIntegration = async (enabled) => {
        if (enabled) {
            // Подключить VK интеграцию - перенаправить на OAuth
            loginWithVk();
        } else {
            // Отключить VK интеграцию
            try {
                setIsLoading(true);
                await botService.post('/api/integrations/vk/disconnect');
                await fetchIntegrations(); // Обновить состояние
            } catch (error) {
                console.error('Error disconnecting VK:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const value = {
        integrations,
        isLoading,
        refreshIntegrations: fetchIntegrations,
        updateTwitchIntegration,
        updateVkIntegration,
    };

    return (
        <IntegrationsContext.Provider value={value}>
            {children}
        </IntegrationsContext.Provider>
    );
};
