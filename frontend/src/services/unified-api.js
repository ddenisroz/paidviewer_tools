/**
 * Унифицированный API клиент
 * Объединяет работу с Bot и TTS сервисами в удобном интерфейсе
 */

import {
    botService,
    ttsService,
    getAdminVoices as getAdminVoicesApi,
    getGlobalVoices as getGlobalVoicesApi,
    uploadVoice as uploadVoiceApi,
    deleteVoice as deleteVoiceApi,
    updateVoiceSettings as updateVoiceSettingsApi,
    transcribeVoice as transcribeVoiceApi,
    retranscribeVoice as retranscribeVoiceApi,
    retranscribeUserVoice as retranscribeUserVoiceApi,
    renameVoice as renameVoiceApi,
    renameUserVoice as renameUserVoiceApi,
    getUsers as getUsersApi,
    getUserVoices as getUserVoicesApi,
    uploadUserVoice as uploadUserVoiceApi,
    deleteUserVoice as deleteUserVoiceApi,
    updateUserVoiceSettings as updateUserVoiceSettingsApi,
    transcribeUserVoice as transcribeUserVoiceApi,
    testVoice as testVoiceApi,
} from './microservices';

// Реэкспортируем сервисы для удобства использования
export { botService, ttsService };

// --- Voice Management ---

// Admin
export const getAdminVoices = () => getAdminVoicesApi();
export const getGlobalVoices = () => getGlobalVoicesApi();
export const uploadVoice = (formData) => uploadVoiceApi(formData);
export const deleteVoice = (voiceId) => deleteVoiceApi(voiceId);
export const updateVoiceSettings = (voiceId, settings) => updateVoiceSettingsApi(voiceId, settings);
export const transcribeVoice = (voiceId) => transcribeVoiceApi(voiceId);
export const retranscribeVoice = (voiceId) => retranscribeVoiceApi(voiceId);
export const renameVoice = (voiceId, newName) => renameVoiceApi(voiceId, newName);
export const getUsers = () => getUsersApi();

// User
export const getUserVoices = (userId) => getUserVoicesApi(userId);
export const uploadUserVoice = (userId, formData) => uploadUserVoiceApi(userId, formData);
export const deleteUserVoice = (voiceId, userId) => deleteUserVoiceApi(voiceId, userId);
export const updateUserVoiceSettings = (voiceId, userId, settings) => updateUserVoiceSettingsApi(voiceId, userId, settings);
export const transcribeUserVoice = (voiceId, userId) => transcribeUserVoiceApi(voiceId, userId);
export const renameUserVoice = (voiceId, userId, newName) => renameUserVoiceApi(voiceId, userId, newName);
export const retranscribeUserVoice = (voiceId, userId, referenceText) => retranscribeUserVoiceApi(voiceId, userId, referenceText);

// Common
export const testVoice = (voiceName, userId, testText, cfgStrength, speedPreset) => testVoiceApi(voiceName, userId, testText, cfgStrength, speedPreset);
