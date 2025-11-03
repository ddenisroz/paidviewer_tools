/**
 * Константы для frontend приложения
 * Централизованное хранение всех магических чисел, строк и конфигурационных значений
 */

// === URL КОНСТАНТЫ ===
import { getApiBaseUrl, getWebSocketBaseUrl, getTtsServiceUrl } from '../utils/urlUtils';

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWebSocketBaseUrl();
export const TTS_SERVICE_URL = getTtsServiceUrl();

// === МАРШРУТЫ ===
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  SETTINGS: '/dashboard/settings',
  TTS: '/dashboard/tts',
  MEDIA: '/dashboard/media',
  ANALYTICS: '/dashboard/analytics'
};

// === API ENDPOINTS ===
export const API_ENDPOINTS = {
  // Auth
  AUTH_STATUS: '/api/auth/status',
  AUTH_SESSION_STATUS: '/api/auth/session/status',
  AUTH_USER_ME: '/api/auth/user/me',
  AUTH_LOGOUT: '/auth/logout',
  
  // Twitch
  TWITCH_LOGIN: '/api/auth/twitch/login',
  TWITCH_AUTH: '/auth/twitch/login',
  
  // VK
  VK_AUTH: '/auth/vk/login',
  VK_GUEST_START: '/auth/vk/guest/start',
  VK_GUEST_VERIFY: '/auth/vk/guest/verify',
  
  // Bot
  BOT_CONNECT: '/api/chat/connect',
  BOT_DISCONNECT: '/api/chat/disconnect',
  BOT_STATUS: '/api/chat/status',
  BOT_RECONNECT: '/api/chat/reconnect',
  
  // TTS
  TTS_ENABLE: '/api/tts/enable',
  TTS_DISABLE: '/api/tts/disable',
  TTS_STATUS: '/api/tts/status',
  TTS_VK_ENABLE: '/api/tts/vk/enable',
  TTS_VK_DISABLE: '/api/tts/vk/disable',
  TTS_VK_STATUS: '/api/tts/vk/status',
  
  // Channels
  ACTIVE_CHANNELS: '/api/active-channels',
  
  // Admin
  ADMIN_SESSIONS: '/api/admin/sessions',
  ADMIN_BLOCKED_CHANNELS: '/api/admin/blocked-channels'
};

// === ВРЕМЕННЫЕ КОНСТАНТЫ (в миллисекундах) ===
export const TIMEOUTS = {
  TYPING_DELAY: 60,              // Задержка печатания заголовка
  VERIFICATION_TIMEOUT: 60000,   // 1 минута
  API_REQUEST_TIMEOUT: 10000,    // 10 секунд
  WEBSOCKET_RECONNECT: 3000,     // 3 секунды
  CACHE_DURATION: 15000,         // 15 секунд для кэша статуса бота
  TOAST_DURATION: 3000,          // 3 секунды для уведомлений
  DEBOUNCE_DELAY: 300            // Задержка для debounce
};

// === ПЛАТФОРМЫ ===
export const PLATFORMS = {
  TWITCH: 'twitch',
  VK: 'vk',
  YOUTUBE: 'youtube'
};

// === ПОЛЬЗОВАТЕЛЬСКИЕ РЕЖИМЫ ===
export const USER_MODES = {
  AUTH: 'auth',
  GUEST: 'guest'
};

// === СТАТУСЫ СОСТОЯНИЯ ===
export const STATUS = {
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  IDLE: 'idle'
};

// === ТИПЫ ТОСТОВ ===
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// === WEBSOCKET СОБЫТИЯ ===
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  ERROR: 'error',
  USER_CONNECTED: 'user_connected',
  USER_DISCONNECTED: 'user_disconnected',
  BOT_STATUS_CHANGE: 'bot_status_change',
  INTEGRATION_UPDATE: 'integration_update'
};

// === ЛОКАЛЬНОЕ ХРАНИЛИЩЕ КЛЮЧИ ===
export const STORAGE_KEYS = {
  USER_MODE: 'userMode',
  TTS_HEALTH_STATUS: 'tts_health_status',
  THEME: 'theme',
  LANGUAGE: 'language',
  GUEST_DATA: 'guestData'
};

// === COOKIE НАЗВАНИЯ ===
export const COOKIES = {
  SESSION_ID: 'session_id',
  GUEST_DATA: 'guestData'
};

