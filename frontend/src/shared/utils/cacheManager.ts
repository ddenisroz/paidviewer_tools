import Logger from '@/shared/utils/prodLogger';

const logger = new Logger('CACHE');
/* eslint-disable @typescript-eslint/no-non-null-assertion */

export interface CacheType {
    key: string;
    ttl: number;
    version: number;
}

export const CACHE_CONFIG = {
    USER_SETTINGS: { key: 'cache_user_settings', ttl: 5 * 60 * 1000, version: 1 },
    CHATBOX_SETTINGS: { key: 'cache_chatbox_settings', ttl: 5 * 60 * 1000, version: 1 },
    INTEGRATIONS: { key: 'cache_integrations', ttl: 2 * 60 * 1000, version: 1 },
    TTS_VOICES: { key: 'cache_tts_voices', ttl: 10 * 60 * 1000, version: 1 },
    TTS_STATUS: { key: 'cache_tts_status', ttl: 3 * 60 * 1000, version: 1 },
    COMMANDS: { key: 'cache_commands', ttl: 2 * 60 * 1000, version: 1 },
    TWITCH_BADGES: { key: 'cache_twitch_badges', ttl: 24 * 60 * 60 * 1000, version: 1 },
} as const;

export type CacheConfigValue = (typeof CACHE_CONFIG)[keyof typeof CACHE_CONFIG];

class CacheManager {
    private listeners: Map<string, Array<(data?: unknown) => void>>;
    private pendingUpdates: Map<string, Promise<unknown>>;

    constructor() {
        this.listeners = new Map();
        this.pendingUpdates = new Map();
        this.setupStorageListener();
    }

