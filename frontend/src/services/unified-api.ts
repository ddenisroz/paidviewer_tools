/**
 * Унифицированный API клиент
 * Объединяет работу с Bot и TTS сервисами в удобном интерфейсе
 */

import { ttsService } from './api/services';
import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '../types/api';
import type { TtsVoice } from '../types/tts';

// Реэкспортируем сервисы для удобства использования
export { ttsService };

// Voice Management API - обертки над ttsService для обратной совместимости
export const getGlobalVoices = (): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> => 
  ttsService.getGlobalVoices();

export const getUserVoices = (userId: number): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> => 
  ttsService.getUserVoices(userId);

export const uploadVoice = (formData: FormData): Promise<AxiosResponse<ApiResponse<TtsVoice>>> => 
  ttsService.uploadVoice(formData);

export const uploadUserVoice = (userId: number, formData: FormData): Promise<AxiosResponse<ApiResponse<TtsVoice>>> => 
  ttsService.uploadUserVoice(userId, formData);

export const deleteVoice = (voiceId: number): Promise<AxiosResponse<ApiResponse>> => 
  ttsService.deleteVoice(voiceId);

export const deleteUserVoice = (voiceId: string, userId: number): Promise<AxiosResponse<ApiResponse>> => 
  ttsService.deleteUserVoice(voiceId, userId);

export const testVoice = (voiceId: number, text: string): Promise<AxiosResponse<ApiResponse>> => 
  ttsService.testVoice(voiceId, text);

// Admin voice management functions
export const getAdminVoices = async (): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.get('/api/voices/admin/global');
};

export const updateVoiceSettings = async (voiceId: number, settings: Record<string, any>): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.put(`/api/voices/admin/global/${voiceId}`, settings);
};

export const transcribeVoice = async (voiceId: number): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.post(`/api/voices/admin/global/${voiceId}/transcribe`);
};

export const retranscribeVoice = async (voiceId: number): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.post(`/api/voices/admin/global/${voiceId}/retranscribe`);
};

export const retranscribeUserVoice = async (voiceId: number, userId: number, referenceText?: string): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.post(`/api/voices/user/${voiceId}/retranscribe`, { user_id: userId, reference_text: referenceText });
};

export const renameVoice = async (voiceId: number, newName: string): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.put(`/api/voices/admin/global/${voiceId}/rename`, { new_name: newName });
};

export const renameUserVoice = async (voiceId: number, userId: number, newName: string): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.put(`/api/voices/user/${voiceId}/rename`, { user_id: userId, new_name: newName });
};

export const getUsers = async (): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.get('/api/admin/users/list');
};

export const updateUserVoiceSettings = async (voiceId: number, userId: number, settings: Record<string, any>): Promise<AxiosResponse<ApiResponse>> => {
  const { apiClient } = await import('./api/client');
  return apiClient.put(`/api/voices/user/settings/${voiceId}`, settings);
};

