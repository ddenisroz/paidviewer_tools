// src/hooks/useChatPlatforms.ts
import { useEffect, useState } from 'react';

import { ttsService } from '../services/api/services/ttsService';
import { logger } from '../utils/prodLogger';
import { toast } from '../utils/toastManager';

interface TtsSettings {
    enabled_platforms: string[];
    global_enabled?: boolean;
}

interface UseChatPlatformsReturn {
    twitchChatVisible: boolean;
    vkChatVisible: boolean;
    ttsSettings: TtsSettings;
    setTwitchChatVisible: (visible: boolean) => void;
    setVkChatVisible: (visible: boolean) => void;
    setTtsSettings: (settings: TtsSettings) => void;
    handleTwitchToggle: () => Promise<void>;
    handleVkToggle: () => Promise<void>;
}

export const useChatPlatforms = (userId?: number | null): UseChatPlatformsReturn => {
    const [twitchChatVisible, setTwitchChatVisible] = useState<boolean>(false);
    const [vkChatVisible, setVkChatVisible] = useState<boolean>(false);
    const [ttsSettings, setTtsSettings] = useState<TtsSettings>({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });

    useEffect(() => {
        const loadTtsSettings = async (): Promise<void> => {
            try {
                const response = await ttsService.getPlatformSettings();
                
                if (!response?.data?.data) {
                    logger.warn('[WARN] [TTS SHORTCUT] No settings data received (backend may be unavailable)');
                    return;
                }
                
                const settings = response.data.data as TtsSettings;
                setTtsSettings(settings);
                logger.log('[OK] [TTS SHORTCUT] Settings loaded:', settings);
                
                if (!settings.enabled_platforms) {
                    logger.warn('[WARN] [TTS SHORTCUT] No enabled_platforms in settings');
                    return;
                }
                
                logger.log('[OK] [TTS SHORTCUT] enabled_platforms:', settings.enabled_platforms);
                
                const enabledPlatforms = settings.enabled_platforms || [];
                setTwitchChatVisible(enabledPlatforms.includes('twitch'));
                setVkChatVisible(enabledPlatforms.includes('vk'));
                
                logger.log('[REFRESH] [TTS SHORTCUT] Synced visibility from API:', {
                    enabled_platforms: enabledPlatforms,
                    twitch: enabledPlatforms.includes('twitch'),
                    vk: enabledPlatforms.includes('vk')
                });
            } catch (error) {
                logger.warn('[WARN] [TTS SHORTCUT] Backend unavailable, using defaults:', error instanceof Error ? error.message : 'Unknown error');
            }
        };
        
        loadTtsSettings();
        
        const handleTtsSettingsChanged = async (event: CustomEvent<{ enabledPlatforms: string[] }>): Promise<void> => {
            const { enabledPlatforms } = event.detail;
            logger.log('[REFRESH] [TTS SHORTCUT] Received settings update:', enabledPlatforms);
            
            setTwitchChatVisible(enabledPlatforms.includes('twitch'));
            setVkChatVisible(enabledPlatforms.includes('vk'));
            setTtsSettings(prev => ({
                ...prev,
                enabled_platforms: enabledPlatforms
            }));
            
            try {
                const response = await ttsService.getPlatformSettings();
                const enabledPlatformsFromAPI = (response.data as unknown as TtsSettings).enabled_platforms || [];
                logger.log('[REFRESH] [TTS SHORTCUT] Reloaded from API:', enabledPlatformsFromAPI);
                
                setTwitchChatVisible(enabledPlatformsFromAPI.includes('twitch'));
                setVkChatVisible(enabledPlatformsFromAPI.includes('vk'));
                setTtsSettings(prev => ({
                    ...prev,
                    enabled_platforms: enabledPlatformsFromAPI
                }));
            } catch (error) {
                logger.error('[ERROR] [TTS SHORTCUT] Error reloading settings:', error);
            }
        };
        
        window.addEventListener('tts-settings-changed', handleTtsSettingsChanged as unknown as EventListener);
        
        return () => {
            window.removeEventListener('tts-settings-changed', handleTtsSettingsChanged as unknown as EventListener);
        };
    }, [userId]);

    const handleTwitchToggle = async (): Promise<void> => {
        const newVisible = !twitchChatVisible;
        
        setTwitchChatVisible(newVisible);
        
        try {
            const enabledPlatforms = Array.isArray(ttsSettings?.enabled_platforms) 
                ? [...ttsSettings.enabled_platforms] 
                : [];
            
            const index = enabledPlatforms.indexOf('twitch');
            
            if (newVisible && index === -1) {
                enabledPlatforms.push('twitch');
            } else if (!newVisible && index > -1) {
                enabledPlatforms.splice(index, 1);
            }
            
            await ttsService.savePlatformSettings({
                enabled_platforms: enabledPlatforms
            });
            
            const updatedSettings: TtsSettings = {
                ...ttsSettings,
                enabled_platforms: enabledPlatforms
            };
            setTtsSettings(updatedSettings);
            
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: enabledPlatforms }
            }));
            
            logger.log(`[GAME] [TTS SHORTCUT] Twitch ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`Twitch озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            logger.error('[ERROR] [TTS SHORTCUT] Error saving:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };

    const handleVkToggle = async (): Promise<void> => {
        const newVisible = !vkChatVisible;
        
        setVkChatVisible(newVisible);
        
        try {
            const enabledPlatforms = Array.isArray(ttsSettings?.enabled_platforms) 
                ? [...ttsSettings.enabled_platforms] 
                : [];
            
            const index = enabledPlatforms.indexOf('vk');
            
            if (newVisible && index === -1) {
                enabledPlatforms.push('vk');
            } else if (!newVisible && index > -1) {
                enabledPlatforms.splice(index, 1);
            }
            
            await ttsService.savePlatformSettings({
                enabled_platforms: enabledPlatforms
            });
            
            const updatedSettings: TtsSettings = {
                ...ttsSettings,
                enabled_platforms: enabledPlatforms
            };
            setTtsSettings(updatedSettings);
            
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: enabledPlatforms }
            }));
            
            logger.log(`[TTS SHORTCUT] VK ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`VK озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            logger.error('[ERROR] [TTS SHORTCUT] Error saving:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };

    return {
        twitchChatVisible,
        vkChatVisible,
        ttsSettings,
        setTwitchChatVisible,
        setVkChatVisible,
        setTtsSettings,
        handleTwitchToggle,
        handleVkToggle
    };
};
