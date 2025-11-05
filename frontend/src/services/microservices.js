import axios from 'axios';
import { toast } from 'sonner';

import { TTS_SERVICE_URL, API_BASE_URL } from '../constants';
import { logger } from '../utils/prodLogger';
import { getErrorMessage, getOperationMessage } from '../utils/errorMessages';

export { TTS_SERVICE_URL };

export const botService = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// Response interceptor для обработки 401 ошибок
botService.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // 🔐 НЕ перенаправляем на /login для overlay routes (они работают по JWT token из URL)
            const isOverlayRoute = 
                window.location.pathname.startsWith('/chat-overlay') ||
                window.location.pathname.startsWith('/tts-obs') ||
                window.location.pathname.startsWith('/youtube-obs') ||
                window.location.pathname.startsWith('/drops-widget');
            
            if (!isOverlayRoute) {
                // Перенаправляем на страницу логина при 401 только для основного приложения
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);


export const ttsService = axios.create({
    baseURL: TTS_SERVICE_URL,
    withCredentials: true,
    timeout: 10000, // 10 секунд максимум для всех запросов к TTS
});

// --- Authentication ---
export const loginTwitch = async () => {
    try {
        logger.log('🔵 [TWITCH AUTH] Redirecting to /auth/twitch/login');
        // Прямой редирект на Twitch OAuth (бэкенд сделает 302 на Twitch)
        window.location.href = `${API_BASE_URL}/auth/twitch/login`;
    } catch (error) {
        logger.error('❌ Ошибка при входе через Twitch:', error);
        toast.error('Ошибка при входе через Twitch.');
    }
};

export const loginVk = async () => {
    try {
        logger.log('🔵 [VK AUTH] Redirecting to /auth/vk/login');
        // Прямой редирект на VK OAuth (бэкенд сделает 302 на VK)
        window.location.href = `${API_BASE_URL}/auth/vk/login`;
    } catch (error) {
        logger.error('❌ Ошибка при входе через VK Live:', error);
        toast.error('Ошибка при входе через VK Live.');
    }
};

export const logout = async () => {
    return await botService.post('/api/auth/logout');
};

export const getUser = async () => {
    return await botService.get('/api/auth/user/me');
};

// --- Bot Control ---
export const connectBot = async () => {
    return await botService.post('/api/chat/connect');
};

export const disconnectBot = async () => {
    return await botService.post('/api/chat/disconnect');
};

export const getBotStatus = async () => {
    return await botService.get('/api/chat/status');
};

// --- TTS Control ---
export const enableTts = async () => {
    return await botService.post('/api/tts/enable');
};

export const disableTts = async () => {
    return await botService.post('/api/tts/disable');
};

export const getTtsStatus = async (channelName = null) => {
    const params = channelName ? { channel_name: channelName } : {};
    return await botService.get('/api/tts/status', { params });
};

export const generateObsUrl = async () => {
    return await botService.post('/api/tts/generate-obs-url');
};


// --- Voice Management (TTS Service) ---

// Admin
export const getAdminVoices = async () => {
    // ✅ Используем botService для проверки прав доступа
    return await botService.get('/api/admin/voices');
};

// Global voices
export const getGlobalVoices = async () => {
    return await ttsService.get('/api/tts/voices/global');
};

