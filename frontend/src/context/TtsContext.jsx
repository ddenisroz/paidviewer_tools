// src/context/TtsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTtsHealth, getGlobalVoices, enableTts, disableTts, getTtsStatus } from '../services/microservices';
import { AuthContext } from './AuthContext';
import { toast } from 'sonner';

const TtsContext = createContext();

export const useTts = () => useContext(TtsContext);

export const TtsProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [isWhitelisted, setIsWhitelisted] = useState(null); // null = не проверено, true/false = результат проверки
    const [voices, setVoices] = useState([]);
    const [engineStatus, setEngineStatus] = useState({ loaded: false, error: null });
    const [notificationCallback, setNotificationCallback] = useState(null);

    // Функция для регистрации callback уведомлений
    const setNotificationHandler = useCallback((callback) => {
        console.log('TtsContext: setNotificationHandler called with callback:', !!callback);
        if (callback) {
            setNotificationCallback(() => callback);
        }
    }, []);

    const checkEngineStatus = useCallback(async () => {
        try {
            console.log('TtsContext: Checking engine status...');
            const response = await getTtsHealth();
            console.log('TtsContext: Engine status response:', response);
            if (response.tts_engine_loaded) {
                console.log('TtsContext: Engine loaded successfully');
                setEngineStatus({ loaded: true, error: null });
            } else {
                console.log('TtsContext: Engine not loaded');
                setEngineStatus({ loaded: false, error: "TTS engine failed to load on the server." });
            }
        } catch (error) {
            console.log('TtsContext: Engine check failed:', error);
            setEngineStatus({ loaded: false, error: "TTS service is unavailable." });
            console.error("TTS Health check failed:", error);
        }
    }, []);

    const checkTtsStatus = useCallback(async () => {
        if (user) {
            console.log("TtsContext: Checking TTS status for user:", user.username);
            try {
                const response = await getTtsStatus();
                const { is_enabled, is_whitelisted } = response.data;
                console.log("TtsContext: TTS status response:", { is_enabled, is_whitelisted });
                setTtsEnabled(is_enabled);
                setIsWhitelisted(is_whitelisted);
            } catch (error) {
                console.error("TtsContext: Could not get TTS status:", error);
                setTtsEnabled(false);
            }
        }
    }, [user]);

    const loadVoices = useCallback(async () => {
        if (user && engineStatus.loaded) {
             try {
                const response = await getGlobalVoices();
                setVoices(response.data);
            } catch (error) {
                console.error("Failed to load voices:", error);
                if (notificationCallback) {
                    notificationCallback("Не удалось загрузить список голосов.");
                } else {
                    toast.error("Не удалось загрузить список голосов.");
                }
            }
        }
    }, [user, engineStatus.loaded]);


    // Убираем автоматические запросы - они будут вызываться только при явном обращении к TTS функциям
    // useEffect(() => {
    //     // Проверяем статус TTS только для авторизованных пользователей
    //     if (user) {
    //         checkEngineStatus();
    //     }
    // }, [checkEngineStatus, user]);

    // useEffect(() => {
    //     if (engineStatus.loaded) {
    //         checkTtsStatus();
    //         loadVoices();
    //     }
    // }, [engineStatus.loaded, checkTtsStatus, loadVoices]);


    const toggleTts = useCallback(async () => {
        if (!engineStatus.loaded) {
            console.log('TtsContext: TTS engine not loaded, notificationCallback:', !!notificationCallback);
            // Всегда используем toast для ошибок движка, так как callback может быть не зарегистрирован
            toast.error("Неполадки на сервере, TTS не работает");
            return;
        }

        if (!isWhitelisted) {
            console.log('TtsContext: Channel not whitelisted, notificationCallback:', !!notificationCallback);
            if (notificationCallback) {
                console.log('TtsContext: Using notification callback for whitelist');
                notificationCallback("Ваш канал не в белом списке для использования TTS.");
            } else {
                console.log('TtsContext: Using fallback toast for whitelist');
                toast.error("Ваш канал не в белом списке для использования TTS.");
            }
            return;
        }

        try {
            if (ttsEnabled) {
                await disableTts();
                setTtsEnabled(false);
                if (notificationCallback) {
                    notificationCallback("Озвучка сообщений отключена.", "success");
                } else {
                    toast.success("Озвучка сообщений отключена.");
                }
            } else {
                await enableTts();
                setTtsEnabled(true);
                if (notificationCallback) {
                    notificationCallback("Озвучка сообщений включена.", "success");
                } else {
                    toast.success("Озвучка сообщений включена.");
                }
            }
        } catch (error) {
            console.error("Failed to toggle TTS status:", error);
            if (notificationCallback) {
                notificationCallback("Не удалось изменить статус озвучки.");
            } else {
                toast.error("Не удалось изменить статус озвучки.");
            }
        }
    }, [engineStatus.loaded, isWhitelisted, ttsEnabled, notificationCallback]);

    // Функция для инициализации TTS (вызывается только при переходе на TTS страницы)
    const initializeTts = useCallback(async () => {
        // Всегда проверяем статус движка, независимо от пользователя
        if (!engineStatus.loaded) {
            await checkEngineStatus();
        }
        // Проверяем статус TTS только если есть пользователь
        if (engineStatus.loaded && user) {
            await checkTtsStatus();
            await loadVoices();
        }
    }, [engineStatus.loaded, checkEngineStatus, checkTtsStatus, loadVoices, user]);

    const value = {
        ttsEnabled,
        isWhitelisted,
        setIsWhitelisted,
        voices,
        engineStatus,
        toggleTts,
        loadVoices,
        initializeTts,
        setNotificationHandler,
    };

    return (
        <TtsContext.Provider value={value}>
            {children}
        </TtsContext.Provider>
    );
};