/**
 * Lootbox Service - инкапсуляция всех Lootbox API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * Lootbox Service
 */
export const lootboxService = {
    /**
     * Получить прогрессию лутбоксов для канала
     * @param channelName - Имя канала
     * @returns Promise с ответом API
     */
    async getProgression(channelName: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/lootbox/progression/${channelName}`);
    },

    /**
     * Получить лутбоксы для канала
     * @param channelName - Имя канала
     * @returns Promise с ответом API
     */
    async getLootboxes(channelName: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/lootbox/lootboxes/${channelName}`);
    },

    /**
     * Получить недавние открытия лутбоксов
     * @param channelName - Имя канала
     * @param params - Параметры запроса (limit)
     * @returns Promise с ответом API
     */
    async getRecentOpenings(
        channelName: string,
        params: Record<string, unknown> = {}
    ): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/lootbox/recent/${channelName}`, { params });
    },

    /**
     * Открыть лутбокс
     * @param data - Данные для открытия
     * @returns Promise с ответом API
     */
    async openLootbox(data: { lootbox_id: number }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/lootbox/open', data);
    },

    /**
     * Получить список лутбоксов (админ)
     * @returns Promise с ответом API
     */
    async getAdminLootboxes(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/lootbox/admin/lootboxes');
    },

    /**
     * Получить список достижений (админ)
     * @returns Promise с ответом API
     */
    async getAdminAchievements(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/lootbox/admin/achievements');
    },

    /**
     * Создать лутбокс (админ)
     * @param data - Данные лутбокса
     * @returns Promise с ответом API
     */
    async createLootbox(data: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/lootbox/admin/lootbox', data);
    },

    /**
     * Создать награду (админ)
     * @param data - Данные награды
     * @returns Promise с ответом API
     */
    async createReward(data: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/lootbox/admin/lootbox/reward', data);
    },

    /**
     * Создать достижение (админ)
     * @param data - Данные достижения
     * @returns Promise с ответом API
     */
    async createAchievement(data: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/lootbox/admin/achievement', data);
    },
};
