/**
 * Stream Queries - централизованные React Query queries для Stream
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { streamService } from '@/services/api/services/streamService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type { ApiResponse } from '../../types';
import type { AxiosError } from 'axios';

// Stream info data type
interface StreamInfoData {
    title?: string;
    game_id?: string;
    category_id?: string;
    [key: string]: unknown;
}

/**
 * Получить информацию о стриме Twitch
 */
export const useTwitchStreamInfo = (
    options?: Omit<UseQueryOptions<ApiResponse<StreamInfoData>, AxiosError>, 'queryKey' | 'queryFn'> & {
        params?: Record<string, unknown>;
    }
) => {
    return useQuery<ApiResponse<StreamInfoData>, AxiosError>({
        queryKey: queryKeys.stream.twitchInfo(),
        queryFn: () =>
            unwrapResponse(streamService.getTwitchStreamInfo(options?.params || {})) as Promise<
                ApiResponse<StreamInfoData>
            >,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 60 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
        ...options,
    });
};

/**
 * Получить информацию о стриме VK
 */
export const useVkStreamInfo = (
    options?: Omit<UseQueryOptions<ApiResponse<StreamInfoData>, AxiosError>, 'queryKey' | 'queryFn'> & {
        params?: Record<string, unknown>;
    }
) => {
    return useQuery<ApiResponse<StreamInfoData>, AxiosError>({
        queryKey: queryKeys.stream.vkInfo(),
        queryFn: () =>
            unwrapResponse(streamService.getVkStreamInfo(options?.params || {})) as Promise<
                ApiResponse<StreamInfoData>
            >,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 60 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
        ...options,
    });
};

/**
 * Обновить название стрима Twitch
 */
export const useUpdateTwitchStreamTitle = (
    options?: UseMutationOptions<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >({
        mutationFn: (title: string) =>
            unwrapResponse(streamService.updateTwitchStreamTitle(title)) as Promise<ApiResponse<StreamInfoData>>,
        onMutate: async (newTitle: string) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.stream.twitchInfo() });
            const previousStreamInfo = queryClient.getQueryData<ApiResponse<StreamInfoData>>(
                queryKeys.stream.twitchInfo()
            );

            queryClient.setQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.twitchInfo(), (old) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: { ...old.data, title: newTitle },
                };
            });

            return { previousStreamInfo };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
            toast.success('Название стрима обновлено');
        },
        onError: (error, _newTitle, context) => {
            if (context?.previousStreamInfo) {
                queryClient.setQueryData(queryKeys.stream.twitchInfo(), context.previousStreamInfo);
            }
            logger.error('Error updating Twitch stream title:', error);
            toast.error('Ошибка обновления названия стрима');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
        },
        ...options,
    });
};

/**
 * Обновить категорию стрима Twitch
 */
export const useUpdateTwitchStreamCategory = (
    options?: UseMutationOptions<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >({
        mutationFn: (categoryId: string) =>
            unwrapResponse(streamService.updateTwitchStreamCategory(categoryId)) as Promise<
                ApiResponse<StreamInfoData>
            >,
        onMutate: async (newCategoryId: string) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.stream.twitchInfo() });
            const previousStreamInfo = queryClient.getQueryData<ApiResponse<StreamInfoData>>(
                queryKeys.stream.twitchInfo()
            );

            queryClient.setQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.twitchInfo(), (old) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: { ...old.data, game_id: newCategoryId },
                };
            });

            return { previousStreamInfo };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
            toast.success('Категория стрима обновлена');
        },
        onError: (error, _newCategoryId, context) => {
            if (context?.previousStreamInfo) {
                queryClient.setQueryData(queryKeys.stream.twitchInfo(), context.previousStreamInfo);
            }
            logger.error('Error updating Twitch stream category:', error);
            toast.error('Ошибка обновления категории стрима');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
        },
        ...options,
    });
};

/**
 * Обновить название стрима VK
 */
export const useUpdateVkStreamTitle = (
    options?: UseMutationOptions<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >({
        mutationFn: (title: string) =>
            unwrapResponse(streamService.updateVkStreamTitle(title)) as Promise<ApiResponse<StreamInfoData>>,
        onMutate: async (newTitle: string) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.stream.vkInfo() });
            const previousStreamInfo = queryClient.getQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.vkInfo());

            queryClient.setQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.vkInfo(), (old) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: { ...old.data, title: newTitle },
                };
            });

            return { previousStreamInfo };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
            toast.success('Название стрима обновлено');
        },
        onError: (error, _newTitle, context) => {
            if (context?.previousStreamInfo) {
                queryClient.setQueryData(queryKeys.stream.vkInfo(), context.previousStreamInfo);
            }
            logger.error('Error updating VK stream title:', error);
            toast.error('Ошибка обновления названия стрима');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
        },
        ...options,
    });
};

/**
 * Обновить категорию стрима VK
 */
export const useUpdateVkStreamCategory = (
    options?: UseMutationOptions<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse<StreamInfoData>,
        AxiosError,
        string,
        { previousStreamInfo?: ApiResponse<StreamInfoData> }
    >({
        mutationFn: (categoryId: string) =>
            unwrapResponse(streamService.updateVkStreamCategory(categoryId)) as Promise<ApiResponse<StreamInfoData>>,
        onMutate: async (newCategoryId: string) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.stream.vkInfo() });
            const previousStreamInfo = queryClient.getQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.vkInfo());

            queryClient.setQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.vkInfo(), (old) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: { ...old.data, category_id: newCategoryId },
                };
            });

            return { previousStreamInfo };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
            toast.success('Категория стрима обновлена');
        },
        onError: (error, _newCategoryId, context) => {
            if (context?.previousStreamInfo) {
                queryClient.setQueryData(queryKeys.stream.vkInfo(), context.previousStreamInfo);
            }
            logger.error('Error updating VK stream category:', error);
            toast.error('Ошибка обновления категории стрима');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
        },
        ...options,
    });
};

