import { useCallback, useEffect, useRef } from 'react';

import Logger from '@/shared/utils/prodLogger';
import { getSharedWebSocket } from '@/shared/utils/sharedWebSocket';

type MessageHandler = (message: Record<string, unknown>) => void;

const logger = new Logger('USE_SHARED_WS');

export const useSharedWebSocket = (
    userId: string | number | null | undefined,
    onMessage: MessageHandler | null | undefined
): { send: (data: Record<string, unknown>) => void } => {
    const wsManagerRef = useRef<ReturnType<typeof getSharedWebSocket> | null>(null);
    const onMessageRef = useRef<MessageHandler | null | undefined>(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const handleMessage = useCallback((message: Record<string, unknown>) => {
        if (onMessageRef.current) {
            onMessageRef.current(message);
        }
    }, []);

    useEffect(() => {
        if (!userId) {
            // Не логируем - это нормально при logout
            return;
        }
        logger.debug(`[HOOK] Requesting shared WebSocket for user ${userId}`);
        wsManagerRef.current = getSharedWebSocket(userId);
        wsManagerRef.current.addMessageHandler(handleMessage);
        logger.debug(`[HOOK] Message handler registered for user ${userId}`);
        return () => {
            if (wsManagerRef.current) {
                logger.debug(`[HOOK] Removing message handler for user ${userId}`);
                wsManagerRef.current.removeMessageHandler(handleMessage);
            }
        };
    }, [userId, handleMessage]);

    const send = useCallback((data: Record<string, unknown>) => {
        if (wsManagerRef.current) {
            wsManagerRef.current.send(data);
        }
    }, []);

    return { send };
};

export default useSharedWebSocket;
