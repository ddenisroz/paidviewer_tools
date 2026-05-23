/**
 * Drops Service - инкапсуляция всех Drops API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse, DropsConfig, DropsHistory, DropsReward, DropsStreak } from '../../../types';
import type { AxiosResponse } from 'axios';

const compactParams = (params: Record<string, unknown> = {}): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );

/**
 * Drops Service
 */
export const dropsService = {
    /**
     * Получить конфигурацию Drops
     * @param channelName - Имя канала
     * @returns Promise с ответом API
     */
    async getConfig(channelName: string): Promise<AxiosResponse<ApiResponse<DropsConfig>>> {
        return apiClient.get(`/api/drops/config/${channelName}`);
    },

    /**
     * Обновить конфигурацию Drops
     * @param channelName - Имя канала
     * @param config - Конфигурация Drops
     * @returns Promise с ответом API
     */
    async updateConfig(
        channelName: string,
        config: Partial<DropsConfig>
    ): Promise<AxiosResponse<ApiResponse<DropsConfig>>> {
        return apiClient.put(`/api/drops/config/${channelName}`, config);
    },

    /**
     * Получить качества Drops
     * @returns Promise с ответом API
     */
    async getQualities(): Promise<AxiosResponse<ApiResponse<string[]>>> {
        return apiClient.get('/api/drops/qualities');
    },

    /**
     * Получить награды Drops
     * @param channelName - Имя канала
     * @returns Promise с ответом API
     */
    async getRewards(channelName: string): Promise<AxiosResponse<ApiResponse<DropsReward[]>>> {
        // Награды общие для всех платформ, platform параметр игнорируется на бэкенде
        return apiClient.get(`/api/drops/rewards/${channelName}`, {
            params: { platform: 'twitch' }, // Для совместимости
        });
    },

    /**
     * Создать награду Drops
     * @param channelName - Имя канала
     * @param reward - Данные награды
     * @returns Promise с ответом API
     */
    async createReward(
        channelName: string,
        reward: Partial<DropsReward>
    ): Promise<AxiosResponse<ApiResponse<DropsReward>>> {
        // Backend endpoint: POST /api/drops/rewards/{channel_name}?platform=twitch
        // Параметр platform передается для совместимости, но награда будет общей для всех платформ
        return apiClient.post(`/api/drops/rewards/${channelName}`, reward, {
            params: { platform: (reward.platform as string) || 'twitch' },
        });
    },

    /**
     * Обновить награду Drops
     * @param channelName - Имя канала (не используется в endpoint, но оставлен для совместимости)
     * @param rewardId - ID награды
     * @param reward - Данные награды
     * @returns Promise с ответом API
     */
    async updateReward(
        channelName: string,
        rewardId: number,
        reward: Partial<DropsReward>
    ): Promise<AxiosResponse<ApiResponse<DropsReward>>> {
        // Backend endpoint: PUT /api/drops/rewards/{reward_id}
        return apiClient.put(`/api/drops/rewards/${rewardId}`, reward);
    },

    /**
     * Удалить награду Drops
     * @param channelName - Имя канала (не используется в endpoint, но оставлен для совместимости)
     * @param rewardId - ID награды
     * @returns Promise с ответом API
     */
    async deleteReward(_channelName: string, rewardId: number): Promise<AxiosResponse<ApiResponse>> {
        // Backend endpoint: DELETE /api/drops/rewards/{reward_id}
        return apiClient.delete(`/api/drops/rewards/${rewardId}`);
    },

    /**
     * Переключить активность награды
     * @param channelName - Имя канала (не используется в endpoint, но оставлен для совместимости)
     * @param rewardId - ID награды
     * @param isActive - Активна ли награда
     * @returns Promise с ответом API
     */
    async toggleReward(_channelName: string, rewardId: number, isActive: boolean): Promise<AxiosResponse<ApiResponse>> {
        // Primary endpoint: PATCH /api/drops/rewards/{reward_id}/toggle
        // Fallback for older backend builds: PUT /api/drops/rewards/{reward_id}
        try {
            return await apiClient.patch(`/api/drops/rewards/${rewardId}/toggle`, {
                is_active: isActive,
            });
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status !== 404) throw error;
            return apiClient.put(`/api/drops/rewards/${rewardId}`, {
                is_active: isActive,
            });
        }
    },

    /**
     * Получить историю Drops
     * @param channelName - Имя канала
     * @param params - Параметры запроса (limit, offset, etc.)
     * @returns Promise с ответом API
     */
    async getHistory(
        channelName: string,
        params: Record<string, unknown> = {}
    ): Promise<AxiosResponse<ApiResponse<DropsHistory[]>>> {
        return apiClient.get(`/api/drops/history/${channelName}`, { params });
    },

    /**
     * Сгенерировать или получить URL виджета для OBS
     * @param regenerate - Перегенерировать токен
     * @returns Promise с ответом API
     */
    async generateWidgetUrl(regenerate: boolean = false): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/drops/widget-url', null, {
            params: { regenerate },
        });
    },

    async sendWidgetTestEvent(
        channelName: string,
        quality: string
    ): Promise<AxiosResponse<ApiResponse<{ delivered: number; quality: string; reward_name?: string }>>> {
        return apiClient.post(`/api/drops/widget/test-event/${channelName}`, {
            quality,
        });
    },

    /**
     * Сбросить стрик для канала
     * @param channelName - Имя канала
     * @returns Promise с ответом API
     */
    async resetStreak(channelName: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(`/api/drops/streak/reset/${channelName}`, {});
    },

    /**
     * Получить статистику стриков
     * @param channelName - Имя канала
     * @param params - Параметры запроса (limit, offset, search)
     * @returns Promise с ответом API
     */
    async getStreaks(
        channelName: string,
        params: Record<string, unknown> = {}
    ): Promise<AxiosResponse<ApiResponse<DropsStreak[]>>> {
        return apiClient.get(`/api/drops/streaks/${channelName}`, { params });
    },

    /**
     * Получить данные пользователя по токену виджета
     * @param token - Токен виджета
     * @returns Promise с ответом API
     */
    async getUserFromToken(token: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/api/drops/user-from-token/${token}`);
    },

    /**
     * Получить конфигурацию Drops с токеном виджета
     * @param channelName - Имя канала
     * @param params - Параметры запроса (platform, widget_token)
     * @returns Promise с ответом API
     */
    async getConfigWithToken(
        channelName: string,
        params: Record<string, unknown> = {}
    ): Promise<AxiosResponse<ApiResponse<DropsConfig>>> {
        return apiClient.get(`/api/drops/config/${channelName}`, { params: compactParams(params) });
    },

    /**
     * Получить активную сессию мифического сундука
     * @param channelName - Имя канала
     * @param token - Токен виджета
     * @returns Promise с ответом API
     */
    async getMythicalSession(channelName: string, token: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/api/drops/mythical-session/${channelName}`, {
            params: compactParams({ widget_token: token }),
        });
    },

    /**
     * Получить награды для виджета
     * @param channelName - Имя канала
     * @param params - Параметры запроса (platform, quality, widget_token)
     * @returns Promise с ответом API
     */
    async getRewardsForWidget(
        channelName: string,
        params: Record<string, unknown> = {}
    ): Promise<AxiosResponse<ApiResponse<DropsReward[]>>> {
        return apiClient.get(`/api/drops/rewards/${channelName}`, { params: compactParams(params) });
    },

    async uploadRewardSound(
        rewardId: number,
        soundFile: File
    ): Promise<AxiosResponse<ApiResponse<{ sound_file?: string; filename?: string }>>> {
        const formData = new FormData();
        formData.append('sound_file', soundFile);
        return apiClient.post(`/api/drops/rewards/${rewardId}/sound`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    async uploadWidgetSound(
        channelName: string,
        kind: 'spin' | 'reveal',
        soundFile: File
    ): Promise<AxiosResponse<ApiResponse<{ kind?: string; sound_file?: string; config?: DropsConfig }>>> {
        const formData = new FormData();
        formData.append('sound_file', soundFile);
        return apiClient.post(`/api/drops/config/${channelName}/widget-sound`, formData, {
            params: { kind },
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
};
