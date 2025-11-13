/**
 * Chat Queries - централизованные React Query queries для Chat
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { chatService } from '../../services/api/services/chatService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '../../types';

/**
 * Получить историю чата
 */
export const useChatHistory = (params: Record<string, any> = {}, options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.chat.history(),
    queryFn: () => chatService.getChatHistory(params),
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
export const useBotStatus = (options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.chat.botStatus(),
    queryFn: () => chatService.getBotStatus(),
    staleTime: 10 * 1000, // 10 секунд
    gcTime: 2 * 60 * 1000, // 2 минуты
    refetchInterval: 30 * 1000, // 30 секунд
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
};

/**
 * Подключить бота
 */
export const useConnectBot = (options?: UseMutationOptions<any, AxiosError, void>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => chatService.connectBot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.botStatus() });
      if (!options?.onSuccess) {
        toast.success('Бот подключен');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error connecting bot:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Не удалось подключить бота';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Отключить бота
 */
export const useDisconnectBot = (options?: UseMutationOptions<any, AxiosError, void>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => chatService.disconnectBot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.botStatus() });
      if (!options?.onSuccess) {
        toast.success('Бот отключен');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error disconnecting bot:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Не удалось отключить бота';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

