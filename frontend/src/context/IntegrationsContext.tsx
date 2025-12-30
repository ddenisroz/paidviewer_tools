import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { integrationsService } from '../services/api/services/integrationsService';
import { ttsService } from '../services/api/services/ttsService';
import { saveReturnUrl } from '../utils/oauthRedirect';
import { logger } from '../utils/prodLogger';

import { useAuth } from './AuthContext';

interface IntegrationStatus {
    enabled: boolean;
    username: string | null;
}

interface IntegrationsState {
    twitch: IntegrationStatus;
    vk: IntegrationStatus;
    donationalerts: IntegrationStatus;
}

interface IntegrationsContextValue {
    integrations: IntegrationsState;
    isLoading: boolean;
    refreshIntegrations: () => Promise<void>;
    updateTwitchIntegration: (enabled: boolean, onClose?: (() => void) | null) => Promise<void>;
    updateVkIntegration: (enabled: boolean, onClose?: (() => void) | null) => Promise<void>;
}

const IntegrationsContext = createContext<IntegrationsContextValue | undefined>(undefined);

export const useIntegrations = (): IntegrationsContextValue => {
    const context = useContext(IntegrationsContext);
    if (!context) {
        throw new Error('useIntegrations must be used within an IntegrationsProvider');
    }
    return context;
};

interface IntegrationsProviderProps {
    children: ReactNode;
}

export const IntegrationsProvider: React.FC<IntegrationsProviderProps> = ({ children }) => {
    const { isAuthenticated, user, integrationsNeedRefresh, markIntegrationsRefreshed, refreshAuthStatus } = useAuth();
    
    const getInitialIntegrations = (): IntegrationsState => {
        if (user?.integrations) {
            return {
                twitch: { 
                    enabled: !!user.integrations.twitch?.connected,
                    username: (user.integrations.twitch as { username?: string })?.username || null
                },
                vk: { 
                    enabled: !!user.integrations.vk?.connected,
                    username: (user.integrations.vk as { username?: string })?.username || null
                },
                donationalerts: {
                    enabled: !!user.integrations.donationalerts?.connected,
                    username: (user.integrations.donationalerts as { username?: string })?.username || null
                },
            };
        }
        
        return {
            twitch: { enabled: false, username: null },
            vk: { enabled: false, username: null },
            donationalerts: { enabled: false, username: null },
        };
    };
    
    const [integrations, setIntegrations] = useState<IntegrationsState>(getInitialIntegrations);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [initialLoad, setInitialLoad] = useState<boolean>(!user?.integrations);

    const fetchIntegrations = useCallback(async (): Promise<void> => {
        if (isAuthenticated === false) {
            setIntegrations({ 
                twitch: { enabled: false, username: null }, 
                vk: { enabled: false, username: null },
                donationalerts: { enabled: false, username: null }
            });
            setIsLoading(false);
            setInitialLoad(false);
            return;
        }

        if (isAuthenticated === true && user?.integrations) {
            const newIntegrations: IntegrationsState = {
                twitch: { 
                    enabled: !!user.integrations.twitch?.connected,
                    username: (user.integrations.twitch as { username?: string })?.username || null
                },
                vk: { 
                    enabled: !!user.integrations.vk?.connected,
                    username: (user.integrations.vk as { username?: string })?.username || null
                },
                donationalerts: {
                    enabled: !!user.integrations.donationalerts?.connected,
                    username: (user.integrations.donationalerts as { username?: string })?.username || null
                },
            };
            
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
    }, [isAuthenticated, user?.integrations, initialLoad]);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    useEffect(() => {
        if (integrationsNeedRefresh) {
            refreshAuthStatus(true);
            fetchIntegrations();
            markIntegrationsRefreshed();
        }
    }, [integrationsNeedRefresh, fetchIntegrations, markIntegrationsRefreshed, refreshAuthStatus]);

    useEffect(() => {
        const handleAuthRefresh = (): void => {
            logger.log('[REFRESH] [INTEGRATIONS] Received auth_refresh_required, refreshing integrations...');
            setTimeout(() => {
                refreshAuthStatus(true);
                fetchIntegrations();
            }, 100);
        };

        window.addEventListener('auth_refresh_required', handleAuthRefresh);
        
        return () => {
            window.removeEventListener('auth_refresh_required', handleAuthRefresh);
        };
    }, [fetchIntegrations, refreshAuthStatus]);

    const updateTwitchIntegration = useCallback(async (enabled: boolean, onClose: (() => void) | null = null): Promise<void> => {
        if (enabled) {
            if (onClose) onClose();
            saveReturnUrl();
            integrationsService.connectTwitch();
        } else {
            try {
                setIsLoading(true);
                await integrationsService.disconnectTwitch();
                
                try {
                    const ttsSettingsResponse = await ttsService.getPlatformSettings();
                    const currentPlatforms = (ttsSettingsResponse.data as { enabled_platforms?: string[] }).enabled_platforms || [];
                    const updatedPlatforms = currentPlatforms.filter((p: string) => p !== 'twitch');
                    await ttsService.savePlatformSettings({
                        enabled_platforms: updatedPlatforms
                    });
                    
                    window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                        detail: { enabledPlatforms: updatedPlatforms }
                    }));
                    
                    logger.log('[REFRESH] Automatically removed twitch from TTS enabled_platforms');
                } catch (ttsError) {
                    logger.error('Error updating TTS settings after disconnect:', ttsError);
                }
                
                await refreshAuthStatus(true);
                await fetchIntegrations();
            } catch (error) {
                logger.error('Error disconnecting Twitch:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [refreshAuthStatus, fetchIntegrations]);

    const updateVkIntegration = useCallback(async (enabled: boolean, onClose: (() => void) | null = null): Promise<void> => {
        if (enabled) {
            logger.log('[INTEGRATIONS] VK integration enable requested');
            if (onClose) onClose();
            saveReturnUrl();
            integrationsService.connectVk();
        } else {
            try {
                setIsLoading(true);
                await integrationsService.disconnectVk();
                
                try {
                    const ttsSettingsResponse = await ttsService.getPlatformSettings();
                    const currentPlatforms = (ttsSettingsResponse.data as { enabled_platforms?: string[] }).enabled_platforms || [];
                    const updatedPlatforms = currentPlatforms.filter((p: string) => p !== 'vk');
                    await ttsService.savePlatformSettings({
                        enabled_platforms: updatedPlatforms
                    });
                    
                    window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                        detail: { enabledPlatforms: updatedPlatforms }
                    }));
                    
                    logger.log('[REFRESH] Automatically removed vk from TTS enabled_platforms');
                } catch (ttsError) {
                    logger.error('Error updating TTS settings after disconnect:', ttsError);
                }
                
                await refreshAuthStatus(true);
                await fetchIntegrations();
            } catch (error) {
                logger.error('Error disconnecting VK:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [refreshAuthStatus, fetchIntegrations]);

    const value = useMemo<IntegrationsContextValue>(() => ({
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

