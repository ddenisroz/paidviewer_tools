/**
 * Унифицированный API клиент
 * Объединяет работу с Bot и TTS сервисами в удобном интерфейсе
 */

import {
    getAdminVoices as getAdminVoicesApi,
    uploadVoice as uploadVoiceApi,
    deleteVoice as deleteVoiceApi,
    updateVoiceSettings as updateVoiceSettingsApi,
    getUserVoices as getUserVoicesApi,
    uploadUserVoice as uploadUserVoiceApi,
    deleteUserVoice as deleteUserVoiceApi,
    updateUserVoiceSettings as updateUserVoiceSettingsApi,
    testVoice as testVoiceApi,
} from './microservices';

// --- Voice Management ---

// Admin
export const getAdminVoices = (token) => getAdminVoicesApi(token);
export const uploadVoice = (formData, token) => uploadVoiceApi(formData, token);
export const deleteVoice = (voiceId, token) => deleteVoiceApi(voiceId, token);
export const updateVoiceSettings = (voiceId, settings, token) => updateVoiceSettingsApi(voiceId, settings, token);

// User
export const getUserVoices = (userId, token) => getUserVoicesApi(userId, token);
export const uploadUserVoice = (userId, formData, token) => uploadUserVoiceApi(userId, formData, token);
export const deleteUserVoice = (voiceId, userId, token) => deleteUserVoiceApi(voiceId, userId, token);
export const updateUserVoiceSettings = (voiceId, userId, settings, token) => updateUserVoiceSettingsApi(voiceId, userId, settings, token);

// Common
export const testVoice = (formData, token) => testVoiceApi(formData, token);
