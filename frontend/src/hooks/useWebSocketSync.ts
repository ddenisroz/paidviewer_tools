/**
 * useWebSocketSync - Hook for synchronizing state via WebSocket
 * 
 * Listens for WebSocket messages and updates React Query cache accordingly
 * Handles concurrent updates and prevents race conditions
 */
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSharedWebSocket } from '../utils/sharedWebSocket';
import { queryKeys } from '../queries/queryKeys';
import { logger } from '../utils/prodLogger';
import { toast } from 'sonner';

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
  customHandlers?: Record<string, (data: any) => void>;
}

export const useWebSocketSync = (options: WebSocketSyncOptions) => {
  const { userId, showNotifications = false, customHandlers = {} } = options;
  const queryClient = useQueryClient();

  const handleWebSocketMessage = useCallback(
    (message: any) => {
      const { type, data } = message;

      logger.debug('WebSocket message received:', { type, data });

      switch (type) {
        // Settings updates
        case 'settings_updated':
          queryClient.setQueryData(queryKeys.userSettings.settings(), (old: any) => ({
            ...old,
            ...data.settings,
          }));
          if (showNotifications) {
            toast.info('Настройки обновлены');
          }
          break;

        // TTS settings updates
        case 'tts_settings_updated':
          queryClient.setQueryData(queryKeys.tts.settings(), (old: any) => ({
            ...old,
            data: {
              ...(old?.data || {}),
              ...data.settings,
            },
          }));
          if (showNotifications) {
            toast.info('Настройки TTS обновлены');
          }
          break;

        // TTS status updates
        case 'tts_status_changed':
          queryClient.setQueryData(queryKeys.tts.status(null), (old: any) => ({
            ...old,
            data: {
              ...(old?.data || {}),
              enabled: data.enabled,
            },
          }));
          break;

        // Stream info updates
        case 'stream_info_updated':
          if (data.platform === 'twitch') {
            queryClient.setQueryData(queryKeys.stream.twitchInfo(), (old: any) => ({
              ...old,
              data: {
                ...(old?.data || {}),
                ...data.stream_info,
              },
            }));
          } else if (data.platform === 'vk') {
            queryClient.setQueryData(queryKeys.stream.vkInfo(), (old: any) => ({
              ...old,
              data: {
                ...(old?.data || {}),
                ...data.stream_info,
              },
            }));
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
          if (customHandlers[type]) {
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
      (data: any) => {
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
    (settingType: string, settingData: any) => {
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