export const uploadVoice = async (formData) => {
    // ✅ Используем botService для проверки прав доступа
    return await botService.post('/api/admin/voices/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const deleteVoice = async (voiceId) => {
    // ✅ Используем botService для проверки прав доступа
    return await botService.delete(`/api/admin/voices/${voiceId}`);
};

export const updateVoiceSettings = async (voiceId, settings) => {
    return await botService.put(`/api/admin/voices/${voiceId}/settings`, settings);
};

export const updateUserVoiceSettings = async (voiceId, userId, settings) => {
    return await ttsService.put(`/api/tts/user/voices/${voiceId}/settings?user_id=${userId}`, settings);
};

export const transcribeVoice = async (voiceId) => {
    return await botService.post(`/api/admin/voices/${voiceId}/transcribe`);
};

export const retranscribeVoice = async (voiceId) => {
    // ✅ Используем botService для проверки прав доступа
    // retranscribeVoice извлекает reference_text из аудиофайла автоматически
    return await botService.post(`/api/admin/voices/${voiceId}/retranscribe`);
};

export const retranscribeUserVoice = async (voiceId, userId, referenceText) => {
    const formData = new FormData();
    formData.append('reference_text', referenceText);
    return await ttsService.post(`/api/tts/user/voices/${voiceId}/retranscribe?user_id=${userId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const transcribeUserVoice = async (voiceId, userId) => {
    return await ttsService.post(`/api/tts/user/voices/${voiceId}/transcribe?user_id=${userId}`);
};

// Rename voice functions
export const renameVoice = async (voiceId, newName) => {
    // ✅ Используем botService для проверки прав доступа
    const formData = new FormData();
    formData.append('new_name', newName);
    return await botService.put(`/api/admin/voices/${voiceId}/rename`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const renameUserVoice = async (voiceId, userId, newName) => {
    const formData = new FormData();
    formData.append('new_name', newName);
    return await ttsService.put(`/api/tts/user/voices/${voiceId}/rename?user_id=${userId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const getUsers = async () => {
    return await botService.get('/api/admin/users');
};

// User
export const getUserVoices = async (userId) => {
    return await ttsService.get(`/api/tts/user/voices/${userId}`);
};

export const uploadUserVoice = async (userId, formData) => {
     return await ttsService.post(`/api/tts/user/voices/upload?user_id=${userId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const deleteUserVoice = async (voiceId, userId) => {
    return await ttsService.delete(`/api/tts/user/voices/${voiceId}?user_id=${userId}`);
};


// Common
export const testVoice = async (voiceName, userId, testText = "Ну так я гетеро, че мне пидоров бояться!", cfgStrength = null, speedPreset = null) => {
    // 📤 testVoice called with:', { voiceName, userId, cfgStrength, speedPreset });
    
    // ✅ Используем botService для проверки прав доступа (только админы)
    const payload = {
        voice_name: voiceName,
        user_id: userId,
        test_text: testText,
    };
    if (cfgStrength !== null) {
        payload.cfg_strength = cfgStrength;
    }
    if (speedPreset !== null) {
        payload.speed_preset = speedPreset;
    }
    
    // ✅ Используем botService - endpoint проверяет права доступа и проксирует в TTS Service
    return await botService.post('/api/admin/voices/test', payload);
};

// TTS Configuration API
export const getTtsConfig = async () => {
    return await ttsService.get('/api/tts/config');
};

export const updateTtsConfig = async (config) => {
    return await ttsService.put('/api/tts/config', config);
};


// --- Whitelist Management ---
export const getWhitelist = async (token) => {
    return await botService.get('/api/admin/whitelist', { headers: { Authorization: `Bearer ${token}` } });
};

export const addToWhitelist = async (username, token) => {
    return await botService.post('/api/admin/whitelist/add', { username }, { headers: { Authorization: `Bearer ${token}` } });
};

export const removeFromWhitelist = async (username, token) => {
    return await botService.delete('/api/admin/whitelist/remove', { 
        data: { username },
        headers: { Authorization: `Bearer ${token}` } 
    });
};

// --- Blocked Bots Management ---
export const getBlockedBots = async (token) => {
    return await botService.get('/api/admin/blocked-bots', { headers: { Authorization: `Bearer ${token}` } });
};

// --- Admin List ---
export const getAdminList = async () => {
    return await botService.get('/api/admin/list');
};

export const addBlockedBot = async (botName, token) => {
    return await botService.post('/api/admin/blocked-bots/add', { bot_name: botName }, { headers: { Authorization: `Bearer ${token}` } });
};

export const removeBlockedBot = async (botName, token) => {
    return await botService.delete(`/api/admin/blocked-bots/remove/${botName}`, { headers: { Authorization: `Bearer ${token}` } });
};


// --- YouTube Queue ---
export const getYoutubeQueue = async (token) => {
    return await botService.get('/api/youtube/queue', { headers: { Authorization: `Bearer ${token}` } });
};

export const youtubePlayerNext = async (token) => {
    return await botService.post('/api/youtube/player/next', {}, { headers: { Authorization: `Bearer ${token}` } });
};

export const youtubeQueueClear = async (token) => {
    return await botService.post('/api/youtube/queue/clear', {}, { headers: { Authorization: `Bearer ${token}` } });
};

// --- Twitch Stream Info ---
export const getStreamInfo = async (token) => {
    return await botService.get('/api/twitch/stream-info', { headers: { Authorization: `Bearer ${token}` } });
};

export const getTwitchCategories = async (search, token) => {
    return await botService.get(`/api/twitch/categories?search=${search}`, { headers: { Authorization: `Bearer ${token}` } });
};

export const updateStreamTitle = async (title, token) => {
    return await botService.post('/api/twitch/stream/title', { title }, { headers: { Authorization: `Bearer ${token}` } });
};

export const updateStreamCategory = async (categoryId, token) => {
    return await botService.post('/api/twitch/stream/category', { category_id: categoryId }, { headers: { Authorization: `Bearer ${token}` } });
};

// --- Stream Stats ---
export const getStreamHistory = async (token) => {
    return await botService.get('/api/stream/history', { headers: { Authorization: `Bearer ${token}` } });
};

// --- Health ---
export const getBotHealth = async () => {
    try {
        const response = await botService.get('/health');
        return response.data;
    } catch (error) {
        logger.error("Error fetching bot health:", error);
        return { status: 'unhealthy' };
    }
};

export const getTtsHealth = async () => {
    try {
        const response = await ttsService.get('/health');
        return response.data;
    } catch (error) {
        logger.error("Error fetching TTS health:", error);
        return { status: 'unhealthy', tts_engine_loaded: false };
    }
};

// Экспорт botService как microservicesAPI для совместимости
export const microservicesAPI = botService;

// Export error handling utilities
export { getErrorMessage, getOperationMessage };
