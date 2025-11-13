import { logger } from '../utils/prodLogger';

type BadgeImages = { image_url_1x?: string; image_url_2x?: string; image_url_4x?: string };
type BadgeSet = Record<string, BadgeImages>; // version -> images
type BadgesDict = Record<string, BadgeSet>; // badgeId -> set

class TwitchBadgesService {
  private globalBadges: BadgesDict | null;
  private channelBadges: Record<string, BadgesDict>;
  private loading: boolean;

  constructor() {
    this.globalBadges = null;
    this.channelBadges = {};
    this.loading = false;
  }

  async loadGlobalBadges(): Promise<BadgesDict> {
    if (this.globalBadges) return this.globalBadges;
    try {
      const cached = localStorage.getItem('twitch_badges_cache');
      if (cached) {
        const { badges, timestamp } = JSON.parse(cached) as { badges: BadgesDict; timestamp: number };
        const age = Date.now() - timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          this.globalBadges = badges;
          logger.log('✅ [BADGES] Loaded from cache:', Object.keys(this.globalBadges).length, 'sets');
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
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!this.loading) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      return this.globalBadges || {};
    }
    this.loading = true;
    try {
      const response = await fetch('/api/twitch/badges/global');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.globalBadges = data.badges as BadgesDict;
          logger.log('✅ [BADGES] Loaded global badges:', Object.keys(this.globalBadges).length, 'sets');
          try {
            localStorage.setItem('twitch_badges_cache', JSON.stringify({ badges: this.globalBadges, timestamp: Date.now() }));
            logger.log('💾 [BADGES] Saved to cache');
          } catch (e) {
            logger.warn('⚠️ [BADGES] Cache save error:', e);
          }
        } else {
          this.globalBadges = {};
        }
      } else {
        logger.warn('⚠️ [BADGES] Failed to load badges:', response.status);
        this.globalBadges = {};
      }
    } catch (error) {
      logger.error('❌ [BADGES] Failed to load global badges:', error);
      this.globalBadges = {};
    } finally {
      this.loading = false;
    }
    return this.globalBadges!;
  }

  private refreshBadgesInBackground(): void {
    fetch('/api/twitch/badges/global')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.globalBadges = data.badges as BadgesDict;
          localStorage.setItem('twitch_badges_cache', JSON.stringify({ badges: this.globalBadges, timestamp: Date.now() }));
          logger.log('🔄 [BADGES] Cache refreshed');
        }
      })
      .catch((error) => logger.warn('⚠️ [BADGES] Background refresh failed:', error));
  }

  async loadChannelBadges(broadcasterId: string): Promise<BadgesDict> {
    if (this.channelBadges[broadcasterId]) {
      return this.channelBadges[broadcasterId];
    }
    try {
      const response = await fetch(`/api/twitch/badges/channel/${broadcasterId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.channelBadges[broadcasterId] = data.badges as BadgesDict;
          logger.log(`✅ [BADGES] Loaded channel badges for ${broadcasterId}:`, Object.keys(this.channelBadges[broadcasterId]).length);
        } else {
          this.channelBadges[broadcasterId] = {};
        }
      } else {
        this.channelBadges[broadcasterId] = {};
      }
    } catch (error) {
      logger.error(`❌ [BADGES] Failed to load channel badges for ${broadcasterId}:`, error);
      this.channelBadges[broadcasterId] = {};
    }
    return this.channelBadges[broadcasterId];
  }

  getBadgeUrl(badgeId: string, version: string, size: '1x' | '2x' | '4x' = '1x', broadcasterId: string | null = null): string | null {
    if (broadcasterId && this.channelBadges[broadcasterId]) {
      const channelBadge = this.channelBadges[broadcasterId][badgeId]?.[version];
      if (channelBadge) {
        return (channelBadge as any)[`image_url_${size}`] || null;
      }
    }
    if (this.globalBadges) {
      const globalBadge = this.globalBadges[badgeId]?.[version];
      if (globalBadge) {
        return (globalBadge as any)[`image_url_${size}`] || null;
      }
    }
    return null;
  }

  getBadgeUrls(badges: string[], size: '1x' | '2x' | '4x' = '1x', broadcasterId: string | null = null): Array<{ id: string; version: string; url: string | null }> {
    if (!badges || !Array.isArray(badges)) {
      return [];
    }
    return badges.map((badge) => {
      const [badgeId, version] = badge.split('/');
      const url = this.getBadgeUrl(badgeId, version, size, broadcasterId);
      return { id: badgeId, version, url };
    });
  }

  clearCache(): void {
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


