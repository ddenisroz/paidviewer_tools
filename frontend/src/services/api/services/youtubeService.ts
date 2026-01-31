/**
 * YouTube Service - инкапсуляция всех YouTube API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '@/types/api';
import type { YoutubeObsUrlResponse, YoutubeQueue, YoutubeSettings, YoutubeVideo } from '@/types/youtube';
import type { AxiosResponse } from 'axios';

/**
 * YouTube Service
 */
export const youtubeService = {
  /**
   * Получить очередь YouTube
   * @returns Promise с ответом API
   */
  async getQueue(): Promise<AxiosResponse<YoutubeQueue>> {
    return apiClient.get('/api/youtube/queue');
  },

  /**
   * Добавить видео в очередь
   * @param data - Данные видео
   * @returns Promise с ответом API
   */
  async addToQueue(data: { video_url?: string; url?: string; is_paid?: boolean; points_cost?: number }): Promise<AxiosResponse<ApiResponse<{ queue_item: YoutubeVideo }>>> {
    // Backend endpoint: POST /api/youtube/queue/add
    return apiClient.post('/api/youtube/queue/add', {
      video_url: data.video_url || data.url,
      is_paid: data.is_paid || false,
      points_cost: data.points_cost || 0,
    });
  },

  /**
   * Удалить видео из очереди
   * @param queueId - ID видео в очереди
   * @returns Promise с ответом API
   */
  async removeFromQueue(queueId: number): Promise<AxiosResponse<ApiResponse>> {
    // Backend endpoint: DELETE /api/youtube/queue/remove/{queue_id}
    return apiClient.delete(`/api/youtube/queue/remove/${queueId}`);
  },

  /**
   * Очистить очередь
   * @returns Promise с ответом API
   */
  async clearQueue(): Promise<AxiosResponse<ApiResponse>> {
    // Backend endpoint: DELETE /api/youtube/queue/clear или POST /api/youtube/clear
    return apiClient.post('/api/youtube/clear');
  },

  /**
   * Перейти к следующему видео
   * @returns Promise с ответом API
   */
  async nextVideo(): Promise<AxiosResponse<ApiResponse<{ current_video: YoutubeVideo | null }>>> {
    // Backend endpoint: POST /api/youtube/player/next
    return apiClient.post('/api/youtube/player/next');
  },

  /**
   * Отметить видео как проигранное
   * @param queueId - ID видео в очереди
   * @returns Promise с ответом API
   */
  async markAsPlayed(queueId: number): Promise<AxiosResponse<ApiResponse>> {
    // Backend endpoint: POST /api/youtube/queue/mark-played/{queue_id}
    return apiClient.post(`/api/youtube/queue/mark-played/${queueId}`);
  },

  /**
   * Получить настройки YouTube
   * @returns Promise с ответом API
   */
  async getSettings(): Promise<AxiosResponse<YoutubeSettings>> {
    return apiClient.get('/api/tts/youtube-settings');
  },

  /**
   * Сохранить настройки YouTube
   * @param settings - Настройки YouTube
   * @returns Promise с ответом API
   */
  async saveSettings(settings: Partial<YoutubeSettings>): Promise<AxiosResponse<YoutubeSettings>> {
    return apiClient.post('/api/tts/youtube-settings', settings);
  },


};

