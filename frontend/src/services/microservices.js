import axios from 'axios';

const botService = axios.create({
    baseURL: import.meta.env.VITE_BOT_SERVICE_URL || 'http://localhost:8000',
    withCredentials: true,
});

const ttsService = axios.create({
    baseURL: import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001',
});

// --- Authentication ---
export const loginTwitch = () => {
    window.location.href = `${botService.defaults.baseURL}/api/auth/twitch/login`;
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

export const getTtsStatus = async () => {
    return await botService.get('/api/tts/status');
};

export const generateObsUrl = async () => {
    return await botService.post('/api/tts/generate-obs-url');
};


// --- Voice Management (TTS Service) ---

// Admin
export const getAdminVoices = async () => {
    return await ttsService.get('/api/admin/voices');
};

// Global voices
export const getGlobalVoices = async () => {
    return await ttsService.get('/api/voices/global');
};

export const uploadVoice = async (formData) => {
    return await ttsService.post('/api/admin/voices/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const deleteVoice = async (voiceId) => {
    return await ttsService.delete(`/api/admin/voices/${voiceId}`);
};

export const updateVoiceSettings = async (voiceId, settings) => {
    return await ttsService.put(`/api/admin/voices/${voiceId}/settings`, settings);
};

export const updateUserVoiceSettings = async (voiceId, userId, settings) => {
    return await ttsService.put(`/api/user/voices/${voiceId}/settings?user_id=${userId}`, settings);
};

export const transcribeVoice = async (voiceId) => {
    return await ttsService.post(`/api/admin/voices/${voiceId}/transcribe`);
};

export const transcribeUserVoice = async (voiceId, userId) => {
    return await ttsService.post(`/api/user/voices/${voiceId}/transcribe?user_id=${userId}`);
};

// Rename voice functions
export const renameVoice = async (voiceId, newName) => {
    const formData = new FormData();
    formData.append('new_name', newName);
    return await ttsService.put(`/api/admin/voices/${voiceId}/rename`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const renameUserVoice = async (voiceId, userId, newName) => {
    const formData = new FormData();
    formData.append('new_name', newName);
    return await ttsService.put(`/api/user/voices/${voiceId}/rename?user_id=${userId}`, formData, {
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
    return await ttsService.get(`/api/user/voices?user_id=${userId}`);
};

export const uploadUserVoice = async (userId, formData) => {
     return await ttsService.post(`/api/user/voices/upload?user_id=${userId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const deleteUserVoice = async (voiceId, userId) => {
    return await ttsService.delete(`/api/user/voices/${voiceId}?user_id=${userId}`);
};


// Common
export const testVoice = async (voiceName, userId, testText = "Ну так я гетеро, че мне пидоров бояться!", cfgStrength = null) => {
    const formData = new FormData();
    formData.append('voice_name', voiceName);
    formData.append('user_id', userId);
    formData.append('test_text', testText);
    if (cfgStrength !== null) {
        formData.append('cfg_strength', cfgStrength);
    }
    
    return await ttsService.post('/api/voices/test', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
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
        console.error("Error fetching bot health:", error);
        return { status: 'unhealthy' };
    }
};

export const getTtsHealth = async () => {
    try {
        const response = await ttsService.get('/health');
        return response.data;
    } catch (error) {
        console.error("Error fetching TTS health:", error);
        return { status: 'unhealthy', tts_engine_loaded: false };
    }
};
