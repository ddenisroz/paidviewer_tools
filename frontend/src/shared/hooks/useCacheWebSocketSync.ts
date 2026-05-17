// src/shared/hooks/useCacheWebSocketSync.ts
/**
 * Hook to sync React Query cache with WebSocket updates.
 * Listens for invalidation/update messages from the server.
 */

import { useCallback, useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/queries/queryKeys';
import { logger } from '@/shared/utils/prodLogger';
import { getSharedWebSocket } from '@/shared/utils/sharedWebSocket';

interface WebSocketMessage {
    type: string;
    data?: Record<string, unknown>;
    queryKey?: string[];
    platform?: 'twitch' | 'vk';
}

/**
 * Hook to sync React Query cache with WebSocket messages.
 * @param userId - User ID for WebSocket connection (pass from component)
 */
export const useCacheWebSocketSync = (userId?: string | number) => {
    const queryClient = useQueryClient();

    const handleMessage = useCallback(
        (message: unknown) => {
            const msg = message as WebSocketMessage;

            if (msg?.type === 'invalidate' && msg.queryKey) {
                logger.debug('[CacheSync] Invalidating query:', msg.queryKey);
                queryClient.invalidateQueries({ queryKey: msg.queryKey });
            } else if (msg?.type === 'update' && msg.queryKey && msg.data) {
                logger.debug('[CacheSync] Updating query:', msg.queryKey);
                queryClient.setQueryData(msg.queryKey, msg.data);
            } else if (msg?.type === 'stream_info_updated') {
                const payload = msg.data || {};
                const platform = (payload.platform || msg.platform) as 'twitch' | 'vk' | undefined;
                const streamInfo = payload.stream_info as Record<string, unknown> | undefined;

                if (platform === 'twitch') {
                    if (streamInfo) {
                        queryClient.setQueryData(
                            queryKeys.stream.twitchInfo(),
                            (old: Record<string, unknown> | undefined) => ({
                                ...(old || {}),
                                data: {
                                    ...((old as { data?: Record<string, unknown> } | undefined)?.data || {}),
                                    ...streamInfo,
                                },
                            })
                        );
                    }
                    queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
                } else if (platform === 'vk') {
                    if (streamInfo) {
                        queryClient.setQueryData(
                            queryKeys.stream.vkInfo(),
                            (old: Record<string, unknown> | undefined) => ({
                                ...(old || {}),
                                data: {
                                    ...((old as { data?: Record<string, unknown> } | undefined)?.data || {}),
                                    ...streamInfo,
                                },
                            })
                        );
                    }
                    queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
                } else {
                    queryClient.invalidateQueries({ queryKey: queryKeys.stream.all });
                }
            }
        },
        [queryClient]
    );

    useEffect(() => {
        if (!userId) return;

        const wsManager = getSharedWebSocket(userId);
        wsManager.addMessageHandler(handleMessage as (message: Record<string, unknown>) => void);

        return () => {
            wsManager.removeMessageHandler(handleMessage as (message: Record<string, unknown>) => void);
        };
    }, [userId, handleMessage]);

    return {
        invalidateQuery: useCallback(
            (queryKey: string[]) => {
                queryClient.invalidateQueries({ queryKey });
            },
            [queryClient]
        ),
    };
};

export default useCacheWebSocketSync;
