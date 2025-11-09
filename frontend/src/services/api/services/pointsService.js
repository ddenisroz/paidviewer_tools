/**
 * Points Service - инкапсуляция всех Points API вызовов
 */
import { apiClient } from '../client';

/**
 * Points Service
 */
export const pointsService = {
  /**
   * Получить награды платформы
   * @param {string} platform - Платформа (twitch, vk)
   * @returns {Promise<AxiosResponse>}
   */
  async getPlatformRewards(platform) {
    return apiClient.get('/api/points/platform/rewards', {
      params: { platform },
    });
  },

  /**
   * Создать награду платформы
   * @param {string} platform - Платформа (twitch, vk)
   * @param {Object} reward - Данные награды
   * @returns {Promise<AxiosResponse>}
   */
  async createPlatformReward(platform, reward) {
    return apiClient.post('/api/points/platform/rewards/create', reward, {
      params: { platform },
    });
  },

  /**
   * Обновить награду платформы
   * @param {string} platform - Платформа (twitch, vk)
   * @param {string} rewardId - ID награды
   * @param {Object} reward - Данные награды
   * @returns {Promise<AxiosResponse>}
   */
  async updatePlatformReward(platform, rewardId, reward) {
    return apiClient.put(`/api/points/platform/rewards/${rewardId}`, reward, {
      params: { platform },
    });
  },

  /**
   * Удалить награду платформы
   * @param {string} platform - Платформа (twitch, vk)
   * @param {string} rewardId - ID награды
   * @returns {Promise<AxiosResponse>}
   */
  async deletePlatformReward(platform, rewardId) {
    return apiClient.delete(`/api/points/platform/rewards/${rewardId}`, {
      params: { platform },
    });
  },

  /**
   * Переключить статус награды платформы (включить/выключить)
   * @param {string} platform - Платформа (twitch, vk)
   * @param {string} rewardId - ID награды
   * @param {boolean} isEnabled - Включена ли награда
   * @returns {Promise<AxiosResponse>}
   */
  async togglePlatformReward(platform, rewardId, isEnabled) {
    return apiClient.put(`/api/points/platform/rewards/${rewardId}`, {
      is_enabled: isEnabled,
    }, {
      params: { platform },
    });
  },
};

