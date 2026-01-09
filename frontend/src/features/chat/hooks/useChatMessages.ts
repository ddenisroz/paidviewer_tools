// src/features/chat/hooks/useChatMessages.ts
/**
 * Хук для управления сообщениями чата.
 * Отвечает за: reducer, localStorage persistence, фильтрацию по платформам.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { logger } from '@/shared/utils/prodLogger';

import type { ChatMessage } from '@/types/chat';

type MessagesAction =
    | { type: 'ADD_MESSAGE'; payload: ChatMessage }
    | { type: 'CLEAR_MESSAGES' }
    | { type: 'SET_MESSAGES'; payload: ChatMessage[] };

const getMaxMessages = (): number => {
    return parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '200', 10);
};

const messagesReducer = (state: ChatMessage[], action: MessagesAction): ChatMessage[] => {
    const maxMessages = getMaxMessages();

    switch (action.type) {
        case 'ADD_MESSAGE': {
            const isDuplicate = state.some(msg =>
                msg.id === action.payload.id ||
                (msg.timestamp === action.payload.timestamp &&
                    msg.author === action.payload.author &&
                    (msg.content === action.payload.content || msg.message === action.payload.message))
            );

            if (isDuplicate) {
                return state;
            }

            return [...state, action.payload].slice(-maxMessages);
        }

        case 'CLEAR_MESSAGES':
            return [];

        case 'SET_MESSAGES':
            return action.payload.slice(-maxMessages);

        default:
            return state;
    }
};

const loadMessagesFromStorage = (): ChatMessage[] => {
    try {
        const maxMessages = getMaxMessages();
        const stored = localStorage.getItem('chat_messages');
        if (stored) {
            const parsed = JSON.parse(stored) as ChatMessage[];
            return parsed.slice(-maxMessages);
        }
    } catch (error) {
        logger.error('Error loading messages from storage:', error);
    }
    return [];
};

interface PlatformFilter {
    twitch?: boolean;
    vk?: boolean;
}

interface UseChatMessagesReturn {
    messages: ChatMessage[];
    addMessage: (message: ChatMessage, platformFilter?: PlatformFilter) => void;
    setMessages: (messages: ChatMessage[], platformFilter?: PlatformFilter) => void;
    clearMessages: () => void;
    historyLoaded: boolean;
    setHistoryLoaded: (loaded: boolean) => void;
}

export function useChatMessages(): UseChatMessagesReturn {
    const [messages, dispatch] = useReducer(messagesReducer, [], loadMessagesFromStorage);
    const historyLoadedRef = useRef<boolean>(false);

    // Persist messages to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            try {
                localStorage.setItem('chat_messages', JSON.stringify(messages));
            } catch (error) {
                logger.error('Error saving messages to storage:', error);
            }
        }
    }, [messages]);

    const filterByPlatform = useCallback((
        msgs: ChatMessage[],
        filter?: PlatformFilter
    ): ChatMessage[] => {
        if (!filter) return msgs;

        return msgs.filter(msg => {
            if (msg.platform === 'twitch' && filter.twitch === false) return false;
            if (msg.platform === 'vk' && filter.vk === false) return false;
            return true;
        });
    }, []);

    const addMessage = useCallback((message: ChatMessage, platformFilter?: PlatformFilter) => {
        // Check platform filter before adding
        if (platformFilter) {
            if (message.platform === 'twitch' && platformFilter.twitch === false) return;
            if (message.platform === 'vk' && platformFilter.vk === false) return;
        }
        dispatch({ type: 'ADD_MESSAGE', payload: message });
    }, []);

    const setMessages = useCallback((newMessages: ChatMessage[], platformFilter?: PlatformFilter) => {
        const filtered = filterByPlatform(newMessages, platformFilter);
        if (filtered.length > 0) {
            dispatch({ type: 'SET_MESSAGES', payload: filtered });
            historyLoadedRef.current = true;
        }
    }, [filterByPlatform]);

    const clearMessages = useCallback(() => {
        dispatch({ type: 'CLEAR_MESSAGES' });
        historyLoadedRef.current = false;
    }, []);

    const setHistoryLoaded = useCallback((loaded: boolean) => {
        historyLoadedRef.current = loaded;
    }, []);

    return {
        messages,
        addMessage,
        setMessages,
        clearMessages,
        historyLoaded: historyLoadedRef.current,
        setHistoryLoaded
    };
}

export type { MessagesAction, PlatformFilter };
