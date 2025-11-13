import { useEffect, useCallback, useRef } from 'react';
import { getSharedWebSocket } from '../utils/sharedWebSocket';
import Logger from '../utils/prodLogger';

const logger = new Logger('USE_SHARED_WS');

export const useSharedWebSocket = (
  userId: string | number | null | undefined,
  onMessage: ((message: any) => void) | null | undefined
): { send: (data: any) => void } => {
  const wsManagerRef = useRef<ReturnType<typeof getSharedWebSocket> | null>(null);
  const onMessageRef = useRef<typeof onMessage>(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const handleMessage = useCallback((message: any) => {
    if (onMessageRef.current) {
      onMessageRef.current(message);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      logger.warn('No userId provided, skipping WebSocket initialization');
      return;
    }
    logger.debug(`[HOOK] Requesting shared WebSocket for user ${userId}`);
    wsManagerRef.current = getSharedWebSocket(userId);
    wsManagerRef.current.addMessageHandler(handleMessage as any);
    logger.debug(`[HOOK] Message handler registered for user ${userId}`);
    return () => {
      if (wsManagerRef.current) {
        logger.debug(`[HOOK] Removing message handler for user ${userId}`);
        wsManagerRef.current.removeMessageHandler(handleMessage as any);
      }
    };
  }, [userId, handleMessage]);

  const send = useCallback((data: any) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.send(data);
    }
  }, []);

  return { send };
};

export default useSharedWebSocket;


