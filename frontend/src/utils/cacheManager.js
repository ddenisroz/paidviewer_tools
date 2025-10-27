// frontend/src/utils/cacheManager.js
/**
 * Централизованная система кэширования с автоматической инвалидацией
 * 
 * Особенности:
 * - TTL для каждого типа данных
 * - Version control для проверки актуальности
 * - WebSocket integration для real-time invalidation
 * - Multi-tab sync через storage events
 * - Защита от race conditions
 */

import logger from './logger';

// ===== КОНФИГУРАЦИЯ КЭША =====
export const CACHE_CONFIG = {
  USER_SETTINGS: { 
    key: 'cache_user_settings', 
    ttl: 5 * 60 * 1000, // 5 минут
    version: 1
  },
  CHATBOX_SETTINGS: { 
    key: 'cache_chatbox_settings', 
    ttl: 5 * 60 * 1000, // 5 минут
    version: 1
  },
  INTEGRATIONS: { 
    key: 'cache_integrations', 
    ttl: 2 * 60 * 1000, // 2 минуты
    version: 1
  },
  TTS_VOICES: { 
    key: 'cache_tts_voices', 
    ttl: 10 * 60 * 1000, // 10 минут
    version: 1
  },
  TTS_STATUS: { 
    key: 'cache_tts_status', 
    ttl: 3 * 60 * 1000, // 3 минуты
    version: 1
  },
  COMMANDS: { 
    key: 'cache_commands', 
    ttl: 2 * 60 * 1000, // 2 минуты
    version: 1
  },
  TWITCH_BADGES: { 
    key: 'cache_twitch_badges', 
    ttl: 24 * 60 * 60 * 1000, // 24 часа
    version: 1
  }
};

class CacheManager {
  constructor() {
    this.listeners = new Map(); // Слушатели для multi-tab sync
    this.pendingUpdates = new Map(); // Защита от race conditions
    this.setupStorageListener();
  }

  /**
   * Получить данные из кэша
   * @param {Object} cacheType - Тип кэша из CACHE_CONFIG
   * @param {Object} options - Опции { ignoreExpired: false }
   * @returns {any|null} Закэшированные данные или null
   */
  get(cacheType, options = {}) {
    try {
      const cached = localStorage.getItem(cacheType.key);
      if (!cached) {
        logger.debug(`[CACHE] Miss: ${cacheType.key}`);
        return null;
      }
      
      const parsed = JSON.parse(cached);
      const { data, timestamp, version } = parsed;
      
      // Проверка версии схемы
      if (version !== cacheType.version) {
        logger.warn(`[CACHE] Version mismatch for ${cacheType.key}: ${version} !== ${cacheType.version}`);
        this.invalidate(cacheType);
        return null;
      }
      
      // Проверка TTL
      const age = Date.now() - timestamp;
      if (age > cacheType.ttl && !options.ignoreExpired) {
        logger.debug(`[CACHE] Expired: ${cacheType.key} (age: ${Math.round(age / 1000)}s)`);
        this.invalidate(cacheType);
        return null;
      }
      
      logger.debug(`[CACHE] Hit: ${cacheType.key} (age: ${Math.round(age / 1000)}s)`);
      return data;
    } catch (error) {
      logger.error('[CACHE] Read error:', error);
      return null;
    }
  }

  /**
   * Сохранить данные в кэш
   * @param {Object} cacheType - Тип кэша из CACHE_CONFIG
   * @param {any} data - Данные для сохранения
   * @param {Object} options - Опции { userId: null }
   */
  set(cacheType, data, options = {}) {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now(),
        version: cacheType.version,
        userId: options.userId || null // Для multi-user защиты
      };
      
      localStorage.setItem(cacheType.key, JSON.stringify(cacheEntry));
      logger.debug(`[CACHE] Set: ${cacheType.key}`);
      
