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

  const handleWebSocketMessage = useCallback(
    (message: Record<string, unknown>) => {
      const wsMessage = message as { type?: string; data?: Record<string, unknown>; platform?: string };
      const { type, data } = wsMessage;

      if (!type) return;

      logger.debug('WebSocket message received:', { type, data });

      switch (type) {
        // Settings updates
        case 'settings_updated':
          if (!data) break;
          queryClient.setQueryData(queryKeys.userSettings.settings(), (old: ApiResponse | undefined) => {
            const settingsData = data.settings as Record<string, unknown>;
            return {
              ...old,
              ...settingsData,
            };
          });
          if (showNotifications) {
            toast.info('Настройки обновлены');
          }
          break;

        // TTS settings updates
        case 'tts_settings_updated':
          if (!data) break;
          queryClient.setQueryData(queryKeys.tts.settings(), (old: ApiResponse | undefined) => {
            const settingsData = data.settings as Record<string, unknown>;
            return {
              ...old,
              data: {
                ...(old?.data as Record<string, unknown> || {}),
                ...settingsData,
              },
            };
          });
          if (showNotifications) {
            toast.info('Настройки TTS обновлены');
          }
          break;

        // TTS status updates
        case 'tts_status_changed':
          if (!data) break;
          queryClient.setQueryData(queryKeys.tts.status(null), (old: ApiResponse | undefined) => {
            return {
              ...old,
              data: {
                ...(old?.data as Record<string, unknown> || {}),
                enabled: data.enabled,
              },
            };
          });
          break;

        // Stream info updates
        case 'stream_info_updated':
          if (!data) break;
          if (data.platform === 'twitch') {
            queryClient.setQueryData(queryKeys.stream.twitchInfo(), (old: ApiResponse | undefined) => {
              const streamInfo = data.stream_info as Record<string, unknown>;
              return {
                ...old,
                data: {
                  ...(old?.data as Record<string, unknown> || {}),
                  ...streamInfo,
                },
              };
            });
          } else if (data.platform === 'vk') {
            queryClient.setQueryData(queryKeys.stream.vkInfo(), (old: ApiResponse | undefined) => {
              const streamInfo = data.stream_info as Record<string, unknown>;
              return {
                ...old,
                data: {
                  ...(old?.data as Record<string, unknown> || {}),
                  ...streamInfo,
                },
              };
            });
          }
          if (showNotifications) {
            toast.info('Информация о стриме обновлена');
          }
          break;

        // YouTube queue updates
        case 'youtube_queue_updated':
          queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
          break;

        // Points/rewards updates
        case 'points_updated':
          queryClient.invalidateQueries({ queryKey: queryKeys.points.all });
          break;

        // Drops updates
        case 'drops_result':
          queryClient.invalidateQueries({ queryKey: queryKeys.drops.all });
          break;

        // Chat messages (handled by ChatContext)
        case 'chat_message':
          // Let ChatContext handle this
          break;

        // State reconciliation required
        case 'state_reconciliation_required':
          logger.info('State reconciliation triggered by WebSocket');
          // Invalidate all queries to force refetch
          queryClient.invalidateQueries();
          break;

        // Custom handlers
        default:
          if (customHandlers[type] && data) {
            customHandlers[type](data);
          } else {
            logger.debug('Unhandled WebSocket message type:', type);
          }
      }
    },
    [queryClient, showNotifications, customHandlers]
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
