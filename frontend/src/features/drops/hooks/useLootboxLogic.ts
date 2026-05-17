// src/hooks/useLootboxLogic.ts
import { useCallback, useEffect, useState } from 'react';

import { dropsService } from '@/services/api/services/dropsService';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/shared/utils/toastManager';

interface LootboxConfig {
    channel_name: string;
    platform?: string;
    streak_enabled_twitch: boolean;
    streak_enabled_vk: boolean;
    donation_enabled: boolean;
    mythical_enabled: boolean;
    [key: string]: string | number | boolean | undefined;
}

interface UseLootboxLogicReturn {
    config: LootboxConfig | null;
    loading: boolean;
    saving: boolean;
    loadConfig: () => Promise<void>;
    saveConfig: (newConfig: Partial<LootboxConfig>) => Promise<void>;
    updateConfig: (key: string, value: string | number | boolean) => void;
}

export const useLootboxLogic = (channelName?: string): UseLootboxLogicReturn => {
    const [config, setConfig] = useState<LootboxConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadConfig = useCallback(async (): Promise<void> => {
        if (!channelName) return;

        setLoading(true);
        try {
            const response = await dropsService.getConfig(channelName);
            const data = response.data.data || response.data;
            setConfig(data as LootboxConfig);
            logger.log('[DROPS] Config loaded:', data);
        } catch (error) {
            logger.error('[ERROR] [DROPS] Error loading config:', error);
            toast.error('Ошибка загрузки настроек Drops');
        } finally {
            setLoading(false);
        }
    }, [channelName]);

    const saveConfig = useCallback(
        async (newConfig: Partial<LootboxConfig>): Promise<void> => {
            if (!config || !channelName) return;

            setSaving(true);
            try {
                const updatedConfig = {
                    ...config,
                    ...newConfig,
                };
                // Remove index signature properties for API call
                const { channel_name: _channel_name, platform: _platform, ...apiConfig } = updatedConfig;
                await dropsService.updateConfig(channelName, apiConfig as Partial<typeof apiConfig>);
                setConfig((prev) => (prev ? { ...prev, ...newConfig } : null));
                toast.success('Настройки сохранены');
                logger.log('[DROPS] Config saved');
            } catch (error) {
                logger.error('[ERROR] [DROPS] Error saving config:', error);
                toast.error('Ошибка сохранения настроек');
            } finally {
                setSaving(false);
            }
        },
        [config, channelName]
    );

    const updateConfig = useCallback((key: string, value: string | number | boolean): void => {
        setConfig((prev) => (prev ? { ...prev, [key]: value } : null));
    }, []);

    useEffect(() => {
        if (channelName) {
            void loadConfig();
        }
    }, [channelName, loadConfig]);

    return {
        config,
        loading,
        saving,
        loadConfig,
        saveConfig,
        updateConfig,
    };
};