      // Уведомляем другие вкладки
      this.notifyOtherTabs('cache_updated', { key: cacheType.key, data });
    } catch (error) {
      logger.error('[CACHE] Write error:', error);
      
      // Если переполнен localStorage, очищаем старые кэши
      if (error.name === 'QuotaExceededError') {
        logger.warn('[CACHE] Storage quota exceeded, clearing old caches...');
        this.clearOldest();
      }
    }
  }

  /**
   * Инвалидировать конкретный кэш
   * @param {Object} cacheType - Тип кэша из CACHE_CONFIG
   */
  invalidate(cacheType) {
    try {
      localStorage.removeItem(cacheType.key);
      logger.debug(`[CACHE] Invalidated: ${cacheType.key}`);
      
      // Уведомляем другие вкладки
      this.notifyOtherTabs('cache_invalidated', { key: cacheType.key });
      
      // Вызываем слушателей
      const listeners = this.listeners.get(cacheType.key) || [];
      listeners.forEach(callback => callback());
    } catch (error) {
      logger.error('[CACHE] Invalidation error:', error);
    }
  }

  /**
   * Инвалидировать все кэши
   */
  invalidateAll() {
    try {
      Object.values(CACHE_CONFIG).forEach(config => {
        localStorage.removeItem(config.key);
      });
      logger.info('[CACHE] All caches invalidated');
      
      // Уведомляем другие вкладки
      this.notifyOtherTabs('cache_invalidated_all', {});
    } catch (error) {
      logger.error('[CACHE] Clear all error:', error);
    }
  }

  /**
   * Инвалидировать кэши пользователя (при logout)
   * @param {number} userId - ID пользователя
   */
  invalidateUser(userId) {
    try {
      Object.values(CACHE_CONFIG).forEach(config => {
        const cached = localStorage.getItem(config.key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.userId === userId) {
            localStorage.removeItem(config.key);
            logger.debug(`[CACHE] Invalidated for user ${userId}: ${config.key}`);
          }
        }
      });
    } catch (error) {
      logger.error('[CACHE] User invalidation error:', error);
    }
  }

  /**
   * Получить или загрузить данные (cache-aside pattern)
   * @param {Object} cacheType - Тип кэша
   * @param {Function} fetchFn - Async функция для загрузки данных
   * @param {Object} options - Опции
   * @returns {Promise<any>}
   */
  async getOrFetch(cacheType, fetchFn, options = {}) {
    // 1. Проверяем кэш
    const cached = this.get(cacheType, options);
    if (cached !== null) {
      return cached;
    }

    // 2. Проверяем, не выполняется ли уже запрос
    const pendingKey = cacheType.key;
    if (this.pendingUpdates.has(pendingKey)) {
      logger.debug(`[CACHE] Waiting for pending update: ${pendingKey}`);
      return this.pendingUpdates.get(pendingKey);
    }

    // 3. Выполняем запрос
    const promise = (async () => {
      try {
        logger.debug(`[CACHE] Fetching: ${cacheType.key}`);
        const data = await fetchFn();
        
        // Сохраняем в кэш
        this.set(cacheType, data, options);
        
        return data;
      } catch (error) {
        logger.error(`[CACHE] Fetch error for ${cacheType.key}:`, error);
        
        // При ошибке пытаемся вернуть устаревший кэш
        const stale = this.get(cacheType, { ignoreExpired: true });
        if (stale) {
          logger.warn(`[CACHE] Returning stale data for ${cacheType.key}`);
          return stale;
        }
        
        throw error;
      } finally {
        this.pendingUpdates.delete(pendingKey);
      }
    })();

    this.pendingUpdates.set(pendingKey, promise);
    return promise;
  }

  /**
   * Обновить данные (optimistic update)
   * @param {Object} cacheType - Тип кэша
   * @param {Function} updateFn - Async функция для обновления на сервере
   * @param {any} newData - Новые данные для optimistic update
   * @param {Object} options - Опции
   * @returns {Promise<boolean>}
   */
  async optimisticUpdate(cacheType, updateFn, newData, options = {}) {
    // 1. Сохраняем старые данные
    const oldData = this.get(cacheType, { ignoreExpired: true });
    
    // 2. Обновляем кэш оптимистично
    this.set(cacheType, newData, options);
    
    try {
      // 3. Отправляем на сервер
      const result = await updateFn(newData);
      
      // 4. Обновляем кэш с ответом сервера (может быть нормализован)
      if (result && typeof result === 'object') {
        this.set(cacheType, result, options);
      }
      
      logger.debug(`[CACHE] Optimistic update succeeded: ${cacheType.key}`);
      return true;
    } catch (error) {
      logger.error(`[CACHE] Optimistic update failed: ${cacheType.key}`, error);
      
      // 5. Откатываем при ошибке
      if (oldData !== null) {
        this.set(cacheType, oldData, options);
        logger.warn(`[CACHE] Rolled back to old data: ${cacheType.key}`);
      } else {
        this.invalidate(cacheType);
      }
      
      throw error;
    }
  }

  /**
   * Подписаться на изменения кэша (для multi-tab sync)
   * @param {string} cacheKey - Ключ кэша
   * @param {Function} callback - Callback при изменении
   */
  subscribe(cacheKey, callback) {
    if (!this.listeners.has(cacheKey)) {
      this.listeners.set(cacheKey, []);
    }
    this.listeners.get(cacheKey).push(callback);
    
    // Возвращаем функцию отписки
    return () => {
      const listeners = this.listeners.get(cacheKey) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Настройка слушателя storage events (multi-tab sync)
   */
  setupStorageListener() {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('storage', (event) => {
      if (event.key === 'cache_event') {
        try {
          const { type, payload } = JSON.parse(event.newValue || '{}');
          
          if (type === 'cache_invalidated') {
            logger.debug(`[CACHE] Multi-tab invalidation: ${payload.key}`);
            const listeners = this.listeners.get(payload.key) || [];
            listeners.forEach(callback => callback());
          } else if (type === 'cache_invalidated_all') {
            logger.debug('[CACHE] Multi-tab invalidation: ALL');
            this.listeners.forEach(callbacks => {
              callbacks.forEach(callback => callback());
            });
          } else if (type === 'cache_updated') {
            logger.debug(`[CACHE] Multi-tab update: ${payload.key}`);
            const listeners = this.listeners.get(payload.key) || [];
            listeners.forEach(callback => callback(payload.data));
          }
        } catch (error) {
          logger.error('[CACHE] Storage event error:', error);
        }
      }
    });
  }

  /**
   * Уведомить другие вкладки о событии
   */
  notifyOtherTabs(type, payload) {
    try {
      localStorage.setItem('cache_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
      // Сразу удаляем, чтобы событие сработало при следующем setItem
      localStorage.removeItem('cache_event');
    } catch (error) {
      // Игнорируем ошибки multi-tab sync
    }
  }

  /**
   * Очистить самые старые кэши (при переполнении storage)
   */
  clearOldest() {
    try {
      const caches = [];
      
      Object.values(CACHE_CONFIG).forEach(config => {
        const cached = localStorage.getItem(config.key);
        if (cached) {
          const parsed = JSON.parse(cached);
          caches.push({ key: config.key, timestamp: parsed.timestamp });
        }
      });
      
      // Сортируем по времени (самые старые первые)
      caches.sort((a, b) => a.timestamp - b.timestamp);
      
      // Удаляем 30% самых старых
      const toRemove = Math.ceil(caches.length * 0.3);
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(caches[i].key);
        logger.debug(`[CACHE] Removed old cache: ${caches[i].key}`);
      }
    } catch (error) {
      logger.error('[CACHE] Clear oldest error:', error);
    }
  }

  /**
   * Получить статистику кэша (для дебага)
   */
  getStats() {
    const stats = {
      total: 0,
      valid: 0,
      expired: 0,
      invalid: 0,
      caches: []
    };

    Object.values(CACHE_CONFIG).forEach(config => {
      const cached = localStorage.getItem(config.key);
      if (cached) {
        stats.total++;
        try {
          const parsed = JSON.parse(cached);
          const age = Date.now() - parsed.timestamp;
          const isExpired = age > config.ttl;
          const isValidVersion = parsed.version === config.version;

          if (!isValidVersion) {
            stats.invalid++;
          } else if (isExpired) {
            stats.expired++;
          } else {
            stats.valid++;
          }

          stats.caches.push({
            key: config.key,
            age: Math.round(age / 1000),
            ttl: Math.round(config.ttl / 1000),
            expired: isExpired,
            validVersion: isValidVersion,
            size: new Blob([cached]).size
          });
        } catch (error) {
          stats.invalid++;
        }
      }
    });

    return stats;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Export для удобства
export default cacheManager;