/**
 * Получить категории Twitch
 */
export const useTwitchCategories = (
    search: string = '',
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<ApiResponse, AxiosError>({
        queryKey: queryKeys.stream.twitchCategories(search),
        queryFn: () => unwrapResponse(streamService.getTwitchCategories(search)),
        enabled: !!search,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        ...options,
    });
};

/**
 * Получить категории VK
 */
export const useVkCategories = (
    search: string = '',
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<ApiResponse, AxiosError>({
        queryKey: queryKeys.stream.vkCategories(search),
        queryFn: () => unwrapResponse(streamService.getVkCategories(search)),
        enabled: !!search,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        ...options,
    });
};

/**
 * Получить историю стримов
 */
export const useStreamHistory = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery<ApiResponse, AxiosError>({
        queryKey: queryKeys.stream.history(),
        queryFn: () => unwrapResponse(streamService.getStreamHistory()),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 30 * 1000,
        ...options,
    });
};

/**
 * Обновить данные стрима (название и категория)
 */
export const useUpdateStream = (
    options?: UseMutationOptions<
        ApiResponse<StreamInfoData>,
        AxiosError,
        Record<string, unknown>,
        { previousTwitchInfo?: ApiResponse<StreamInfoData>; previousVkInfo?: ApiResponse<StreamInfoData> }
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse<StreamInfoData>,
        AxiosError,
        Record<string, unknown>,
        { previousTwitchInfo?: ApiResponse<StreamInfoData>; previousVkInfo?: ApiResponse<StreamInfoData> }
    >({
        mutationFn: async (payload: Record<string, unknown>) => {
            const response = await (unwrapResponse(streamService.updateStream(payload)) as Promise<
                ApiResponse<StreamInfoData>
            >);
            if (response?.success === false) {
                const error = new Error(
                    response.message || response.error || 'Не удалось сохранить изменения'
                ) as AxiosError;
                (error as unknown as { response?: { status?: number; data?: ApiResponse<StreamInfoData> } }).response =
                    {
                        status: 409,
                        data: response,
                    };
                throw error;
            }
            return response;
        },
        onMutate: async (newData: Record<string, unknown>) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.stream.all });

            const previousTwitchInfo = queryClient.getQueryData<ApiResponse<StreamInfoData>>(
                queryKeys.stream.twitchInfo()
            );
            const previousVkInfo = queryClient.getQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.vkInfo());

            if (newData.platform === 'twitch' || newData.platform === 'both') {
                queryClient.setQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.twitchInfo(), (old) => {
                    if (!old?.data) return old;
                    const updates: Partial<StreamInfoData> = {};
                    if (newData.title) updates.title = newData.title as string;
                    if (newData.game_id) updates.game_id = newData.game_id as string;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            ...updates,
                        },
                    };
                });
            }

            if (newData.platform === 'vk' || newData.platform === 'both') {
                queryClient.setQueryData<ApiResponse<StreamInfoData>>(queryKeys.stream.vkInfo(), (old) => {
                    if (!old?.data) return old;
                    const updates: Partial<StreamInfoData> = {};
                    if (newData.title) updates.title = newData.title as string;
                    if (newData.category_id) updates.category_id = newData.category_id as string;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            ...updates,
                        },
                    };
                });
            }

            return { previousTwitchInfo, previousVkInfo };
        },
        onSuccess: (_data, variables) => {
            // Targeted invalidation based on payload keys
            const hasTwitchUpdates = 'twitch' in variables;
            const hasVkUpdates = 'vk' in variables;

            if (hasTwitchUpdates) {
                queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
            }
            if (hasVkUpdates) {
                queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
            }

            // If neither (or something else), default to all to be safe
            if (!hasTwitchUpdates && !hasVkUpdates) {
                queryClient.invalidateQueries({ queryKey: queryKeys.stream.all });
            }

            toast.success('Изменения сохранены');
        },
        onError: (error, _newData, context) => {
            if (context?.previousTwitchInfo) {
                queryClient.setQueryData(queryKeys.stream.twitchInfo(), context.previousTwitchInfo);
            }
            if (context?.previousVkInfo) {
                queryClient.setQueryData(queryKeys.stream.vkInfo(), context.previousVkInfo);
            }
            logger.error('Error updating stream:', error);
            const errorData = error.response?.data as Record<string, unknown> | undefined;
            const rawErrorMessage = errorData?.detail || errorData?.message;
            const errorMessage =
                typeof rawErrorMessage === 'string'
                    ? rawErrorMessage
                    : rawErrorMessage != null && typeof rawErrorMessage === 'object'
                      ? JSON.stringify(rawErrorMessage)
                      : 'Не удалось сохранить изменения';
            toast.error(errorMessage);
        },
        onSettled: (_data, _error, variables) => {
            if (variables) {
                if ('twitch' in variables) queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
                if ('vk' in variables) queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
                if (!('twitch' in variables) && !('vk' in variables))
                    queryClient.invalidateQueries({ queryKey: queryKeys.stream.all });
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.stream.all });
            }
        },
        ...options,
    });
};
