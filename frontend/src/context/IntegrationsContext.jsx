import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { botService } from '../services/microservices';
import { saveReturnUrl } from '../utils/oauthRedirect';
import { API_BASE_URL } from '../constants';
import { logger } from '../utils/prodLogger';

const IntegrationsContext = createContext();

export const useIntegrations = () => useContext(IntegrationsContext);

export const IntegrationsProvider = ({ children }) => {
    const { isAuthenticated, user, integrationsNeedRefresh, markIntegrationsRefreshed, loginWithTwitch, loginWithVk, refreshAuthStatus } = useAuth();
    
    // Инициализируем сразу с данными из user если они есть, чтобы избежать мерцания
    const getInitialIntegrations = () => {
        if (user?.integrations) {
            return {
                twitch: { 
                    enabled: !!user.integrations.twitch?.connected,
                    username: user.integrations.twitch?.username || null
                },
                vk: { 
                    enabled: !!user.integrations.vk?.connected,
                    username: user.integrations.vk?.username || null
                },
                donationalerts: {
                    enabled: !!user.integrations.donationalerts?.connected,
                    username: user.integrations.donationalerts?.username || null
                },
            };
        }
        
        // 🚀 ANTI-FLASH: Показываем disabled вместо null (без лоадеров)
        // AuthContext загружает данные при инициализации, поэтому показываем placeholder
        return {
            twitch: { enabled: false, username: null },
            vk: { enabled: false, username: null },
            donationalerts: { enabled: false, username: null },
        };
    };
    
    const [integrations, setIntegrations] = useState(getInitialIntegrations);
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(!user?.integrations);

    const fetchIntegrations = useCallback(async () => {
        if (isAuthenticated === false) {
            setIntegrations({ 
                twitch: { enabled: false }, 
                vk: { enabled: false },
                donationalerts: { enabled: false }
            });
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
                donationalerts: {
                    enabled: !!user.integrations.donationalerts?.connected,
                    username: user.integrations.donationalerts?.username || null
                },
            };
            
            // Обновляем только если данные действительно изменились
            setIntegrations(prev => {
                const hasChanged = 
                    prev.twitch.enabled !== newIntegrations.twitch.enabled ||
                    prev.vk.enabled !== newIntegrations.vk.enabled ||
                    prev.donationalerts.enabled !== newIntegrations.donationalerts.enabled;
                
                return hasChanged ? newIntegrations : prev;
            });
            setIsLoading(false);
            setInitialLoad(false);
            return;
        }

        // Если данные еще не загружены, показываем состояние загрузки ТОЛЬКО если еще не было initial load
        if (isAuthenticated === null && initialLoad) {
            setIsLoading(true);
        }
    }, [isAuthenticated, user?.integrations, initialLoad]);

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

    const updateTwitchIntegration = useCallback(async (enabled, onClose = null) => {
        if (enabled) {
            // Подключить Twitch интеграцию - прямой редирект на OAuth
            if (onClose) onClose(); // Закрываем попап перед перенаправлением
            saveReturnUrl(); // Сохраняем текущую страницу
            window.location.href = `${API_BASE_URL}/auth/twitch/login`;
        } else {
            // Отключить Twitch интеграцию
            try {
                setIsLoading(true);
                const disconnectResponse = await botService.post('/api/integrations/twitch/disconnect');
                
                // 🔄 Автоматически удаляем Twitch из TTS enabled_platforms
                try {
                    const ttsSettingsResponse = await botService.get('/api/tts/platform-settings');
                    const currentPlatforms = ttsSettingsResponse.data.enabled_platforms || [];
                    const updatedPlatforms = currentPlatforms.filter(p => p !== 'twitch');
                    await botService.post('/api/tts/platform-settings', {
                        enabled_platforms: updatedPlatforms
                    });
                    
                    // Отправляем событие для синхронизации с другими компонентами
                    window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                        detail: { enabledPlatforms: updatedPlatforms }
                    }));
                    
                    logger.log('🔄 Automatically removed twitch from TTS enabled_platforms');
                } catch (ttsError) {
                    logger.error('Error updating TTS settings after disconnect:', ttsError);
                }
                
                // Обновляем данные пользователя из AuthContext
                await refreshAuthStatus(true);
                await fetchIntegrations();
            } catch (error) {
                logger.error('Error disconnecting Twitch:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [refreshAuthStatus, fetchIntegrations]);

    const updateVkIntegration = useCallback(async (enabled, onClose = null) => {
        if (enabled) {
            // Подключить VK интеграцию - прямой редирект на OAuth
            logger.log('🔵 [INTEGRATIONS] VK integration enable requested');
            if (onClose) onClose(); // Закрываем попап перед перенаправлением
            saveReturnUrl(); // Сохраняем текущую страницу
            window.location.href = `${API_BASE_URL}/auth/vk/login`;
        } else {
            // Отключить VK интеграцию
            try {
                setIsLoading(true);
                const disconnectResponse = await botService.post('/api/integrations/vk/disconnect');
                
                // 🔄 Автоматически удаляем VK из TTS enabled_platforms
                try {
                    const ttsSettingsResponse = await botService.get('/api/tts/platform-settings');
                    const currentPlatforms = ttsSettingsResponse.data.enabled_platforms || [];
                    const updatedPlatforms = currentPlatforms.filter(p => p !== 'vk');
                    await botService.post('/api/tts/platform-settings', {
                        enabled_platforms: updatedPlatforms
                    });
                    
                    // Отправляем событие для синхронизации с другими компонентами
                    window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                        detail: { enabledPlatforms: updatedPlatforms }
                    }));
                    
                    logger.log('🔄 Automatically removed vk from TTS enabled_platforms');
                } catch (ttsError) {
                    logger.error('Error updating TTS settings after disconnect:', ttsError);
                }
                
                // Обновляем данные пользователя из AuthContext
                await refreshAuthStatus(true);
                await fetchIntegrations();
            } catch (error) {
                logger.error('Error disconnecting VK:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [refreshAuthStatus, fetchIntegrations]);

    // Мемоизируем значение контекста для предотвращения лишних re-renders
    const value = useMemo(() => ({
        integrations,
        isLoading,
        refreshIntegrations: fetchIntegrations,
        updateTwitchIntegration,
        updateVkIntegration,
    }), [
        integrations,
        isLoading,
        fetchIntegrations,
        updateTwitchIntegration,
        updateVkIntegration,
    ]);

    return (
        <IntegrationsContext.Provider value={value}>
            {children}
        </IntegrationsContext.Provider>
    );
};
