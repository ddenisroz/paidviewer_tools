// src/context/UserSettingsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import cacheManager, { CACHE_CONFIG } from '../utils/cacheManager';
import Logger from '../utils/prodLogger';
import { useUserSettings as useUserSettingsQuery, useSaveUserSettings } from '../queries/userSettings/userSettingsQueries';

const logger = new Logger('USER_SETTINGS');

const UserSettingsContext = createContext();

export const useUserSettings = () => {
    const context = useContext(UserSettingsContext);
    if (!context) {
        throw new Error('useUserSettings must be used within a UserSettingsProvider');
    }
    return context;
};

export const UserSettingsProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    // 🚀 ANTI-FLASH: Инициализируем из кэша сразу, чтобы не было мерцания
    const [settings, setSettings] = useState(() => {
        return cacheManager.get(CACHE_CONFIG.USER_SETTINGS, { ignoreExpired: true }) || null;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // React Query hook для загрузки настроек
    const { data: settingsData, isLoading: isLoadingSettings, refetch: refetchSettings } = useUserSettingsQuery({
        enabled: isAuthenticated,
        onSuccess: (data) => {
            setSettings(data);
            // Сохраняем в cacheManager для обратной совместимости
            if (data) {
                cacheManager.set(CACHE_CONFIG.USER_SETTINGS, data, { userId: user?.id });
            }
        },
        onError: (error) => {
            logger.error('[USER_SETTINGS] Error loading settings:', error);
            setSettings(null);
            cacheManager.invalidate(CACHE_CONFIG.USER_SETTINGS);
        },
    });

    // Обновляем loading состояние из React Query
    useEffect(() => {
        setIsLoading(isLoadingSettings);
    }, [isLoadingSettings]);

    // Обновляем settings при изменении данных из React Query
    useEffect(() => {
        if (settingsData) {
            setSettings(settingsData);
        }
    }, [settingsData]);

    // Обертка для совместимости
    const loadSettings = useCallback(async () => {
        if (!isAuthenticated) {
            setSettings(null);
            cacheManager.invalidate(CACHE_CONFIG.USER_SETTINGS);
            return;
        }
        await refetchSettings();
    }, [isAuthenticated, refetchSettings]);

    // React Query mutation для сохранения настроек
    const saveSettingsMutation = useSaveUserSettings({
        onSuccess: (response) => {
            const savedSettings = response.data?.settings || response.data;
            setSettings(savedSettings);
            // Сохраняем в cacheManager для обратной совместимости
            if (savedSettings) {
                cacheManager.set(CACHE_CONFIG.USER_SETTINGS, savedSettings, { userId: user?.id });
            }
            logger.info('[USER_SETTINGS] Saved successfully');
        },
        onError: (error) => {
            logger.error('[USER_SETTINGS] Error saving settings:', error);
            // При ошибке React Query автоматически откатит кэш
        },
    });

    // Обновляем isSaving из React Query mutation
    useEffect(() => {
        setIsSaving(saveSettingsMutation.isPending);
    }, [saveSettingsMutation.isPending]);

    // Обертка для совместимости
    const saveSettings = useCallback(async (newSettings) => {
        if (!isAuthenticated) return false;
        
        return new Promise((resolve) => {
            saveSettingsMutation.mutate(newSettings, {
                onSuccess: () => resolve(true),
                onError: () => resolve(false),
            });
        });
    }, [isAuthenticated, saveSettingsMutation]);

    // Обновление конкретной настройки
    const updateSetting = useCallback(async (key, value) => {
        const success = await saveSettings({ [key]: value });
        return success;
    }, [saveSettings]);

    // Обновление группы настроек
    const updateSettings = useCallback(async (settingsToUpdate) => {
        const success = await saveSettings(settingsToUpdate);
        return success;
    }, [saveSettings]);

    // Получение конкретной настройки
    const getSetting = useCallback((key, defaultValue = null) => {
        return settings?.[key] ?? defaultValue;
    }, [settings]);

    // Получение настроек чата
    const getChatSettings = useCallback(() => {
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

    // Получение настроек OBS
    const getObsSettings = useCallback(() => {
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

    // Получение настроек объединения (только UI настройки)
    // 🚀 ANTI-FLASH: Проверяем кэш напрямую, чтобы получить значения даже если settings еще не загружен
    const getCombineSettings = useCallback(() => {
        // Сначала пытаемся использовать settings из state
        if (settings) {
            return {
                combine_titles: settings.combine_titles ?? false,
                combine_categories: settings.combine_categories ?? false
            };
        }
        
        // Если settings еще не загружен, проверяем кэш напрямую
        const cachedSettings = cacheManager.get(CACHE_CONFIG.USER_SETTINGS, { ignoreExpired: true });
        if (cachedSettings) {
            return {
                combine_titles: cachedSettings.combine_titles ?? false,
                combine_categories: cachedSettings.combine_categories ?? false
            };
        }
        
        // Если ничего не найдено, возвращаем false
        return { combine_titles: false, combine_categories: false };
    }, [settings]);

    // Загружаем настройки при изменении авторизации
    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Подписываемся на изменения из других вкладок (multi-tab sync)
    useEffect(() => {
        const unsubscribe = cacheManager.subscribe(
            CACHE_CONFIG.USER_SETTINGS.key,
            (updatedData) => {
                if (updatedData) {
                    logger.debug('[USER_SETTINGS] Multi-tab update received');
                    setSettings(updatedData);
                } else {
                    // Кэш инвалидирован, перезагружаем
                    logger.debug('[USER_SETTINGS] Cache invalidated from another tab');
                    loadSettings();
                }
            }
        );

        return unsubscribe;
    }, [loadSettings]);

    const value = {
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
