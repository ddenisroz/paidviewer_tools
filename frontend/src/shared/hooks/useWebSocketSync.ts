import { useCallback, useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '@/queries/queryKeys';
import { logger } from '@/shared/utils/prodLogger';
import { getSharedWebSocket } from '@/shared/utils/sharedWebSocket';

import type { ApiResponse } from '@/types/api';

interface WebSocketSyncOptions {
    /**
     * User ID for WebSocket connection
     */
    userId: string | number;

    /**
     * Whether to show toast notifications for updates (default: false)
     */
    showNotifications?: boolean;

    /**
     * Custom message handlers for specific event types
     */
    customHandlers?: Record<string, (data: Record<string, unknown>) => void>;
}

export const useWebSocketSync = (options: WebSocketSyncOptions) => {
    const { userId, showNotifications = false, customHandlers = {} } = options;
    const queryClient = useQueryClient();
    const reconciliationKeys = [
        queryKeys.userSettings.all,
        queryKeys.stream.all,
        queryKeys.youtube.all,
        queryKeys.tts.all,
        queryKeys.chat.all,
        queryKeys.drops.all,
        queryKeys.integrations.all,
    ] as const;

    const handleMessageByType = useCallback(
        (type: string, data: Record<string, unknown> | undefined) => {
            // Settings updates
            if (type === 'settings_updated' && data) {
                queryClient.setQueryData(queryKeys.userSettings.settings(), (old: ApiResponse | undefined) => ({
                    ...old,
                    ...(data.settings as Record<string, unknown>),
                }));
                if (showNotifications) toast.info('Настройки обновлены');
                return;
            }

            // TTS settings updates
            if (type === 'tts_settings_updated' && data) {
                queryClient.setQueryData(queryKeys.tts.settings(), (old: ApiResponse | undefined) => ({
                    ...old,
                    data: {
                        ...((old?.data as Record<string, unknown>) || {}),
                        ...(data.settings as Record<string, unknown>),
                    },
                }));
                if (showNotifications) toast.info('Настройки TTS обновлены');
                return;
            }

            // TTS status updates
            if (type === 'tts_status_changed' && data) {
                queryClient.setQueryData(queryKeys.tts.status(null), (old: ApiResponse | undefined) => ({
                    ...old,
                    data: {
                        ...((old?.data as Record<string, unknown>) || {}),
                        enabled: data.enabled,
                    },
                }));
                return;
            }

            // Stream info updates
            if (type === 'stream_info_updated' && data) {
                if (data.platform === 'twitch') {
                    queryClient.setQueryData(queryKeys.stream.twitchInfo(), (old: ApiResponse | undefined) => ({
                        ...old,
                        data: {
                            ...((old?.data as Record<string, unknown>) || {}),
                            ...(data.stream_info as Record<string, unknown>),
                        },
                    }));
                } else if (data.platform === 'vk') {
                    queryClient.setQueryData(queryKeys.stream.vkInfo(), (old: ApiResponse | undefined) => ({
                        ...old,
                        data: {
                            ...((old?.data as Record<string, unknown>) || {}),
                            ...(data.stream_info as Record<string, unknown>),
                        },
                    }));
                }
                if (showNotifications) toast.info('Информация о стриме обновлена');
                return;
            }

            // Invalidations
            const invalidations: Record<string, { queryKey: readonly unknown[] }> = {
                youtube_queue_updated: { queryKey: queryKeys.youtube.queue() },
                points_updated: { queryKey: queryKeys.points.all },
                drops_result: { queryKey: queryKeys.drops.all },
                state_reconciliation_required: { queryKey: [] }, // Special case
            };

            if (invalidations[type]) {
                if (type === 'state_reconciliation_required') {
                    logger.info('State reconciliation triggered by WebSocket');
                    reconciliationKeys.forEach((queryKey) => {
                        void queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
                    });
                } else {
                    queryClient.invalidateQueries(invalidations[type]);
                }
                return;
            }

            if (type === 'chat_message') return; // Handled by ChatContext

            // Custom handlers
            if (customHandlers[type] && data) {
                customHandlers[type](data);
            } else {
                logger.debug('Unhandled WebSocket message type:', type);
            }
        },
        [customHandlers, queryClient, reconciliationKeys, showNotifications]
    );

    const handleWebSocketMessage = useCallback(
        (message: Record<string, unknown>) => {
            const { type, data, platform } = message as {
                type?: string;
                data?: Record<string, unknown>;
                platform?: string;
            };
            if (!type) return;

            // Normalize data if platform is outside data object
            const normalizedData = data || {};
            if (platform) {
                normalizedData.platform = platform;
            }

            logger.debug('WebSocket message received:', { type, data: normalizedData });
            handleMessageByType(type, normalizedData);
        },
        [handleMessageByType]
    );

    useEffect(() => {
        if (!userId) return;

        const ws = getSharedWebSocket(userId);
        ws.addMessageHandler(handleWebSocketMessage);

        return () => {
            ws.removeMessageHandler(handleWebSocketMessage);
        };
    }, [userId, handleWebSocketMessage]);

    return {
        // Expose WebSocket instance for sending messages
        send: useCallback(
            (data: Record<string, unknown>) => {
                const ws = getSharedWebSocket(userId);
                ws.send(data);
            },
            [userId]
        ),
    };
};

/**
 * Hook to broadcast setting changes via WebSocket
 */
export const useBroadcastSettingChange = (userId: string | number) => {
    const broadcastChange = useCallback(
        (settingType: string, settingData: Record<string, unknown>) => {
            const ws = getSharedWebSocket(userId);
            ws.send({
                type: 'setting_changed',
                setting_type: settingType,
                data: settingData,
            });
        },
        [userId]
    );

    return broadcastChange;
};

/**
 * Example usage:
 *
 * // In a component or context:
 * useWebSocketSync({
 *   userId: user.id,
 *   showNotifications: true,
 *   customHandlers: {
 *     'custom_event': (data) => {
 *       // Handle custom event
 *     }
 *   }
 * });
 *
 * // Broadcasting changes:
 * const broadcastChange = useBroadcastSettingChange(user.id);
 * broadcastChange('tts_settings', { enabled: true });
 */
