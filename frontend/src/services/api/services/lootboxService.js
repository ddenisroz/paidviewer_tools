/**
 * Lootbox Service - инкапсуляция всех Lootbox API вызовов
 */
import { apiClient } from '../client';

/**
 * Lootbox Service
 */
export const lootboxService = {
  /**
   * Получить прогрессию лутбоксов для канала
   * @param {string} channelName - Имя канала
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getProgression(channelName) {
    return apiClient.get(`/lootbox/progression/${channelName}`);
  },

  /**
   * Получить лутбоксы для канала
   * @param {string} channelName - Имя канала
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getLootboxes(channelName) {
    return apiClient.get(`/lootbox/lootboxes/${channelName}`);
  },

  /**
   * Получить недавние открытия лутбоксов
   * @param {string} channelName - Имя канала
   * @param {Object} params - Параметры запроса (limit)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getRecentOpenings(channelName, params = {}) {
    return apiClient.get(`/lootbox/recent/${channelName}`, { params });
  },

  /**
   * Открыть лутбокс
   * @param {Object} data - Данные { lootbox_id }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async openLootbox(data) {
    return apiClient.post('/lootbox/open', data);
  },

  /**
   * Получить список лутбоксов (админ)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAdminLootboxes() {
    return apiClient.get('/api/lootbox/admin/lootboxes');
  },

  /**
   * Получить список достижений (админ)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAdminAchievements() {
    return apiClient.get('/api/lootbox/admin/achievements');
  },

  /**
   * Создать лутбокс (админ)
   * @param {Object} data - Данные лутбокса
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async createLootbox(data) {
    return apiClient.post('/lootbox/admin/lootbox', data);
  },

  /**
   * Создать награду (админ)
   * @param {Object} data - Данные награды
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async createReward(data) {
    return apiClient.post('/lootbox/admin/lootbox/reward', data);
  },

  /**
   * Создать достижение (админ)
   * @param {Object} data - Данные достижения
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async createAchievement(data) {
    return apiClient.post('/lootbox/admin/achievement', data);
  },
};

