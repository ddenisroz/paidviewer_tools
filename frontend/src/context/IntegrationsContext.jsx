import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { botService } from '../services/microservices';

const IntegrationsContext = createContext();

export const useIntegrations = () => useContext(IntegrationsContext);

export const IntegrationsProvider = ({ children }) => {
    const { isAuthenticated, user, integrationsNeedRefresh, markIntegrationsRefreshed, loginWithTwitch, loginWithVk, refreshAuthStatus } = useAuth();
    const [integrations, setIntegrations] = useState({
        twitch: { enabled: null }, // null = загрузка, false = отключено, true = включено
        vk: { enabled: null },
    });
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    const fetchIntegrations = useCallback(async () => {
        if (isAuthenticated === false) {
            setIntegrations({ twitch: { enabled: false }, vk: { enabled: false } });
            setIsLoading(false);
            setInitialLoad(false);
            return;
        }

        // Если пользователь аутентифицирован, используем данные из AuthContext
        if (isAuthenticated === true && user?.integrations) {
            const newIntegrations = {
                twitch: { 
                    enabled: !!user.integrations.twitch?.connected,  // Проверяем поле connected
                    username: user.integrations.twitch?.username || null
                },
                vk: { 
                    enabled: !!user.integrations.vk?.connected,  // Проверяем поле connected
                    username: user.integrations.vk?.username || null
                },
            };
            setIntegrations(newIntegrations);
            setIsLoading(false);
            setInitialLoad(false);
            return;
        }

        // Если данные еще не загружены, показываем состояние загрузки
        if (isAuthenticated === null) {
            setIntegrations({ twitch: { enabled: null }, vk: { enabled: null } });
            setIsLoading(true);
            setInitialLoad(true);
        }
    }, [isAuthenticated, user?.integrations]);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    useEffect(() => {
        if (integrationsNeedRefresh) {
            // Принудительно обновляем данные аутентификации
            refreshAuthStatus(true);
            fetchIntegrations();
            markIntegrationsRefreshed();
        }
    }, [integrationsNeedRefresh, fetchIntegrations, markIntegrationsRefreshed, refreshAuthStatus]);

    const updateTwitchIntegration = async (enabled, onClose = null) => {
        if (enabled) {
            // Подключить Twitch интеграцию - перенаправить на OAuth
            if (onClose) onClose(); // Закрываем попап перед перенаправлением
            loginWithTwitch();
        } else {
            // Отключить Twitch интеграцию
            try {
                setIsLoading(true);
                const disconnectResponse = await botService.post('/api/integrations/twitch/disconnect');
                // Обновляем данные пользователя из AuthContext
                await refreshAuthStatus(true);
                await fetchIntegrations();
            } catch (error) {
                console.error('Error disconnecting Twitch:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const updateVkIntegration = async (enabled, onClose = null) => {
        if (enabled) {
            // Подключить VK интеграцию - перенаправить на OAuth
            console.log('🔵 [INTEGRATIONS] VK integration enable requested');
            if (onClose) onClose(); // Закрываем попап перед перенаправлением
            console.log('🔵 [INTEGRATIONS] Calling loginWithVk()');
            loginWithVk();
        } else {
            // Отключить VK интеграцию
            try {
                setIsLoading(true);
                const disconnectResponse = await botService.post('/api/integrations/vk/disconnect');
                // Обновляем данные пользователя из AuthContext
                await refreshAuthStatus(true);
                await fetchIntegrations();
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