    get<T = unknown>(cacheType: CacheConfigValue, options: { ignoreExpired?: boolean } = {}): T | null {
        try {
            const cached = localStorage.getItem(cacheType.key);
            if (!cached) {
                logger.debug(`[CACHE] Miss: ${cacheType.key}`);
                return null;
            }
            const parsed = JSON.parse(cached) as {
                data: T;
                timestamp: number;
                version: number;
                userId?: number | null;
            };
            const { data, timestamp, version } = parsed;
            if (version !== cacheType.version) {
                logger.warn(`[CACHE] Version mismatch for ${cacheType.key}: ${version} !== ${cacheType.version}`);
                this.invalidate(cacheType);
                return null;
            }
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

    set<T = unknown>(cacheType: CacheConfigValue, data: T, options: { userId?: number | null } = {}): void {
        try {
            const cacheEntry = {
                data,
                timestamp: Date.now(),
                version: cacheType.version,
                userId: options.userId ?? null,
            };
            localStorage.setItem(cacheType.key, JSON.stringify(cacheEntry));
            logger.debug(`[CACHE] Set: ${cacheType.key}`);
            this.notifyOtherTabs('cache_updated', { key: cacheType.key, data });
        } catch (error: unknown) {
            logger.error('[CACHE] Write error:', error);
            const storageError = error as { name?: string };
            if (storageError?.name === 'QuotaExceededError') {
                logger.warn('[CACHE] Storage quota exceeded, clearing old caches...');
                this.clearOldest();
            }
        }
    }

    invalidate(cacheType: CacheConfigValue): void {
        try {
            localStorage.removeItem(cacheType.key);
            logger.debug(`[CACHE] Invalidated: ${cacheType.key}`);
            this.notifyOtherTabs('cache_invalidated', { key: cacheType.key });
            const listeners = this.listeners.get(cacheType.key) || [];
            listeners.forEach((callback) => callback());
        } catch (error) {
            logger.error('[CACHE] Invalidation error:', error);
        }
    }

    invalidateAll(): void {
        try {
            Object.values(CACHE_CONFIG).forEach((config) => {
                localStorage.removeItem(config.key);
            });
            logger.info('[CACHE] All caches invalidated');
            this.notifyOtherTabs('cache_invalidated_all', {});
        } catch (error) {
            logger.error('[CACHE] Clear all error:', error);
        }
    }

    invalidateUser(userId: number): void {
        try {
            Object.values(CACHE_CONFIG).forEach((config) => {
                const cached = localStorage.getItem(config.key);
                if (cached) {
                    const parsed = JSON.parse(cached) as { userId?: number | null };
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

    async getOrFetch<T = unknown>(
        cacheType: CacheConfigValue,
        fetchFn: () => Promise<T>,
        options: { ignoreExpired?: boolean; userId?: number | null } = {}
    ): Promise<T> {
        const cached = this.get<T>(cacheType, options);
        if (cached !== null) {
            return cached;
        }
        const pendingKey = cacheType.key;
        if (this.pendingUpdates.has(pendingKey)) {
            logger.debug(`[CACHE] Waiting for pending update: ${pendingKey}`);
            return this.pendingUpdates.get(pendingKey)! as Promise<T>;
        }
        const promise = (async () => {
            try {
                logger.debug(`[CACHE] Fetching: ${cacheType.key}`);
                const data = await fetchFn();
                this.set(cacheType, data, options);
                return data;
            } catch (error) {
                logger.error(`[CACHE] Fetch error for ${cacheType.key}:`, error);
                const stale = this.get<T>(cacheType, { ignoreExpired: true });
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

    async optimisticUpdate<T = unknown>(
        cacheType: CacheConfigValue,
        updateFn: (newData: T) => Promise<unknown>,
        newData: T,
        options: { userId?: number | null } = {}
    ): Promise<boolean> {
        const oldData = this.get<T>(cacheType, { ignoreExpired: true });
        this.set<T>(cacheType, newData, options);
        try {
            const result = await updateFn(newData);
            if (result && typeof result === 'object') {
                this.set(cacheType, result, options);
            }
            logger.debug(`[CACHE] Optimistic update succeeded: ${cacheType.key}`);
            return true;
        } catch (error) {
            logger.error(`[CACHE] Optimistic update failed: ${cacheType.key}`, error);
            if (oldData !== null) {
                this.set(cacheType, oldData, options);
            } else {
                this.invalidate(cacheType);
            }
            throw error;
        }
    }

    subscribe(cacheKey: string, callback: (data?: unknown) => void): () => void {
        if (!this.listeners.has(cacheKey)) {
            this.listeners.set(cacheKey, []);
        }
        this.listeners.get(cacheKey)!.push(callback);
        return () => {
            const listeners = this.listeners.get(cacheKey) || [];
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }

    private setupStorageListener(): void {
        if (typeof window === 'undefined') return;
        window.addEventListener('storage', (event: StorageEvent) => {
            if (event.key === 'cache_event') {
                try {
                    const { type, payload } = JSON.parse(event.newValue || '{}') as {
                        type: string;
                        payload: { key?: string; data?: unknown };
                    };
                    if (type === 'cache_invalidated') {
                        logger.debug(`[CACHE] Multi-tab invalidation: ${payload.key}`);
                        const listeners = this.listeners.get(payload.key as string) || [];
                        listeners.forEach((callback) => callback());
                    } else if (type === 'cache_invalidated_all') {
                        logger.debug('[CACHE] Multi-tab invalidation: ALL');
                        this.listeners.forEach((callbacks) => {
                            callbacks.forEach((callback) => callback());
                        });
                    } else if (type === 'cache_updated') {
                        logger.debug(`[CACHE] Multi-tab update: ${payload.key}`);
                        const listeners = this.listeners.get(payload.key as string) || [];
                        listeners.forEach((callback) => callback(payload.data));
                    }
                } catch (error) {
                    logger.error('[CACHE] Storage event error:', error);
                }
            }
        });
    }

    private notifyOtherTabs(type: string, payload: unknown): void {
        try {
            localStorage.setItem('cache_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
            localStorage.removeItem('cache_event');
        } catch {
            // ignore
        }
    }

    private clearOldest(): void {
        try {
            const caches: Array<{ key: string; timestamp: number }> = [];
            Object.values(CACHE_CONFIG).forEach((config) => {
                const cached = localStorage.getItem(config.key);
                if (cached) {
                    const parsed = JSON.parse(cached) as { timestamp: number };
                    caches.push({ key: config.key, timestamp: parsed.timestamp });
                }
            });
            caches.sort((a, b) => a.timestamp - b.timestamp);
            const toRemove = Math.ceil(caches.length * 0.3);
            for (let i = 0; i < toRemove; i++) {
                localStorage.removeItem(caches[i].key);
                logger.debug(`[CACHE] Removed old cache: ${caches[i].key}`);
            }
        } catch (error) {
            logger.error('[CACHE] Clear oldest error:', error);
        }
    }

    getStats(): {
        total: number;
        valid: number;
        expired: number;
        invalid: number;
        caches: Array<{ key: string; age: number; ttl: number; expired: boolean; validVersion: boolean; size: number }>;
    } {
        const stats: {
            total: number;
            valid: number;
            expired: number;
            invalid: number;
            caches: Array<{
                key: string;
                age: number;
                ttl: number;
                expired: boolean;
                validVersion: boolean;
                size: number;
            }>;
        } = { total: 0, valid: 0, expired: 0, invalid: 0, caches: [] };
        Object.values(CACHE_CONFIG).forEach((config) => {
            const cached = localStorage.getItem(config.key);
            if (cached) {
                stats.total++;
                try {
                    const parsed = JSON.parse(cached) as { timestamp: number; version: number };
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
                        size: new Blob([cached]).size,
                    });
                } catch {
                    stats.invalid++;
                }
            }
        });
        return stats;
    }
}

export const cacheManager = new CacheManager();
export default cacheManager;
