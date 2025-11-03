// src/context/ChatContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useReducer, useMemo } from 'react';
import { API_BASE_URL } from '../constants';
import { connectBot, disconnectBot, getBotStatus } from '../services/microservices';
import { AuthContext, useAuth } from './AuthContext';
import { useToast } from '../components/ui/toast';
import { useIntegrations } from './IntegrationsContext';
import useSharedWebSocket from '../hooks/useSharedWebSocket';
import api from '../services/api';
import { logger } from '../utils/prodLogger';

const ChatContext = createContext();

// Reducer для управления сообщениями
const messagesReducer = (state, action) => {
    const maxMessages = parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '200', 10);
    
    switch (action.type) {
        case 'ADD_MESSAGE':
            // Проверяем на дубликаты
            const isDuplicate = state.some(msg => 
                msg.id === action.payload.id || 
                (msg.timestamp === action.payload.timestamp && 
                 msg.author === action.payload.author && 
                 msg.content === action.payload.content)
            );
            
            if (isDuplicate) {
                return state;
            }
            
            // Добавляем новое сообщение В КОНЕЦ массива (старые вверху, новые внизу)
            const newMessages = [...state, action.payload].slice(-maxMessages);
            return newMessages;
            
        case 'CLEAR_MESSAGES':
            return [];
            
        case 'SET_MESSAGES':
            // Применяем ограничение на количество сообщений (берём последние)
            return action.payload.slice(-maxMessages);
            
        default:
            return state;
    }
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

