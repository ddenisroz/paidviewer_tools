/**
 * Points Service - инкапсуляция всех Points API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * Points Service
 */
export const pointsService = {
    /**
     * Получить награды платформы
     * @param platform - Платформа (twitch, vk)
     * @returns Promise с ответом API
     */
    async getPlatformRewards(platform: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/points/platform/rewards', {
            params: { platform },
        });
    },

    /**
     * Создать награду платформы
     * @param platform - Платформа (twitch, vk)
     * @param reward - Данные награды
     * @returns Promise с ответом API
     */
    async createPlatformReward(platform: string, reward: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/points/platform/rewards/create', reward, {
            params: { platform },
        });
    },

    /**
     * Обновить награду платформы
     * @param platform - Платформа (twitch, vk)
     * @param rewardId - ID награды
     * @param reward - Данные награды
     * @returns Promise с ответом API
     */
    async updatePlatformReward(
        platform: string,
        rewardId: string,
        reward: Record<string, unknown>
    ): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.put(`/api/points/platform/rewards/${rewardId}`, reward, {
            params: { platform },
        });
    },

    /**
     * Удалить награду платформы
     * @param platform - Платформа (twitch, vk)
     * @param rewardId - ID награды
     * @returns Promise с ответом API
     */
    async deletePlatformReward(platform: string, rewardId: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/points/platform/rewards/${rewardId}`, {
            params: { platform },
        });
    },

    /**
     * Переключить статус награды платформы (включить/выключить)
     * @param platform - Платформа (twitch, vk)
     * @param rewardId - ID награды
     * @param isEnabled - Включена ли награда
     * @returns Promise с ответом API
     */
    async togglePlatformReward(
        platform: string,
        rewardId: string,
        isEnabled: boolean
    ): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.put(
            `/api/points/platform/rewards/${rewardId}`,
            {
                is_enabled: isEnabled,
            },
            {
                params: { platform },
            }
        );
    },
};
