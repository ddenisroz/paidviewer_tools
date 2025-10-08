/**
 * Улучшенный хук для работы с WebSocket
 * Обеспечивает автоматическое переподключение, обработку ошибок и cleanup
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE_URL = import.meta.env.VITE_BOT_SERVICE_WS_URL || 'ws://localhost:8000';

/**
 * @typedef {Object} WebSocketState
 * @property {WebSocket|null} socket - WebSocket instance
 * @property {boolean} isConnected - Подключен ли WebSocket
 * @property {boolean} isConnecting - Идет ли подключение
 * @property {Error|null} error - Ошибка если есть
 */

/**
 * Хук для работы с WebSocket с автоматическим переподключением
 * 
 * @param {string} endpoint - WebSocket endpoint
 * @param {Object} options - Опции
 * @param {Function} options.onMessage - Callback для входящих сообщений
 * @param {Function} options.onOpen - Callback при открытии соединения
 * @param {Function} options.onClose - Callback при закрытии соединения
 * @param {Function} options.onError - Callback при ошибке
 * @param {boolean} options.autoConnect - Автоматически подключаться
 * @param {boolean} options.autoReconnect - Автоматически переподключаться
 * @param {number} options.reconnectInterval - Интервал переподключения (мс)
 * @param {number} options.maxReconnectAttempts - Макс. количество попыток переподключения
 * @param {number} options.heartbeatInterval - Интервал heartbeat (мс, 0 = отключено)
 * @returns {Object} WebSocket состояние и функции управления
 */
export function useWebSocket(endpoint, options = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    autoConnect = true,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Очистка heartbeat
  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Запуск heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval > 0) {
      clearHeartbeat();
      heartbeatIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          } catch (err) {
            console.error('Heartbeat send error:', err);
          }
        }
      }, heartbeatInterval);
    }
  }, [heartbeatInterval, clearHeartbeat]);

  // Отправка сообщения
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const data = typeof message === 'string' ? message : JSON.stringify(message);
        wsRef.current.send(data);
        return true;
      } catch (err) {
        console.error('WebSocket send error:', err);
        setError(err);
        return false;
      }
    } else {
      console.warn('WebSocket is not connected');
      return false;
    }
  }, []);

  // Закрытие соединения
  const disconnect = useCallback(() => {
    // Отменяем попытки переподключения
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Останавливаем heartbeat
    clearHeartbeat();

    // Закрываем WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, [clearHeartbeat]);

  // Подключение
  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Если уже подключены или подключаемся, ничего не делаем
    if (wsRef.current && (
      wsRef.current.readyState === WebSocket.OPEN ||
      wsRef.current.readyState === WebSocket.CONNECTING
    )) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const url = `${WS_BASE_URL}${endpoint}`;
      const ws = new WebSocket(url);

      ws.onopen = (event) => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }

        console.log(`WebSocket connected: ${endpoint}`);
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Запускаем heartbeat
        startHeartbeat();

        if (onOpen) {
          onOpen(event);
        }
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          
          // Игнорируем pong сообщения
          if (data.type === 'pong') {
            return;
          }

          if (onMessage) {
            onMessage(data, event);
          }
        } catch (err) {
          // Если не JSON, передаем как есть
          if (onMessage) {
            onMessage(event.data, event);
          }
        }
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;

        console.error(`WebSocket error: ${endpoint}`, event);
        const err = new Error('WebSocket connection error');
        setError(err);
        setIsConnecting(false);

        if (onError) {
          onError(err, event);
        }
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;

        console.log(`WebSocket closed: ${endpoint}`, event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);

        // Останавливаем heartbeat
        clearHeartbeat();

        if (onClose) {
          onClose(event);
        }

        // Автоматическое переподключение
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = reconnectInterval * reconnectAttemptsRef.current;
          
          console.log(
            `WebSocket reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          const err = new Error('Max reconnection attempts reached');
          setError(err);
          if (onError) {
            onError(err);
          }
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error(`WebSocket connection failed: ${endpoint}`, err);
      setError(err);
      setIsConnecting(false);

      if (onError) {
        onError(err);
      }
    }
  }, [
    endpoint,
    autoReconnect,
    reconnectInterval,
    maxReconnectAttempts,
    onOpen,
    onMessage,
    onClose,
    onError,
    startHeartbeat,
    clearHeartbeat
  ]);

  // Автоматическое подключение при монтировании
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup при unmount
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect функция для ручного вызова
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    sendMessage,
    connect,
    disconnect,
    reconnect
  };
}

export default useWebSocket;

