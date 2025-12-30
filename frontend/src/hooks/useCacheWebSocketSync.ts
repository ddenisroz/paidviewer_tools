import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import cacheManager, { CACHE_CONFIG, CacheConfigValue } from '../utils/cacheManager';
import Logger from '../utils/prodLogger';

import useSharedWebSocket from './useSharedWebSocket';

const logger = new Logger('CACHE_SYNC');

const CACHE_KEY_TO_QUERY_KEYS: Record<string, (unknown[])[]> = {
  cache_user_settings: [['user-settings']],
  cache_chatbox_settings: [['chatbox-settings']],
  cache_integrations: [['integrations']],
  cache_tts_voices: [['global-voices'], ['user-voices']],
  cache_tts_status: [['tts-status']],
  tts_settings: [['tts-settings']],
  tts_audio_settings: [['tts-audio-settings']],
  tts_platform_settings: [['tts-platform-settings']],
  youtube_settings: [['youtube-settings']],
  drops_config: [['drops-config']],
};

const getQueryKeysForCacheKey = (cacheKey: string): (unknown[])[] => {
  if (CACHE_KEY_TO_QUERY_KEYS[cacheKey]) {
    return CACHE_KEY_TO_QUERY_KEYS[cacheKey];
  }
  if (cacheKey.startsWith('drops_config_')) {
    const parts = cacheKey.replace('drops_config_', '').split('_');
    if (parts.length >= 2) {
      const platform = parts.pop();
      const channelName = parts.join('_');
      return [['drops-config', channelName, platform]];
    }
    return [['drops-config']];
  }
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

export const useCacheWebSocketSync = (): null => {
  const authContext = useAuth();
  const queryClient = useQueryClient();
  
  // Получаем данные из контекста (может быть null)
  const { user, isAuthenticated } = authContext || {};
  const userId = user?.id;

  const handleWebSocketMessage = (data: Record<string, unknown>) => {
    // Проверка authContext внутри обработчика
    if (!authContext) {
      return;
    }
    
    try {
      if (data.type === 'cache_invalidate') {
        logger.info(`[CACHE] Received invalidation for: ${String(data.cache_key)}`);
        const cacheType = Object.values(CACHE_CONFIG).find((config) => config.key === data.cache_key);
        if (cacheType) {
          cacheManager.invalidate(cacheType as CacheConfigValue);
          logger.debug(`[CACHE] CacheManager invalidated: ${String(data.cache_key)}`);
        } else {
          logger.debug(`[CACHE] No CacheManager config for: ${String(data.cache_key)}`);
        }
        const queryKeys = getQueryKeysForCacheKey(String(data.cache_key));
        if (queryKeys.length > 0) {
          queryKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
            logger.debug(`[CACHE] React Query invalidated: ${JSON.stringify(queryKey)}`);
          });
        } else {
          logger.warn(`[CACHE] No React Query keys mapped for: ${String(data.cache_key)}`);
        }
      }
    } catch (error) {
      logger.error('[CACHE] Message parse error:', error);
    }
  };

  // Хук вызывается всегда, но с null если не авторизован
  useSharedWebSocket(isAuthenticated && userId ? userId : null, handleWebSocketMessage);
  return null;
};

export default useCacheWebSocketSync;


