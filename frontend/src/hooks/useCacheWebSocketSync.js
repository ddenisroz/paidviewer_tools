// frontend/src/hooks/useCacheWebSocketSync.js
/**
 * Хук для синхронизации кэша через WebSocket
 * Слушает события cache_invalidate от сервера и инвалидирует локальный кэш
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import cacheManager from '../utils/cacheManager';
import Logger from '../utils/logger';

const logger = new Logger('CACHE_WS');

export const useCacheWebSocketSync = () => {
  const { user, isAuthenticated } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  useEffect(() => {
    // Только для аутентифицированных пользователей
    if (!isAuthenticated || !user?.id) {
      return;
    }

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/chat/${user.id}`;
        
        logger.debug('[CACHE_WS] Connecting to:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          logger.info('[CACHE_WS] Connected');
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Обработка cache_invalidate событий
            if (data.type === 'cache_invalidate') {
              logger.info(`[CACHE_WS] Received invalidation for: ${data.cache_key}`);
              
              // Находим соответствующий CACHE_CONFIG по ключу
              const { CACHE_CONFIG } = require('../utils/cacheManager');
              const cacheType = Object.values(CACHE_CONFIG).find(
                config => config.key === data.cache_key
              );
              
              if (cacheType) {
                cacheManager.invalidate(cacheType);
                logger.debug(`[CACHE_WS] Cache invalidated: ${data.cache_key}`);
              } else {
                logger.warn(`[CACHE_WS] Unknown cache key: ${data.cache_key}`);
              }
            }
          } catch (error) {
            logger.error('[CACHE_WS] Message parse error:', error);
          }
        };

        ws.onerror = (error) => {
          logger.error('[CACHE_WS] WebSocket error:', error);
        };

        ws.onclose = () => {
          logger.warn('[CACHE_WS] Disconnected');
          wsRef.current = null;

          // Переподключение с экспоненциальной задержкой
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            logger.debug(`[CACHE_WS] Reconnecting in ${delay}ms...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              connectWebSocket();
            }, delay);
          } else {
            logger.error('[CACHE_WS] Max reconnect attempts reached');
          }
        };
      } catch (error) {
        logger.error('[CACHE_WS] Connection error:', error);
      }
    };

    connectWebSocket();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id]);

  return null; // Хук не возвращает ничего, только side effects
};

export default useCacheWebSocketSync;

