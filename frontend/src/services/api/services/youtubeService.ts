/**
 * YouTube Service - инкапсуляция всех YouTube API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '@/types/api';
import type { YoutubeObsState, YoutubeObsUrlResponse, YoutubeQueue, YoutubeSettings, YoutubeVideo } from '@/types/youtube';
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
    async addToQueue(data: {
        video_url?: string;
        url?: string;
        is_paid?: boolean;
        points_cost?: number;
    }): Promise<AxiosResponse<ApiResponse<{ queue_item: YoutubeVideo }>>> {
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
     * Забанить видео и удалить его из очереди
     * @param queueId - ID видео в очереди
     * @returns Promise с ответом API
     */
    async banQueueItem(queueId: number): Promise<AxiosResponse<ApiResponse>> {
        // Backend endpoint: POST /api/youtube/queue/ban/{queue_id}
        return apiClient.post(`/api/youtube/queue/ban/${queueId}`);
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
     * Перейти к выбранному видео в очереди
     * @param queueId - ID видео в очереди
     * @returns Promise с ответом API
     */
    async playQueueItem(queueId: number): Promise<AxiosResponse<ApiResponse<{ current_video: YoutubeVideo | null }>>> {
        // Backend endpoint: POST /api/youtube/queue/play/{queue_id}
        return apiClient.post(`/api/youtube/queue/play/${queueId}`);
    },

    /**
     * Изменить порядок элементов в очереди
     * @param activeQueueId - ID перетаскиваемого элемента
     * @param overQueueId - ID элемента, над которым завершили перетаскивание
     * @returns Promise с обновлённым состоянием очереди
     */
    async reorderQueue(
        activeQueueId: number,
        overQueueId: number
    ): Promise<AxiosResponse<ApiResponse<{ current_video: YoutubeVideo | null; queue: YoutubeVideo[] }>>> {
        return apiClient.post('/api/youtube/queue/reorder', {
            active_queue_id: activeQueueId,
            over_queue_id: overQueueId,
        });
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

    async getObsUrl(): Promise<AxiosResponse<YoutubeObsUrlResponse>> {
        return apiClient.get('/api/youtube/obs-url');
    },

    async generateObsUrl(): Promise<AxiosResponse<YoutubeObsUrlResponse>> {
        return apiClient.post('/api/youtube/generate-obs-url');
    },

    async regenerateObsUrl(): Promise<AxiosResponse<YoutubeObsUrlResponse>> {
        return apiClient.post('/api/youtube/regenerate-obs-url');
    },

    async getObsState(token: string): Promise<AxiosResponse<YoutubeObsState>> {
        return apiClient.get(`/api/youtube/obs-state/${encodeURIComponent(token)}`);
    },
};
