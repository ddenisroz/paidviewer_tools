/**
 * Унифицированный API клиент
 * Объединяет работу с Bot и TTS сервисами в удобном интерфейсе
 */

import { ttsService } from './api/services';

import type { ApiResponse } from '@/types/api';
import type { TtsVoice } from '@/types/tts';
import type { AxiosResponse } from 'axios';

// Реэкспортируем сервисы для удобства использования
export { ttsService };

// Voice Management API - обертки над ttsService для обратной совместимости
export const getGlobalVoices = (provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> =>
    ttsService.getGlobalVoices(provider);

export const getUserVoices = (
    userId: number,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> => ttsService.getUserVoices(userId, provider);

export const uploadVoice = (
    formData: FormData,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse<TtsVoice>>> => ttsService.uploadVoice(formData, provider);

export const uploadUserVoice = (
    userId: number,
    formData: FormData,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse<TtsVoice>>> => ttsService.uploadUserVoice(userId, formData, provider);

export const deleteVoice = (voiceId: number, provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse>> =>
    ttsService.deleteVoice(voiceId, provider);

export const deleteUserVoice = (
    voiceId: string,
    userId: number,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => ttsService.deleteUserVoice(voiceId, userId, provider);

export const testVoice = (
    voiceId: number,
    text: string,
    provider: 'f5' = 'f5',
    options?: { cfg_strength?: number; speed_preset?: string; reference_text?: string }
): Promise<AxiosResponse<ApiResponse>> => ttsService.testVoice(voiceId, text, provider, options);

// Admin voice management functions
export const getAdminVoices = async (
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.get('/api/voices/admin/global', { params: { provider } });
};

export const updateVoiceSettings = async (
    voiceId: number,
    settings: Record<string, unknown>,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.put(`/api/voices/admin/global/${voiceId}`, settings, { params: { provider } });
};

export const transcribeVoice = async (
    voiceId: number,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.post(`/api/voices/admin/global/${voiceId}/transcribe`, null, { params: { provider } });
};

export const retranscribeVoice = async (
    voiceId: number,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.post(`/api/voices/admin/global/${voiceId}/retranscribe`, null, { params: { provider } });
};

export const retranscribeUserVoice = async (
    voiceId: number,
    userId: number,
    referenceText?: string,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.post(
        `/api/voices/user/${voiceId}/retranscribe`,
        { user_id: userId, reference_text: referenceText },
        { params: { provider } }
    );
};

export const renameVoice = async (
    voiceId: number,
    newName: string,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.put(`/api/voices/admin/global/${voiceId}/rename`, { new_name: newName }, { params: { provider } });
};

export const renameUserVoice = async (
    voiceId: number,
    userId: number,
    newName: string,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.put(
        `/api/voices/user/${voiceId}/rename`,
        { user_id: userId, new_name: newName },
        { params: { provider } }
    );
};

export const getUsers = async (): Promise<AxiosResponse<ApiResponse>> => {
    const { adminService } = await import('./api/services/adminService');
    return adminService.getUsers({ page: 1, limit: 1000 });
};

export const updateUserVoiceSettings = async (
    voiceId: number,
    userId: number,
    settings: Record<string, unknown>,
    provider: 'f5' = 'f5'
): Promise<AxiosResponse<ApiResponse>> => {
    const { apiClient } = await import('./api/client');
    return apiClient.put(`/api/voices/user/settings/${voiceId}`, settings, { params: { provider } });
};
