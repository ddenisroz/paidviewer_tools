/**
 * Chat Service - инкапсуляция всех Chat API вызовов
 */
import { apiClient } from '../client';
import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '../../../types';

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
  async getChatHistory(params: Record<string, any> = {}): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/chat/history', { params });
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
   * Подключить гостевой чат
   * @param data - Данные для подключения
   * @returns Promise с ответом API
   */
  async connectGuest(data: { channel_name: string; platform: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/chat/guest/connect', data);
  },

  /**
   * Проверить статус верификации гостя
   * @param data - Данные для проверки
   * @returns Promise с ответом API
   */
  async checkGuest(data: { channel_name: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/chat/guest/check', data);
  },

  /**
   * Финализировать гостевую сессию
   * @param data - Данные для финализации
   * @returns Promise с ответом API
   */
  async finalizeGuest(data: { channel_name: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/chat/guest/finalize', data);
  },

  /**
   * Отключить гостевой чат
   * @param data - Данные для отключения
   * @returns Promise с ответом API
   */
  async disconnectGuest(data: { channel_name: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/chat/guest/disconnect', data);
  },

  /**
   * Получить статус гостевого чата
   * @param channelName - Имя канала
   * @returns Promise с ответом API
   */
  async getGuestStatus(channelName: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/chat/guest/status', { params: { channel_name: channelName } });
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
};

