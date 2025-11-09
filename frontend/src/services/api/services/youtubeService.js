/**
 * YouTube Service - инкапсуляция всех YouTube API вызовов
 */
import { apiClient } from '../client';

/**
 * YouTube Service
 */
export const youtubeService = {
  /**
   * Получить очередь YouTube
   * @returns {Promise<AxiosResponse>}
   */
  async getQueue() {
    return apiClient.get('/api/youtube/queue');
  },

  /**
   * Добавить видео в очередь
   * @param {Object} data - Данные видео { video_url, is_paid?, points_cost? }
   * @returns {Promise<AxiosResponse>}
   */
  async addToQueue(data) {
    // Backend endpoint: POST /api/youtube/queue/add
    return apiClient.post('/api/youtube/queue/add', {
      video_url: data.video_url || data.url,
      is_paid: data.is_paid || false,
      points_cost: data.points_cost || 0,
    });
  },

  /**
   * Удалить видео из очереди
   * @param {number} queueId - ID видео в очереди
   * @returns {Promise<AxiosResponse>}
   */
  async removeFromQueue(queueId) {
    // Backend endpoint: DELETE /api/youtube/queue/remove/{queue_id}
    return apiClient.delete(`/api/youtube/queue/remove/${queueId}`);
  },

  /**
   * Очистить очередь
   * @returns {Promise<AxiosResponse>}
   */
  async clearQueue() {
    // Backend endpoint: DELETE /api/youtube/queue/clear или POST /api/youtube/clear
    return apiClient.delete('/api/youtube/queue/clear');
  },

  /**
   * Перейти к следующему видео
   * @returns {Promise<AxiosResponse>}
   */
  async nextVideo() {
    // Backend endpoint: POST /api/youtube/player/next
    return apiClient.post('/api/youtube/player/next');
  },

  /**
   * Отметить видео как проигранное
   * @param {number} queueId - ID видео в очереди
   * @returns {Promise<AxiosResponse>}
   */
  async markAsPlayed(queueId) {
    // Backend endpoint: POST /api/youtube/queue/mark-played/{queue_id}
    return apiClient.post(`/api/youtube/queue/mark-played/${queueId}`);
  },

  /**
   * Получить настройки YouTube
   * @returns {Promise<AxiosResponse>}
   */
  async getSettings() {
    return apiClient.get('/api/tts/youtube-settings');
  },

  /**
   * Сохранить настройки YouTube
   * @param {Object} settings - Настройки YouTube
   * @returns {Promise<AxiosResponse>}
   */
  async saveSettings(settings) {
    return apiClient.post('/api/tts/youtube-settings', settings);
  },

  /**
   * Получить OBS URL для YouTube
   * @returns {Promise<AxiosResponse>}
   */
  async getObsUrl() {
    return apiClient.get('/api/tts/obs-url');
  },
};

