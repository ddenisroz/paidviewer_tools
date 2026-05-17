/**
 * Stream Service - инкапсуляция всех Stream API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * Stream Service
 */
export const streamService = {
    /**
     * Получить информацию о стриме Twitch
     * @param params - Параметры запроса (force и т.д.)
     * @returns Promise с ответом API
     */
    async getTwitchStreamInfo(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/twitch/stream-info', { params });
    },

    /**
     * Получить информацию о стриме VK
     * @param params - Параметры запроса (force и т.д.)
     * @returns Promise с ответом API
     */
    async getVkStreamInfo(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/vk/stream-info', { params });
    },

    /**
     * Обновить название стрима Twitch
     * @param title - Название стрима
     * @returns Promise с ответом API
     */
    async updateTwitchStreamTitle(title: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/twitch/stream/title', { title });
    },

    /**
     * Обновить категорию стрима Twitch
     * @param categoryId - ID категории
     * @returns Promise с ответом API
     */
    async updateTwitchStreamCategory(categoryId: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/twitch/stream/category', { category_id: categoryId });
    },

    /**
     * Обновить заголовок стрима VK
     * @param title - Новый заголовок
     * @returns Promise с ответом API
     */
    async updateVkStreamTitle(title: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/vk/update-title', { title });
    },

    /**
     * Обновить категорию стрима VK
     * @param categoryId - ID категории
     * @returns Promise с ответом API
     */
    async updateVkStreamCategory(categoryId: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/vk/update-category', { categoryId });
    },

    /**
     * Получить категории Twitch
     * @param search - Поисковый запрос
     * @returns Promise с ответом API
     */
    async getTwitchCategories(search: string = ''): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/twitch/categories', {
            params: { search },
        });
    },

    /**
     * Получить категории VK
     * @param search - Поисковый запрос
     * @returns Promise с ответом API
     */
    async getVkCategories(search: string = ''): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/vk/categories', {
            params: { search },
        });
    },

    /**
     * Получить историю стримов
     * @returns Promise с ответом API
     */
    async getStreamHistory(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/stream/history');
    },

    /**
     * Обновить данные стрима (название и категория)
     * @param payload - Данные для обновления (twitch, vk)
     * @returns Promise с ответом API
     */
    async updateStream(payload: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/stream/update', payload);
    },
};
