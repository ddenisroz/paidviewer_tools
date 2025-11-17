import { logger } from '../../utils/prodLogger';

export const PLATFORMS = {
  TWITCH: 'twitch',
  VK: 'vk',
  YOUTUBE: 'youtube',
  DONATION_ALERTS: 'donationalerts',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

export const PLATFORM_NAMES: Record<Platform, string> = {
  [PLATFORMS.TWITCH]: 'Twitch',
  [PLATFORMS.VK]: 'VK Live',
  [PLATFORMS.YOUTUBE]: 'YouTube',
  [PLATFORMS.DONATION_ALERTS]: 'DonationAlerts',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  [PLATFORMS.TWITCH]: '#9146FF',
  [PLATFORMS.VK]: '#0077FF',
  [PLATFORMS.YOUTUBE]: '#FF0000',
  [PLATFORMS.DONATION_ALERTS]: '#FFB800',
};

export const PLATFORM_ICONS: Record<Platform, string> = {
  [PLATFORMS.TWITCH]: '🎮',
  [PLATFORMS.VK]: '🌐',
  [PLATFORMS.YOUTUBE]: '📺',
  [PLATFORMS.DONATION_ALERTS]: '💝',
};

export const isValidPlatform = (platform: any): platform is Platform => {
  return Object.values(PLATFORMS).includes(platform);
};

export const getPlatformName = (platform: Platform | string): string => {
  return PLATFORM_NAMES[platform as Platform] || String(platform);
};

export const getPlatformColor = (platform: Platform | string): string => {
  return PLATFORM_COLORS[platform as Platform] || '#6B7280';
};

export const getPlatformIcon = (platform: Platform | string): string => {
  return PLATFORM_ICONS[platform as Platform] || '🔌';
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

export const getPlatformSettings = (userSettings: any): Record<string, any> => {
  if (!userSettings) return {};
  return {
    [PLATFORMS.TWITCH]: {
      enabled: userSettings.twitch_token_valid === true,
      token: userSettings.twitch_token,
      username: userSettings.twitch_username,
    },
    [PLATFORMS.VK]: {
      enabled: userSettings.vk_token_valid === true,
      token: userSettings.vk_token,
      channelName: userSettings.vk_channel_name,
    },
  };
};

export const isPlatformAuthorized = (userSettings: any, platform: Platform | string): boolean => {
  const settings = getPlatformSettings(userSettings);
  return !!settings[platform as Platform]?.enabled;
};

export const getAuthorizedPlatforms = (userSettings: any): string[] => {
  const settings = getPlatformSettings(userSettings);
  return Object.entries(settings)
    .filter(([, config]) => (config as any).enabled)
    .map(([platform]) => platform);
};

export const normalizePlatformData = (platform: Platform | string, data: any): any => {
  const normalized: any = { platform, ...data };
  switch (platform) {
    case PLATFORMS.TWITCH:
      normalized.channel_name = normalized.channel_name?.toLowerCase();
      break;
    case PLATFORMS.VK:
      normalized.channel_id = normalized.channel_id?.toString();
      break;
  }
  return normalized;
};

export const formatPlatformError = (platform: Platform | string, error: any): string => {
  logger.error(`Platform error [${platform}]:`, error);
  const platformName = getPlatformName(platform);
  if (error?.response?.status === 401) {
    return `${platformName} authorization expired. Please login again.`;
  }
  if (error?.response?.status === 403) {
    return `Access denied on ${platformName}. Check permissions.`;
  }
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  return `Error connecting to ${platformName}`;
};

export const getCommandPlatforms = (commandPlatforms: string | string[]): string[] => {
  if (typeof commandPlatforms === 'string') {
    return commandPlatforms.split(',').map((p) => p.trim());
  }
  return Array.isArray(commandPlatforms) ? commandPlatforms : [PLATFORMS.TWITCH];
};

export const isCommandAvailableOnPlatform = (command: any, platform: Platform | string): boolean => {
  const platforms = getCommandPlatforms(command.platforms);
  return platforms.includes(platform as string) || platforms.includes('all');
};

export const groupByPlatform = (items: any[], platformKey: string = 'platform'): Record<string, any[]> => {
  return items.reduce((acc: Record<string, any[]>, item: any) => {
    const platform = item[platformKey];
    if (!acc[platform]) {
      acc[platform] = [];
    }
    acc[platform].push(item);
    return acc;
  }, {});
};

export const applyToAllPlatforms = async (
  userSettings: any,
  operation: (platform: string) => Promise<any>,
  onProgress: ((platform: string, index: number, total: number) => void) | null = null
): Promise<Record<string, any>> => {
  const platforms = getAuthorizedPlatforms(userSettings);
  const results: Record<string, any> = {};
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


