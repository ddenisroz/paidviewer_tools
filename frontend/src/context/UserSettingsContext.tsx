// src/context/UserSettingsContext.tsx
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { useSaveUserSettings, useUserSettings as useUserSettingsQuery } from '@/queries/userSettings/userSettingsQueries';
import cacheManager, { CACHE_CONFIG } from '@/shared/utils/cacheManager';
import Logger from '@/shared/utils/prodLogger';

import { useAuth } from './AuthContext';

import type { UserSettings } from '@/types/user';

const logger = new Logger('USER_SETTINGS');

interface ChatSettings {
    enabled: boolean;
    max_messages: number;
    show_timestamps: boolean;
    show_platform: boolean;
    show_user_roles: boolean;
    animation_duration: number;
    animation_type: string;
    message_fade_seconds: number;
}

interface ObsSettings {
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    backgroundColor: string;
    backgroundImage: string | null;
    textColor: string;
    borderRadius: number;
    borderColor: string;
    borderWidth: number;
    messageBg: string;
    messageBorderRadius: number;
    messageMargin: number;
    messagePadding: number;
    colors: {
        moderator: string;
        vip: string;
        subscriber: string;
        normal: string;
    };
}

interface CombineSettings {
    combine_titles: boolean;
    combine_categories: boolean;
}

interface UserSettingsContextValue {
    settings: UserSettings | null;
    isLoading: boolean;
    isSaving: boolean;
    loadSettings: () => Promise<void>;
    saveSettings: (newSettings: Partial<UserSettings>) => Promise<boolean>;
    updateSetting: (key: keyof UserSettings, value: unknown) => Promise<boolean>;
    updateSettings: (settingsToUpdate: Partial<UserSettings>) => Promise<boolean>;
    getSetting: <T = unknown>(key: keyof UserSettings, defaultValue?: T) => T | null;
    getChatSettings: () => ChatSettings | null;
    getObsSettings: () => ObsSettings | null;
    getCombineSettings: () => CombineSettings;
}

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(undefined);

export const useUserSettings = (): UserSettingsContextValue => {
    const context = useContext(UserSettingsContext);
    if (!context) {
        throw new Error('useUserSettings must be used within a UserSettingsProvider');
    }
    return context;
};

interface UserSettingsProviderProps {
    children: ReactNode;
}

