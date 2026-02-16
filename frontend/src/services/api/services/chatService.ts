/**
 * Chat Service - инкапсуляция всех Chat API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * Guest connection response type
 */
interface GuestConnectionResponse {
  verification_required?: boolean;
  verification_code?: string;
  timeout?: number;
  message?: string;
}

/**
 * Guest status response type
 */
interface GuestStatusResponse {
  verified?: boolean;
  connected?: boolean;
}

interface ChatAnalysisResponse {
  result?: string;
  channel_name?: string;
}

/**
 * Chat Service
 */
export const chatService = {
  /**
   * Подключить бота
   * @returns Promise с ответом API
   */
  async connectBot(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/chat/connect');
  },

  /**
   * Отключить бота
   * @returns Promise с ответом API
   */
  async disconnectBot(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/chat/disconnect');
  },

  /**
   * Получить статус бота
   * @returns Promise с ответом API
   */
  async getBotStatus(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/chat/status');
  },

  /**
   * Получить историю чата
   * @param params - Параметры запроса
   * @returns Promise с ответом API
   */
  async getChatHistory(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/chat/history', { params });
  },

  /**
   * Запустить анализ пользователя по сообщениям
   */
  async analyzeUser(data: { username: string; platform: 'twitch' | 'vk'; channel_name?: string }): Promise<AxiosResponse<ApiResponse<ChatAnalysisResponse>>> {
    return apiClient.post('/api/chat/analysis', data);
  },

  /**
   * Переключить mute пользователя
   * @param data - Данные для mute
   * @returns Promise с ответом API
   */
  async toggleMute(data: { username: string; platform: string; channel_name?: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/moderation/toggle-mute', data);
  },

  /**
   * Получить список заглушенных пользователей
   * @returns Promise с ответом API
   */
  async getMutedUsers(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/moderation/muted-users');
  },

  /**
   * Получить статус бота для пользователя
   * @param username - Имя пользователя
   * @returns Promise с ответом API
   */
  async getBotStatusForUser(username: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get(`/api/status/${username}`);
  },

  /**
   * Переключить статус TTS бота
   * @param data - Данные для переключения
   * @returns Promise с ответом API
   */
  async toggleBotTts(data: { is_enabled: boolean }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/bot/tts/toggle', data);
  },

  /**
   * Подключить гостя к каналу
   * @param data - Данные для подключения
   * @returns Promise с ответом API
   */
  async connectGuest(data: { channel_name: string; platform: 'twitch' | 'vk' }): Promise<AxiosResponse<ApiResponse<GuestConnectionResponse>>> {
    return apiClient.post('/api/guest/connect', data);
  },

  /**
   * Получить статус гостя
   * @param channelName - Имя канала
   * @returns Promise с ответом API
   */
  async getGuestStatus(channelName: string): Promise<AxiosResponse<ApiResponse<GuestStatusResponse>>> {
    return apiClient.get(`/api/guest/status/${channelName}`);
  },
};

