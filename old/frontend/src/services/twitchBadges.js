/**
 * Сервис для работы с Twitch badges
 */
import { microservicesAPI } from './microservices';
import { logger } from '../utils/prodLogger';

class TwitchBadgesService {
    constructor() {
        this.globalBadges = null;
        this.channelBadges = {};
        this.loading = false;
    }

    /**
     * Загрузить глобальные badges
     */
    async loadGlobalBadges() {
        if (this.globalBadges) {
            return this.globalBadges;
        }

        // Пытаемся загрузить из localStorage СРАЗУ
        try {
            const cached = localStorage.getItem('twitch_badges_cache');
            if (cached) {
                const { badges, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                // Кеш валиден 24 часа
                if (age < 24 * 60 * 60 * 1000) {
                    this.globalBadges = badges;
                    logger.log('✅ [BADGES] Loaded from cache:', Object.keys(this.globalBadges).length, 'sets');
                    
                    // Обновляем в фоне если кеш старше 1 часа
                    if (age > 60 * 60 * 1000) {
                        logger.log('🔄 [BADGES] Refreshing cache in background...');
                        this.refreshBadgesInBackground();
                    }
                    
                    return this.globalBadges;
                }
            }
        } catch (error) {
            logger.warn('⚠️ [BADGES] Cache read error:', error);
        }

        if (this.loading) {
            // Ждем пока загрузятся
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (!this.loading) {
                        clearInterval(interval);
                        resolve(this.globalBadges);
                    }
                }, 100);
            });
        }

        this.loading = true;

        try {
            // Используем прямой fetch для публичного endpoint
            const response = await fetch('http://localhost:8000/api/twitch/badges/global');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.globalBadges = data.badges;
                    logger.log('✅ [BADGES] Loaded global badges:', Object.keys(this.globalBadges).length, 'sets');
                    
                    // Сохраняем в localStorage
                    try {
                        localStorage.setItem('twitch_badges_cache', JSON.stringify({
                            badges: this.globalBadges,
                            timestamp: Date.now()
                        }));
                        logger.log('💾 [BADGES] Saved to cache');
                    } catch (e) {
                        logger.warn('⚠️ [BADGES] Cache save error:', e);
                    }
                }
            } else {
                logger.warn('⚠️ [BADGES] Failed to load badges:', response.status);
                this.globalBadges = {};
            }
        } catch (error) {
            logger.error('❌ [BADGES] Failed to load global badges:', error);
            this.globalBadges = {}; // Пустой объект чтобы не запрашивать снова
        } finally {
            this.loading = false;
        }

        return this.globalBadges;
    }

    /**
     * Обновить badges в фоне (не блокируя)
     */
    refreshBadgesInBackground() {
        fetch('http://localhost:8000/api/twitch/badges/global')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.globalBadges = data.badges;
                    localStorage.setItem('twitch_badges_cache', JSON.stringify({
                        badges: this.globalBadges,
                        timestamp: Date.now()
                    }));
                    logger.log('🔄 [BADGES] Cache refreshed');
                }
            })
            .catch(error => logger.warn('⚠️ [BADGES] Background refresh failed:', error));
    }

    /**
     * Загрузить badges канала
     */
    async loadChannelBadges(broadcasterId) {
        if (this.channelBadges[broadcasterId]) {
            return this.channelBadges[broadcasterId];
        }

        try {
            const response = await microservicesAPI.get(`/api/twitch/badges/channel/${broadcasterId}`);
            if (response.data.success) {
                this.channelBadges[broadcasterId] = response.data.badges;
                logger.log(`✅ [BADGES] Loaded channel badges for ${broadcasterId}:`, Object.keys(this.channelBadges[broadcasterId]).length);
            }
        } catch (error) {
            logger.error(`❌ [BADGES] Failed to load channel badges for ${broadcasterId}:`, error);
            this.channelBadges[broadcasterId] = {};
        }

        return this.channelBadges[broadcasterId];
    }

    /**
     * Получить URL значка
     * @param {string} badgeId - ID значка (например, "broadcaster", "subscriber")
     * @param {string} version - Версия значка (например, "1", "12")
     * @param {string} size - Размер ('1x', '2x', '4x')
     * @param {string} broadcasterId - ID канала (опционально)
     * @returns {string|null} URL значка
     */
    getBadgeUrl(badgeId, version, size = '1x', broadcasterId = null) {
        // Сначала ищем в badges канала (если указан)
        if (broadcasterId && this.channelBadges[broadcasterId]) {
            const channelBadge = this.channelBadges[broadcasterId][badgeId]?.[version];
            if (channelBadge) {
                return channelBadge[`image_url_${size}`];
            }
        }

        // Затем в глобальных badges
        if (this.globalBadges) {
            const globalBadge = this.globalBadges[badgeId]?.[version];
            if (globalBadge) {
                return globalBadge[`image_url_${size}`];
            }
        }

        // Fallback: возвращаем null чтобы не рендерить badge
        return null;
    }

    /**
     * Получить URLs для массива badges
     * @param {Array<string>} badges - Массив badges в формате ["broadcaster/1", "subscriber/12"]
     * @param {string} size - Размер
     * @param {string} broadcasterId - ID канала
     * @returns {Array<{id: string, version: string, url: string}>}
     */
    getBadgeUrls(badges, size = '1x', broadcasterId = null) {
        if (!badges || !Array.isArray(badges)) {
            return [];
        }

        return badges.map(badge => {
            const [badgeId, version] = badge.split('/');
            const url = this.getBadgeUrl(badgeId, version, size, broadcasterId);
            return {
                id: badgeId,
                version: version,
                url: url
            };
        });
    }

    /**
     * Сбросить кэш
     */
    clearCache() {
        this.globalBadges = null;
        this.channelBadges = {};
        try {
            localStorage.removeItem('twitch_badges_cache');
            logger.log('🗑️ [BADGES] Cache cleared (memory + localStorage)');
        } catch (e) {
            logger.warn('⚠️ [BADGES] localStorage clear error:', e);
        }
    }
}

export const twitchBadgesService = new TwitchBadgesService();

