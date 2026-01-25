// src/features/chat/hooks/useChatPlatforms.ts
import { useCallback, useEffect, useRef, useState } from 'react';

import { ttsService } from '@/services/api/services/ttsService';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/shared/utils/toastManager';

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
        enabled_platforms: [], // Start empty, load from API
        global_enabled: false
    });

    // Ref to always have latest settings for toggle handlers
    const ttsSettingsRef = useRef<TtsSettings>(ttsSettings);
    useEffect(() => {
        ttsSettingsRef.current = ttsSettings;
    }, [ttsSettings]);

    useEffect(() => {
        const loadTtsSettings = async (): Promise<void> => {
            try {
                console.log('[TTS DEBUG] Loading platform settings...');
                const response = await ttsService.getPlatformSettings();
                console.log('[TTS DEBUG] Raw API response:', response);
                console.log('[TTS DEBUG] response.data:', response?.data);
                console.log('[TTS DEBUG] response.data.data:', response?.data?.data);

                // Handle different response structures: response.data.data or response.data
                const rawData = response?.data?.data || response?.data;
                console.log('[TTS DEBUG] rawData extracted:', rawData);

                if (!rawData) {
                    logger.warn('[WARN] [TTS SHORTCUT] No settings data received (backend may be unavailable)');
                    return;
                }

                const settings = rawData as TtsSettings;
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
    }, [userId]);

    const handleTwitchToggle = async (): Promise<void> => {
        const newVisible = !twitchChatVisible;

        setTwitchChatVisible(newVisible);

        try {
            // Use ref to get latest settings (avoid stale closure)
            const currentSettings = ttsSettingsRef.current;
            const enabledPlatforms = Array.isArray(currentSettings?.enabled_platforms)
                ? [...currentSettings.enabled_platforms]
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
                ...currentSettings,
                enabled_platforms: enabledPlatforms
            };
            setTtsSettings(updatedSettings);

            logger.log(`[GAME] [TTS SHORTCUT] Twitch ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`Twitch озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            // Revert on error
            setTwitchChatVisible(!newVisible);
            logger.error('[ERROR] [TTS SHORTCUT] Error saving:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };

    const handleVkToggle = async (): Promise<void> => {
        const newVisible = !vkChatVisible;

        setVkChatVisible(newVisible);

        try {
            // Use ref to get latest settings (avoid stale closure)
            const currentSettings = ttsSettingsRef.current;
            const enabledPlatforms = Array.isArray(currentSettings?.enabled_platforms)
                ? [...currentSettings.enabled_platforms]
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
                ...currentSettings,
                enabled_platforms: enabledPlatforms
            };
            setTtsSettings(updatedSettings);

            logger.log(`[TTS SHORTCUT] VK ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`VK озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            // Revert on error
            setVkChatVisible(!newVisible);
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
