// src/context/TtsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTtsHealth, getAdminVoices, enableTts, disableTts, getTtsStatus } from '../services/microservices';
import { AuthContext } from './AuthContext';
import { toast } from 'sonner';

const TtsContext = createContext();

export const useTts = () => useContext(TtsContext);

export const TtsProvider = ({ children }) => {
    const { user, token } = useContext(AuthContext);
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [isWhitelisted, setIsWhitelisted] = useState(false);
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
        if (user && token) {
            try {
                const response = await getTtsStatus(token);
                const { is_enabled, is_whitelisted } = response.data;
                setTtsEnabled(is_enabled);
                setIsWhitelisted(is_whitelisted);
            } catch (error) {
                console.error("Could not get TTS status:", error);
                setTtsEnabled(false);
            }
        }
    }, [user, token]);

    const loadVoices = useCallback(async () => {
        if (user && token && engineStatus.loaded) {
             try {
                const response = await getAdminVoices(token);
                setVoices(response.data);
            } catch (error) {
                console.error("Failed to load voices:", error);
                toast.error("Не удалось загрузить список голосов.");
            }
        }
    }, [user, token, engineStatus.loaded]);


    useEffect(() => {
        checkEngineStatus();
    }, [checkEngineStatus]);

    useEffect(() => {
        if (engineStatus.loaded) {
            checkTtsStatus();
            loadVoices();
        }
    }, [engineStatus.loaded, checkTtsStatus, loadVoices]);


    const toggleTts = async () => {
        if (!isWhitelisted) {
            toast.error("Ваш канал не в белом списке для использования TTS.");
            return;
        }

        try {
            if (ttsEnabled) {
                await disableTts(token);
                setTtsEnabled(false);
                toast.success("Озвучка сообщений отключена.");
            } else {
                await enableTts(token);
                setTtsEnabled(true);
                toast.success("Озвучка сообщений включена.");
            }
        } catch (error) {
            console.error("Failed to toggle TTS status:", error);
            toast.error("Не удалось изменить статус озвучки.");
        }
    };

    const value = {
        ttsEnabled,
        isWhitelisted,
        voices,
        engineStatus,
        toggleTts,
        loadVoices,
    };

    return (
        <TtsContext.Provider value={value}>
            {children}
        </TtsContext.Provider>
    );
};