// src/context/UserSettingsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { botService } from '../services/microservices';

const UserSettingsContext = createContext();

export const useUserSettings = () => {
    const context = useContext(UserSettingsContext);
    if (!context) {
        throw new Error('useUserSettings must be used within a UserSettingsProvider');
    }
    return context;
};

export const UserSettingsProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Загрузка всех настроек с сервера
    const loadSettings = useCallback(async () => {
        if (!isAuthenticated) {
            setSettings(null);
            return;
        }

        try {
            setIsLoading(true);
            const response = await botService.get('/api/user-settings/');
            if (response.data?.success) {
                setSettings(response.data.settings);
            }
        } catch (error) {
            console.error('Error loading user settings:', error);
            setSettings(null);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Сохранение настроек на сервер
    const saveSettings = useCallback(async (newSettings) => {
        if (!isAuthenticated) return false;

        try {
            setIsSaving(true);
            const response = await botService.post('/api/user-settings/', newSettings);
            
            if (response.data?.success) {
                setSettings(prev => ({ ...prev, ...newSettings }));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error saving user settings:', error);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [isAuthenticated]);

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
            animation_type: settings.chat_animation_type ?? 'slide'
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
    const getCombineSettings = useCallback(() => {
        if (!settings) return { combine_titles: false, combine_categories: false };
        
        return {
            combine_titles: settings.combine_titles ?? false,
            combine_categories: settings.combine_categories ?? false
        };
    }, [settings]);

    // Загружаем настройки при изменении авторизации
    useEffect(() => {
        loadSettings();
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
