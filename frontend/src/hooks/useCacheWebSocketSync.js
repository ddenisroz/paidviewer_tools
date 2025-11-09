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
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import cacheManager, { CACHE_CONFIG } from '../utils/cacheManager';
import useSharedWebSocket from './useSharedWebSocket';
import Logger from '../utils/prodLogger';

const logger = new Logger('CACHE_SYNC');

// Маппинг cache_key -> React Query queryKeys для инвалидации
const CACHE_KEY_TO_QUERY_KEYS = {
  'cache_user_settings': [['user-settings']],
  'cache_chatbox_settings': [['chatbox-settings']],
  'cache_integrations': [['integrations']],
  'cache_tts_voices': [['global-voices'], ['user-voices']],
  'cache_tts_status': [['tts-status']],
  'tts_settings': [['tts-settings']],
  'tts_audio_settings': [['tts-audio-settings']],
  'tts_platform_settings': [['tts-platform-settings']],
  'youtube_settings': [['youtube-settings']],
  'drops_config': [['drops-config']], // Будет заменено на конкретный ключ с channel_name и platform
};

// Функция для получения queryKeys по cache_key
const getQueryKeysForCacheKey = (cacheKey) => {
  // Прямое совпадение
  if (CACHE_KEY_TO_QUERY_KEYS[cacheKey]) {
    return CACHE_KEY_TO_QUERY_KEYS[cacheKey];
  }
  
  // Паттерн для drops_config_{channel}_{platform}
  if (cacheKey.startsWith('drops_config_')) {
    const parts = cacheKey.replace('drops_config_', '').split('_');
    if (parts.length >= 2) {
      const platform = parts.pop();
      const channelName = parts.join('_');
      return [['drops-config', channelName, platform]];
    }
    return [['drops-config']];
  }
  
  // Общие паттерны
  if (cacheKey.includes('tts')) {
    return [['tts-status'], ['tts-settings'], ['tts-audio-settings'], ['tts-platform-settings']];
  }
  
  if (cacheKey.includes('youtube')) {
    return [['youtube-queue'], ['youtube-settings']];
  }
  
  if (cacheKey.includes('drops')) {
    return [['drops-config'], ['drops-rewards'], ['drops-qualities']];
  }
  
  return [];
};

export const useCacheWebSocketSync = () => {
  const authContext = useAuth();
  const queryClient = useQueryClient();
  
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
        
        // 1. Инвалидируем cacheManager (localStorage кеш)
        const cacheType = Object.values(CACHE_CONFIG).find(
          config => config.key === data.cache_key
        );
        
        if (cacheType) {
          cacheManager.invalidate(cacheType);
          logger.debug(`[CACHE] CacheManager invalidated: ${data.cache_key}`);
        } else {
          logger.debug(`[CACHE] No CacheManager config for: ${data.cache_key}`);
        }
        
        // 2. Инвалидируем React Query кеш
        const queryKeys = getQueryKeysForCacheKey(data.cache_key);
        if (queryKeys.length > 0) {
          queryKeys.forEach(queryKey => {
            queryClient.invalidateQueries({ queryKey });
            logger.debug(`[CACHE] React Query invalidated: ${JSON.stringify(queryKey)}`);
          });
        } else {
          logger.warn(`[CACHE] No React Query keys mapped for: ${data.cache_key}`);
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

