// src/context/TtsContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import microservicesAPI from '../services/microservices';

const TtsContext = createContext();

export const useTts = () => {
    const context = useContext(TtsContext);
    if (!context) {
        throw new Error('useTts must be used within a TtsProvider');
    }
    return context;
};

export const TtsProvider = ({ children }) => {
    // Загружаем сохраненное состояние из localStorage
    const getInitialState = () => {
        try {
            const saved = localStorage.getItem('ttsStatus');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ttsStatus: { enabled: parsed.enabled, ready: parsed.ready },
                    ttsEnabled: parsed.ttsEnabled
                };
            }
        } catch (error) {
            console.error('Error loading saved TTS state:', error);
        }
        return {
            ttsStatus: { enabled: false, ready: false },
            ttsEnabled: false
        };
    };

    const initialState = getInitialState();

    // Состояние TTS
    const [ttsStatus, setTtsStatus] = useState(initialState.ttsStatus);
    const [ttsProgress, setTtsProgress] = useState({ progress: 0, status: 'not_started', message: '' });
    const [isLoadingTts, setIsLoadingTts] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(initialState.ttsEnabled);
    const [engineInfo, setEngineInfo] = useState({ engine_type: 'russian', loaded: false, ready: false });
    const [useRussianEngine, setUseRussianEngine] = useState(true);
    const [voices, setVoices] = useState([]);
    const [mutedUsers, setMutedUsers] = useState(new Set());

    // Загружаем статус TTS
    const loadTtsStatus = async () => {
        try {
            const botStatus = await microservicesAPI.getTtsStatus();
            
            setTtsStatus({
                enabled: botStatus.enabled,
                ready: false // Будет обновлено через loadEngineInfo
            });
            
            setMutedUsers(new Set(botStatus.muted_users || []));
            
            // Загружаем информацию о движке
            const engineAvailable = await loadEngineInfo();
            
            // Устанавливаем ttsEnabled только если TTS сервис доступен И включен
            setTtsEnabled(botStatus.enabled && engineAvailable);
            
            // Сохраняем состояние в localStorage
            localStorage.setItem('ttsStatus', JSON.stringify({
                enabled: botStatus.enabled,
                ready: engineAvailable,
                ttsEnabled: botStatus.enabled && engineAvailable
            }));
            
        } catch (error) {
            console.error('Error loading TTS status:', error);
            setTtsStatus({ enabled: false, ready: false });
            setTtsEnabled(false);
        }
    };

    const loadEngineInfo = async () => {
        try {
            // Сначала проверяем bot health
            const botHealth = await microservicesAPI.getBotHealth();
            
            // Если bot health показывает, что TTS недоступен, сразу возвращаем ошибку
            if (!botHealth.tts_available) {
                setEngineInfo({ 
                    engine_type: 'none', 
                    loaded: false, 
                    ready: false,
                    error: botHealth.tts_error || 'TTS сервис недоступен'
                });
                return false;
            }
            
            // Если bot health показывает, что TTS доступен, проверяем напрямую TTS сервис
            try {
                const ttsHealth = await microservicesAPI.getTtsHealth();
                
                setEngineInfo({
                    engine_type: ttsHealth.engine_type || 'russian',
                    loaded: ttsHealth.ready || false,
                    ready: ttsHealth.ready || false
                });
                
                // Загружаем голоса только если TTS доступен
                await loadVoices();
                return true; // TTS доступен
                
            } catch (ttsError) {
                console.error('TTS service direct check failed:', ttsError);
                // Если прямой запрос к TTS сервису не удался, используем данные из bot health
                setEngineInfo({
                    engine_type: 'russian',
                    loaded: true,
                    ready: true
                });
                
                // Загружаем голоса только если TTS доступен
                await loadVoices();
                return true; // TTS доступен через bot health
            }
            
        } catch (error) {
            console.error('Error loading engine info:', error);
            // Если TTS сервис недоступен, устанавливаем соответствующий статус
            setEngineInfo({ 
                engine_type: 'none', 
                loaded: false, 
                ready: false,
                error: 'TTS сервис недоступен'
            });
            return false; // TTS недоступен
        }
    };

    const loadVoices = async () => {
        try {
            // Получаем голоса через bot service
            const response = await microservicesAPI.getTtsVoicesStatus();
            setVoices(response.voices || []);
        } catch (error) {
            console.error('Error loading voices:', error);
            setVoices([]);
        }
    };

    // WebSocket handlers
    useEffect(() => {
        // Проверяем авторизацию через cookies
        const hasAuthCookie = document.cookie.includes('auth_status=authenticated');
        
        if (!hasAuthCookie) {
            console.log('TtsContext: User not authorized, skipping WebSocket connection');
            return;
        }

        const handleWebSocketMessage = (message) => {
            if (message.type === 'tts_status') {
                console.log('WebSocket TTS status:', message.data);
                setTtsStatus(message.data);
                if (message.data.enabled !== undefined) {
                    setTtsEnabled(message.data.enabled);
                }
            } else if (message.type === 'tts_progress') {
                console.log('WebSocket TTS progress:', message.data);
                setTtsProgress(message.data);
                
                // Останавливаем загрузку если статус готов или ошибка
                if (message.data.status === 'ready' || message.data.status === 'error') {
                    setIsLoadingTts(false);
                }
            } else if (message.type === 'chat_message') {
                // Обновляем список заглушенных пользователей при новых сообщениях
                loadTtsStatus();
            }
        };

        microservicesAPI.connectWebSocket(
            handleWebSocketMessage,
            () => console.log('WebSocket подключен'),
            () => console.log('WebSocket отключен')
        );

        return () => {
            microservicesAPI.disconnectWebSocket();
        };
    }, [loadTtsStatus]);

    // Не загружаем информацию о TTS при монтировании
    // TTS будет загружаться только при включении пользователем
    
    // Периодическая проверка доступности TTS сервиса
    useEffect(() => {
        const checkTtsAvailability = async () => {
            if (ttsEnabled) {
                const engineAvailable = await loadEngineInfo();
                if (!engineAvailable) {
                    setTtsEnabled(false);
                    console.log('TTS service became unavailable, disabling toggle');
                }
            }
        };
        
        // Проверяем каждые 30 секунд
        const interval = setInterval(checkTtsAvailability, 30000);
        
        return () => clearInterval(interval);
    }, [ttsEnabled]);

    // Включаем/выключаем TTS
    const toggleTts = async () => {
        try {
            // Сначала проверяем доступность TTS сервиса
            const engineAvailable = await loadEngineInfo();
            
            if (!engineAvailable) {
                // TTS сервис недоступен, выключаем toggle
                setTtsEnabled(false);
                console.log('TTS service unavailable, disabling toggle');
                return;
            }
            
            if (ttsEnabled) {
                await microservicesAPI.disableTts();
                setTtsEnabled(false);
            } else {
                await microservicesAPI.enableTts();
                setTtsEnabled(true);
            }
        } catch (error) {
            console.error('Error toggling TTS:', error);
            // При ошибке выключаем toggle
            setTtsEnabled(false);
        }
    };

    // Функции для включения/выключения TTS (используются в TtsMainPage)
    const startTtsLoading = async () => {
        try {
            setIsLoadingTts(true);
            setTtsProgress({ progress: 0, status: 'starting', message: 'Включаем TTS...' });
            
            // Сначала загружаем информацию о движке
            setTtsProgress({ progress: 25, status: 'loading_engine', message: 'Загружаем информацию о движке...' });
            const engineAvailable = await loadEngineInfo();
            
            // Проверяем, что движок доступен
            if (!engineAvailable || engineInfo.error) {
                throw new Error(engineInfo.error || 'TTS сервис недоступен');
            }
            
            setTtsProgress({ progress: 50, status: 'enabling', message: 'Включаем TTS...' });
            await microservicesAPI.enableTts();
            setTtsEnabled(true);
            
            setTtsProgress({ progress: 100, status: 'ready', message: 'TTS включен' });
            setIsLoadingTts(false);
        } catch (error) {
            console.error('Error starting TTS:', error);
            setTtsProgress({ progress: 0, status: 'error', message: `Ошибка включения TTS: ${error.message}` });
            setTtsEnabled(false); // Выключаем toggle при ошибке
            setIsLoadingTts(false);
        }
    };

    const stopTtsLoading = async () => {
        try {
            setIsLoadingTts(true);
            setTtsProgress({ progress: 0, status: 'stopping', message: 'Выключаем TTS...' });
            
            await microservicesAPI.disableTts();
            setTtsEnabled(false);
            
            setTtsProgress({ progress: 100, status: 'stopped', message: 'TTS выключен' });
            setIsLoadingTts(false);
        } catch (error) {
            console.error('Error stopping TTS:', error);
            setTtsProgress({ progress: 0, status: 'error', message: 'Ошибка выключения TTS' });
            setIsLoadingTts(false);
        }
    };

    // Переключение движка
    const switchEngine = async (useRussian) => {
        setUseRussianEngine(useRussian);
        // В микросервисной архитектуре движок фиксированный
        console.log('Engine switching not supported in microservices architecture');
    };

    // Заглушение пользователя
    const muteUser = async (username) => {
        try {
            await microservicesAPI.muteUser(username);
            setMutedUsers(prev => new Set([...prev, username.toLowerCase()]));
        } catch (error) {
            console.error('Error muting user:', error);
        }
    };

    // Разглушение пользователя
    const unmuteUser = async (username) => {
        try {
            await microservicesAPI.unmuteUser(username);
            setMutedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(username.toLowerCase());
                return newSet;
            });
        } catch (error) {
            console.error('Error unmuting user:', error);
        }
    };

    // Обновление настроек TTS
    const updateTtsSettings = async (settings) => {
        try {
            await microservicesAPI.updateTtsSettings(settings);
        } catch (error) {
            console.error('Error updating TTS settings:', error);
        }
    };

    // Синтез речи (для тестирования)
    const synthesizeSpeech = async (text, voiceName = 'speaker1.wav', channelName = 'test') => {
        try {
            const result = await microservicesAPI.synthesizeSpeech(text, voiceName, channelName);
            return result;
        } catch (error) {
            console.error('Error synthesizing speech:', error);
            return { success: false, error: error.message };
        }
    };

    const value = {
        // Состояние
        ttsStatus,
        ttsProgress,
        isLoadingTts,
        ttsEnabled,
        engineInfo,
        useRussianEngine,
        voices,
        mutedUsers,
        
        // Действия
        toggleTts,
        startTtsLoading,
        stopTtsLoading,
        switchEngine,
        muteUser,
        unmuteUser,
        updateTtsSettings,
        synthesizeSpeech,
        loadTtsStatus,
        loadEngineInfo,
        loadVoices,
        setUseRussianEngine
    };

    return (
        <TtsContext.Provider value={value}>
            {children}
        </TtsContext.Provider>
    );
};