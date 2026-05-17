// Константы для валидации (TypeScript)

export const VALIDATION = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 20,
    USERNAME_REGEX: /^[a-zA-Z0-9_]+$/,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]/,
    CHANNEL_NAME_REGEX: /^[a-zA-Z0-9_]+$/,
    CHANNEL_NAME_MIN_LENGTH: 3,
    CHANNEL_NAME_MAX_LENGTH: 25,
    MESSAGE_MAX_LENGTH: 500,
    MESSAGE_MIN_LENGTH: 1,
    TTS_TEXT_MAX_LENGTH: 200,
    TTS_SPEED_MIN: 0.5,
    TTS_SPEED_MAX: 2.0,
    TTS_PITCH_MIN: 0.5,
    TTS_PITCH_MAX: 2.0,
    TTS_VOLUME_MIN: 0.0,
    TTS_VOLUME_MAX: 1.0,
} as const;

export const TIMEOUTS = {
    API_REQUEST: 10000,
    WEBSOCKET_RECONNECT: 5000,
    DEBOUNCE: 300,
    TOAST_DISPLAY: 5000,
    SESSION_CHECK: 30000,
} as const;

export const REGEX = {
    ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
    ALPHANUMERIC_UNDERSCORE: /^[a-zA-Z0-9_]+$/,
    NUMERIC: /^\d+$/,
    FLOAT: /^\d*\.?\d+$/,
    URL: /^https?:\/\/.+/,
    WEBSOCKET_URL: /^wss?:\/\/.+/,
    TWITCH_URL: /^https?:\/\/(www\.)?twitch\.tv\//,
    VK_URL: /^https?:\/\/(www\.)?vk\.com\//,
    YOUTUBE_URL: /^https?:\/\/(www\.)?youtube\.com\//,
    AUDIO_FILES: /\.(mp3|wav|ogg|m4a)$/i,
    IMAGE_FILES: /\.(jpg|jpeg|png|gif|webp)$/i,
    VIDEO_FILES: /\.(mp4|avi|mov|wmv|flv)$/i,
} as const;

export const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    SERVER_ERROR: 'SERVER_ERROR',
    TIMEOUT: 'TIMEOUT',
    RATE_LIMITED: 'RATE_LIMITED',
} as const;

export const SUCCESS_CODES = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    DELETED: 'DELETED',
    CONNECTED: 'CONNECTED',
    DISCONNECTED: 'DISCONNECTED',
    SAVED: 'SAVED',
} as const;
