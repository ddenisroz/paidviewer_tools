/**
 * Drops Queries - централизованные React Query queries для Drops
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { dropsService } from '@/services/api/services/dropsService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type { ApiResponse, DropsConfig, DropsHistory, DropsReward } from '../../types';
import type { AxiosError } from 'axios';

/**
 * Получить конфигурацию Drops
 */
export const useDropsConfig = (
    channelName: string | null | undefined,
    options?: Omit<UseQueryOptions<DropsConfig | null, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<DropsConfig | null, AxiosError>({
        queryKey: queryKeys.drops.config(channelName),
        queryFn: async () => {
            if (!channelName) return null;
            const response = await unwrapResponse(dropsService.getConfig(channelName));
            return (response?.success ? response?.data : null) as DropsConfig | null;
        },
        enabled: !!channelName,
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        ...options,
    });
};

/**
 * Обновить конфигурацию Drops
 */
export const useUpdateDropsConfig = (
    channelName: string,
    options?: UseMutationOptions<ApiResponse, AxiosError, Partial<DropsConfig>, { previousConfig?: DropsConfig }>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (config: Partial<DropsConfig>) => unwrapResponse(dropsService.updateConfig(channelName, config)),
        onMutate: async (config: Partial<DropsConfig>) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.drops.config(channelName) });
            const previousConfig = queryClient.getQueryData<DropsConfig>(queryKeys.drops.config(channelName));

            queryClient.setQueryData(
                queryKeys.drops.config(channelName),
                (old: DropsConfig | undefined) =>
                    ({
                        ...old,
                        ...config,
                    }) as DropsConfig
            );

            return { previousConfig };
        },
        onError: (
            err: AxiosError,
            config: Partial<DropsConfig>,
            context: { previousConfig?: DropsConfig } | undefined
        ) => {
            if (context?.previousConfig) {
                queryClient.setQueryData(queryKeys.drops.config(channelName), context.previousConfig);
            }
            toast.error('Ошибка сохранения настроек Drops');
            logger.error('Error updating drops config:', err);
        },
        onSuccess: (_response, config: Partial<DropsConfig>, _context) => {
            if (_response?.success && _response?.data) {
                queryClient.setQueryData(queryKeys.drops.config(channelName), _response.data);
            }

            // [OK] СИНХРОНИЗАЦИЯ: Отправляем события для синхронизации с другими компонентами
            if (config.donation_enabled !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('drops-config-changed', {
                        detail: {
                            donation_enabled: config.donation_enabled,
                            channel: channelName,
                            source: 'useDropsConfig',
                        },
                    })
                );
            }
            if (config.streak_enabled_twitch !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('drops-config-changed', {
                        detail: {
                            streak_enabled: config.streak_enabled_twitch,
                            channel: channelName,
                            platform: 'twitch',
                            source: 'useDropsConfig',
                        },
                    })
                );
            }
            if (config.streak_enabled_vk !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('drops-config-changed', {
                        detail: {
                            streak_enabled: config.streak_enabled_vk,
                            channel: channelName,
                            platform: 'vk',
                            source: 'useDropsConfig',
                        },
                    })
                );
            }
        },
        ...options,
    });
};

/**
 * Получить качества Drops
 */
export const useDropsQualities = (options?: Omit<UseQueryOptions<string[], AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery<string[], AxiosError>({
        queryKey: queryKeys.drops.qualities(),
        queryFn: async () => {
            const response = await unwrapResponse(dropsService.getQualities());
            return (response?.success ? response?.data : []) as string[];
        },
        staleTime: 10 * 60 * 1000, // 10 минут - качества редко меняются
        gcTime: 30 * 60 * 1000, // 30 минут
        ...options,
    });
};

/**
 * Получить награды Drops
 */
export const useDropsRewards = (
    channelName: string | null | undefined,
    options?: Omit<UseQueryOptions<DropsReward[], AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<DropsReward[], AxiosError>({
        queryKey: queryKeys.drops.rewards(channelName),
        queryFn: async () => {
            if (!channelName) return [];
            const response = await unwrapResponse(dropsService.getRewards(channelName));
            if (!response?.success) return [];
            return (response?.data || []) as DropsReward[];
        },
        enabled: !!channelName,
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        ...options,
    });
};

/**
 * Создать награду Drops
 */
export const useCreateDropsReward = (
    channelName: string,
    options?: UseMutationOptions<ApiResponse, AxiosError, Partial<DropsReward>, { previousRewards?: DropsReward[] }>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reward: Partial<DropsReward>) => unwrapResponse(dropsService.createReward(channelName, reward)),
        onMutate: async (reward: Partial<DropsReward>) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));

            const tempReward: DropsReward = {
                id: `temp-${Date.now()}`,
                name: reward.name || '',
                quality: reward.quality || 'common',
                ...reward,
            } as DropsReward;

            queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old: DropsReward[] | undefined) => {
                if (!old) return [tempReward];
                return [...old, tempReward];
            });

            return { previousRewards };
        },
        onError: (
            err: AxiosError,
            _reward: Partial<DropsReward>,
            context: { previousRewards?: DropsReward[] } | undefined
        ) => {
            if (context?.previousRewards) {
                queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
            }
            logger.error('Error creating reward:', err);
            toast.error('Ошибка создания награды');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            toast.success('Награда создана');
        },
        ...options,
    });
};

/**
 * Обновить награду Drops
 */
