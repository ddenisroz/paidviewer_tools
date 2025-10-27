// frontend/src/hooks/useSharedWebSocket.js
/**
 * React хук для использования Shared WebSocket
 * Автоматически управляет подключением и синхронизацией между вкладками
 */

import { useEffect, useCallback, useRef } from 'react';
import { getSharedWebSocket } from '../utils/sharedWebSocket';
import Logger from '../utils/logger';

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

        logger.info(`Initializing shared WebSocket for user ${userId}`);
        
        // Получаем singleton instance
        wsManagerRef.current = getSharedWebSocket();
        
        // Инициализируем для данного пользователя
        wsManagerRef.current.init(userId);
        
        // Добавляем обработчик сообщений
        wsManagerRef.current.addMessageHandler(handleMessage);

        // Cleanup при размонтировании
        return () => {
            if (wsManagerRef.current) {
                wsManagerRef.current.removeMessageHandler(handleMessage);
                // Не вызываем cleanup() здесь, так как instance shared между компонентами
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

