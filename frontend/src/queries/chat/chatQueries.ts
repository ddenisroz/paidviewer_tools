/**
 * Chat Queries - централизованные React Query queries для Chat
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { chatService } from '@/services/api/services/chatService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type { ApiResponse } from '../../types';
import type { AxiosError } from 'axios';

/**
 * Получить историю чата
 */
export const useChatHistory = (
    params: Record<string, unknown> = {},
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: queryKeys.chat.history(),
        queryFn: () => unwrapResponse(chatService.getChatHistory(params)),
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
        ...options,
    });
};

/**
 * Получить статус бота
 */
export const useBotStatus = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery({
        queryKey: queryKeys.chat.botStatus(),
        queryFn: () => unwrapResponse(chatService.getBotStatus()),
        staleTime: 10 * 1000, // 10 секунд
        gcTime: 2 * 60 * 1000, // 2 минуты
        refetchInterval: 30 * 1000, // 30 секунд
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
        ...options,
    });
};

/**
 * Подключить бота
 */
export const useConnectBot = (options?: UseMutationOptions<ApiResponse, AxiosError, void>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => unwrapResponse(chatService.connectBot()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.chat.botStatus() });
            if (!options?.onSuccess) {
                toast.success('Бот подключен');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error connecting bot:', error);
            if (!options?.onError) {
                const errorMessage =
                    ((error.response?.data as Record<string, unknown>)?.detail as string) ||
                    ((error.response?.data as Record<string, unknown>)?.message as string) ||
                    'Не удалось подключить бота';
                toast.error(errorMessage);
            }
        },
        ...options,
    });
};

/**
 * Отключить бота
 */
export const useDisconnectBot = (options?: UseMutationOptions<ApiResponse, AxiosError, void>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => unwrapResponse(chatService.disconnectBot()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.chat.botStatus() });
            if (!options?.onSuccess) {
                toast.success('Бот отключен');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error disconnecting bot:', error);
            if (!options?.onError) {
                const errorMessage =
                    ((error.response?.data as Record<string, unknown>)?.detail as string) ||
                    ((error.response?.data as Record<string, unknown>)?.message as string) ||
                    'Не удалось отключить бота';
                toast.error(errorMessage);
            }
        },
        ...options,
    });
};
