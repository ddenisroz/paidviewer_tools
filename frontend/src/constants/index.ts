/**
 * Константы для frontend приложения (TypeScript)
 */
import { getApiBaseUrl, getWebSocketBaseUrl } from '@/shared/utils/urlUtils';

export const API_BASE_URL: string = getApiBaseUrl();
export const WS_BASE_URL: string = getWebSocketBaseUrl();

export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    SETTINGS: '/dashboard/settings',
    TTS: '/dashboard/tts',
    MEDIA: '/dashboard/media',
    ANALYTICS: '/dashboard/analytics',
} as const;

export const API_ENDPOINTS = {
    AUTH_STATUS: '/api/auth/status',
    AUTH_SESSION_STATUS: '/api/auth/session/status',
    AUTH_USER_ME: '/api/auth/user/me',
    AUTH_LOGOUT: '/auth/logout',
    TWITCH_LOGIN: '/api/auth/twitch/login',
    TWITCH_AUTH: '/auth/twitch/login',
    VK_AUTH: '/auth/vk/login',
    BOT_CONNECT: '/api/chat/connect',
    BOT_DISCONNECT: '/api/chat/disconnect',
    BOT_STATUS: '/api/chat/status',
    BOT_RECONNECT: '/api/chat/reconnect',
    TTS_ENABLE: '/api/tts/enable',
    TTS_DISABLE: '/api/tts/disable',
    TTS_STATUS: '/api/tts/status',
    TTS_VK_ENABLE: '/api/tts/vk/enable',
    TTS_VK_DISABLE: '/api/tts/vk/disable',
    TTS_VK_STATUS: '/api/tts/vk/status',
    ACTIVE_CHANNELS: '/api/active-channels',
    ADMIN_SESSIONS: '/api/admin/sessions',
    ADMIN_BLOCKED_CHANNELS: '/api/admin/blocked-channels',
} as const;

export const TIMEOUTS = {
    TYPING_DELAY: 60,
    VERIFICATION_TIMEOUT: 60000,
    API_REQUEST_TIMEOUT: 10000,
    WEBSOCKET_RECONNECT: 3000,
    CACHE_DURATION: 15000,
    TOAST_DURATION: 3000,
    DEBOUNCE_DELAY: 300,
} as const;

export const PLATFORMS = {
    TWITCH: 'twitch',
    VK: 'vk',
    YOUTUBE: 'youtube',
} as const;

export const USER_MODES = {
    AUTH: 'auth',
} as const;

export const STATUS = {
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error',
    IDLE: 'idle',
} as const;

export const TOAST_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
} as const;

export const WS_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    MESSAGE: 'message',
    ERROR: 'error',
    USER_CONNECTED: 'user_connected',
    USER_DISCONNECTED: 'user_disconnected',
    BOT_STATUS_CHANGE: 'bot_status_change',
    INTEGRATION_UPDATE: 'integration_update',
} as const;

export const STORAGE_KEYS = {
    USER_MODE: 'userMode',
    TTS_HEALTH_STATUS: 'tts_health_status',
    TTS_LISTENING_MODE: 'tts_listening_mode',
    THEME: 'theme',
    LANGUAGE: 'language',
} as const;

export const COOKIES = {
    SESSION_ID: 'session_id',
} as const;

export const MESSAGES = {
    SUCCESS: {
        TWITCH_INTEGRATION_DISABLED: 'Интеграция с Twitch отключена',
        VK_INTEGRATION_DISABLED: 'Интеграция с VK Live отключена',
        TTS_ENABLED: 'TTS включен',
        TTS_DISABLED: 'TTS выключен',
        BOT_CONNECTED: 'Бот подключен',
        BOT_DISCONNECTED: 'Бот отключен',
        CODE_COPIED: 'Код скопирован в буфер обмена',
    },
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
        NOT_FOUND: 'Не найдено',
    },
    INFO: {
        LOADING: 'Загрузка...',
        CONNECTING: 'Подключение...',
        VERIFYING: 'Проверка...',
        PROCESSING: 'Обработка...',
        NO_DATA: 'Нет данных',
    },
} as const;

export const VALIDATION = {
    USERNAME: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 25,
        PATTERN: /^[a-zA-Z0-9_]{3,25}$/,
        ERROR_MESSAGE: 'Имя пользователя должно содержать от 3 до 25 символов (только буквы, цифры и _)',
    },
    VERIFICATION_CODE: {
        MIN_LENGTH: 4,
        MAX_LENGTH: 10,
        PATTERN: /^[A-Z0-9]{4,10}$/,
        ERROR_MESSAGE: 'Код должен содержать от 4 до 10 символов (только заглавные буквы и цифры)',
    },
    CHANNEL_NAME: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 25,
        PATTERN: /^[a-zA-Z0-9_]{3,25}$/,
        ERROR_MESSAGE: 'Название канала должно содержать от 3 до 25 символов',
    },
} as const;

export const ANIMATION = {
    DURATION: {
        FAST: 150,
        NORMAL: 300,
        SLOW: 500,
    },
    EASING: {
        EASE_IN: 'ease-in',
        EASE_OUT: 'ease-out',
        EASE_IN_OUT: 'ease-in-out',
    },
} as const;

export const LIMITS = {
    MESSAGE_MAX_LENGTH: 500,
    UPLOAD_MAX_SIZE: 10 * 1024 * 1024,
    CHANNELS_PER_PAGE: 20,
    HISTORY_MAX_ITEMS: 100,
} as const;

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
} as const;

export const FEATURES = {
    TTS_ENABLED: true,
    MEDIA_REQUESTS: true,
    CHAT_ANALYSIS: true,
    ADMIN_PANEL: true,
    DARK_MODE: true,
} as const;

export const COLORS = {
    PRIMARY: '#3b82f6',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#6366f1',
    PLATFORMS: {
        [PLATFORMS.TWITCH]: '#9146ff',
        [PLATFORMS.VK]: '#0077ff',
        [PLATFORMS.YOUTUBE]: '#ff0000',
    },
} as const;

export const ICONS = {
    SUCCESS: '[OK]',
    ERROR: '[ERROR]',
    WARNING: '[WARN]',
    INFO: '[INFO]',
    LOADING: '⏳',
    TTS: '[TTS]',
    BOT: '[BOT]',
    PLATFORM: {
        [PLATFORMS.TWITCH]: '[TW]',
        [PLATFORMS.VK]: '[VK]',
        [PLATFORMS.YOUTUBE]: '[YT]',
    },
} as const;

export const REGEX = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+/,
    YOUTUBE_URL: /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/).+/,
    TWITCH_CHANNEL: /^[a-zA-Z0-9_]{4,25}$/,
    VK_CHANNEL: /^[a-zA-Z0-9_]{3,30}$/,
} as const;
