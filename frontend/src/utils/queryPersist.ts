// src/utils/queryPersist.ts
/**
 * Query persistence utilities for TanStack Query.
 */

const PERSIST_KEY = 'tanstack-query-cache';

/**
 * Load persisted query cache from localStorage.
 */
export const loadPersistedCache = (): unknown | null => {
    try {
        const cached = localStorage.getItem(PERSIST_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (error) {
        console.warn('Failed to load persisted cache:', error);
    }
    return null;
};

/**
 * Save query cache to localStorage.
 */
export const saveQueryCache = (cache: unknown): void => {
    try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(cache));
    } catch (error) {
        console.warn('Failed to save cache:', error);
    }
};

/**
 * Clear persisted query cache.
 */
export const clearPersistedCache = (): void => {
    try {
        localStorage.removeItem(PERSIST_KEY);
    } catch (error) {
        console.warn('Failed to clear cache:', error);
    }
};

export default {
    loadPersistedCache,
    saveQueryCache,
    clearPersistedCache,
};
