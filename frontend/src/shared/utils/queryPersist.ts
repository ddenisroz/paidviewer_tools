import { logger } from '@/shared/utils/prodLogger';

const QUERY_CACHE_PREFIX = 'rq_cache_';
const CACHE_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 80;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupTime = 0;

type CleanupOptions = {
    maxEntries?: number;
    maxAgeMs?: number;
};

type CacheMeta = {
    key: string;
    timestamp: number;
};

function parseCacheMeta(key: string): CacheMeta | null {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const parsed = JSON.parse(cached) as { timestamp?: number; version?: number };
        if (parsed.version !== CACHE_VERSION) {
            localStorage.removeItem(key);
            return null;
        }
        const timestamp = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0;
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
            localStorage.removeItem(key);
            return null;
        }
        return { key, timestamp };
    } catch {
        localStorage.removeItem(key);
        return null;
    }
}

export function cleanupQueryCache(options: CleanupOptions = {}): { total: number; removed: number } {
    const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

    if (typeof window === 'undefined') {
        return { total: 0, removed: 0 };
    }

    const keys = Object.keys(localStorage).filter((key) => key.startsWith(QUERY_CACHE_PREFIX));
    const entries: CacheMeta[] = [];
    let removed = 0;
    const now = Date.now();

    keys.forEach((key) => {
        const meta = parseCacheMeta(key);
        if (!meta) {
            removed += 1;
            return;
        }
        if (maxAgeMs > 0 && now - meta.timestamp > maxAgeMs) {
            localStorage.removeItem(meta.key);
            removed += 1;
            return;
        }
        entries.push(meta);
    });

    if (entries.length > maxEntries) {
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const excess = entries.length - maxEntries;
        for (let i = 0; i < excess; i += 1) {
            localStorage.removeItem(entries[i].key);
            removed += 1;
        }
    }

    return { total: keys.length, removed };
}

function maybeCleanupQueryCache(): void {
    const now = Date.now();
    if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
        return;
    }
    lastCleanupTime = now;
    cleanupQueryCache();
}

export function getQueryCache<T = unknown>(queryKey: readonly unknown[] | unknown[]): T | null {
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

export function getQueryCacheWithMaxAge<T = unknown>(
    queryKey: readonly unknown[] | unknown[],
    maxAgeMs: number
): T | null {
    try {
        const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        const { data, timestamp, version } = JSON.parse(cached) as { data: T; timestamp: number; version: number };
        if (version !== CACHE_VERSION) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        if (Date.now() - timestamp > maxAgeMs) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        return data;
    } catch (error) {
        logger.error('[Query Persist] Error reading cache with age:', error);
        return null;
    }
}

export function setQueryCache<T = unknown>(queryKey: readonly unknown[] | unknown[], data: T): void {
    try {
        const cacheKey = `${QUERY_CACHE_PREFIX}${JSON.stringify(queryKey)}`;
        const cacheData = {
            data,
            timestamp: Date.now(),
            version: CACHE_VERSION,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        maybeCleanupQueryCache();
    } catch (error) {
        logger.error('[Query Persist] Error writing cache:', error);
    }
}

export function clearQueryCache(queryKey: readonly unknown[] | unknown[]): void {
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
