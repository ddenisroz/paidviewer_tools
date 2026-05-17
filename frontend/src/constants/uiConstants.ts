export const UI_SIZES = {
    YOUTUBE_PLAYER_WIDTH: 'w-[360px]',
    YOUTUBE_PLAYER_HEIGHT: 'h-[150px]',
    YOUTUBE_CONTROL_BUTTON_HEIGHT: 'h-12',
    REWARD_ICON_SIZE: 'w-16 h-16',
    REWARD_ICON_SMALL: 'w-8 h-8',
    ACTION_BUTTON_WIDTH: 'w-32',
    ACTION_BUTTON_HEIGHT: 'h-9',
    SIDEBAR_WIDTH: 'w-64',
    SIDEBAR_ICON_SIZE: 'h-6 w-6',
    SIDEBAR_ICON_SMALL: 'h-4 w-4',
    LOADER_SIZE: 'w-8 h-8',
    LOADER_SIZE_SMALL: 'w-4 h-4',
} as const;

export const PLATFORM_COLORS = {
    TWITCH: '#9146FF', // Purple
    VK_LIVE: '#FF4444', // Red
    YOUTUBE: '#FF0000',
    DEFAULT: '#9146ff',
} as const;

export const TIMINGS = {
    CACHE_TTL: 30000,
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 200,
    TOAST_DURATION: 3000,
    WEBSOCKET_RECONNECT_DELAY: 3000,
} as const;

export const LIMITS = {
    MAX_QUEUE_SIZE: 100,
    MAX_REWARD_TITLE_LENGTH: 45,
    MAX_REWARD_DESCRIPTION_LENGTH: 200,
    VIRTUALIZATION_THRESHOLD: 50,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
} as const;

export const TEXT = {
    ERRORS: {
        NETWORK: 'Проверьте подключение к интернету',
        SESSION_EXPIRED: 'Сессия истекла. Войдите заново',
        UNAUTHORIZED: 'Необходима авторизация',
        NOT_FOUND: 'Ресурс не найден',
        SERVER_ERROR: 'Ошибка сервера. Попробуйте позже',
        GENERIC: 'Произошла ошибка',
    },
    SUCCESS: {
        SAVED: 'Сохранено',
        DELETED: 'Удалено',
        UPDATED: 'Обновлено',
        COPIED: 'Скопировано',
    },
} as const;

export const API_PATHS = {
    POINTS: {
        REWARDS: (platform: 'twitch' | 'vk') => `/api/points/rewards/${platform}`,
        CREATE: (platform: 'twitch' | 'vk') => `/api/points/rewards/${platform}/create`,
        UPDATE: (platform: 'twitch' | 'vk', id: string) => `/api/points/rewards/${platform}/${id}`,
        DELETE: (platform: 'twitch' | 'vk', id: string) => `/api/points/rewards/${platform}/${id}`,
        TOGGLE: (id: string) => `/api/points/rewards/vk/${id}/toggle`,
        REDEMPTIONS: (platform: 'twitch' | 'vk') => `/api/points/rewards/${platform}/redemptions`,
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
    },
} as const;

export default {
    UI_SIZES,
    PLATFORM_COLORS,
    TIMINGS,
    LIMITS,
    TEXT,
    API_PATHS,
};
