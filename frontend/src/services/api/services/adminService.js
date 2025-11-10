/**
 * Admin Service - инкапсуляция всех Admin API вызовов
 */
import { apiClient } from '../client';

/**
 * Admin Service
 */
export const adminService = {
  /**
   * Получить список администраторов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAdminList() {
    return apiClient.get('/api/admin/list');
  },

  /**
   * Получить статус ботов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getBotsStatus() {
    return apiClient.get('/api/admin/bots/status');
  },

  /**
   * Получить системные логи
   * @param {Object} params - Параметры запроса (lines)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getSystemLogs(params = {}) {
    return apiClient.get('/api/system/logs', { params });
  },

  /**
   * Получить метрики мониторинга
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getMonitoringMetrics() {
    return apiClient.get('/api/admin/monitoring/metrics');
  },

  /**
   * Получить список заблокированных каналов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getBlockedChannels() {
    return apiClient.get('/api/admin/blocked-channels');
  },

  /**
   * Заблокировать канал
   * @param {Object} data - Данные { channel_name, reason }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async blockChannel(data) {
    return apiClient.post('/api/admin/blocked-channels', data);
  },

  /**
   * Разблокировать канал
   * @param {number} channelId - ID канала
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async unblockChannel(channelId) {
    return apiClient.delete(`/api/admin/blocked-channels/${channelId}`);
  },
};

