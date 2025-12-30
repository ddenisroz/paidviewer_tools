// src/hooks/useChatHistory.ts
/**
 * Хук для загрузки истории чата.
 * Отвечает за: загрузку истории из API, фильтрацию по платформам.
 */
import { useEffect, useRef } from 'react';

import { chatService } from '../services/api/services/chatService';
import { logger } from '../utils/prodLogger';

import type { PlatformFilter } from './useChatMessages';
import type { ChatMessage } from '../types/chat';

interface ApiResponse {
    success: boolean;
    messages: ChatMessage[];
}

interface IntegrationsState {
    twitch?: { enabled?: boolean };
    vk?: { enabled?: boolean };
}

interface UseChatHistoryOptions {
    isAuthenticated: boolean;
    isGuest: boolean;
    isConnected: boolean;
    integrationsLoading: boolean;
    integrations: IntegrationsState | null;
    historyLoaded: boolean;
    onHistoryLoaded: (messages: ChatMessage[], platformFilter?: PlatformFilter) => void;
}

export function useChatHistory({
    isAuthenticated,
    isGuest,
    isConnected,
    integrationsLoading,
    integrations,
    historyLoaded,
    onHistoryLoaded
}: UseChatHistoryOptions): void {
    const loadingRef = useRef<boolean>(false);

    useEffect(() => {
        const loadChatHistory = async (): Promise<void> => {
            // Skip if not authenticated/guest
            if (!isAuthenticated && !isGuest) return;
            if (integrationsLoading) return;
            if (historyLoaded) {
                logger.debug('[CHAT] History already loaded, skipping...');
                return;
            }
            if (loadingRef.current) return;

            // Wait for WebSocket connection
            const maxWaitTime = 2000;
            const checkInterval = 100;
            let elapsedTime = 0;

            while (elapsedTime < maxWaitTime && !historyLoaded) {
                if (isConnected) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                elapsedTime += checkInterval;
            }

            // Check again after waiting
            if (historyLoaded) {
                logger.debug('[CHAT] History already loaded via WebSocket, skipping API load...');
                return;
            }

            loadingRef.current = true;

            try {
                logger.info('[CHAT] Loading chat history from API (WebSocket fallback)...');
                const response = await chatService.getChatHistory({
                    limit: parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '200', 10)
                });

                const data = response.data as ApiResponse;
                if (data.success && data.messages && data.messages.length > 0) {
                    const platformFilter: PlatformFilter = {
                        twitch: integrations?.twitch?.enabled ?? true,
                        vk: integrations?.vk?.enabled ?? true
                    };

                    logger.info(`[CHAT] Loaded ${data.messages.length} messages from history (API fallback)`);
                    onHistoryLoaded(data.messages, platformFilter);
                } else {
                    logger.debug('[CHAT] No messages in history response');
                }
            } catch (error) {
                logger.error('Failed to load chat history:', error);
            } finally {
                loadingRef.current = false;
            }
        };

        loadChatHistory();
    }, [isAuthenticated, isGuest, integrationsLoading, isConnected, integrations, historyLoaded, onHistoryLoaded]);
}
