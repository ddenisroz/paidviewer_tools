// src/context/TtsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTtsHealth, getAdminVoices, enableTts, disableTts, getTtsStatus } from '../services/microservices';
import { AuthContext } from './AuthContext';
import { toast } from 'sonner';

const TtsContext = createContext();

export const useTts = () => useContext(TtsContext);

export const TtsProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [isWhitelisted, setIsWhitelisted] = useState(true); // Устанавливаем true по умолчанию
    const [voices, setVoices] = useState([]);
    const [engineStatus, setEngineStatus] = useState({ loaded: false, error: null });

    const checkEngineStatus = useCallback(async () => {
        try {
            const response = await getTtsHealth();
            if (response.tts_engine_loaded) {
                setEngineStatus({ loaded: true, error: null });
            } else {
                setEngineStatus({ loaded: false, error: "TTS engine failed to load on the server." });
            }
        } catch (error) {
            setEngineStatus({ loaded: false, error: "TTS service is unavailable." });
            console.error("TTS Health check failed:", error);
        }
    }, []);

    const checkTtsStatus = useCallback(async () => {
        if (user) {
            try {
                const response = await getTtsStatus();
                const { is_enabled, is_whitelisted } = response.data;
                setTtsEnabled(is_enabled);
                setIsWhitelisted(is_whitelisted);
            } catch (error) {
                console.error("Could not get TTS status:", error);
                setTtsEnabled(false);
            }
        }
    }, [user]);

    const loadVoices = useCallback(async () => {
        if (user && engineStatus.loaded) {
             try {
                const response = await getAdminVoices();
                setVoices(response.data);
            } catch (error) {
                console.error("Failed to load voices:", error);
                toast.error("Не удалось загрузить список голосов.");
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


    const toggleTts = async () => {
        if (!isWhitelisted) {
            toast.error("Ваш канал не в белом списке для использования TTS.");
            return;
        }

        try {
            if (ttsEnabled) {
                await disableTts();
                setTtsEnabled(false);
                toast.success("Озвучка сообщений отключена.");
            } else {
                await enableTts();
                setTtsEnabled(true);
                toast.success("Озвучка сообщений включена.");
            }
        } catch (error) {
            console.error("Failed to toggle TTS status:", error);
            toast.error("Не удалось изменить статус озвучки.");
        }
    };

    // Функция для инициализации TTS (вызывается только при переходе на TTS страницы)
    const initializeTts = useCallback(async () => {
        if (user && !engineStatus.loaded) {
            await checkEngineStatus();
        }
        if (engineStatus.loaded) {
            await checkTtsStatus();
            await loadVoices();
        }
    }, [user, engineStatus.loaded, checkEngineStatus, checkTtsStatus, loadVoices]);

    const value = {
        ttsEnabled,
        isWhitelisted,
        voices,
        engineStatus,
        toggleTts,
        loadVoices,
        initializeTts,
    };

    return (
        <TtsContext.Provider value={value}>
            {children}
        </TtsContext.Provider>
    );
};