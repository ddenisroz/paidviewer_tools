/**
 * Chatbox Service - инкапсуляция всех Chatbox API вызовов
 */
import { apiClient } from '../client';

/**
 * Chatbox Service
 */
export const chatboxService = {
  /**
   * Получить настройки Chatbox
   * @returns {Promise<AxiosResponse>}
   */
  async getSettings() {
    return apiClient.get('/api/chatbox/settings');
  },

  /**
   * Сохранить настройки Chatbox
   * @param {Object} settings - Настройки Chatbox
   * @param {boolean} regenerateToken - Регенерировать токен виджета
   * @returns {Promise<AxiosResponse>}
   */
  async saveSettings(settings, regenerateToken = false) {
    return apiClient.post('/api/chatbox/settings', settings, {
      params: { regenerate_token: regenerateToken },
    });
  },

  /**
   * Получить настройки Chatbox по токену
   * @param {string} token - Токен виджета
   * @returns {Promise<AxiosResponse>}
   */
  async getSettingsByToken(token) {
    return apiClient.get(`/api/chatbox/settings/by-token/${token}`);
  },
};

