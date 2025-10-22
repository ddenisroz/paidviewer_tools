/**
 * Улучшенный хук для работы с WebSocket
 * Обеспечивает автоматическое переподключение, обработку ошибок и cleanup
 */
import { useEffect, useRef, useState, useCallback } from 'react';

import { getWebSocketBaseUrl } from '../utils/urlUtils';

const WS_BASE_URL = import.meta.env.VITE_BOT_SERVICE_WS_URL || getWebSocketBaseUrl();

// Глобальный счетчик попыток подключения для предотвращения перегрузки
let globalConnectionAttempts = 0;
const MAX_GLOBAL_ATTEMPTS = parseInt(import.meta.env.VITE_WS_MAX_GLOBAL_ATTEMPTS || '5', 10);
const RESET_INTERVAL_MS = parseInt(import.meta.env.VITE_WS_RESET_INTERVAL_MS || '30000', 10);

// Сброс глобального счетчика через заданный интервал
setInterval(() => {
  if (globalConnectionAttempts > 0) {
    console.log(`useWebSocket: Resetting global connection attempts counter (was ${globalConnectionAttempts})`);
    globalConnectionAttempts = 0;
  }
}, RESET_INTERVAL_MS);

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
    reconnectInterval = parseInt(import.meta.env.VITE_WS_RECONNECT_INTERVAL || '5000', 10),
    maxReconnectAttempts = parseInt(import.meta.env.VITE_WS_MAX_RECONNECT_ATTEMPTS || '5', 10),
    heartbeatInterval = parseInt(import.meta.env.VITE_WS_HEARTBEAT_INTERVAL || '30000', 10)
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
    if (!isMountedRef.current) {
      return;
    }
    
    // Если endpoint не задан, не подключаемся
    if (!endpoint) {
      return;
    }
    
    // Проверяем глобальный лимит попыток подключения
    if (globalConnectionAttempts >= MAX_GLOBAL_ATTEMPTS) {
      console.log(`useWebSocket: Global connection limit reached (${globalConnectionAttempts}/${MAX_GLOBAL_ATTEMPTS}), skipping`);
      return;
    }
    
    // Закрываем существующее соединение перед созданием нового
    if (wsRef.current) {
      console.log(`useWebSocket: Closing existing connection before creating new one. State: ${wsRef.current.readyState}`);
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (isConnecting) {
      console.log(`useWebSocket: Already connecting, skipping`);
      return;
    }

    globalConnectionAttempts++;
    setIsConnecting(true);
    setError(null);

    try {
      // Если endpoint уже содержит полный URL, используем его как есть
      // Иначе добавляем к базовому URL
      const url = endpoint.startsWith('ws://') || endpoint.startsWith('wss://') 
        ? endpoint 
        : `${WS_BASE_URL}${endpoint}`;
      const ws = new WebSocket(url);

      ws.onopen = (event) => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }

        globalConnectionAttempts = Math.max(0, globalConnectionAttempts - 1); // Уменьшаем счетчик при успехе
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
          
          // Игнорируем ping/pong сообщения (heartbeat)
          if (data.type === 'pong' || data.type === 'ping') {
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

        globalConnectionAttempts = Math.max(0, globalConnectionAttempts - 1); // Уменьшаем счетчик при ошибке
        const err = new Error('WebSocket connection error');
        setError(err);
        setIsConnecting(false);

        if (onError) {
          onError(err, event);
        }
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;

        // WebSocket closed
        setIsConnected(false);
        setIsConnecting(false);

        // Останавливаем heartbeat
        clearHeartbeat();

        if (onClose) {
          onClose(event);
        }

        // Автоматическое переподключение только если соединение не установлено
        if (autoReconnect && !isConnected && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const maxDelay = parseInt(import.meta.env.VITE_WS_MAX_RECONNECT_DELAY || '10000', 10);
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1), maxDelay); // Exponential backoff
          
          console.log(`useWebSocket: Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !isConnected) {
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
    // Отмечаем что компонент смонтирован
    isMountedRef.current = true;
    
    // Не подключаемся если endpoint null или уже подключены
    if (!endpoint || isConnected) {
      return;
    }
    
    if (autoConnect) {
      // Подключаемся сразу без задержки для первого подключения
      connect();
    }

    // Cleanup при unmount
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [endpoint]); // Убираем autoConnect и connect из зависимостей чтобы избежать пересоздания

  // Reconnect функция для ручного вызова
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    const initialDelay = parseInt(import.meta.env.VITE_WS_INITIAL_CONNECT_DELAY || '100', 10);
    setTimeout(connect, initialDelay);
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