export const ChatProvider = ({ children }) => {
    const { user, isAuthenticated, isGuest, isLoading } = useAuth();
    const { integrations, loading: integrationsLoading } = useIntegrations();
    const { addToast } = useToast();
    
    // Инициализируем messages из localStorage
    const loadMessagesFromStorage = () => {
        try {
            const maxMessages = parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '500', 10);
            const stored = localStorage.getItem('chat_messages');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Ограничиваем количество загруженных сообщений (берём последние)
                return parsed.slice(-maxMessages);
            }
        } catch (error) {
            logger.error('Error loading messages from storage:', error);
        }
        return [];
    };
    
    const [messages, dispatchMessages] = useReducer(messagesReducer, [], loadMessagesFromStorage);
    
    // Загрузка истории сообщений из API при инициализации
    useEffect(() => {
        const loadChatHistory = async () => {
            if (!isAuthenticated && !isGuest) return;
            
            try {
                const response = await api.get('/api/chat/history', {
                    params: {
                        limit: parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '200', 10)
                    }
                });
                
                if (response.data.success && response.data.messages.length > 0) {
                    logger.info(`📜 Loaded ${response.data.messages.length} messages from history`);
                    dispatchMessages({ type: 'SET_MESSAGES', payload: response.data.messages });
                }
            } catch (error) {
                logger.error('Failed to load chat history:', error);
                // Fallback на localStorage если API не доступно
            }
        };
        
        loadChatHistory();
    }, [isAuthenticated, isGuest]);
    const [lastJsonMessage, setLastJsonMessage] = useState(null);
    const [error, setError] = useState(null);
    const [botStatus, setBotStatus] = useState('disconnected');
    
    // Web Audio API контекст для обхода политики браузера (как в Twitch TTS проектах)
    const audioContext = useRef(null);
    const audioUnlocked = useRef(false);
    const autoplayToastShown = useRef(false);
    
    // Разблокировка AudioContext при первом взаимодействии (ЛЕНИВАЯ инициализация)
    useEffect(() => {
        const unlockAudioContext = async () => {
            // Помечаем что пользователь взаимодействовал со страницей
            if (!audioUnlocked.current) {
                audioUnlocked.current = true;
                logger.info('✅ User interaction detected - audio unlocked');
                
                // Удаляем обработчики после первого клика
                document.removeEventListener('click', unlockAudioContext);
                document.removeEventListener('touchstart', unlockAudioContext);
                document.removeEventListener('keydown', unlockAudioContext);
                
                // Resume контекста если он уже существует и приостановлен
                if (audioContext.current && audioContext.current.state === 'suspended') {
                    try {
                        await audioContext.current.resume();
                        logger.info('🔊 AudioContext resumed after user gesture');
                    } catch (err) {
                        logger.debug('AudioContext resume failed:', err.message);
                    }
                }
            }
        };
        
        // Добавляем обработчики для первого взаимодействия
        document.addEventListener('click', unlockAudioContext);
        document.addEventListener('touchstart', unlockAudioContext);
        document.addEventListener('keydown', unlockAudioContext);
        
        return () => {
            document.removeEventListener('click', unlockAudioContext);
            document.removeEventListener('touchstart', unlockAudioContext);
            document.removeEventListener('keydown', unlockAudioContext);
        };
    }, []);
    
    // Используем новый WebSocket хук если пользователь авторизован (включая гостя)
    const baseUrl = API_BASE_URL;
    if (!baseUrl) {
        logger.error('VITE_BOT_SERVICE_URL environment variable is required');
        return (
            <ChatContext.Provider value={{
                messages: [],
                sendMessage: () => {},
                isConnected: false,
                botStatus: 'disconnected',
                connectBotToChannels: () => {},
                disconnectBotFromChannels: () => {},
                playTTS: () => {},
                error: 'Ошибка конфигурации: отсутствует URL сервиса'
            }}>
                {children}
            </ChatContext.Provider>
        );
    }
    // Для гостей используем session_id как уникальный идентификатор, для обычных пользователей - реальный ID
    const userId = isGuest ? user?.session_id : user?.id;
    const [isConnected, setIsConnected] = useState(false);
    
    // 📡 Обработчик WebSocket сообщений для Shared WebSocket
    const handleWebSocketMessage = useCallback((data) => {
            setLastJsonMessage(data);
            
            // 🔍 DEBUG: Логируем ВСЕ входящие WebSocket сообщения
            logger.log('🔌 [WS] Received message type:', data.type, 'Data:', data);
            
            if (data.type === 'message' || data.type === 'chat_message') {
                dispatchMessages({ type: 'ADD_MESSAGE', payload: data });
            } else if (data.type === 'chat_history') {
                // Получили историю сообщений через WebSocket
                logger.log('📜 [WS] Processing chat_history, messages:', data.messages?.length);
                if (data.messages && Array.isArray(data.messages)) {
                    logger.info(`📜 Loaded ${data.messages.length} messages from WebSocket history`);
                    dispatchMessages({ type: 'SET_MESSAGES', payload: data.messages });
                } else {
                    logger.warn('⚠️ [WS] chat_history received but messages is not an array:', data.messages);
                }
            } else if (data.type === 'bot_status') {
                setBotStatus(data.status);
            } else if (data.type === 'tts_audio') {
                // Обработка готового TTS аудио из backend через Web Audio API
                const audioData = data.data || data;
                if (audioData.audio_url) {
                    try {
                        // Используем Web Audio API для лучшей совместимости с autoplay политикой
                        const playAudioViaWebAudioAPI = async () => {
                            try {
                                // Проверяем что пользователь кликнул на странице
                                if (!audioUnlocked.current) {
                                    throw new Error('User interaction required');
                                }
                                
                                // ЛЕНИВОЕ создание AudioContext (ТОЛЬКО после первого клика)
                                if (!audioContext.current || audioContext.current.state === 'closed') {
                                    audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
                                    logger.info('🎵 AudioContext created for TTS playback');
                                }
                                
                                // Resume контекста если он приостановлен
                                if (audioContext.current.state === 'suspended') {
                                    await audioContext.current.resume();
                                    logger.info('🔊 AudioContext resumed');
                                }
                                
                                // Проверяем что контекст работает
                                if (audioContext.current.state !== 'running') {
                                    throw new Error('AudioContext not running');
                                }
                                
                                // Загружаем аудио файл
                                const response = await fetch(audioData.audio_url);
                                const arrayBuffer = await response.arrayBuffer();
                                
                                // Декодируем аудио данные
                                const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
                                
                                // Создаем source и применяем громкость
                                const source = audioContext.current.createBufferSource();
                                const gainNode = audioContext.current.createGain();
                                
                                source.buffer = audioBuffer;
                                gainNode.gain.value = (audioData.volume || 50) / 100;
                                
                                // Подключаем: source → gain → destination
                                source.connect(gainNode);
                                gainNode.connect(audioContext.current.destination);
                                
                                // Воспроизводим
                                source.start(0);
                                logger.info(`✅ TTS audio playing via Web Audio API: ${audioData.tts_type}`);
                                
                            } catch (err) {
                                // Fallback на обычный Audio если Web Audio API не работает
                                logger.warn('Web Audio API failed, falling back to Audio element:', err.message);
                                
                                const audio = new Audio(audioData.audio_url);
                                audio.volume = (audioData.volume || 50) / 100;
                                
                                const playPromise = audio.play();
                                if (playPromise !== undefined) {
                                    playPromise.catch(playErr => {
                                        if (playErr.name === 'NotAllowedError' && !autoplayToastShown.current) {
                                            autoplayToastShown.current = true;
                                            addToast({
                                                type: 'info',
                                                title: '🔊 Разрешите озвучку',
                                                message: 'Кликните в любом месте страницы для активации TTS',
                                                duration: 5000
                                            });
                                        }
                                    });
                                }
                            }
                        };
                        
                        playAudioViaWebAudioAPI();
                        
                    } catch (err) {
                        logger.error('Error creating TTS playback:', err);
                    }
                } else {
                    logger.warn('TTS audio event received but no audio_url provided');
                }
            } else if (data.type === 'error') {
                setError(data.message);
                addToast({ 
                    type: 'error', 
                    title: 'Ошибка чата', 
                    message: data.message 
                });
            } else if (data.type === 'ping' || data.type === 'pong') {
                // Игнорируем ping/pong сообщения (heartbeat)
                return;
            } else if (data.type === 'chatbox_settings_updated') {
                // Игнорируем события обновления настроек ChatOverlay (они предназначены для OBS виджета)
                return;
            } else {
                logger.debug('Unknown message type:', data.type);
            }
    }, [addToast]);
    
    // 🔌 Подключаем Shared WebSocket
    const { send: wsSendMessage } = useSharedWebSocket(userId, handleWebSocketMessage);
    
    // Устанавливаем isConnected на true если userId есть (Shared WebSocket автоматически подключается)
    useEffect(() => {
        if (userId && (isAuthenticated || isGuest)) {
            setIsConnected(true);
        } else {
            setIsConnected(false);
        }
    }, [userId, isAuthenticated, isGuest]);
    
    // Сохраняем messages в localStorage при изменении
    useEffect(() => {
        if (messages.length > 0) {
            logger.debug('Messages updated:', messages.length, 'total messages');
            try {
                localStorage.setItem('chat_messages', JSON.stringify(messages));
            } catch (error) {
                logger.error('Error saving messages to storage:', error);
            }
        }
    }, [messages]);

    // Функция для воспроизведения TTS
    const playTTS = useCallback((text, voice = 'default') => {
        try {
            const audio = new Audio();
            audio.src = `${API_BASE_URL}/api/tts/speak?text=${encodeURIComponent(text)}&voice=${voice}`;
            
            audio.onloadeddata = () => {
                logger.debug('TTS audio loaded, playing...');
                audio.play().catch(err => {
                    logger.error('Error playing TTS audio:', err);
                });
            };
            
            audio.onerror = (err) => {
                logger.error('Error loading TTS audio:', err);
                addToast({
                    type: 'error',
                    title: 'Ошибка TTS',
                    message: 'Не удалось загрузить аудио для озвучки'
                });
            };
            
            // Загружаем аудио
            audio.load();
        } catch (error) {
            logger.error("Error creating TTS audio:", error);
            addToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось создать аудио объект для TTS'
            });
        }
    }, [addToast]);

    // Функция для проверки статуса подключения бота
    const checkConnectionStatus = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get('/api/chat/status');
            setBotStatus(response.data.is_connected ? 'connected' : 'disconnected');
        } catch (err) {
            logger.error("Failed to check chat connection status:", err);
            setBotStatus('disconnected');
        }
    }, [isAuthenticated]);

    // Функция для отправки сообщения в чат
    const sendMessage = useCallback((message, platforms = []) => {
        if (!isConnected) {
            throw new Error('WebSocket not connected');
        }

        if (!message || !message.trim()) {
            throw new Error('Message cannot be empty');
        }

        if (!platforms || platforms.length === 0) {
            throw new Error('No platforms specified');
        }

        // Отправляем сообщение через WebSocket
        wsSendMessage({
            type: 'send_message',
            message: message.trim(),
            platforms: platforms
        });
    }, [isConnected, wsSendMessage]);

    // Функция для подключения бота
    const connectBotToChannels = useCallback(async (platforms = []) => {
        if (!isAuthenticated) return;
        
        try {
            const response = await connectBot(platforms);
            if (response.success) {
                setBotStatus('connected');
                addToast({
                    type: 'success',
                    title: 'Бот подключен',
                    message: `Бот успешно подключен к ${platforms.join(', ')}`
                });
            }
        } catch (error) {
            logger.error('Error connecting bot:', error);
            addToast({
                type: 'error',
                title: 'Ошибка подключения',
                message: 'Не удалось подключить бота к каналам'
            });
        }
    }, [isAuthenticated, addToast]);

    // Функция для отключения бота
    const disconnectBotFromChannels = useCallback(async () => {
        if (!isAuthenticated) return;
        
        try {
            const response = await disconnectBot();
            if (response.success) {
                setBotStatus('disconnected');
                addToast({
                    type: 'success',
                    title: 'Бот отключен',
                    message: 'Бот успешно отключен от всех каналов'
                });
            }
        } catch (error) {
            logger.error('Error disconnecting bot:', error);
            addToast({
                type: 'error',
                title: 'Ошибка отключения',
                message: 'Не удалось отключить бота от каналов'
            });
        }
    }, [isAuthenticated, addToast]);

    // Функция для получения статуса бота
    const getBotConnectionStatus = useCallback(async () => {
        if (!isAuthenticated) return;
        
        try {
            const response = await getBotStatus();
            setBotStatus(response.status);
            return response;
        } catch (error) {
            logger.error('Error getting bot status:', error);
            setBotStatus('disconnected');
            return { status: 'disconnected' };
        }
    }, [isAuthenticated]);

    // Функция для очистки сообщений
    const clearMessages = useCallback(() => {
        dispatchMessages({ type: 'CLEAR_MESSAGES' });
    }, []);

    // Функция для установки сообщений
    const setMessages = useCallback((newMessages) => {
        dispatchMessages({ type: 'SET_MESSAGES', payload: newMessages });
    }, []);

    // Автоматическая проверка статуса бота при загрузке
    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            getBotConnectionStatus();
        }
    }, [isAuthenticated, isLoading, getBotConnectionStatus]);

    // Очистка сообщений при выходе
    useEffect(() => {
        if (!isAuthenticated) {
            dispatchMessages({ type: 'CLEAR_MESSAGES' });
        }
    }, [isAuthenticated]);

    const value = {
        messages,
        lastJsonMessage,
        isConnected,
        botStatus,
        error,
        sendMessage,
        connectBotToChannels,
        disconnectBotFromChannels,
        getBotConnectionStatus,
        clearMessages,
        setMessages,
        playTTS
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};