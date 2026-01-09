// src/utils/cacheManager.ts
/**
 * Simple in-memory cache manager with TTL support.
 */

interface CacheItem<T> {
    value: T;
    expiresAt: number;
}

class CacheManager {
    private cache: Map<string, CacheItem<unknown>> = new Map();
    private defaultTTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get item from cache.
     */
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value as T;
    }

    /**
     * Set item in cache.
     */
    set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl,
        });
    }

    /**
     * Remove item from cache.
     */
    remove(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear all cached items.
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Check if key exists and is not expired.
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Get all keys in cache.
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }
}

export const cacheManager = new CacheManager();
export default cacheManager;
