// frontend/src/utils/queryPersist.js
/**
 * Утилита для сохранения React Query данных в localStorage
 * Предотвращает мерцание при перезагрузке страницы
 */

const QUERY_CACHE_PREFIX = 'rq_cache_';
const CACHE_VERSION = 1;

/**
 * Получить данные из localStorage для query
 */
export function getQueryCache(queryKey) {
  try {
    const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const { data, timestamp, version } = JSON.parse(cached);
    
    // Проверяем версию
    if (version !== CACHE_VERSION) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    // Данные из кэша всегда считаем валидными для ANTI-FLASH
    // React Query обновит их в фоне
    return data;
  } catch (error) {
    console.error('[Query Persist] Error reading cache:', error);
    return null;
  }
}

/**
 * Сохранить данные в localStorage для query
 */
export function setQueryCache(queryKey, data) {
  try {
    const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
    const cacheData = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    // Игнорируем ошибки записи (например, переполнение localStorage)
    console.error('[Query Persist] Error writing cache:', error);
  }
}

/**
 * Удалить данные из localStorage для query
 */
export function clearQueryCache(queryKey) {
  try {
    const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('[Query Persist] Error clearing cache:', error);
  }
}

/**
 * Очистить весь кэш React Query
 */
export function clearAllQueryCache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(QUERY_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('[Query Persist] Error clearing all cache:', error);
  }
}

