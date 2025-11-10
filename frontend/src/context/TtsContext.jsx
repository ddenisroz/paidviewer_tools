// src/context/TtsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AuthContext } from './AuthContext';
import { useToast } from '../components/ui/toast';
import { useButtonPosition } from '../hooks/useButtonPosition';
import { logger } from '../utils/prodLogger';
import { useTtsStatus, useTtsHealth, useToggleTts, useGlobalVoices } from '../queries/tts/ttsQueries';
import { useLocation } from 'react-router-dom';

const TtsContext = createContext();

export const useTts = () => useContext(TtsContext);

export const TtsProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();
    const { getButtonPosition } = useButtonPosition();
    const location = useLocation();
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [isWhitelisted, setIsWhitelisted] = useState(null); // null = не проверено, true/false = результат проверки
    const [voices, setVoices] = useState([]);
    const [engineStatus, setEngineStatus] = useState({ loaded: false, error: null });
    const [notificationCallback, setNotificationCallback] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isToggling, setIsToggling] = useState(false); // Флаг для предотвращения множественных вызовов
    
    // Проверяем, является ли пользователь гостем
    const isGuest = user?.is_guest || user?.id === -1;
    
    // Проверяем, является ли это TTS страницей
    const ttsRelatedPaths = ['/dashboard/tts', '/tts'];
    const isTtsPage = ttsRelatedPaths.some(path => location.pathname.startsWith(path));
    
    // React Query hooks
    const channelName = user?.isGuest ? user.username : null;
    
    // Health check - только для не-гостевых пользователей и на TTS страницах
    const { data: healthData, isLoading: isCheckingHealth } = useTtsHealth({
        enabled: !isGuest && isTtsPage,
        refetchInterval: 30 * 1000, // 30 секунд
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        onSuccess: (data) => {
            const healthResponse = data?.data || data;
            const isHealthy = healthResponse?.tts_engine_loaded === true;
            if (isHealthy) {
                setEngineStatus({ loaded: true, error: null });
            } else {
                setEngineStatus({ loaded: false, error: "TTS движок не готов" });
            }
        },
        onError: (error) => {
            logger.error("TTS Health check failed:", error);
            setEngineStatus({ loaded: false, error: "Не удается подключиться к TTS сервису" });
        },
    });
    
    // TTS Status
    const { data: statusData, refetch: refetchStatus } = useTtsStatus(channelName, {
        enabled: !!user,
        refetchInterval: 30 * 1000, // 30 секунд
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        onSuccess: (data) => {
            const statusResponse = data?.data || data;
            if (statusResponse) {
                setTtsEnabled(statusResponse.enabled || false);
                setIsWhitelisted(statusResponse.is_whitelisted || false);
                if (statusResponse.has_local_setup) {
                    localStorage.setItem('tts_has_local_setup', 'true');
                } else {
                    localStorage.setItem('tts_has_local_setup', 'false');
                }
            }
        },
    });
    
    // Global Voices - загружаем только если движок готов
    const { data: voicesData } = useGlobalVoices({
        enabled: !!user && engineStatus.loaded,
        onSuccess: (data) => {
            const voicesResponse = data?.voices || data;
            if (Array.isArray(voicesResponse)) {
                setVoices(voicesResponse);
            } else if (voicesResponse?.success && Array.isArray(voicesResponse.voices)) {
                setVoices(voicesResponse.voices);
            }
        },
    });
    
    // Toggle TTS mutation
    const toggleTtsMutation = useToggleTts({
        onSuccess: (data, enabled) => {
            setTtsEnabled(enabled);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled } 
            }));
            const message = enabled ? "Озвучка сообщений включена." : "Озвучка сообщений отключена.";
            if (notificationCallback) {
                notificationCallback(message, "success");
            }
        },
        onError: (error) => {
            logger.error("Failed to toggle TTS status:", error);
            const message = "Не удалось изменить статус озвучки.";
            if (notificationCallback) {
                notificationCallback(message);
            }
        },
    });

    // Функция для регистрации callback уведомлений
    const setNotificationHandler = useCallback((callback) => {
        if (callback) {
            setNotificationCallback(() => callback);
        }
    }, []);

    // Инициализация - данные загружаются автоматически через React Query
    useEffect(() => {
        if (!isInitialized && user) {
            setIsInitialized(true);
        }
    }, [isInitialized, user]);

    // Обертка для проверки статуса (для обратной совместимости)
    const checkTtsStatus = useCallback(async () => {
        if (user) {
            await refetchStatus();
        }
    }, [user, refetchStatus]);
    
    // Обертка для проверки health (для обратной совместимости)
    const checkTtsHealth = useCallback(async () => {
        // Health проверяется автоматически через useTtsHealth
        return { isHealthy: engineStatus.loaded, isChecking: isCheckingHealth };
    }, [engineStatus.loaded, isCheckingHealth]);

    // Слушаем изменения от TtsQuickSettings (shortcuts на главной странице)
    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            logger.log('🔄 TtsContext: Received tts-status-changed event:', event.detail);
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    // Обертка для загрузки голосов (для обратной совместимости)
    const loadVoices = useCallback(async () => {
        // Голоса загружаются автоматически через useGlobalVoices
        // Функция оставлена для обратной совместимости
    }, []);


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


    // Обновляем isToggling из mutation
    useEffect(() => {
        setIsToggling(toggleTtsMutation.isPending);
    }, [toggleTtsMutation.isPending]);

    const toggleTts = useCallback(async (event = null) => {
        // Предотвращаем множественные вызовы
        if (isToggling || toggleTtsMutation.isPending) {
            return;
        }
        
        if (!engineStatus.loaded) {
            const errorMessage = engineStatus.error || "TTS движок не готов. Попробуйте обновить страницу.";
            if (notificationCallback) {
                notificationCallback(errorMessage);
            }
            return;
        }

        if (!isWhitelisted) {
            const message = "Ваш канал не в белом списке для использования TTS.";
            if (notificationCallback) {
                notificationCallback(message);
            }
            return;
        }

        // Используем mutation для переключения
        toggleTtsMutation.mutate(!ttsEnabled);
    }, [engineStatus.loaded, isWhitelisted, ttsEnabled, notificationCallback, isToggling, toggleTtsMutation]);

    // Функция для инициализации TTS (обертка для обратной совместимости)
    const initializeTts = useCallback(async () => {
        // Данные загружаются автоматически через React Query
        // Функция оставлена для обратной совместимости
        if (!isInitialized && user) {
            setIsInitialized(true);
        }
    }, [isInitialized, user]);

    // Мемоизируем значение контекста для предотвращения лишних re-renders
    const value = useMemo(() => ({
        ttsEnabled,
        isWhitelisted,
        setIsWhitelisted,
        voices,
        engineStatus,
        isInitialized,
        isToggling,
        toggleTts,
        loadVoices,
        initializeTts,
        setNotificationHandler,
        checkTtsStatus,
        checkTtsHealth,
        isCheckingHealth,
    }), [
        ttsEnabled,
        isWhitelisted,
        voices,
        engineStatus,
        isInitialized,
        isToggling,
        toggleTts,
        loadVoices,
        initializeTts,
        setNotificationHandler,
        checkTtsStatus,
        checkTtsHealth,
        isCheckingHealth,
    ]);

    return (
        <TtsContext.Provider value={value}>
            {children}
        </TtsContext.Provider>
    );
};