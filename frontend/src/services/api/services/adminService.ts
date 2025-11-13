/**
 * Admin Service - инкапсуляция всех Admin API вызовов
 */
import { apiClient } from '../client';
import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '../../../types';

/**
 * Admin Service
 */
export const adminService = {
  /**
   * Получить список администраторов
   * @returns Promise с ответом API
   */
  async getAdminList(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/list');
  },

  /**
   * Получить whitelist (для гостей)
   * @returns Promise с ответом API
   */
  async getWhitelist(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/whitelist');
  },

  /**
   * Получить статистику кеша
   * @returns Promise с ответом API
   */
  async getCacheStats(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/monitoring/cache/stats');
  },

  /**
   * Очистить кеш
   * @returns Promise с ответом API
   */
  async clearCache(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/monitoring/cache/clear');
  },

  /**
   * Очистить истекшие записи кеша
   * @returns Promise с ответом API
   */
  async cleanupExpiredCache(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/monitoring/cache/cleanup');
  },

  /**
   * Получить статус ботов
   * @returns Promise с ответом API
   */
  async getBotsStatus(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/bots/status');
  },

  /**
   * Получить системные логи
   * @param params - Параметры запроса (lines)
   * @returns Promise с ответом API
   */
  async getSystemLogs(params: Record<string, any> = {}): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/system/logs', { params });
  },

  /**
   * Получить метрики мониторинга
   * @returns Promise с ответом API
   */
  async getMonitoringMetrics(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/monitoring/metrics');
  },

  /**
   * Получить список заблокированных каналов
   * @returns Promise с ответом API
   */
  async getBlockedChannels(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/blocked-channels');
  },

  /**
   * Заблокировать канал
   * @param data - Данные для блокировки
   * @returns Promise с ответом API
   */
  async blockChannel(data: { channel_name: string; reason?: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/admin/blocked-channels', data);
  },

  /**
   * Разблокировать канал
   * @param channelId - ID канала
   * @returns Promise с ответом API
   */
  async unblockChannel(channelId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/admin/blocked-channels/${channelId}`);
  },

  /**
   * Получить логи администратора
   * @param params - Параметры запроса
   * @returns Promise с ответом API
   */
  async getAdminLogs(params: Record<string, any> = {}): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/logs', { params });
  },

  /**
   * Получить статистику логов
   * @param daysRange - Количество дней
   * @returns Promise с ответом API
   */
  async getLogsStats(daysRange: number = 7): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get(`/api/admin/logs/stats?days=${daysRange}`);
  },

  /**
   * Получить доступные действия логов
   * @returns Promise с ответом API
   */
  async getLogsActions(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/logs/actions');
  },

  /**
   * Получить статистику базы данных
   * @returns Promise с ответом API
   */
  async getDatabaseStats(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/database/stats');
  },

  /**
   * Очистить базу данных
   * @param data - Данные для очистки
   * @returns Promise с ответом API
   */
  async cleanupDatabase(data: { cleanup_type: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/database/cleanup', data);
  },

  /**
   * Получить список бэкапов
   * @returns Promise с ответом API
   */
  async getBackups(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/database/backups');
  },

  /**
   * Удалить бэкап
   * @param filename - Имя файла бэкапа
   * @returns Promise с ответом API
   */
  async deleteBackup(filename: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/database/backups/${filename}`);
  },

  /**
   * Восстановить базу данных из бэкапа
   * @param filename - Имя файла бэкапа
   * @returns Promise с ответом API
   */
  async restoreBackup(filename: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post(`/api/database/backups/${filename}/restore`);
  },

  /**
   * Получить список пользователей (админ)
   * @param params - Параметры запроса (page, limit, search)
   * @returns Promise с ответом API
   */
  async getUsers(params: Record<string, any> = {}): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/users', { params });
  },

  /**
   * Получить список сессий (админ)
   * @returns Promise с ответом API
   */
  async getSessions(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/sessions');
  },

  /**
   * Обновить пользователя (админ)
   * @param userId - ID пользователя
   * @param data - Данные для обновления
   * @returns Promise с ответом API
   */
  async updateUser(userId: number, data: Record<string, any>): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.put(`/api/admin/users/${userId}`, data);
  },

  /**
   * Заблокировать пользователя (админ)
   * @param userId - ID пользователя
   * @param data - Данные для блокировки
   * @returns Promise с ответом API
   */
  async blockUser(userId: number, data: { reason?: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post(`/api/admin/users/${userId}/block`, data);
  },

  /**
   * Удалить пользователя (админ)
   * @param userId - ID пользователя
   * @returns Promise с ответом API
   */
  async deleteUser(userId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/admin/users/${userId}`);
  },

  /**
   * Добавить канал в whitelist
   * @param data - Данные для добавления
   * @returns Promise с ответом API
   */
  async addToWhitelist(data: { username: string; platform: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/admin/whitelist/add', data);
  },

  /**
   * Удалить канал из whitelist
   * @param channelName - Имя канала
   * @param platform - Платформа (twitch/vk)
   * @returns Promise с ответом API
   */
  async removeFromWhitelist(channelName: string, platform: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/admin/whitelist/${channelName}`, { params: { platform } });
  },

  /**
   * Получить статус TTS (админ)
   * @returns Promise с ответом API
   */
  async getTtsStatus(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/tts/status');
  },

  /**
   * Перезапустить Bot Service (админ)
   * @returns Promise с ответом API
   */
  async restartBotService(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/admin/bot-service/restart');
  },

  /**
   * Перезапустить TTS движок (админ)
   * @returns Promise с ответом API
   */
  async restartTtsEngine(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/admin/tts/restart');
  },
};