export const UserSettingsProvider: React.FC<UserSettingsProviderProps> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const [settings, setSettings] = useState<UserSettings | null>(() => {
        return cacheManager.get(CACHE_CONFIG.USER_SETTINGS, { ignoreExpired: true }) || null;
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const { data: settingsData, isLoading: isLoadingSettings, refetch: refetchSettings, error: settingsError } = useUserSettingsQuery({
        enabled: !!isAuthenticated,
    });
    
    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (settingsData) {
            const data = settingsData as { data?: UserSettings } | UserSettings;
            const settings = 'data' in data && data.data ? data.data : (data as UserSettings);
            if (settings && typeof settings === 'object' && !('data' in settings)) {
                setSettings(settings);
                cacheManager.set(CACHE_CONFIG.USER_SETTINGS, settings, { userId: user?.id });
            } else {
                setSettings(null);
            }
        }
    }, [settingsData, user?.id]);
    
    useEffect(() => {
        if (settingsError) {
            logger.error('[USER_SETTINGS] Error loading settings:', settingsError);
            setSettings(null);
            cacheManager.invalidate(CACHE_CONFIG.USER_SETTINGS);
        }
    }, [settingsError]);

    useEffect(() => {
        setIsLoading(isLoadingSettings);
    }, [isLoadingSettings]);



    const loadSettings = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) {
            setSettings(null);
            cacheManager.invalidate(CACHE_CONFIG.USER_SETTINGS);
            return;
        }
        await refetchSettings();
    }, [isAuthenticated, refetchSettings]);

    const saveSettingsMutation = useSaveUserSettings({
        onSuccess: (response: unknown) => {
            const data = response as { data?: { settings?: UserSettings } | UserSettings };
            const savedSettings = data.data && typeof data.data === 'object' && 'settings' in data.data 
                ? data.data.settings 
                : data.data;
            setSettings(savedSettings as UserSettings);
            if (savedSettings) {
                cacheManager.set(CACHE_CONFIG.USER_SETTINGS, savedSettings, { userId: user?.id });
            }
            logger.info('[USER_SETTINGS] Saved successfully');
        },
        onError: (error) => {
            logger.error('[USER_SETTINGS] Error saving settings:', error);
        },
    });

    useEffect(() => {
        setIsSaving(saveSettingsMutation.isPending);
    }, [saveSettingsMutation.isPending]);

    const saveSettings = useCallback(async (newSettings: Partial<UserSettings>): Promise<boolean> => {
        if (!isAuthenticated) return false;
        
        return new Promise((resolve) => {
            saveSettingsMutation.mutate(newSettings, {
                onSuccess: () => resolve(true),
                onError: () => resolve(false),
            });
        });
    }, [isAuthenticated, saveSettingsMutation]);

    const updateSetting = useCallback(async (key: keyof UserSettings, value: unknown): Promise<boolean> => {
        const success = await saveSettings({ [key]: value } as Partial<UserSettings>);
        return success;
    }, [saveSettings]);

    const updateSettings = useCallback(async (settingsToUpdate: Partial<UserSettings>): Promise<boolean> => {
        const success = await saveSettings(settingsToUpdate);
        return success;
    }, [saveSettings]);

    const getSetting = useCallback(<T = unknown,>(key: keyof UserSettings, defaultValue: T | null = null): T | null => {
        return (settings?.[key] as T) ?? defaultValue;
    }, [settings]);

    const getChatSettings = useCallback((): ChatSettings | null => {
        if (!settings) return null;
        
        return {
            enabled: settings.chat_enabled ?? true,
            max_messages: settings.chat_max_messages ?? 50,
            show_timestamps: settings.chat_show_timestamps ?? true,
            show_platform: settings.chat_show_platform ?? true,
            show_user_roles: settings.chat_show_user_roles ?? true,
            animation_duration: settings.chat_animation_duration ?? 500,
            animation_type: settings.chat_animation_type ?? 'slide',
            message_fade_seconds: settings.chat_message_fade_seconds ?? 60
        };
    }, [settings]);

    const getObsSettings = useCallback((): ObsSettings | null => {
        if (!settings) return null;
        
        return {
            width: settings.obs_width ?? 400,
            height: settings.obs_height ?? 300,
            fontSize: settings.obs_font_size ?? 14,
            fontFamily: settings.obs_font_family ?? 'Arial',
            fontWeight: settings.obs_font_weight ?? 'normal',
            backgroundColor: settings.obs_background_color ?? '#000000',
            backgroundImage: settings.obs_background_image ?? null,
            textColor: settings.obs_text_color ?? '#ffffff',
            borderRadius: settings.obs_border_radius ?? 8,
            borderColor: settings.obs_border_color ?? '#333333',
            borderWidth: settings.obs_border_width ?? 1,
            messageBg: settings.obs_message_bg ?? '#1a1a1a',
            messageBorderRadius: settings.obs_message_border_radius ?? 4,
            messageMargin: settings.obs_message_margin ?? 2,
            messagePadding: settings.obs_message_padding ?? 8,
            colors: {
                moderator: settings.obs_moderator_color ?? '#00ff00',
                vip: settings.obs_vip_color ?? '#ffd700',
                subscriber: settings.obs_subscriber_color ?? '#ff6b6b',
                normal: settings.obs_normal_color ?? '#ffffff'
            }
        };
    }, [settings]);

    const getCombineSettings = useCallback((): CombineSettings => {
        if (settings) {
            return {
                combine_titles: settings.combine_titles ?? false,
                combine_categories: settings.combine_categories ?? false
            };
        }
        
        const cachedSettings = cacheManager.get(CACHE_CONFIG.USER_SETTINGS, { ignoreExpired: true }) as UserSettings | null;
        if (cachedSettings) {
            return {
                combine_titles: cachedSettings.combine_titles ?? false,
                combine_categories: cachedSettings.combine_categories ?? false
            };
        }
        
        return { combine_titles: false, combine_categories: false };
    }, [settings]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    useEffect(() => {
        const unsubscribe = cacheManager.subscribe(
            CACHE_CONFIG.USER_SETTINGS.key,
            (updatedData: unknown) => {
                if (updatedData && typeof updatedData === 'object') {
                    logger.debug('[USER_SETTINGS] Multi-tab update received');
                    setSettings(updatedData as UserSettings);
                } else {
                    logger.debug('[USER_SETTINGS] Cache invalidated from another tab');
                    loadSettings();
                }
            }
        );

        return unsubscribe;
    }, [loadSettings]);

    const value: UserSettingsContextValue = {
        settings,
        isLoading,
        isSaving,
        loadSettings,
        saveSettings,
        updateSetting,
        updateSettings,
        getSetting,
        getChatSettings,
        getObsSettings,
        getCombineSettings
    };

    return (
        <UserSettingsContext.Provider value={value}>
            {children}
        </UserSettingsContext.Provider>
    );
};

