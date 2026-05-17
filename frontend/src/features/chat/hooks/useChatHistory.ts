// src/features/chat/hooks/useChatHistory.ts
/**
 * Хук для загрузки истории чата.
 * Отвечает за: загрузку истории из API, фильтрацию по платформам.
 */
import { useEffect, useRef } from 'react';

import { chatService } from '@/services/api/services/chatService';
import { logger } from '@/shared/utils/prodLogger';

import type { PlatformFilter } from './useChatMessages';
import type { ChatMessage } from '@/types/chat';

interface ApiResponse {
    success: boolean;
    messages: ChatMessage[];
}

interface IntegrationsState {
    twitch?: { enabled?: boolean };
    vk?: { enabled?: boolean };
}

interface UseChatHistoryOptions {
    enabled: boolean;
    isAuthenticated: boolean;
    isConnected: boolean;
    integrationsLoading: boolean;
    integrations: IntegrationsState | null;
    historyLoaded: boolean;
    onHistoryLoaded: (messages: ChatMessage[], platformFilter?: PlatformFilter) => void;
}

export function useChatHistory({
    enabled,
    isAuthenticated,
    isConnected,
    integrationsLoading,
    integrations,
    historyLoaded,
    onHistoryLoaded,
}: UseChatHistoryOptions): void {
    const loadingRef = useRef<boolean>(false);
    // Track if we've already attempted to load history this session
    const hasAttemptedLoadRef = useRef<boolean>(false);
    // Stable ref for callback to prevent useEffect re-triggers
    const onHistoryLoadedRef = useRef(onHistoryLoaded);
    onHistoryLoadedRef.current = onHistoryLoaded;

    // IMPORTANT: Track historyLoaded in ref to avoid stale closure in async loop
    const historyLoadedRef = useRef(historyLoaded);
    historyLoadedRef.current = historyLoaded;

    useEffect(() => {
        const loadChatHistory = async (): Promise<void> => {
            if (!enabled) return;
            // Skip if not authenticated
            if (!isAuthenticated) return;
            if (integrationsLoading) return;
            if (historyLoadedRef.current) {
                logger.debug('[CHAT] History already loaded, skipping...');
                return;
            }
            // Skip if already loading or already attempted
            if (loadingRef.current) return;
            if (hasAttemptedLoadRef.current) {
                logger.debug('[CHAT] Already attempted to load history, skipping...');
                return;
            }

            // Wait for WebSocket connection
            const maxWaitTime = 2000;
            const checkInterval = 100;
            let elapsedTime = 0;

            // Use ref to check current value (not stale closure)
            while (elapsedTime < maxWaitTime && !historyLoadedRef.current) {
                if (isConnected) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, checkInterval));
                elapsedTime += checkInterval;
            }

            // Check again after waiting - use ref for real-time value
            if (historyLoadedRef.current) {
                logger.debug('[CHAT] History already loaded via WebSocket, skipping API load...');
                return;
            }

            loadingRef.current = true;
            hasAttemptedLoadRef.current = true;

            try {
                logger.info('[CHAT] Loading chat history from API (WebSocket fallback)...');
                const response = await chatService.getChatHistory({
                    limit: parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '200', 10),
                });

                const data = response.data as ApiResponse;
                if (data.success && data.messages && data.messages.length > 0) {
                    const platformFilter: PlatformFilter = {
                        twitch: integrations?.twitch?.enabled ?? true,
                        vk: integrations?.vk?.enabled ?? true,
                    };

                    logger.info(`[CHAT] Loaded ${data.messages.length} messages from history (API fallback)`);
                    onHistoryLoadedRef.current(data.messages, platformFilter);
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
        // Removed onHistoryLoaded from deps - using ref instead to prevent re-triggers
    }, [enabled, isAuthenticated, integrationsLoading, isConnected, integrations, historyLoaded]);
}
