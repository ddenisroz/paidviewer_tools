// frontend/src/store/useChatStore.ts
/**
 * Zustand store for chat state management.
 *
 * Manages:
 * - Chat messages
 * - Connection status
 * - Bot status
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { ChatMessage } from '@/types/chat';

export type BotStatusType = 'connected' | 'disconnected' | 'connecting' | 'error';

interface ChatState {
    // State
    messages: ChatMessage[];
    isConnected: boolean;
    botStatus: BotStatusType;
    error: string | null;
    historyLoaded: boolean;

    // Actions
    addMessage: (message: ChatMessage) => void;
    setMessages: (messages: ChatMessage[]) => void;
    clearMessages: () => void;
    setIsConnected: (connected: boolean) => void;
    setBotStatus: (status: BotStatusType) => void;
    setError: (error: string | null) => void;
    setHistoryLoaded: (loaded: boolean) => void;
    reset: () => void;
}

const MAX_MESSAGES = 500;

const initialState = {
    messages: [],
    isConnected: false,
    botStatus: 'disconnected' as BotStatusType,
    error: null,
    historyLoaded: false,
};

export const useChatStore = create<ChatState>()(
    devtools(
        (set, _get) => ({
            ...initialState,

            addMessage: (message) =>
                set((state) => {
                    const newMessages = [...state.messages, message];
                    // Limit messages to prevent memory issues
                    if (newMessages.length > MAX_MESSAGES) {
                        return { messages: newMessages.slice(-MAX_MESSAGES) };
                    }
                    return { messages: newMessages };
                }),

            setMessages: (messages) =>
                set({
                    messages: messages.slice(-MAX_MESSAGES),
                    historyLoaded: true,
                }),

            clearMessages: () => set({ messages: [], historyLoaded: false }),

            setIsConnected: (isConnected) => set({ isConnected }),

            setBotStatus: (botStatus) => set({ botStatus }),

            setError: (error) => set({ error }),

            setHistoryLoaded: (historyLoaded) => set({ historyLoaded }),

            reset: () => set(initialState),
        }),
        { name: 'ChatStore' }
    )
);

// Selector hooks
export const useChatMessages = () => useChatStore((state) => state.messages);
export const useChatConnectionStatus = () => useChatStore((state) => state.isConnected);
export const useBotStatus = () => useChatStore((state) => state.botStatus);
export const useChatError = () => useChatStore((state) => state.error);
