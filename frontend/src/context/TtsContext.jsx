// src/context/TtsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getTtsHealth, getGlobalVoices, enableTts, disableTts, getTtsStatus } from '../services/microservices';
import { AuthContext } from './AuthContext';
import { useToast } from '../components/ui/toast';
import { useButtonPosition } from '../hooks/useButtonPosition';
import { logger } from '../utils/prodLogger';

const TtsContext = createContext();

export const useTts = () => useContext(TtsContext);

export const TtsProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();
    const { getButtonPosition } = useButtonPosition();
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [isWhitelisted, setIsWhitelisted] = useState(null); // null = не проверено, true/false = результат проверки
    const [voices, setVoices] = useState([]);
    const [engineStatus, setEngineStatus] = useState({ loaded: false, error: null });
    const [notificationCallback, setNotificationCallback] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isToggling, setIsToggling] = useState(false); // Флаг для предотвращения множественных вызовов

    // Функция для регистрации callback уведомлений
    const setNotificationHandler = useCallback((callback) => {
        if (callback) {
            setNotificationCallback(() => callback);
        }
    }, []);

    // Инициализация при первом запуске - теперь полагаемся на TtsHealthContext
    useEffect(() => {
        if (!isInitialized) {
            // Просто отмечаем как инициализированный, health проверка в TtsHealthContext
            setIsInitialized(true);
        }
    }, [isInitialized]);

    // Дополнительная инициализация при появлении пользователя
    useEffect(() => {
        if (isInitialized && user) {
            // Вызываем функции напрямую, без зависимости
            const initUserTts = async () => {
                try {
                    // CRITICAL: Проверяем статус TTS и whitelist ВСЕГДА (независимо от engineStatus)
                    const channelName = user?.isGuest ? user.username : null;
                    const response = await getTtsStatus(channelName);
                    if (response.data) {
                        setTtsEnabled(response.data.enabled);
                        // IMPORTANT: Set isWhitelisted from API response
                        setIsWhitelisted(response.data.is_whitelisted || false);
                        // Сохраняем has_local_setup в localStorage для других компонентов
                        if (response.data.has_local_setup) {
                            localStorage.setItem('tts_has_local_setup', 'true');
                        } else {
                            localStorage.setItem('tts_has_local_setup', 'false');
                        }
                    }
                } catch (error) {
                    logger.error('Failed to get TTS status:', error);
                }
                
                // Загружаем голоса только если движок готов
                if (engineStatus.loaded) {
                    try {
                        const voicesResponse = await getGlobalVoices();
                        if (voicesResponse.success) {
                            setVoices(voicesResponse.voices || []);
                        }
                    } catch (error) {
                        logger.error('Failed to load voices:', error);
                    }
                }
            };
            
            initUserTts();
        }
    }, [isInitialized, engineStatus.loaded, user]);

    const checkEngineStatus = useCallback(async () => {
        try {
            const response = await getTtsHealth();
            
            // Проверяем и статус, и готовность движка
            if (response.status === 'healthy' && response.tts_engine_loaded) {
                setEngineStatus({ loaded: true, error: null });
            } else {
                const errorMsg = response.status !== 'healthy' 
                    ? "TTS сервис недоступен" 
                    : "TTS движок не готов";
                setEngineStatus({ loaded: false, error: errorMsg });
            }
        } catch (error) {
            setEngineStatus({ loaded: false, error: "Не удается подключиться к TTS сервису" });
            logger.error("TTS Health check failed:", error);
        }
    }, []);

    // Синхронизация с TtsHealthContext
    const syncWithHealthContext = useCallback((isHealthy) => {
        // Проверяем, изменилось ли значение
        const newStatus = isHealthy ? 
            { loaded: true, error: null } : 
            { loaded: false, error: "TTS сервис недоступен" };
        
        // Обновляем только если статус изменился
        setEngineStatus(prevStatus => {
            if (prevStatus.loaded !== newStatus.loaded || prevStatus.error !== newStatus.error) {
                return newStatus;
            }
            return prevStatus;
        });
    }, []);

    const checkTtsStatus = useCallback(async () => {
        if (user) {
            try {
                const channelName = user?.isGuest ? user.username : null;
                const response = await getTtsStatus(channelName);
                const { enabled, is_whitelisted, has_local_setup } = response.data;
                setTtsEnabled(enabled);
                setIsWhitelisted(is_whitelisted || false);
                // Сохраняем has_local_setup в localStorage для других компонентов
                if (has_local_setup) {
                    localStorage.setItem('tts_has_local_setup', 'true');
                } else {
                    localStorage.setItem('tts_has_local_setup', 'false');
                }
            } catch (error) {
                logger.error("Could not get TTS status:", error);
                setTtsEnabled(false);
            }
        }
    }, [user]);

    // Слушаем изменения от TtsQuickSettings (shortcuts на главной странице)
    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            logger.log('🔄 TtsContext: Received tts-status-changed event:', event.detail);
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    const loadVoices = useCallback(async () => {
        if (user && engineStatus.loaded) {
             try {
                const response = await getGlobalVoices();
                setVoices(response.data);
            } catch (error) {
                logger.error("Failed to load voices:", error);
                const message = "Не удалось загрузить список голосов.";
                if (notificationCallback) {
                    notificationCallback(message);
                } else {
                    // showNotification(message, 'error'); // This line was removed from imports
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


    const toggleTts = useCallback(async (event = null) => {
        // Предотвращаем множественные вызовы
        if (isToggling) {
            return;
        }
        
        setIsToggling(true);
        
        try {
            if (!engineStatus.loaded) {
                // TtsContext: TTS engine not loaded, notificationCallback:', !!notificationCallback);
                // TtsContext: Engine status:', engineStatus);
                // Показываем более точное сообщение об ошибке
                const errorMessage = engineStatus.error || "TTS движок не готов. Попробуйте обновить страницу.";
                if (notificationCallback) {
                    notificationCallback(errorMessage);
                } else {
                    const position = getButtonPosition(event);
                    // showNotification(errorMessage, 'error', 4000, position); // This line was removed from imports
                }
                return;
            }

            if (!isWhitelisted) {
                // TtsContext: Channel not whitelisted, notificationCallback:', !!notificationCallback);
                const message = "Ваш канал не в белом списке для использования TTS.";
                if (notificationCallback) {
                    // TtsContext: Using notification callback for whitelist');
                    notificationCallback(message);
                } else {
                    // TtsContext: Using fallback notification for whitelist');
                    const position = getButtonPosition(event);
                    // showNotification(message, 'warning', 4000, position); // This line was removed from imports
                }
                return;
            }

            if (ttsEnabled) {
                await disableTts();
                setTtsEnabled(false);
                
                // Уведомляем shortcuts на главной странице
                window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                    detail: { enabled: false } 
                }));
                
                const message = "Озвучка сообщений отключена.";
                if (notificationCallback) {
                    notificationCallback(message, "success");
                } else {
                    const position = getButtonPosition(event);
                    // showNotification(message, "success", 4000, position); // This line was removed from imports
                }
            } else {
                await enableTts();
                setTtsEnabled(true);
                
                // Уведомляем shortcuts на главной странице
                window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                    detail: { enabled: true } 
                }));
                
                const message = "Озвучка сообщений включена.";
                if (notificationCallback) {
                    notificationCallback(message, "success");
                } else {
                    const position = getButtonPosition(event);
                    // showNotification(message, "success", 4000, position); // This line was removed from imports
                }
            }
        } catch (error) {
            logger.error("Failed to toggle TTS status:", error);
            const message = "Не удалось изменить статус озвучки.";
            if (notificationCallback) {
                notificationCallback(message);
            } else {
                const position = getButtonPosition(event);
                // showNotification(message, 'error', 4000, position); // This line was removed from imports
            }
        } finally {
            // Сбрасываем флаг с минимальной задержкой для предотвращения спама
            setTimeout(() => {
                setIsToggling(false);
            }, 200); // 200ms задержка
        }
    }, [engineStatus.loaded, isWhitelisted, ttsEnabled, notificationCallback, getButtonPosition, isToggling]);

    // Функция для инициализации TTS (вызывается только при переходе на TTS страницы)
    const initializeTts = useCallback(async () => {
        // TtsContext: initializeTts called, isInitialized:', isInitialized, 'engine status:', engineStatus);
        
        // Если уже инициализирован, не делаем повторную инициализацию
        if (isInitialized) {
            // TtsContext: Already initialized, skipping...');
            return;
        }
        
        // CRITICAL: Check TTS status and whitelist ALWAYS (independently of engine status)
        // This fixes the issue where isWhitelisted stays null until engine loads
        if (user) {
            try {
                // Проверяем статус TTS и whitelist
                const channelName = user?.isGuest ? user.username : null;
                const response = await getTtsStatus(channelName);
                if (response.data) {
                    setTtsEnabled(response.data.enabled);
                    // IMPORTANT: Set isWhitelisted from API response
                    // Backend returns: is_whitelisted OR has_local_setup
                    setIsWhitelisted(response.data.is_whitelisted || false);
                    // Save has_local_setup to localStorage for other components
                    if (response.data.has_local_setup) {
                        localStorage.setItem('tts_has_local_setup', 'true');
                    } else {
                        localStorage.setItem('tts_has_local_setup', 'false');
                    }
                }
            } catch (error) {
                logger.error('Failed to get TTS status:', error);
            }
        }
        
        // Загружаем голоса только если движок готов
        if (engineStatus.loaded && user) {
            try {
                // Загружаем голоса
                const voicesResponse = await getGlobalVoices();
                if (voicesResponse.success) {
                    setVoices(voicesResponse.voices || []);
                }
            } catch (error) {
                logger.error('Failed to load voices:', error);
            }
        }
        
        // Отмечаем как инициализированный
        setIsInitialized(true);
    }, [isInitialized, engineStatus.loaded, user]);

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
        syncWithHealthContext,
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
        syncWithHealthContext,
    ]);

    return (
        <TtsContext.Provider value={value}>
            {children}
        </TtsContext.Provider>
    );
};