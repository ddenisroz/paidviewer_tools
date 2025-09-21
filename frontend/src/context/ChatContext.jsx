// src/context/ChatContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { connectBot, disconnectBot, getBotStatus } from '../services/microservices';
import { AuthContext, useAuth } from './AuthContext';
import { toast } from 'sonner';
import { useIntegrations } from './IntegrationsContext';
import api from '../services/api';

const ChatContext = createContext();

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

export const ChatProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { integrations, loading: integrationsLoading } = useIntegrations();
    const [messages, setMessages] = useState([]);
    const [lastJsonMessage, setLastJsonMessage] = useState(null); // <-- Добавлено
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);
    
    const websocket = useRef(null);

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
        if (!isAuthenticated || !user?.id || user?.id === 'guest' || websocket.current) return;

        const baseWsUrl = import.meta.env.VITE_BOT_WS_URL || 'ws://localhost:8000/ws';
        const wsUrl = `${baseWsUrl}/chat/${user.id}`;
        
        console.log(`Attempting to connect WebSocket to ${wsUrl}`);
        
        const ws = new WebSocket(wsUrl);
        websocket.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connection established");
            setError(null);
        };

        ws.onmessage = (event) => {
            console.log("WebSocket message received:", event.data);
            const messageData = JSON.parse(event.data);
            setLastJsonMessage(messageData); // <-- Добавлено: сохраняем все сообщение
            
            // Обрабатываем TTS ошибки
            if (messageData.type === 'tts_error') {
                console.error('TTS Error:', messageData.message);
                // Показываем красивое уведомление об ошибке
                toast.error(messageData.message);
                return;
            }
            
            // Фильтруем и добавляем только сообщения чата
            if (messageData.type === 'chat_message' || !messageData.type) {
                 // Добавляем уникальный ID на фронтенде для React key
                messageData.id = Date.now() + Math.random(); 
                setMessages(prev => [messageData, ...prev.slice(0, 199)]); // Храним до 200 сообщений
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            setError("Ошибка WebSocket соединения. Попробуйте обновить страницу.");
        };

        ws.onclose = () => {
            console.log("WebSocket connection closed");
            websocket.current = null;
            // Попытка переподключения через 5 секунд
            setTimeout(setupWebSocket, 5000); 
        };

    }, [isAuthenticated, user?.id]);

    // Функция для закрытия WebSocket соединения
    const closeWebSocket = () => {
        if (websocket.current) {
            websocket.current.onclose = null; // Предотвращаем реконнект
            websocket.current.close();
            websocket.current = null;
        }
    };

    // Основной useEffect для управления соединением
    useEffect(() => {
        console.log(`ChatContext: useEffect triggered - isAuthenticated: ${isAuthenticated}, user: ${user?.username || 'none'}, user.id: ${user?.id}`);
        
        if (isAuthenticated && user?.id && user?.id !== 'guest') {
            console.log("ChatContext: Setting up WebSocket for authenticated user");
            setupWebSocket();
        } else {
            console.log("ChatContext: Closing WebSocket - not authenticated, no user, or guest mode");
            closeWebSocket();
            setIsConnected(false);
            setMessages([]);
        }

        return () => {
            closeWebSocket();
        };
    }, [isAuthenticated, user, setupWebSocket]);

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
    const connect = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsConnecting(true);
        setError(null);
        try {
            await api.post('/api/chat/connect');
            setIsConnected(true);
        } catch (err) {
            const errorMsg = err.response?.data?.detail || "Не удалось подключить бота.";
            console.error("Failed to connect bot:", err);
            setError(errorMsg);
            setIsConnected(false);
            throw err; // Пробрасываем ошибку дальше
        } finally {
            setIsConnecting(false);
        }
    }, [isAuthenticated]);

    const disconnect = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsConnecting(true);
        setError(null);
        try {
            await api.post('/api/chat/disconnect');
            setIsConnected(false);
            setMessages([]); // Очищаем чат при отключении
        } catch (err) {
            console.error("Failed to disconnect bot:", err);
            setError(err.response?.data?.detail || "Не удалось отключить бота.");
        } finally {
            setIsConnecting(false);
        }
    }, [isAuthenticated]);
    
    const clearChat = () => {
        setMessages([]);
    };

    const value = {
        messages,
        lastJsonMessage, // <-- Добавлено
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect,
        clearChat,
        checkConnectionStatus,
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
