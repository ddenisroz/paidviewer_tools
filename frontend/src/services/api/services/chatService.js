/**
 * Chat Service - инкапсуляция всех Chat API вызовов
 */
import { apiClient } from '../client';

/**
 * Chat Service
 */
export const chatService = {
  /**
   * Подключить бота
   * @returns {Promise<AxiosResponse>}
   */
  async connectBot() {
    return apiClient.post('/api/chat/connect');
  },

  /**
   * Отключить бота
   * @returns {Promise<AxiosResponse>}
   */
  async disconnectBot() {
    return apiClient.post('/api/chat/disconnect');
  },

  /**
   * Получить статус бота
   * @returns {Promise<AxiosResponse>}
   */
  async getBotStatus() {
    return apiClient.get('/api/chat/status');
  },

  /**
   * Получить историю чата
   * @param {Object} params - Параметры запроса
   * @returns {Promise<AxiosResponse>}
   */
  async getChatHistory(params = {}) {
    return apiClient.get('/api/chat/history', { params });
  },
};

