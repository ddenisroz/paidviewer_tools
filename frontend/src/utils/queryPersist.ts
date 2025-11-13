import { logger } from './prodLogger';

const QUERY_CACHE_PREFIX = 'rq_cache_';
const CACHE_VERSION = 1;

export function getQueryCache<T = unknown>(queryKey: unknown[]): T | null {
  try {
    const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    const { data, version } = JSON.parse(cached) as { data: T; timestamp: number; version: number };
    if (version !== CACHE_VERSION) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return data;
  } catch (error) {
    logger.error('[Query Persist] Error reading cache:', error);
    return null;
  }
}

export function setQueryCache<T = unknown>(queryKey: unknown[], data: T): void {
  try {
    const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
    const cacheData = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    logger.error('[Query Persist] Error writing cache:', error);
  }
}

export function clearQueryCache(queryKey: unknown[]): void {
  try {
    const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    logger.error('[Query Persist] Error clearing cache:', error);
  }
}

export function clearAllQueryCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(QUERY_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    logger.error('[Query Persist] Error clearing all cache:', error);
  }
}


