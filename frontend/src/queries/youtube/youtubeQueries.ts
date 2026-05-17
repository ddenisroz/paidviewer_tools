/**
 * YouTube Queries - централизованные React Query queries для YouTube
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { youtubeService } from '@/services/api/services/youtubeService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type { ApiResponse, YouTubeSettings } from '../../types';
import type { AxiosError } from 'axios';

interface YoutubeQueue {
    queue: unknown[];
    current_video: unknown | null;
    is_playing?: boolean;
    skip_votes?: {
        current: number;
        required: number;
        video_id?: number | string | null;
    };
}

/**
 * Получить очередь YouTube
 */
export const useYoutubeQueue = (options?: Omit<UseQueryOptions<YoutubeQueue, AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery<YoutubeQueue, AxiosError>({
        queryKey: queryKeys.youtube.queue(),
        queryFn: async () => {
            const response = await unwrapResponse(youtubeService.getQueue());
            return response as unknown as YoutubeQueue;
        },
        staleTime: 15 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 15 * 1000,
        refetchIntervalInBackground: false,
        ...options,
    });
};

/**
 * Добавить видео в очередь YouTube
 */
export const useAddYoutubeVideo = (
    options?: Omit<
        UseMutationOptions<
            ApiResponse,
            AxiosError,
            string | { video_url?: string; url?: string; is_paid?: boolean; points_cost?: number },
            unknown
        >,
        'mutationFn'
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse,
        AxiosError,
        string | { video_url?: string; url?: string; is_paid?: boolean; points_cost?: number },
        unknown
    >({
        mutationFn: (data) => {
            if (typeof data === 'string') {
                return unwrapResponse(youtubeService.addToQueue({ video_url: data }));
            }
            return unwrapResponse(youtubeService.addToQueue(data));
        },
        onSuccess: (_data, _variables, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
            if (!options?.onSuccess) {
                toast.success('Видео добавлено в очередь');
            }
        },
        onError: (error: AxiosError, _variables, _context) => {
            logger.error('Error adding video to queue:', error);
            if (!options?.onError) {
                const errorData = error.response?.data as Record<string, unknown> | undefined;
                const errorMessage = (errorData?.detail ||
                    errorData?.message ||
                    'Ошибка добавления видео в очередь') as string;
                toast.error(errorMessage);
            }
        },
        ...options,
    });
};

/**
 * Удалить видео из очереди YouTube
 */
export const useDeleteYoutubeVideo = (
    options?: Omit<UseMutationOptions<ApiResponse, AxiosError, number, unknown>, 'mutationFn'>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, number, unknown>({
        mutationFn: (queueId: number) => unwrapResponse(youtubeService.removeFromQueue(queueId)),
        onSuccess: (_data, _variables, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
            if (!options?.onSuccess) {
                toast.success('Видео удалено из очереди');
            }
        },
        onError: (error: AxiosError, _variables, _context) => {
            logger.error('Error removing video from queue:', error);
            if (!options?.onError) {
                toast.error('Ошибка удаления видео из очереди');
            }
        },
        ...options,
    });
};

/**
 * Удалить видео из очереди YouTube (алиас для совместимости)
 */
export const useRemoveYoutubeVideo = useDeleteYoutubeVideo;

/**
 * Очистить очередь YouTube
 */
export const useClearYoutubeQueue = (
    options?: Omit<UseMutationOptions<ApiResponse, AxiosError, void, unknown>, 'mutationFn'>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, void, unknown>({
        mutationFn: () => unwrapResponse(youtubeService.clearQueue()),
        onSuccess: (_response, _variables, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
            if (!options?.onSuccess) {
                toast.success('Очередь очищена');
            }
        },
        onError: (error: AxiosError, _variables, _context) => {
            logger.error('Error clearing queue:', error);
            if (!options?.onError) {
                toast.error('Ошибка очистки очереди');
            }
        },
        ...options,
    });
};

/**
 * Отметить видео как проигранное
 */
export const useMarkYoutubeVideoAsPlayed = (
    options?: Omit<UseMutationOptions<ApiResponse, AxiosError, number, unknown>, 'mutationFn'>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, number, unknown>({
        mutationFn: (queueId: number) => unwrapResponse(youtubeService.markAsPlayed(queueId)),
        onSuccess: (_data, _variables, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
            if (!options?.onSuccess) {
                toast.success('Видео отмечено как проигранное');
            }
        },
        onError: (error: AxiosError, _variables, _context) => {
            logger.error('Error marking video as played:', error);
            if (!options?.onError) {
                toast.error('Ошибка обновления статуса видео');
            }
        },
        ...options,
    });
};

/**
 * Перейти к следующему видео YouTube
 */
export const useNextYoutubeVideo = (
    options?: Omit<UseMutationOptions<ApiResponse, AxiosError, void, unknown>, 'mutationFn'>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, void, unknown>({
        mutationFn: () => unwrapResponse(youtubeService.nextVideo()),
        onSuccess: (_response, _variables, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
            if (!options?.onSuccess) {
                toast.success('Переход к следующему видео');
            }
        },
        onError: (error: AxiosError, _variables, _context) => {
            logger.error('Error going to next video:', error);
            if (!options?.onError) {
                toast.error('Ошибка перехода к следующему видео');
            }
        },
        ...options,
    });
};

/**
 * Пропустить видео (алиас для useNextYoutubeVideo)
 */
export const useSkipYoutubeVideo = useNextYoutubeVideo;

/**
 * Переключиться на конкретный элемент очереди YouTube
 */
export const usePlayYoutubeQueueItem = (
    options?: Omit<UseMutationOptions<ApiResponse, AxiosError, number, unknown>, 'mutationFn'>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, number, unknown>({
        mutationFn: (queueId: number) => unwrapResponse(youtubeService.playQueueItem(queueId)),
        onSuccess: (_response, _queueId, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
            if (!options?.onSuccess) {
                toast.success('Переход к выбранному видео');
            }
        },
        onError: (error: AxiosError, _queueId, _context) => {
            logger.error('Error switching to queue item:', error);
            if (!options?.onError) {
                toast.error('Ошибка переключения видео');
            }
        },
        ...options,
    });
};

/**
 * Получить настройки YouTube
 */
export const useYoutubeSettings = (
    options?: Omit<UseQueryOptions<YouTubeSettings, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<YouTubeSettings, AxiosError>({
        queryKey: queryKeys.youtube.settings(),
        queryFn: async () => {
            const response = await unwrapResponse(youtubeService.getSettings());
            return response as unknown as YouTubeSettings;
        },
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        ...options,
    });
};

/**
 * Сохранить настройки YouTube
 */
export const useSaveYoutubeSettings = (
    options?: Omit<UseMutationOptions<YouTubeSettings, AxiosError, Partial<YouTubeSettings>, unknown>, 'mutationFn'>
) => {
    const queryClient = useQueryClient();

    return useMutation<YouTubeSettings, AxiosError, Partial<YouTubeSettings>, unknown>({
        mutationFn: async (settings: Partial<YouTubeSettings>) => {
            const response = await unwrapResponse(youtubeService.saveSettings(settings));
            return response as unknown as YouTubeSettings;
        },
        onSuccess: (_response, _settings, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.youtube.settings() });
            if (!options?.onSuccess) {
                toast.success('Настройки YouTube сохранены');
            }
        },
        onError: (error: AxiosError, _settings, _context) => {
            logger.error('Error saving YouTube settings:', error);
            if (!options?.onError) {
                toast.error('Ошибка сохранения настроек YouTube');
            }
        },
        ...options,
    });
};
