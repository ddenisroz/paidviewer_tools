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

  /**
   * Переключить mute пользователя
   * @param {Object} data - Данные { username, platform, channel_name }
   * @returns {Promise<AxiosResponse>}
   */
  async toggleMute(data) {
    return apiClient.post('/api/moderation/toggle-mute', data);
  },

  /**
   * Получить список заглушенных пользователей
   * @returns {Promise<AxiosResponse>}
   */
  async getMutedUsers() {
    return apiClient.get('/api/moderation/muted-users');
  },

  /**
   * Подключить гостевой чат
   * @param {Object} data - Данные { channel_name, platform }
   * @returns {Promise<AxiosResponse>}
   */
  async connectGuest(data) {
    return apiClient.post('/api/chat/guest/connect', data);
  },

  /**
   * Проверить статус верификации гостя
   * @param {Object} data - Данные { channel_name }
   * @returns {Promise<AxiosResponse>}
   */
  async checkGuest(data) {
    return apiClient.post('/api/chat/guest/check', data);
  },

  /**
   * Финализировать гостевую сессию
   * @param {Object} data - Данные { channel_name }
   * @returns {Promise<AxiosResponse>}
   */
  async finalizeGuest(data) {
    return apiClient.post('/api/chat/guest/finalize', data);
  },

  /**
   * Отключить гостевой чат
   * @param {Object} data - Данные { channel_name }
   * @returns {Promise<AxiosResponse>}
   */
  async disconnectGuest(data) {
    return apiClient.post('/api/chat/guest/disconnect', data);
  },

  /**
   * Получить статус гостевого чата
   * @param {string} channelName - Имя канала
   * @returns {Promise<AxiosResponse>}
   */
  async getGuestStatus(channelName) {
    return apiClient.get('/api/chat/guest/status', { params: { channel_name: channelName } });
  },

  /**
   * Получить статус бота для пользователя
   * @param {string} username - Имя пользователя
   * @returns {Promise<AxiosResponse>}
   */
  async getBotStatusForUser(username) {
    return apiClient.get(`/api/status/${username}`);
  },

  /**
   * Переключить статус TTS бота
   * @param {Object} data - Данные { is_enabled }
   * @returns {Promise<AxiosResponse>}
   */
  async toggleBotTts(data) {
    return apiClient.post('/api/bot/tts/toggle', data);
  },
};

