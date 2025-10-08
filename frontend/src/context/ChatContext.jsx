// src/context/ChatContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { connectBot, disconnectBot, getBotStatus } from '../services/microservices';
import { AuthContext, useAuth } from './AuthContext';
import { useToast } from '../components/ui/toast';
import { useIntegrations } from './IntegrationsContext';
import api from '../services/api';

const ChatContext = createContext();

// Reducer для управления сообщениями
const messagesReducer = (state, action) => {
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
                console.log('⚠️ Duplicate message detected, skipping:', action.payload);
                return state;
            }
            
            const newMessages = [action.payload, ...state.slice(0, 199)];
            console.log('📝 Reducer: New messages array length:', newMessages.length);
            return newMessages;
            
        case 'CLEAR_MESSAGES':
            return [];
            
        case 'SET_MESSAGES':
            return action.payload;
            
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
    const { user, isAuthenticated, isLoading } = useAuth();
    const { integrations, loading: integrationsLoading } = useIntegrations();
    const { addToast } = useToast();
    const [messages, dispatchMessages] = useReducer(messagesReducer, []);
    const [lastJsonMessage, setLastJsonMessage] = useState(null); // <-- Добавлено
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);
    
    const websocket = useRef(null);
    
    // Отслеживаем изменения messages для отладки
    useEffect(() => {
        console.log('🔄 Messages state changed:', messages.length, 'messages');
        if (messages.length > 0) {
            console.log('📋 Latest message:', messages[0]);
        }
    }, [messages]);
    
    // useReducer автоматически обновляет состояние

    // Функция для воспроизведения TTS аудио
    const playTtsAudio = (audioUrl) => {
        try {
            // Проверяем, является ли URL уже полным
            let fullAudioUrl = audioUrl;
            if (!audioUrl.startsWith('http')) {
                const ttsServiceUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
                fullAudioUrl = `${ttsServiceUrl}${audioUrl}`;
            }
            
            console.log('Playing TTS audio:', fullAudioUrl);
            const audio = new Audio(fullAudioUrl);
            
            // Добавляем обработчики событий
            audio.oncanplaythrough = () => {
                console.log('TTS audio ready to play');
                audio.play().catch(e => {
                    console.error("TTS audio play failed:", e);
                    addToast({
                        type: 'error',
                        title: 'Ошибка воспроизведения',
                        message: 'Не удалось воспроизвести TTS аудио'
                    });
                });
            };
            
            audio.onended = () => {
                console.log('TTS audio playback ended');
            };
            
            audio.onerror = (e) => {
                console.error("Error loading TTS audio:", fullAudioUrl, e);
                addToast({
                    type: 'error',
                    title: 'Ошибка загрузки',
                    message: 'Не удалось загрузить TTS аудио файл'
                });
            };
            
            // Загружаем аудио
            audio.load();
        } catch (error) {
            console.error("Error creating TTS audio:", error);
            addToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось создать аудио объект для TTS'
            });
        }
    };

    // Функция для проверки статуса подключения бота
    const checkConnectionStatus = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get('/api/chat/status');
            setIsConnected(response.data.is_connected);
        } catch (err) {
            console.error("Failed to check chat connection status:", err);
            setIsConnected(false);
        }
    }, [isAuthenticated]);
    
    // Функция для установки WebSocket соединения
    const setupWebSocket = useCallback(() => {
        // WebSocket только для авторизованных пользователей (не гостей)
        if (!isAuthenticated || !user?.id || user?.id === 'guest') {
            console.log('WebSocket setup skipped:', { isAuthenticated, userId: user?.id });
            return;
        }

        // Если уже есть активное соединение, не создаем новое
        if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected, skipping setup');
            return;
        }

        // Если соединение в процессе установки, ждем
        if (websocket.current && websocket.current.readyState === WebSocket.CONNECTING) {
            console.log('WebSocket is connecting, skipping setup');
            return;
        }

        const baseWsUrl = import.meta.env.VITE_BOT_WS_URL || 'ws://localhost:8000/ws';
        const wsUrl = `${baseWsUrl}/chat/${user.id}`;
        
        console.log('🔌 Setting up WebSocket connection to:', wsUrl);
        setIsConnecting(true);
        
        const ws = new WebSocket(wsUrl);
        websocket.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected successfully to:', wsUrl);
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);
            
            // Отправляем ping каждые 30 секунд для поддержания соединения
            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                } else {
                    clearInterval(pingInterval);
                }
            }, 30000);
            
            // Сохраняем интервал для очистки
            ws.pingInterval = pingInterval;
        };

        ws.onmessage = (event) => {
            console.log('🔔 WebSocket message received:', event.data);
            const messageData = JSON.parse(event.data);
            console.log('📦 Parsed message data:', messageData);
            setLastJsonMessage(messageData); // <-- Добавлено: сохраняем все сообщение
            
            // Обрабатываем YouTube события
            if (messageData.type === 'youtube_event') {
                console.log('YouTube event received:', messageData);
                // Создаем кастомное событие для YouTube компонентов
                window.dispatchEvent(new CustomEvent('youtubeEvent', {
                    detail: messageData
                }));
                return;
            }
            
            // Обрабатываем TTS аудио
            if (messageData.type === 'tts_synthesized' && messageData.audio_url) {
                console.log('TTS Audio received:', messageData.audio_url);
                playTtsAudio(messageData.audio_url);
                return;
            }
            
            // Обрабатываем TTS ошибки
            if (messageData.type === 'tts_error') {
                console.error('TTS Error:', messageData.message);
                // Показываем красивое уведомление об ошибке
                addToast({
                    type: 'error',
                    title: 'Ошибка TTS',
                    message: messageData.message
                });
                return;
            }
            
            // Фильтруем и добавляем только сообщения чата
            console.log('🔍 Checking message type:', messageData.type, 'Condition:', messageData.type === 'chat_message' || !messageData.type);
            if (messageData.type === 'chat_message' || !messageData.type) {
                 // Добавляем уникальный ID на фронтенде для React key
                messageData.id = Date.now() + Math.random();
                console.log('📩 Chat message received:', {
                    platform: messageData.platform,
                    author: messageData.author_name || messageData.author,
                    content: messageData.content || messageData.message
                });
                console.log('🔄 About to dispatch ADD_MESSAGE...');
                console.log('📝 Dispatching ADD_MESSAGE action');
                dispatchMessages({
                    type: 'ADD_MESSAGE',
                    payload: messageData
                });
                console.log('✅ ADD_MESSAGE dispatched successfully');
                
                // useReducer автоматически обновляет состояние
            } else {
                console.warn('⚠️ Message type not handled:', messageData.type);
            }
        };

        ws.onerror = (err) => {
            console.log("WebSocket connection error (это нормально, если сервер недоступен):", err.type || 'connection_failed');
            setIsConnecting(false);
            // Убираем error toast, чтобы не раздражать пользователя постоянными уведомлениями
            // setError("Ошибка WebSocket соединения. Попробуйте обновить страницу.");
        };

        ws.onclose = (event) => {
            console.log("WebSocket closed:", event.code, event.reason);
            
            // Очищаем ping интервал
            if (ws.pingInterval) {
                clearInterval(ws.pingInterval);
            }
            
            websocket.current = null;
            setIsConnected(false);
            setIsConnecting(false);
            
            // Попытка переподключения только если это не было намеренное закрытие
            // и пользователь все еще аутентифицирован
            if (event.code !== 1000 && isAuthenticated && user?.id && user?.id !== 'guest') {
                console.log("Attempting to reconnect WebSocket in 3 seconds...");
                setTimeout(() => {
                    if (!websocket.current && isAuthenticated && user?.id && user?.id !== 'guest') {
                        setupWebSocket();
                    }
                }, 3000);
            } else if (event.code === 1000) {
                console.log("WebSocket closed normally (code 1000)");
            }
        };

    }, [isAuthenticated, user?.id, addToast]);

    // ОТКЛЮЧЕНО: автоматическое переподключение при сворачивании/разворачивании браузера
    // WebSocket остается активным в фоне, переподключение только при явном обновлении страницы
    // useEffect(() => {
    //     const handleVisibilityChange = () => {
    //         if (document.visibilityState === 'visible') {
    //             // Браузер стал активным - проверяем соединение
    //             const needsReconnect = (!websocket.current || 
    //                 websocket.current.readyState === WebSocket.CLOSED || 
    //                 websocket.current.readyState === WebSocket.CLOSING) &&
    //                 isAuthenticated && user?.id && user?.id !== 'guest';
    //                 
    //             if (needsReconnect) {
    //                 console.log("🌅 Browser became visible, reconnecting WebSocket...");
    //                 setupWebSocket();
    //             }
    //         }
    //         // НЕ закрываем WebSocket при сворачивании - озвучка должна работать в фоне
    //     };

    //     document.addEventListener('visibilitychange', handleVisibilityChange);
    //     
    //     return () => {
    //         document.removeEventListener('visibilitychange', handleVisibilityChange);
    //     };
    // }, [isAuthenticated, user?.id, setupWebSocket]);

    // ОТКЛЮЧЕНО: автоматическое переподключение при фокусе окна
    // useEffect(() => {
    //     const handleFocus = () => {
    //         // Окно получило фокус - проверяем соединение
    //         const needsReconnect = (!websocket.current || 
    //             websocket.current.readyState === WebSocket.CLOSED || 
    //             websocket.current.readyState === WebSocket.CLOSING) &&
    //             isAuthenticated && user?.id && user?.id !== 'guest';
    //             
    //         if (needsReconnect) {
    //             console.log("🎯 Window focused, reconnecting WebSocket...");
    //             setupWebSocket();
    //         }
    //     };

    //     // НЕ закрываем WebSocket при потере фокуса - озвучка должна работать в фоне
    //     window.addEventListener('focus', handleFocus);
    //     
    //     return () => {
    //         window.removeEventListener('focus', handleFocus);
    //     };
    // }, [isAuthenticated, user?.id, setupWebSocket]);

    // Функция для закрытия WebSocket соединения
    const closeWebSocket = useCallback(() => {
        if (websocket.current) {
            console.log('🔌 Closing WebSocket connection');
            
            // Очищаем ping интервал
            if (websocket.current.pingInterval) {
                clearInterval(websocket.current.pingInterval);
            }
            
            // Предотвращаем реконнект
            websocket.current.onclose = null;
            websocket.current.onerror = null;
            
            // Закрываем только если соединение открыто или в процессе открытия
            if (websocket.current.readyState === WebSocket.OPEN || 
                websocket.current.readyState === WebSocket.CONNECTING) {
                websocket.current.close();
            }
            
            websocket.current = null;
            setIsConnected(false);
        }
    }, []);

    // Основной useEffect для управления соединением
    useEffect(() => {
        // Не делаем ничего, пока идет проверка авторизации
        if (isLoading) {
            console.log('⏳ Waiting for auth to complete...');
            return;
        }

        if (isAuthenticated && user?.id && user?.id !== 'guest') {
            console.log('👤 User authenticated, setting up WebSocket');
            setupWebSocket();
        } else {
            console.log('🚪 User not authenticated or is guest, closing WebSocket');
            closeWebSocket();
            dispatchMessages({ type: 'CLEAR_MESSAGES' });
        }

        return () => {
            console.log('🧹 Cleaning up WebSocket on unmount');
            closeWebSocket();
        };
    }, [isAuthenticated, user?.id, isLoading, setupWebSocket, closeWebSocket]);

    // useEffect для автоматического подключения/отключения бота
    useEffect(() => {
        const manageBotConnection = async () => {
            // Ждем загрузки интеграций
            if (integrationsLoading) {
                return;
            }

            const hasTwitch = integrations.twitch?.enabled;
            
            // Убираем автоматическое подключение бота
            // if (isAuthenticated && hasTwitch && !isConnected) {
            //     console.log("ChatContext: Twitch integration is active, attempting to auto-connect bot.");
            //     try {
            //         await api.post('/api/chat/connect');
            //         setIsConnected(true);
            //     } catch (err) {
            //         console.error("ChatContext: Failed to auto-connect bot.", err);
            //         setIsConnected(false);
            //     }
            // } else if ((!isAuthenticated || !hasTwitch) && isConnected) {
            //     console.log("ChatContext: User logged out or Twitch integration disabled, disconnecting bot.");
            //     try {
            //         await api.post('/api/chat/disconnect');
            //         setIsConnected(false);
            //     } catch (err) {
            //         console.error("ChatContext: Failed to auto-disconnect bot.", err);
            //     }
            // }
        };

        manageBotConnection();

    }, [isAuthenticated, integrations, integrationsLoading, isConnected]);


    // Функции управления ботом
    const handleBotAction = useCallback(async (action) => {
        if (!isAuthenticated) return;
        setIsConnecting(true);
        setError(null);
        try {
            await api.post(`/api/chat/${action}`);
            setIsConnected(action === 'connect');
            if (action === 'connect') {
                addToast({
                    type: 'success',
                    title: 'Бот подключен',
                    message: 'Вы успешно подключились к каналу.'
                });
            } else {
                addToast({
                    type: 'success',
                    title: 'Бот отключен',
                    message: 'Вы успешно отключились от канала.'
                });
                dispatchMessages({ type: 'CLEAR_MESSAGES' }); // Очищаем чат при отключении
            }
        } catch (error) {
            if (error.response) {
                console.error("Chat API error:", error.response.data);
                addToast({
                    type: 'error',
                    title: 'Ошибка чат-бота',
                    message: `Не удалось ${action === 'connect' ? 'подключиться к' : 'отключиться от'} канала: ${error.response.data.detail}`
                });
            } else {
                console.error("Chat connection error:", error);
                addToast({
                    type: 'error',
                    title: 'Ошибка сети',
                    message: 'Проверьте ваше интернет-соединение.'
                });
            }
        } finally {
            setIsConnecting(false);
        }
    }, [user, isAuthenticated, addToast, setIsConnecting, setIsConnected, dispatchMessages]);
    
    const connectBot = useCallback(() => handleBotAction('connect'), [handleBotAction]);

    const disconnect = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsConnecting(true);
        setError(null);
        try {
            await api.post('/api/chat/disconnect');
            setIsConnected(false);
            dispatchMessages({ type: 'CLEAR_MESSAGES' }); // Очищаем чат при отключении
        } catch (err) {
            console.error("Failed to disconnect bot:", err);
            setError(err.response?.data?.detail || "Не удалось отключить бота.");
        } finally {
            setIsConnecting(false);
        }
    }, [isAuthenticated]);
    
    const clearChat = () => {
        dispatchMessages({ type: 'CLEAR_MESSAGES' });
    };

    // Функция для отправки сообщения в чат
    const sendMessage = useCallback((message, platforms = []) => {
        if (!websocket.current || websocket.current.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }

        if (!message || !message.trim()) {
            throw new Error('Message is empty');
        }

        if (!platforms || platforms.length === 0) {
            throw new Error('No platforms specified');
        }

        // Отправляем сообщение через WebSocket
        websocket.current.send(JSON.stringify({
            type: 'send_message',
            message: message.trim(),
            platforms: platforms
        }));
    }, []);

    const value = {
        messages,
        lastJsonMessage, // <-- Добавлено
        isConnected,
        isConnecting,
        error,
        connect: connectBot,
        disconnect,
        clearChat,
        checkConnectionStatus,
        sendMessage, // <-- Добавлено
        // forceUpdate убран - useReducer автоматически обновляет состояние
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
