/**
 * Stream Service - инкапсуляция всех Stream API вызовов
 */
import { apiClient } from '../client';

/**
 * Stream Service
 */
export const streamService = {
  /**
   * Получить информацию о стриме Twitch
   * @param {Object} params - Параметры запроса (force и т.д.)
   * @returns {Promise<AxiosResponse>}
   */
  async getTwitchStreamInfo(params = {}) {
    return apiClient.get('/api/twitch/stream-info', { params });
  },

  /**
   * Получить информацию о стриме VK
   * @param {Object} params - Параметры запроса (force и т.д.)
   * @returns {Promise<AxiosResponse>}
   */
  async getVkStreamInfo(params = {}) {
    return apiClient.get('/api/vk/stream-info', { params });
  },

  /**
   * Обновить название стрима Twitch
   * @param {string} title - Название стрима
   * @returns {Promise<AxiosResponse>}
   */
  async updateTwitchStreamTitle(title) {
    return apiClient.post('/api/twitch/stream/title', { title });
  },

  /**
   * Обновить категорию стрима Twitch
   * @param {string} categoryId - ID категории
   * @returns {Promise<AxiosResponse>}
   */
  async updateTwitchStreamCategory(categoryId) {
    return apiClient.post('/api/twitch/stream/category', { category_id: categoryId });
  },

  /**
   * Обновить название стрима VK
   * @param {string} title - Название стрима
   * @returns {Promise<AxiosResponse>}
   */
  async updateVkStreamTitle(title) {
    return apiClient.post('/api/vk/stream/title', { title });
  },

  /**
   * Обновить категорию стрима VK
   * @param {string} categoryId - ID категории
   * @returns {Promise<AxiosResponse>}
   */
  async updateVkStreamCategory(categoryId) {
    return apiClient.post('/api/vk/stream/category', { category_id: categoryId });
  },

  /**
   * Получить категории Twitch
   * @param {string} search - Поисковый запрос
   * @returns {Promise<AxiosResponse>}
   */
  async getTwitchCategories(search = '') {
    return apiClient.get('/api/twitch/categories', {
      params: { search },
    });
  },

  /**
   * Получить категории VK
   * @param {string} search - Поисковый запрос
   * @returns {Promise<AxiosResponse>}
   */
  async getVkCategories(search = '') {
    return apiClient.get('/api/vk/categories', {
      params: { search },
    });
  },

  /**
   * Получить историю стримов
   * @returns {Promise<AxiosResponse>}
   */
  async getStreamHistory() {
    return apiClient.get('/api/stream/history');
  },

  /**
   * Обновить данные стрима (название и категория)
   * @param {Object} payload - Данные для обновления (twitch, vk)
   * @returns {Promise<AxiosResponse>}
   */
  async updateStream(payload) {
    return apiClient.post('/api/stream/update', payload);
  },
};

