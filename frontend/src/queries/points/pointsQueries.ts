/**
 * Points Queries - централизованные React Query queries для Points
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { pointsService } from '@/services/api/services/pointsService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';

import type { ApiResponse } from '../../types';
import type { AxiosError, AxiosRequestConfig } from 'axios';

/**
 * Получить награды платформы
 */
export const usePlatformRewards = (
    platform: string,
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<ApiResponse, AxiosError>({
        queryKey: queryKeys.points.platformRewards(platform),
        queryFn: async () => {
            try {
                const response = await pointsService.getPlatformRewards(platform);
                return response.data;
            } catch (error) {
                const axiosError = error as AxiosError;
                // Логируем только если это не 403 (ожидаемая ошибка для не-партнёров)
                if (axiosError?.response?.status !== 403) {
                    logger.error('[API] Response error:', {
                        url: axiosError.config?.url,
                        method: axiosError.config?.method,
                        status: axiosError.response?.status,
                        retries:
                            (axiosError.config as AxiosRequestConfig & { 'axios-retry'?: { retryCount?: number } })?.[
                                'axios-retry'
                            ]?.retryCount || 0,
                    });
                }
                throw error;
            }
        },
        enabled: !!platform && options?.enabled !== false,
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        retry: (failureCount, error) => {
            // Не повторяем запрос при 403 (партнер/аффилиат требуется) или 404
            const status = (error as AxiosError)?.response?.status;
            if (status === 403 || status === 404) {
                return false;
            }
            return failureCount < 2;
        },
        ...options,
    });
};

/**
 * Создать награду платформы
 */
export const useCreatePlatformReward = (
    platform: string,
    options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, Record<string, unknown>>({
        mutationFn: async (reward: Record<string, unknown>) => {
            const response = await pointsService.createPlatformReward(platform, reward);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
            if (!options?.onSuccess) {
                toast.success('Награда создана');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error creating platform reward:', error);
            if (!options?.onError) {
                const errorData = error.response?.data as Record<string, unknown> | undefined;
                const errorMessage = (errorData?.detail || errorData?.message || 'Ошибка создания награды') as string;
                toast.error(errorMessage);
            }
        },
        ...options,
    });
};

/**
 * Обновить награду платформы
 */
export const useUpdatePlatformReward = (
    platform: string,
    options?: UseMutationOptions<
        ApiResponse,
        AxiosError,
        { rewardId: string; reward: Record<string, unknown> },
        unknown
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, { rewardId: string; reward: Record<string, unknown> }>({
        mutationFn: async ({ rewardId, reward }: { rewardId: string; reward: Record<string, unknown> }) => {
            const response = await pointsService.updatePlatformReward(platform, rewardId, reward);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
            if (!options?.onSuccess) {
                toast.success('Награда обновлена');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error updating platform reward:', error);
            if (!options?.onError) {
                const errorData = error.response?.data as Record<string, unknown> | undefined;
                const errorMessage = (errorData?.detail || errorData?.message || 'Ошибка обновления награды') as string;
                toast.error(errorMessage);
            }
        },
        ...options,
    });
};

/**
 * Удалить награду платформы
 */
export const useDeletePlatformReward = (
    platform: string,
    options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, string>({
        mutationFn: async (rewardId: string) => {
            const response = await pointsService.deletePlatformReward(platform, rewardId);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
            if (!options?.onSuccess) {
                toast.success('Награда удалена');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error deleting platform reward:', error);
            if (!options?.onError) {
                toast.error('Ошибка удаления награды');
            }
        },
        ...options,
    });
};

/**
 * Переключить статус награды платформы
 */
export const useTogglePlatformReward = (
    platform: string,
    options?: UseMutationOptions<ApiResponse, AxiosError, { rewardId: string; isEnabled: boolean }, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, { rewardId: string; isEnabled: boolean }>({
        mutationFn: async ({ rewardId, isEnabled }: { rewardId: string; isEnabled: boolean }) => {
            const response = await pointsService.togglePlatformReward(platform, rewardId, isEnabled);
            return response.data;
        },
        onSuccess: (_response, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
            if (!options?.onSuccess) {
                toast.success(variables.isEnabled ? 'Награда включена' : 'Награда отключена');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error toggling platform reward:', error);
            if (!options?.onError) {
                toast.error('Ошибка изменения статуса награды');
            }
        },
        ...options,
    });
};
