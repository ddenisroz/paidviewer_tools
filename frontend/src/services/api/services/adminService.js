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

  /**
   * Получить логи администратора
   * @param {Object} params - Параметры запроса
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAdminLogs(params = {}) {
    return apiClient.get('/api/admin/logs', { params });
  },

  /**
   * Получить статистику логов
   * @param {number} daysRange - Количество дней
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getLogsStats(daysRange = 7) {
    return apiClient.get(`/api/admin/logs/stats?days=${daysRange}`);
  },

  /**
   * Получить доступные действия логов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getLogsActions() {
    return apiClient.get('/api/admin/logs/actions');
  },

  /**
   * Получить статистику базы данных
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getDatabaseStats() {
    return apiClient.get('/api/database/stats');
  },

  /**
   * Очистить базу данных
   * @param {Object} data - Данные { cleanup_type }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async cleanupDatabase(data) {
    return apiClient.post('/api/database/cleanup', data);
  },

  /**
   * Получить список бэкапов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getBackups() {
    return apiClient.get('/api/database/backups');
  },

  /**
   * Удалить бэкап
   * @param {string} filename - Имя файла бэкапа
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async deleteBackup(filename) {
    return apiClient.delete(`/api/database/backups/${filename}`);
  },

  /**
   * Восстановить базу данных из бэкапа
   * @param {string} filename - Имя файла бэкапа
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async restoreBackup(filename) {
    return apiClient.post(`/api/database/backups/${filename}/restore`);
  },

  /**
   * Получить список пользователей (админ)
   * @param {Object} params - Параметры запроса (page, limit, search)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getUsers(params = {}) {
    return apiClient.get('/api/admin/users', { params });
  },

  /**
   * Получить список сессий (админ)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getSessions() {
    return apiClient.get('/api/admin/sessions');
  },

  /**
   * Обновить пользователя (админ)
   * @param {number} userId - ID пользователя
   * @param {Object} data - Данные для обновления
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async updateUser(userId, data) {
    return apiClient.put(`/api/admin/users/${userId}`, data);
  },

  /**
   * Заблокировать пользователя (админ)
   * @param {number} userId - ID пользователя
   * @param {Object} data - Данные { reason }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async blockUser(userId, data) {
    return apiClient.post(`/api/admin/users/${userId}/block`, data);
  },

  /**
   * Удалить пользователя (админ)
   * @param {number} userId - ID пользователя
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async deleteUser(userId) {
    return apiClient.delete(`/api/admin/users/${userId}`);
  },

  /**
   * Добавить канал в whitelist
   * @param {Object} data - Данные { username, platform }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async addToWhitelist(data) {
    return apiClient.post('/api/admin/whitelist/add', data);
  },

  /**
   * Удалить канал из whitelist
   * @param {string} channelName - Имя канала
   * @param {string} platform - Платформа (twitch/vk)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async removeFromWhitelist(channelName, platform) {
    return apiClient.delete(`/api/admin/whitelist/${channelName}`, { params: { platform } });
  },

  /**
   * Получить статус TTS (админ)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getTtsStatus() {
    return apiClient.get('/api/admin/tts/status');
  },

  /**
   * Перезапустить Bot Service (админ)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async restartBotService() {
    return apiClient.post('/api/admin/bot-service/restart');
  },

  /**
   * Перезапустить TTS движок (админ)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async restartTtsEngine() {
    return apiClient.post('/api/admin/tts/restart');
  },
};

