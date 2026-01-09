// src/shared/hooks/useCacheWebSocketSync.ts
/**
 * Hook to sync React Query cache with WebSocket updates.
 * Listens for invalidation/update messages from the server.
 */

import { useCallback, useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { logger } from '@/shared/utils/prodLogger';
import { getSharedWebSocket } from '@/shared/utils/sharedWebSocket';

interface WebSocketMessage {
    type: string;
    data?: unknown;
    queryKey?: string[];
}

/**
 * Hook to sync React Query cache with WebSocket messages.
 * @param userId - User ID for WebSocket connection (pass from component)
 */
export const useCacheWebSocketSync = (userId?: string | number) => {
    const queryClient = useQueryClient();

    const handleMessage = useCallback((message: unknown) => {
        const msg = message as WebSocketMessage;

        if (msg?.type === 'invalidate' && msg.queryKey) {
            logger.debug('[CacheSync] Invalidating query:', msg.queryKey);
            queryClient.invalidateQueries({ queryKey: msg.queryKey });
        } else if (msg?.type === 'update' && msg.queryKey && msg.data) {
            logger.debug('[CacheSync] Updating query:', msg.queryKey);
            queryClient.setQueryData(msg.queryKey, msg.data);
        }
    }, [queryClient]);

    useEffect(() => {
        if (!userId) return;

        const wsManager = getSharedWebSocket(userId);
        wsManager.addMessageHandler(handleMessage as (message: Record<string, unknown>) => void);

        return () => {
            wsManager.removeMessageHandler(handleMessage as (message: Record<string, unknown>) => void);
        };
    }, [userId, handleMessage]);

    return {
        invalidateQuery: useCallback((queryKey: string[]) => {
            queryClient.invalidateQueries({ queryKey });
        }, [queryClient]),
    };
};

export default useCacheWebSocketSync;
