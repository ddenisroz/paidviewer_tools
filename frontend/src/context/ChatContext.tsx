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
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useLocation } from 'react-router-dom';

import { type BotStatusType, useBotConnection } from '@/features/admin/hooks/useBotConnection';
import { isAdminPath } from '@/features/admin/utils/adminRoutes';
import { useChatHistory } from '@/features/chat/hooks/useChatHistory';
import { useChatMessages } from '@/features/chat/hooks/useChatMessages';
import { useChatWebSocket } from '@/features/chat/hooks/useChatWebSocket';
import { useToast } from '@/shared/components/ui/toast';
import { useAudioUnlock } from '@/shared/hooks/useAudioUnlock';
import useSharedWebSocket from '@/shared/hooks/useSharedWebSocket';

import { useAuth } from './AuthContext';
import { useIntegrations } from './IntegrationsContext';

// Import refactored hooks

import type { ChatMessage } from '@/types/chat';

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
    const { user, isAuthenticated, isCheckingAuth } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { addToast: _addToast } = useToast();
    const location = useLocation();

    const isBotStatusPage = location.pathname.startsWith('/dashboard/chat-analysis') || isAdminPath(location.pathname);
    const botStatusPollInterval = isBotStatusPage ? 30000 : 120000;
    const shouldLoadChatHistory = location.pathname.startsWith('/chat-window');
    const shouldUseSharedWebSocket =
        shouldLoadChatHistory ||
        isBotStatusPage ||
        location.pathname.startsWith('/dashboard/media') ||
        location.pathname.startsWith('/dashboard/tts') ||
        location.pathname.startsWith('/dashboard/points');

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
        setHistoryLoaded,
    } = useChatMessages();

    // Bot connection hook
    const { botStatus, setBotStatus, connectBotToChannels, disconnectBotFromChannels, getBotConnectionStatus } =
        useBotConnection({
            isAuthenticated: !!isAuthenticated,
            isCheckingAuth: isCheckingAuth ?? false,
            pollingInterval: botStatusPollInterval,
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
        onError: setError,
    });

    // User ID for WebSocket
    const userId: number | string | undefined = user?.id;

    // WebSocket connection
    const { send: wsSendMessage } = useSharedWebSocket(
        shouldUseSharedWebSocket ? userId : null,
        handleWebSocketMessage as (message: Record<string, unknown>) => void
    );

    // Connection status
    useEffect(() => {
        setIsConnected(!!(shouldUseSharedWebSocket && userId && isAuthenticated));
    }, [shouldUseSharedWebSocket, userId, isAuthenticated]);

    // Chat history loading
    useChatHistory({
        enabled: shouldLoadChatHistory,
        isAuthenticated: !!isAuthenticated,
        isConnected,
        integrationsLoading,
        integrations,
        historyLoaded,
        onHistoryLoaded: (msgs, filter) => {
            setMessagesInternal(msgs, filter);
            setHistoryLoaded(true);
        },
    });

    // Clear messages on logout
    useEffect(() => {
        if (!isAuthenticated) {
            clearMessages();
        }
    }, [isAuthenticated, clearMessages]);

    // Send message function
    const sendMessage = useCallback(
        (message: string, platforms: string[] = []): void => {
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
                platforms: platforms,
            });
        },
        [isConnected, wsSendMessage]
    );

    // Public setMessages wrapper
    const setMessages = useCallback(
        (newMessages: ChatMessage[]): void => {
            setMessagesInternal(newMessages);
        },
        [setMessagesInternal]
    );

    // Context value
    const value = useMemo<ChatContextValue>(() => {
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
            setMessages,
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
        setMessages,
    ]);

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
