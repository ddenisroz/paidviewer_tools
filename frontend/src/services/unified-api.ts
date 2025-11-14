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

// Заглушки для методов, которые пока не реализованы в ttsService
// TODO: Реализовать эти методы в ttsService
export const getAdminVoices = (): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> => 
  ttsService.getGlobalVoices(); // Временно используем getGlobalVoices

export const updateVoiceSettings = (voiceId: number, settings: Record<string, any>): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('updateVoiceSettings not implemented yet'));

export const transcribeVoice = (voiceId: number): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('transcribeVoice not implemented yet'));

export const retranscribeVoice = (voiceId: number): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('retranscribeVoice not implemented yet'));

export const retranscribeUserVoice = (voiceId: number, userId: number, referenceText?: string): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('retranscribeUserVoice not implemented yet'));

export const renameVoice = (voiceId: number, newName: string): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('renameVoice not implemented yet'));

export const renameUserVoice = (voiceId: number, userId: number, newName: string): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('renameUserVoice not implemented yet'));

export const getUsers = (): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('getUsers not implemented yet'));

export const updateUserVoiceSettings = (voiceId: number, userId: number, settings: Record<string, any>): Promise<AxiosResponse<ApiResponse>> => 
  Promise.reject(new Error('updateUserVoiceSettings not implemented yet'));

