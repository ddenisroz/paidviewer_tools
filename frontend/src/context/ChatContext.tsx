// src/context/ChatContext.tsx
/**
 * Контекст чата - композиция хуков для управления чатом.
 * 
 * Рефакторинг: логика разделена на отдельные хуки:
 * - useChatMessages: управление сообщениями (reducer, localStorage)
 * - useChatWebSocket: обработка WebSocket сообщений
 * - useBotConnection: подключение/отключение бота
 * - useChatHistory: загрузка истории чата
 * - useAudioUnlock: разблокировка аудио после user interaction
 */
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useToast } from '../components/ui/toast';
import { API_BASE_URL } from '../constants';
import { useAudioUnlock } from '../hooks/useAudioUnlock';
import { type BotStatusType, useBotConnection } from '../hooks/useBotConnection';
import { useChatHistory } from '../hooks/useChatHistory';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import useSharedWebSocket from '../hooks/useSharedWebSocket';
import { logger } from '../utils/prodLogger';

import { useAuth } from './AuthContext';
import { useIntegrations } from './IntegrationsContext';


// Import refactored hooks

import type { ChatMessage } from '../types/chat';

export type WebSocketMessage = Record<string, unknown>;

interface ChatContextValue {
    messages: ChatMessage[];
    lastJsonMessage: WebSocketMessage | null;
    isConnected: boolean;
    botStatus: BotStatusType;
    error: string | null;
    sendMessage: (message: string, platforms?: string[]) => void;
    connectBotToChannels: (platforms?: string[]) => Promise<void>;
    disconnectBotFromChannels: () => Promise<void>;
    getBotConnectionStatus: () => Promise<{ status: BotStatusType; [key: string]: unknown }>;
    clearMessages: () => void;
    setMessages: (messages: ChatMessage[]) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const useChat = (): ChatContextValue => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

interface ChatProviderProps {
    children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
    // Auth and integrations
    const { user, isAuthenticated, isGuest, isCheckingAuth } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { addToast: _addToast } = useToast();
    
    // State
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    
    // Audio unlock hook
    useAudioUnlock();
    
    // Messages hook
    const {
        messages,
        addMessage,
        setMessages: setMessagesInternal,
        clearMessages,
        historyLoaded,
        setHistoryLoaded
    } = useChatMessages();
    
    // Bot connection hook
    const {
        botStatus,
        setBotStatus,
        connectBotToChannels,
        disconnectBotFromChannels,
        getBotConnectionStatus
    } = useBotConnection({
        isAuthenticated: !!isAuthenticated,
        isCheckingAuth: isCheckingAuth ?? false
    });
    
    // WebSocket message handler hook
    const { lastJsonMessage, handleWebSocketMessage } = useChatWebSocket({
        integrations,
        onMessage: addMessage,
        onHistoryLoaded: (msgs, filter) => {
            setMessagesInternal(msgs, filter);
            setHistoryLoaded(true);
        },
        onBotStatusChange: setBotStatus,
        onError: setError
    });
    
    // User ID for WebSocket
    const userId: number | string | undefined = isGuest 
        ? (user as { session_id?: string })?.session_id 
        : user?.id;
    
    // WebSocket connection
    const { send: wsSendMessage } = useSharedWebSocket(
        userId, 
        handleWebSocketMessage as (message: Record<string, unknown>) => void
    );
    
    // Connection status
    useEffect(() => {
        setIsConnected(!!(userId && (isAuthenticated || isGuest)));
    }, [userId, isAuthenticated, isGuest]);
    
    // Chat history loading
    useChatHistory({
        isAuthenticated: !!isAuthenticated,
        isGuest: !!isGuest,
        isConnected,
        integrationsLoading,
        integrations,
        historyLoaded,
        onHistoryLoaded: (msgs, filter) => {
            setMessagesInternal(msgs, filter);
            setHistoryLoaded(true);
        }
    });
    
    // Clear messages on logout
    useEffect(() => {
        if (!isAuthenticated) {
            clearMessages();
        }
    }, [isAuthenticated, clearMessages]);

    // Send message function
    const sendMessage = useCallback((message: string, platforms: string[] = []): void => {
        if (!isConnected) {
            throw new Error('WebSocket not connected');
        }
        if (!message || !message.trim()) {
            throw new Error('Message cannot be empty');
        }
        if (!platforms || platforms.length === 0) {
            throw new Error('No platforms specified');
        }

        wsSendMessage({
            type: 'send_message',
            message: message.trim(),
            platforms: platforms
        });
    }, [isConnected, wsSendMessage]);

    // Public setMessages wrapper
    const setMessages = useCallback((newMessages: ChatMessage[]): void => {
        setMessagesInternal(newMessages);
    }, [setMessagesInternal]);

    // Context value
    const value = useMemo<ChatContextValue>(() => {
        if (!API_BASE_URL) {
            logger.error('VITE_BOT_SERVICE_URL environment variable is required');
            return {
                messages: [],
                lastJsonMessage: null,
                isConnected: false,
                botStatus: 'disconnected' as BotStatusType,
                error: 'Ошибка конфигурации: отсутствует URL сервиса',
                sendMessage: () => {},
                connectBotToChannels: async () => {},
                disconnectBotFromChannels: async () => {},
                getBotConnectionStatus: async () => ({ status: 'disconnected' as BotStatusType }),
                clearMessages: () => {},
                setMessages: () => {}
            };
        }
        
        return {
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
            setMessages
        };
    }, [
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
        setMessages
    ]);

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
