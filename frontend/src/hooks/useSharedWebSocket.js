// frontend/src/hooks/useSharedWebSocket.js
/**
 * React хук для использования Shared WebSocket
 * Автоматически управляет подключением и синхронизацией между вкладками
 */

import { useEffect, useCallback, useRef } from 'react';
import { getSharedWebSocket } from '../utils/sharedWebSocket';
import Logger from '../utils/prodLogger';

const logger = new Logger('USE_SHARED_WS');

export const useSharedWebSocket = (userId, onMessage) => {
    const wsManagerRef = useRef(null);
    const onMessageRef = useRef(onMessage);

    // Обновляем ref при изменении onMessage
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    // Обработчик сообщений
    const handleMessage = useCallback((message) => {
        if (onMessageRef.current) {
            onMessageRef.current(message);
        }
    }, []);

    // Инициализация
    useEffect(() => {
        if (!userId) {
            logger.warn('No userId provided, skipping WebSocket initialization');
            return;
        }

        logger.debug(`[HOOK] Requesting shared WebSocket for user ${userId}`);
        
        // 🔒 Получаем singleton instance (он сам инициализируется если нужно)
        wsManagerRef.current = getSharedWebSocket(userId);
        
        // ✅ Добавляем обработчик сообщений
        wsManagerRef.current.addMessageHandler(handleMessage);
        
        logger.debug(`[HOOK] Message handler registered for user ${userId}`);

        // 🧹 Cleanup при размонтировании - удаляем ТОЛЬКО обработчик
        return () => {
            if (wsManagerRef.current) {
                logger.debug(`[HOOK] Removing message handler for user ${userId}`);
                wsManagerRef.current.removeMessageHandler(handleMessage);
                // ❌ НЕ вызываем cleanup() - instance используется другими компонентами!
            }
        };
    }, [userId, handleMessage]);

    // Функция для отправки сообщений
    const send = useCallback((data) => {
        if (wsManagerRef.current) {
            wsManagerRef.current.send(data);
        }
    }, []);

    return { send };
};

export default useSharedWebSocket;

