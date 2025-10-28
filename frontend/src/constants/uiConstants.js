/**
 * UI Constants
 * Централизованное хранилище размеров, цветов и других UI констант
 */

// Размеры компонентов
export const UI_SIZES = {
  // YouTube Integration
  YOUTUBE_PLAYER_WIDTH: 'w-[360px]',
  YOUTUBE_PLAYER_HEIGHT: 'h-[150px]',
  YOUTUBE_CONTROL_BUTTON_HEIGHT: 'h-12',
  
  // Channel Points
  REWARD_ICON_SIZE: 'w-16 h-16',
  REWARD_ICON_SMALL: 'w-8 h-8',
  ACTION_BUTTON_WIDTH: 'w-32',
  ACTION_BUTTON_HEIGHT: 'h-9',
  
  // Sidebar
  SIDEBAR_WIDTH: 'w-64',
  SIDEBAR_ICON_SIZE: 'h-6 w-6',
  SIDEBAR_ICON_SMALL: 'h-4 w-4',
  
  // Generic
  LOADER_SIZE: 'w-8 h-8',
  LOADER_SIZE_SMALL: 'w-4 h-4',
};

// Цвета платформ
export const PLATFORM_COLORS = {
  TWITCH: '#9147FF',
  VK_LIVE: '#FF0000',
  YOUTUBE: '#FF0000',
  DEFAULT: '#9147ff'
};

// Тайминги и интервалы
export const TIMINGS = {
  CACHE_TTL: 30000, // 30 секунд
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 3000,
  WEBSOCKET_RECONNECT_DELAY: 3000
};

// Лимиты
export const LIMITS = {
  MAX_QUEUE_SIZE: 100,
  MAX_REWARD_TITLE_LENGTH: 45,
  MAX_REWARD_DESCRIPTION_LENGTH: 200,
  VIRTUALIZATION_THRESHOLD: 50, // Порог для включения виртуализации списков
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
};

// Текстовые константы
export const TEXT = {
  ERRORS: {
    NETWORK: 'Проверьте подключение к интернету',
    SESSION_EXPIRED: 'Сессия истекла. Войдите заново',
    UNAUTHORIZED: 'Необходима авторизация',
    NOT_FOUND: 'Ресурс не найден',
    SERVER_ERROR: 'Ошибка сервера. Попробуйте позже',
    GENERIC: 'Произошла ошибка'
  },
  SUCCESS: {
    SAVED: 'Сохранено',
    DELETED: 'Удалено',
    UPDATED: 'Обновлено',
    COPIED: 'Скопировано'
  }
};

// Пути API (относительные)
export const API_PATHS = {
  POINTS: {
    REWARDS: (platform) => `/api/points/rewards/${platform}`,
    CREATE: (platform) => `/api/points/rewards/${platform}/create`,
    UPDATE: (platform, id) => `/api/points/rewards/${platform}/${id}`,
    DELETE: (platform, id) => `/api/points/rewards/${platform}/${id}`,
    TOGGLE: (id) => `/api/points/rewards/vk/${id}/toggle`,
    REDEMPTIONS: (platform) => `/api/points/rewards/${platform}/redemptions`,
  },
  YOUTUBE: {
    QUEUE: '/api/youtube/queue',
    ADD: '/api/youtube/add',
    SKIP: '/api/youtube/player/next',
    CLEAR: '/api/youtube/queue/clear',
  },
  TTS: {
    SETTINGS: '/api/tts/settings',
    VOICES: '/api/tts/voices',
    TEST: '/api/tts/test',
  }
};

export default {
  UI_SIZES,
  PLATFORM_COLORS,
  TIMINGS,
  LIMITS,
  TEXT,
  API_PATHS
};

