// frontend/src/hooks/useCacheWebSocketSync.js
/**
 * 🔄 Хук для синхронизации кэша через SharedWebSocket (BroadcastChannel)
 * 
 * ❌ БОЛЬШЕ НЕ СОЗДАЁТ СВОЙ WebSocket!
 * ✅ Использует SharedWebSocketManager через BroadcastChannel
 * 
 * Слушает события cache_invalidate от сервера и инвалидирует локальный кэш
 */

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import cacheManager from '../utils/cacheManager';
import useSharedWebSocket from './useSharedWebSocket';
import Logger from '../utils/logger';

const logger = new Logger('CACHE_SYNC');

export const useCacheWebSocketSync = () => {
  const authContext = useAuth();
  
  // Проверяем, что контекст доступен
  if (!authContext) {
    return;
  }
  
  const { user, isAuthenticated } = authContext;
  const userId = user?.id;

  // 🔌 Подключаемся к SharedWebSocket (если userId есть)
  const handleWebSocketMessage = (data) => {
    try {
      // Обработка cache_invalidate событий
      if (data.type === 'cache_invalidate') {
        logger.info(`[CACHE] Received invalidation for: ${data.cache_key}`);
        
        // Находим соответствующий CACHE_CONFIG по ключу
        const { CACHE_CONFIG } = require('../utils/cacheManager');
        const cacheType = Object.values(CACHE_CONFIG).find(
          config => config.key === data.cache_key
        );
        
        if (cacheType) {
          cacheManager.invalidate(cacheType);
          logger.debug(`[CACHE] Cache invalidated: ${data.cache_key}`);
        } else {
          logger.warn(`[CACHE] Unknown cache key: ${data.cache_key}`);
        }
      }
    } catch (error) {
      logger.error('[CACHE] Message parse error:', error);
    }
  };

  // ✅ Используем SharedWebSocket вместо создания собственного
  useSharedWebSocket(
    isAuthenticated && userId ? userId : null,
    handleWebSocketMessage
  );

  // 🧹 Больше нет manual cleanup - SharedWebSocket сам управляет подключением
  return null;
};

export default useCacheWebSocketSync;