export const useUpdateDropsReward = (
    channelName: string,
    options?: UseMutationOptions<
        ApiResponse,
        AxiosError,
        { rewardId: number; reward: Partial<DropsReward> },
        { previousRewards?: DropsReward[] }
    >
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ rewardId, reward }: { rewardId: number; reward: Partial<DropsReward> }) =>
            unwrapResponse(dropsService.updateReward(channelName, rewardId, reward)),
        onMutate: async (variables) => {
            const { rewardId, reward } = variables;
            await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));

            queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old: DropsReward[] | undefined) => {
                if (!old) return old;
                return old.map((r) => (r.id === rewardId ? { ...r, ...reward } : r)) as DropsReward[];
            });

            return { previousRewards };
        },
        onError: (
            err: AxiosError,
            _variables: { rewardId: number; reward: Partial<DropsReward> },
            context: { previousRewards?: DropsReward[] } | undefined
        ) => {
            if (context?.previousRewards) {
                queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
            }
            logger.error('Error updating reward:', err);
            toast.error('Ошибка обновления награды');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            toast.success('Награда обновлена');
        },
        ...options,
    });
};

/**
 * Удалить награду Drops
 */
export const useDeleteDropsReward = (
    channelName: string,
    options?: UseMutationOptions<ApiResponse, AxiosError, number, { previousRewards?: DropsReward[] }>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (rewardId: number) => unwrapResponse(dropsService.deleteReward(channelName, rewardId)),
        onMutate: async (rewardId: number) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));

            queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old: DropsReward[] | undefined) => {
                if (!old) return old;
                return old.filter((r) => r.id !== rewardId);
            });

            return { previousRewards };
        },
        onError: (err: AxiosError, _rewardId: number, context: { previousRewards?: DropsReward[] } | undefined) => {
            if (context?.previousRewards) {
                queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
            }
            logger.error('Error deleting reward:', err);
            toast.error('Ошибка удаления награды');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            toast.success('Награда удалена');
        },
        ...options,
    });
};

/**
 * Переключить активность награды Drops
 */
export const useToggleDropsReward = (
    channelName: string,
    options?: UseMutationOptions<
        ApiResponse,
        AxiosError,
        { rewardId: number; isActive: boolean },
        { previousRewards?: DropsReward[] }
    >
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ rewardId, isActive }: { rewardId: number; isActive: boolean }) =>
            unwrapResponse(dropsService.toggleReward(channelName, rewardId, isActive)),
        onMutate: async (variables) => {
            const { rewardId, isActive } = variables;
            await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));

            queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old: DropsReward[] | undefined) => {
                if (!old) return old;
                return old.map((reward) =>
                    reward.id === rewardId ? { ...reward, is_active: isActive } : reward
                ) as DropsReward[];
            });

            return { previousRewards };
        },
        onError: (
            err: AxiosError,
            _variables: { rewardId: number; isActive: boolean },
            context: { previousRewards?: DropsReward[] } | undefined
        ) => {
            if (context?.previousRewards) {
                queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
            }
            toast.error('Ошибка переключения награды');
            logger.error('Error toggling reward:', err);
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            toast.success(response?.message || 'Статус награды изменен');
        },
        ...options,
    });
};

export const useUploadDropsRewardSound = (
    channelName: string,
    options?: UseMutationOptions<
        ApiResponse<{ sound_file?: string; filename?: string }>,
        AxiosError,
        { rewardId: number; file: File },
        unknown
    >
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ rewardId, file }: { rewardId: number; file: File }) =>
            unwrapResponse(dropsService.uploadRewardSound(rewardId, file)),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
            toast.success(response?.message || 'Звук награды загружен');
        },
        onError: (error: AxiosError) => {
            logger.error('Error uploading reward sound:', error);
            toast.error('Не удалось загрузить звук награды');
        },
        ...options,
    });
};

/**
 * Получить историю Drops
 */
export const useDropsHistory = (
    channelName: string | null | undefined,
    params: Record<string, unknown> = {},
    options?: Omit<UseQueryOptions<{ data: DropsHistory[]; hasMore: boolean }, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<{ data: DropsHistory[]; hasMore: boolean }, AxiosError>({
        queryKey: [...queryKeys.drops.history(channelName), params],
        queryFn: async () => {
            if (!channelName) return { data: [], hasMore: false };
            const response = await unwrapResponse(dropsService.getHistory(channelName, params));
            return {
                data: (response?.success ? response?.data : []) as DropsHistory[],
                hasMore: ((response?.data as DropsHistory[]) || []).length === (params.limit || 50),
            };
        },
        enabled: !!channelName,
        staleTime: 10 * 1000, // 10 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        ...options,
    });
};

/**
 * Сгенерировать или получить URL виджета для OBS
 */
export const useGenerateDropsWidgetUrl = (options?: UseMutationOptions<ApiResponse, AxiosError, boolean, unknown>) => {
    return useMutation({
        mutationFn: (regenerate: boolean = false) => unwrapResponse(dropsService.generateWidgetUrl(regenerate)),
        onSuccess: (_response, _regenerate: boolean, _context) => {
            if (_regenerate) {
                toast.success('Токен виджета перегенерирован');
            }
        },
        onError: (error: AxiosError, _regenerate: boolean, _context) => {
            logger.error('Error generating widget URL:', error);
            toast.error('Ошибка генерации URL виджета');
        },
        ...options,
    });
};

export const useSendDropsWidgetTestEvent = (
    channelName: string,
    options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>
) => {
    return useMutation({
        mutationFn: (quality: string) => unwrapResponse(dropsService.sendWidgetTestEvent(channelName, quality)),
        onSuccess: (response) => {
            const delivered = Number((response?.data as { delivered?: number } | undefined)?.delivered ?? 0);
            if (delivered > 0) {
                toast.success('Тестовое событие отправлено в виджет');
                return;
            }
            toast.warning('Виджет не подключен. Открой URL в OBS или браузере и повтори тест');
        },
        onError: (error: AxiosError) => {
            logger.error('Error sending drops widget test event:', error);
            toast.error('Не удалось запустить тест виджета');
        },
        ...options,
    });
};