// === СООБЩЕНИЯ ===
export const MESSAGES = {
  // Успех
  SUCCESS: {
    TWITCH_INTEGRATION_DISABLED: 'Интеграция с Twitch отключена',
    VK_INTEGRATION_DISABLED: 'Интеграция с VK Live отключена',
    TTS_ENABLED: 'TTS включен',
    TTS_DISABLED: 'TTS выключен',
    BOT_CONNECTED: 'Бот подключен',
    BOT_DISCONNECTED: 'Бот отключен',
    CODE_COPIED: 'Код скопирован в буфер обмена'
  },
  
  // Ошибки
  ERROR: {
    TWITCH_INTEGRATION_ERROR: 'Ошибка при обновлении интеграции Twitch',
    VK_INTEGRATION_ERROR: 'Ошибка при обновлении интеграции VK',
    TTS_TOGGLE_ERROR: 'Ошибка при переключении TTS',
    BOT_CONNECTION_ERROR: 'Ошибка подключения бота',
    API_ERROR: 'Ошибка API',
    NETWORK_ERROR: 'Ошибка сети',
    VALIDATION_ERROR: 'Ошибка валидации',
    UNAUTHORIZED: 'Неавторизованный доступ',
    FORBIDDEN: 'Доступ запрещен',
    NOT_FOUND: 'Не найдено'
  },
  
  // Информация
  INFO: {
    LOADING: 'Загрузка...',
    CONNECTING: 'Подключение...',
    VERIFYING: 'Проверка...',
    PROCESSING: 'Обработка...',
    NO_DATA: 'Нет данных',
    GUEST_MODE_RESTORED: 'Гостевой режим восстановлен, но требуется новая верификация'
  }
};

// === ВАЛИДАЦИЯ ===
export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 25,
    PATTERN: /^[a-zA-Z0-9_]{3,25}$/,
    ERROR_MESSAGE: 'Имя пользователя должно содержать от 3 до 25 символов (только буквы, цифры и _)'
  },
  
  VERIFICATION_CODE: {
    MIN_LENGTH: 4,
    MAX_LENGTH: 10,
    PATTERN: /^[A-Z0-9]{4,10}$/,
    ERROR_MESSAGE: 'Код должен содержать от 4 до 10 символов (только заглавные буквы и цифры)'
  },
  
  CHANNEL_NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 25,
    PATTERN: /^[a-zA-Z0-9_]{3,25}$/,
    ERROR_MESSAGE: 'Название канала должно содержать от 3 до 25 символов'
  }
};

// === АНИМАЦИИ ===
export const ANIMATION = {
  DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  },
  
  EASING: {
    EASE_IN: 'ease-in',
    EASE_OUT: 'ease-out',
    EASE_IN_OUT: 'ease-in-out'
  }
};

// === РАЗМЕРЫ И ЛИМИТЫ ===
export const LIMITS = {
  MESSAGE_MAX_LENGTH: 500,
  UPLOAD_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  CHANNELS_PER_PAGE: 20,
  HISTORY_MAX_ITEMS: 100
};

// === HTTP STATUS CODES ===
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

// === FEATURE FLAGS ===
export const FEATURES = {
  TTS_ENABLED: true,
  MEDIA_REQUESTS: true,
  CHAT_ANALYSIS: true,
  GUEST_MODE: true,
  ADMIN_PANEL: true,
  DARK_MODE: true
};

// === НАСТРОЙКИ ПО УМОЛЧАНИЮ ===
export const DEFAULTS = {
  THEME: 'dark',
  LANGUAGE: 'ru',
  PLATFORM: PLATFORMS.TWITCH,
  TTS_ENABLED: false,
  NOTIFICATIONS_ENABLED: true
};

// === ЦВЕТА (для использования в JavaScript) ===
export const COLORS = {
  PRIMARY: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#6366f1',
  
  PLATFORMS: {
    [PLATFORMS.TWITCH]: '#9146ff',
    [PLATFORMS.VK]: '#0077ff',
    [PLATFORMS.YOUTUBE]: '#ff0000'
  }
};

// === ИКОНКИ (emoji для простоты) ===
export const ICONS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  TTS: '🎤',
  BOT: '🤖',
  PLATFORM: {
    [PLATFORMS.TWITCH]: '🟣',
    [PLATFORMS.VK]: '🔵',
    [PLATFORMS.YOUTUBE]: '🔴'
  }
};

// === РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ ===
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  YOUTUBE_URL: /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/).+/,
  TWITCH_CHANNEL: /^[a-zA-Z0-9_]{4,25}$/,
  VK_CHANNEL: /^[a-zA-Z0-9_]{3,30}$/
};
