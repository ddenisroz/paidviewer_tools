import { logger } from '@/shared/utils/prodLogger';

import type { AxiosError } from 'axios';

export const PLATFORMS = {
    TWITCH: 'twitch',
    VK: 'vk',
    YOUTUBE: 'youtube',
    DONATION_ALERTS: 'donationalerts',
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

interface UserSettings {
    twitch_token_valid?: boolean;
    twitch_token?: string;
    twitch_username?: string;
    vk_token_valid?: boolean;
    vk_token?: string;
    vk_channel_name?: string;
}

interface PlatformConfig {
    enabled?: boolean;
    token?: string;
    username?: string;
    channelName?: string;
}

interface PlatformData {
    platform?: string;
    channel_name?: string;
    channel_id?: string;
    [key: string]: unknown;
}

interface CommandData {
    platforms: string | string[];
    [key: string]: unknown;
}

export const PLATFORM_NAMES: Record<Platform, string> = {
    [PLATFORMS.TWITCH]: 'Twitch',
    [PLATFORMS.VK]: 'VK Live',
    [PLATFORMS.YOUTUBE]: 'YouTube',
    [PLATFORMS.DONATION_ALERTS]: 'DonationAlerts',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
    [PLATFORMS.TWITCH]: '#9146FF',
    [PLATFORMS.VK]: '#FF4444',
    [PLATFORMS.YOUTUBE]: '#FF0000',
    [PLATFORMS.DONATION_ALERTS]: '#FFB800',
};

export const PLATFORM_ICONS: Record<Platform, string> = {
    [PLATFORMS.TWITCH]: '[GAME]',
    [PLATFORMS.VK]: '[WEB]',
    [PLATFORMS.YOUTUBE]: '[YT]',
    [PLATFORMS.DONATION_ALERTS]: '[DA]',
};

export const isValidPlatform = (platform: unknown): platform is Platform => {
    return typeof platform === 'string' && Object.values(PLATFORMS).includes(platform as Platform);
};

export const getPlatformName = (platform: Platform | string): string => {
    return PLATFORM_NAMES[platform as Platform] || String(platform);
};

export const getPlatformColor = (platform: Platform | string): string => {
    return PLATFORM_COLORS[platform as Platform] || '#6B7280';
};

export const getPlatformIcon = (platform: Platform | string): string => {
    return PLATFORM_ICONS[platform as Platform] || '[CONNECT]';
};

export const getPlatformProfileUrl = (platform: Platform | string, username?: string | null): string | null => {
    if (!username) return null;
    switch (platform) {
        case PLATFORMS.TWITCH:
            return `https://twitch.tv/${username}`;
        case PLATFORMS.VK:
            return `https://vk.com/${username}`;
        case PLATFORMS.YOUTUBE:
            return `https://youtube.com/@${username}`;
        default:
            logger.warn(`Unknown platform for profile URL: ${platform}`);
            return null;
    }
};

export const getPlatformStreamUrl = (platform: Platform | string, username?: string | null): string | null => {
    if (!username) return null;
    switch (platform) {
        case PLATFORMS.TWITCH:
            return `https://twitch.tv/${username}`;
        case PLATFORMS.VK:
            return `https://vk.com/${username}/videos`;
        case PLATFORMS.YOUTUBE:
            return `https://youtube.com/@${username}/live`;
        default:
            return null;
    }
};

export const getPlatformSettings = (userSettings: unknown): Record<string, PlatformConfig> => {
    const settings = userSettings as UserSettings | null;
    if (!settings) return {};
    return {
        [PLATFORMS.TWITCH]: {
            enabled: settings.twitch_token_valid === true,
            token: settings.twitch_token,
            username: settings.twitch_username,
        },
        [PLATFORMS.VK]: {
            enabled: settings.vk_token_valid === true,
            token: settings.vk_token,
            channelName: settings.vk_channel_name,
        },
    };
};

export const isPlatformAuthorized = (userSettings: unknown, platform: Platform | string): boolean => {
    const settings = getPlatformSettings(userSettings);
    return !!settings[platform as Platform]?.enabled;
};

export const getAuthorizedPlatforms = (userSettings: unknown): string[] => {
    const settings = getPlatformSettings(userSettings);
    return Object.entries(settings)
        .filter(([, config]) => config.enabled)
        .map(([platform]) => platform);
};

export const normalizePlatformData = (platform: Platform | string, data: unknown): PlatformData => {
    const normalized: PlatformData = { platform, ...(data as Record<string, unknown>) };
    switch (platform) {
        case PLATFORMS.TWITCH:
            if (normalized.channel_name) {
                normalized.channel_name = normalized.channel_name.toLowerCase();
            }
            break;
        case PLATFORMS.VK:
            if (normalized.channel_id) {
                normalized.channel_id = normalized.channel_id.toString();
            }
            break;
    }
    return normalized;
};

export const formatPlatformError = (platform: Platform | string, error: unknown): string => {
    logger.error(`Platform error [${platform}]:`, error);
    const platformName = getPlatformName(platform);
    const axiosError = error as AxiosError<{ detail?: string }>;

    if (axiosError.response?.status === 401) {
        return `${platformName} authorization expired. Please login again.`;
    }
    if (axiosError.response?.status === 403) {
        return `Access denied on ${platformName}. Check permissions.`;
    }
    if (axiosError.response?.data?.detail) {
        return axiosError.response.data.detail;
    }
    return `Error connecting to ${platformName}`;
};

export const getCommandPlatforms = (commandPlatforms: string | string[]): string[] => {
    if (typeof commandPlatforms === 'string') {
        return commandPlatforms.split(',').map((p) => p.trim());
    }
    return Array.isArray(commandPlatforms) ? commandPlatforms : [PLATFORMS.TWITCH];
};

export const isCommandAvailableOnPlatform = (command: unknown, platform: Platform | string): boolean => {
    const cmd = command as CommandData;
    const platforms = getCommandPlatforms(cmd.platforms);
    return platforms.includes(platform as string) || platforms.includes('all');
};

export const groupByPlatform = (items: unknown[], platformKey: string = 'platform'): Record<string, unknown[]> => {
    return items.reduce((acc: Record<string, unknown[]>, item: unknown) => {
        const itemData = item as Record<string, unknown>;
        const platform = itemData[platformKey] as string;
        if (!acc[platform]) {
            acc[platform] = [];
        }
        acc[platform].push(item);
        return acc;
    }, {});
};

export const applyToAllPlatforms = async (
    userSettings: unknown,
    operation: (platform: string) => Promise<unknown>,
    onProgress: ((platform: string, index: number, total: number) => void) | null = null
): Promise<Record<string, unknown>> => {
    const platforms = getAuthorizedPlatforms(userSettings);
    const results: Record<string, unknown> = {};
    for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        try {
            logger.debug(`Applying operation to ${platform}`);
            results[platform] = await operation(platform);
            if (onProgress) onProgress(platform, i + 1, platforms.length);
        } catch (error) {
            logger.error(`Operation failed on ${platform}:`, error);
            results[platform] = { error: formatPlatformError(platform, error) };
        }
    }
    return results;
};

export const getLocalizedMessage = (key: string, platform: Platform | string, defaultMessage: string = ''): string => {
    const messages: Record<string, Record<string, string>> = {
        connection_failed: {
            [PLATFORMS.TWITCH]: 'Failed to connect to Twitch',
            [PLATFORMS.VK]: 'Failed to connect to VK Live',
        },
        rate_limit: {
            [PLATFORMS.TWITCH]: 'Twitch rate limit exceeded',
            [PLATFORMS.VK]: 'VK Live rate limit exceeded',
        },
    };
    return messages[key]?.[platform as string] || defaultMessage;
};

export default {
    PLATFORMS,
    PLATFORM_NAMES,
    PLATFORM_COLORS,
    PLATFORM_ICONS,
    isValidPlatform,
    getPlatformName,
    getPlatformColor,
    getPlatformIcon,
    getPlatformProfileUrl,
    getPlatformStreamUrl,
    getPlatformSettings,
    isPlatformAuthorized,
    getAuthorizedPlatforms,
    normalizePlatformData,
    formatPlatformError,
    getCommandPlatforms,
    isCommandAvailableOnPlatform,
    groupByPlatform,
    applyToAllPlatforms,
    getLocalizedMessage,
};
