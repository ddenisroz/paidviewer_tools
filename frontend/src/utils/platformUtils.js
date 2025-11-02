import { logger } from './prodLogger';

/**
 * Утилиты для работы с платформами (Twitch, VK, YouTube, DonationAlerts)
 * Централизованные функции для предотвращения дублирования кода
 */

// === ПЛАТФОРМ-СПЕЦИФИЧНЫЕ КОНСТАНТЫ ===

export const PLATFORMS = {
  TWITCH: 'twitch',
  VK: 'vk',
  YOUTUBE: 'youtube',
  DONATION_ALERTS: 'donationalerts'
};

export const PLATFORM_NAMES = {
  [PLATFORMS.TWITCH]: 'Twitch',
  [PLATFORMS.VK]: 'VK Live',
  [PLATFORMS.YOUTUBE]: 'YouTube',
  [PLATFORMS.DONATION_ALERTS]: 'DonationAlerts'
};

export const PLATFORM_COLORS = {
  [PLATFORMS.TWITCH]: '#9146FF',
  [PLATFORMS.VK]: '#0077FF',
  [PLATFORMS.YOUTUBE]: '#FF0000',
  [PLATFORMS.DONATION_ALERTS]: '#FFB800'
};

export const PLATFORM_ICONS = {
  [PLATFORMS.TWITCH]: '🎮',
  [PLATFORMS.VK]: '🌐',
  [PLATFORMS.YOUTUBE]: '📺',
  [PLATFORMS.DONATION_ALERTS]: '💝'
};

// === ВАЛИДАЦИЯ ПЛАТФОРМ ===

/**
 * Проверить валидность платформы
 */
export const isValidPlatform = (platform) => {
  return Object.values(PLATFORMS).includes(platform);
};

/**
 * Получить локализованное имя платформы
 */
export const getPlatformName = (platform) => {
  return PLATFORM_NAMES[platform] || platform;
};

/**
 * Получить цвет платформы для UI
 */
export const getPlatformColor = (platform) => {
  return PLATFORM_COLORS[platform] || '#6B7280';
};

/**
 * Получить эмодзи платформы
 */
export const getPlatformIcon = (platform) => {
  return PLATFORM_ICONS[platform] || '🔌';
};

// === РАБОТА С URL-А ПЛАТФОРМ ===

/**
 * Получить URL профиля пользователя в платформе
 */
export const getPlatformProfileUrl = (platform, username) => {
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

/**
 * Получить URL потока пользователя в платформе
 */
export const getPlatformStreamUrl = (platform, username) => {
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

// === РАБОТА С НАСТРОЙКАМИ ПЛАТФОРМ ===

/**
 * Получить настройки платформ пользователя
 */
export const getPlatformSettings = (userSettings) => {
  if (!userSettings) return {};
  
  return {
    [PLATFORMS.TWITCH]: {
      enabled: userSettings.twitch_token_valid === true,
      token: userSettings.twitch_token,
      username: userSettings.twitch_username
    },
    [PLATFORMS.VK]: {
      enabled: userSettings.vk_token_valid === true,
      token: userSettings.vk_token,
      channelName: userSettings.vk_channel_name
    }
  };
};

/**
 * Проверить авторизацию платформы
 */
export const isPlatformAuthorized = (userSettings, platform) => {
  const settings = getPlatformSettings(userSettings);
  return settings[platform]?.enabled || false;
};

/**
 * Получить авторизованные платформы
 */
export const getAuthorizedPlatforms = (userSettings) => {
  const settings = getPlatformSettings(userSettings);
  return Object.entries(settings)
    .filter(([_, config]) => config.enabled)
    .map(([platform, _]) => platform);
};

// === РАБОТА С ДАННЫМИ ПЛАТФОРМ ===

/**
 * Нормализовать данные платформы перед отправкой
 */
export const normalizePlatformData = (platform, data) => {
  const normalized = {
    platform,
    ...data
  };
  
  // Платформ-специфичные нормализации
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

/**
 * Форматировать ошибку для платформы
 */
export const formatPlatformError = (platform, error) => {
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

// === РАБОТА С КОМАНДАМИ ПЛАТФОРМ ===

/**
 * Получить платформу для команды
 */
export const getCommandPlatforms = (commandPlatforms) => {
  if (typeof commandPlatforms === 'string') {
    return commandPlatforms.split(',').map(p => p.trim());
  }
  return Array.isArray(commandPlatforms) ? commandPlatforms : [PLATFORMS.TWITCH];
};

/**
 * Проверить команду на совместимость с платформой
 */
export const isCommandAvailableOnPlatform = (command, platform) => {
  const platforms = getCommandPlatforms(command.platforms);
  return platforms.includes(platform) || platforms.includes('all');
};

// === БАТЧ ОПЕРАЦИИ ===

/**
 * Разделить данные по платформам
 */
export const groupByPlatform = (items, platformKey = 'platform') => {
  return items.reduce((acc, item) => {
    const platform = item[platformKey];
    if (!acc[platform]) {
      acc[platform] = [];
    }
    acc[platform].push(item);
    return acc;
  }, {});
};

/**
 * Применить операцию ко всем авторизованным платформам
 */
export const applyToAllPlatforms = async (
  userSettings,
  operation,
  onProgress = null
) => {
  const platforms = getAuthorizedPlatforms(userSettings);
  const results = {};
  
  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    
    try {
      logger.debug(`Applying operation to ${platform}`);
      results[platform] = await operation(platform);
      
      if (onProgress) {
        onProgress(platform, i + 1, platforms.length);
      }
    } catch (error) {
      logger.error(`Operation failed on ${platform}:`, error);
      results[platform] = { error: formatPlatformError(platform, error) };
    }
  }
  
  return results;
};

// === ЛОКАЛИЗАЦИЯ ===

/**
 * Получить локализованное сообщение для платформы
 */
export const getLocalizedMessage = (key, platform, defaultMessage = '') => {
  const messages = {
    'connection_failed': {
      [PLATFORMS.TWITCH]: 'Failed to connect to Twitch',
      [PLATFORMS.VK]: 'Failed to connect to VK Live'
    },
    'rate_limit': {
      [PLATFORMS.TWITCH]: 'Twitch rate limit exceeded',
      [PLATFORMS.VK]: 'VK Live rate limit exceeded'
    }
  };
  
  return messages[key]?.[platform] || defaultMessage;
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
  getLocalizedMessage
};
