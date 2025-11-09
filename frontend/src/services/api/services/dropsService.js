/**
 * Drops Service - инкапсуляция всех Drops API вызовов
 */
import { apiClient } from '../client';

/**
 * Drops Service
 */
export const dropsService = {
  /**
   * Получить конфигурацию Drops
   * @param {string} channelName - Имя канала
   * @returns {Promise<AxiosResponse>}
   */
  async getConfig(channelName) {
    return apiClient.get(`/api/drops/config/${channelName}`);
  },

  /**
   * Обновить конфигурацию Drops
   * @param {string} channelName - Имя канала
   * @param {Object} config - Конфигурация Drops
   * @returns {Promise<AxiosResponse>}
   */
  async updateConfig(channelName, config) {
    return apiClient.put(`/api/drops/config/${channelName}`, config);
  },

  /**
   * Получить качества Drops
   * @returns {Promise<AxiosResponse>}
   */
  async getQualities() {
    return apiClient.get('/api/drops/qualities');
  },

  /**
   * Получить награды Drops
   * @param {string} channelName - Имя канала
   * @returns {Promise<AxiosResponse>}
   */
  async getRewards(channelName) {
    // Награды общие для всех платформ, platform параметр игнорируется на бэкенде
    return apiClient.get(`/api/drops/rewards/${channelName}`, {
      params: { platform: 'twitch' }, // Для совместимости
    });
  },

  /**
   * Создать награду Drops
   * @param {string} channelName - Имя канала
   * @param {Object} reward - Данные награды
   * @returns {Promise<AxiosResponse>}
   */
  async createReward(channelName, reward) {
    // Backend endpoint: POST /api/drops/rewards/{channel_name}?platform=twitch
    // Параметр platform передается для совместимости, но награда будет общей для всех платформ
    return apiClient.post(`/api/drops/rewards/${channelName}`, reward, {
      params: { platform: reward.platform || 'twitch' }
    });
  },

  /**
   * Обновить награду Drops
   * @param {string} channelName - Имя канала (не используется в endpoint, но оставлен для совместимости)
   * @param {number} rewardId - ID награды
   * @param {Object} reward - Данные награды
   * @returns {Promise<AxiosResponse>}
   */
  async updateReward(channelName, rewardId, reward) {
    // Backend endpoint: PUT /api/drops/rewards/{reward_id}
    return apiClient.put(`/api/drops/rewards/${rewardId}`, reward);
  },

  /**
   * Удалить награду Drops
   * @param {string} channelName - Имя канала (не используется в endpoint, но оставлен для совместимости)
   * @param {number} rewardId - ID награды
   * @returns {Promise<AxiosResponse>}
   */
  async deleteReward(channelName, rewardId) {
    // Backend endpoint: DELETE /api/drops/rewards/{reward_id}
    return apiClient.delete(`/api/drops/rewards/${rewardId}`);
  },

  /**
   * Переключить активность награды
   * @param {string} channelName - Имя канала (не используется в endpoint, но оставлен для совместимости)
   * @param {number} rewardId - ID награды
   * @param {boolean} isActive - Активна ли награда
   * @returns {Promise<AxiosResponse>}
   */
  async toggleReward(channelName, rewardId, isActive) {
    // Backend endpoint: PATCH /api/drops/rewards/{reward_id}/toggle
    return apiClient.patch(`/api/drops/rewards/${rewardId}/toggle`, {
      is_active: isActive,
    });
  },

  /**
   * Получить историю Drops
   * @param {string} channelName - Имя канала
   * @param {Object} params - Параметры запроса (limit, offset, etc.)
   * @returns {Promise<AxiosResponse>}
   */
  async getHistory(channelName, params = {}) {
    return apiClient.get(`/api/drops/history/${channelName}`, { params });
  },

  /**
   * Сгенерировать или получить URL виджета для OBS
   * @param {boolean} regenerate - Перегенерировать токен
   * @returns {Promise<AxiosResponse>}
   */
  async generateWidgetUrl(regenerate = false) {
    return apiClient.post('/api/drops/widget-url', null, {
      params: { regenerate }
    });
  },

  /**
   * Сбросить стрик для канала
   * @param {string} channelName - Имя канала
   * @returns {Promise<AxiosResponse>}
   */
  async resetStreak(channelName) {
    return apiClient.post(`/api/drops/streak/reset/${channelName}`, {});
  },
};

