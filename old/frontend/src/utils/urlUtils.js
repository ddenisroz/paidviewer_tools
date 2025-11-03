/**
 * Утилиты для работы с URL в проекте
 * Обеспечивает переносимость между разными доменами
 */

/**
 * Получить базовый URL для API
 */
export const getApiBaseUrl = () => {
    const url = import.meta.env.VITE_BOT_SERVICE_URL;
    if (!url) {
        throw new Error('VITE_BOT_SERVICE_URL environment variable is required');
    }
    return url;
};

export const getTtsServiceUrl = () => {
    const url = import.meta.env.VITE_TTS_SERVICE_URL;
    if (!url) {
        throw new Error('VITE_TTS_SERVICE_URL environment variable is required');
    }
    return url;
};

/**
 * Получить базовый URL для WebSocket
 */
export const getWebSocketBaseUrl = () => {
    const apiUrl = getApiBaseUrl();
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = apiUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${wsBaseUrl}`;
};

/**
 * Получить URL для TTS WebSocket
 */
export const getTtsWebSocketUrl = (token) => {
    const wsBaseUrl = getWebSocketBaseUrl();
    return `${wsBaseUrl}/ws/tts/${token}`;
};

/**
 * Получить URL для чата WebSocket
 */
export const getChatWebSocketUrl = (userId) => {
    const wsBaseUrl = getWebSocketBaseUrl();
    return `${wsBaseUrl}/ws/chat/${userId}`;
};

/**
 * Получить URL для OBS WebSocket
 */
export const getObsWebSocketUrl = (token) => {
    const wsBaseUrl = getWebSocketBaseUrl();
    return `${wsBaseUrl}/ws/obs/${token}`;
};

/**
 * Получить URL для виджета чата WebSocket
 */
export const getChatWidgetWebSocketUrl = (userId) => {
    const wsBaseUrl = getWebSocketBaseUrl();
    return `${wsBaseUrl}/ws/chat-widget/${userId}`;
};

/**
 * Получить URL для виджета лутбокса WebSocket
 */
export const getLootboxWidgetWebSocketUrl = (userId) => {
    const wsBaseUrl = getWebSocketBaseUrl();
    return `${wsBaseUrl}/ws/lootbox-widget/${userId}`;
};

/**
 * Получить URL для YouTube OBS WebSocket
 */
export const getYoutubeObsWebSocketUrl = (token) => {
    const wsBaseUrl = getWebSocketBaseUrl();
    return `${wsBaseUrl}/ws/youtube-obs/${token}`;
};

/**
 * Получить URL для аудио файлов
 */
export const getAudioUrl = (filename) => {
    const apiUrl = getApiBaseUrl();
    return `${apiUrl}/audio/${filename}`;
};

/**
 * Получить URL для TTS API
 */
export const getTtsApiUrl = (endpoint) => {
    const apiUrl = getApiBaseUrl();
    return `${apiUrl}/api/tts/${endpoint}`;
};

/**
 * Получить URL для аутентификации
 */
export const getAuthUrl = (endpoint) => {
    const apiUrl = getApiBaseUrl();
    return `${apiUrl}/auth/${endpoint}`;
};

/**
 * Получить URL для API
 */
export const getApiUrl = (endpoint) => {
    const apiUrl = getApiBaseUrl();
    return `${apiUrl}/api/${endpoint}`;
};
