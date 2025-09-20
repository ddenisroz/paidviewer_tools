/**
 * Унифицированный API клиент
 * Объединяет работу с Bot и TTS сервисами в удобном интерфейсе
 */

import {
    getAdminVoices as getAdminVoicesApi,
    uploadVoice as uploadVoiceApi,
    deleteVoice as deleteVoiceApi,
    updateVoiceSettings as updateVoiceSettingsApi,
    getUsers as getUsersApi,
    getUserVoices as getUserVoicesApi,
    uploadUserVoice as uploadUserVoiceApi,
    deleteUserVoice as deleteUserVoiceApi,
    updateUserVoiceSettings as updateUserVoiceSettingsApi,
    testVoice as testVoiceApi,
} from './microservices';

// --- Voice Management ---

// Admin
export const getAdminVoices = () => getAdminVoicesApi();
export const uploadVoice = (formData) => uploadVoiceApi(formData);
export const deleteVoice = (voiceId) => deleteVoiceApi(voiceId);
export const updateVoiceSettings = (voiceId, settings) => updateVoiceSettingsApi(voiceId, settings);
export const getUsers = () => getUsersApi();

// User
export const getUserVoices = (userId) => getUserVoicesApi(userId);
export const uploadUserVoice = (userId, formData) => uploadUserVoiceApi(userId, formData);
export const deleteUserVoice = (voiceId, userId) => deleteUserVoiceApi(voiceId, userId);
export const updateUserVoiceSettings = (voiceId, userId, settings) => updateUserVoiceSettingsApi(voiceId, userId, settings);

// Common
export const testVoice = (voiceName, userId, testText) => testVoiceApi(voiceName, userId, testText);
