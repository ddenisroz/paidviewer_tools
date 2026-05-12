import { apiClient } from '@/services/api/client';

import type { AxiosError, AxiosResponse } from 'axios';

type Platform = 'twitch' | 'vk';

interface ApiError extends Error {
    status?: number;
    response?: { status?: number };
}

async function handleApiResponse<T>(request: Promise<AxiosResponse<T>>, fallbackMessage: string): Promise<T> {
    try {
        const response = await request;
        return response.data;
    } catch (err) {
        const axiosError = err as AxiosError<{ detail?: string | { message?: string }; message?: string } | string>;
        const responseData = axiosError.response?.data;
        let errorMessage = fallbackMessage;

        if (typeof responseData === 'string' && responseData.trim()) {
            errorMessage = responseData;
        } else if (responseData && typeof responseData === 'object') {
            const detail = responseData.detail;
            if (typeof detail === 'string' && detail.trim()) {
                errorMessage = detail;
            } else if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
                errorMessage = detail.message;
            } else {
                errorMessage = responseData.message || fallbackMessage;
            }
        } else if (err instanceof Error && err.message) {
            errorMessage = err.message;
        }

        if (
            axiosError.response?.status === 403 &&
            /partner|affiliate|channel.?points|broadcaster/i.test(errorMessage)
        ) {
            errorMessage =
                'Twitch разрешает создавать награды только для каналов со статусом Affiliate или Partner. Это ограничение Twitch, приложение работает корректно.';
        }

        const error: ApiError = new Error(errorMessage);
        error.status = axiosError.response?.status;
        error.response = axiosError.response ? { status: axiosError.response.status } : undefined;
        throw error;
    }
}

class PointsAPI {
    async getRewards<T = unknown>(platform: Platform): Promise<T> {
        return handleApiResponse<T>(
            apiClient.get<T>(`/api/points/rewards/${platform}`),
            `Failed to load ${platform} rewards`
        );
    }

    async createReward<T = unknown>(platform: Platform, rewardData: Record<string, unknown>): Promise<T> {
        return handleApiResponse<T>(
            apiClient.post<T>(`/api/points/rewards/${platform}/create`, rewardData),
            'Failed to create reward'
        );
    }

    async updateReward<T = unknown>(
        platform: Platform,
        rewardId: string,
        rewardData: Record<string, unknown>
    ): Promise<T> {
        return handleApiResponse<T>(
            apiClient.patch<T>(`/api/points/rewards/${platform}/${rewardId}`, rewardData),
            'Failed to update reward'
        );
    }

    async deleteReward<T = unknown>(platform: Platform, rewardId: string): Promise<T> {
        return handleApiResponse<T>(
            apiClient.delete<T>(`/api/points/rewards/${platform}/${rewardId}`),
            'Failed to delete reward'
        );
    }

    async toggleReward<T = unknown>(platform: Platform, rewardId: string, isEnabled: boolean): Promise<T> {
        return handleApiResponse<T>(
            apiClient.patch<T>(`/api/points/rewards/${platform}/${rewardId}/toggle`, { is_enabled: isEnabled }),
            'Failed to toggle reward'
        );
    }

    async getVKDemands<T = unknown>(): Promise<T> {
        return handleApiResponse<T>(apiClient.get<T>('/api/points/rewards/vk/demands'), 'Failed to load VK demands');
    }

    async processVKDemands<T = unknown>(action: 'accept' | 'reject', demandIds: string[]): Promise<T> {
        return handleApiResponse<T>(
            apiClient.post<T>('/api/points/rewards/vk/demands/process', { action, demand_ids: demandIds }),
            'Failed to process demands'
        );
    }
}

export const pointsApi = new PointsAPI();
export default pointsApi;
