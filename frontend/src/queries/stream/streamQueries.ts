/**
 * Stream Queries - централизованные React Query queries для Stream
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { streamService } from '../../services/api/services/streamService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '../../types';

/**
 * Получить информацию о стриме Twitch
 */
export const useTwitchStreamInfo = (options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'> & { params?: Record<string, any> }) => {
  return useQuery({
    queryKey: queryKeys.stream.twitchInfo(),
    queryFn: () => streamService.getTwitchStreamInfo(options?.params || {}),
    staleTime: 60 * 1000, // 1 минута
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchInterval: 60 * 1000, // 1 минута
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
};

/**
 * Получить информацию о стриме VK
 */
export const useVkStreamInfo = (options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'> & { params?: Record<string, any> }) => {
  return useQuery({
    queryKey: queryKeys.stream.vkInfo(),
    queryFn: () => streamService.getVkStreamInfo(options?.params || {}),
    staleTime: 60 * 1000, // 1 минута
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchInterval: 60 * 1000, // 1 минута
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
};

/**
 * Обновить название стрима Twitch
 */
export const useUpdateTwitchStreamTitle = (options?: UseMutationOptions<any, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => streamService.updateTwitchStreamTitle(title),
    onMutate: async (newTitle: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.stream.twitchInfo() });
      
      // Snapshot previous value
      const previousStreamInfo = queryClient.getQueryData(queryKeys.stream.twitchInfo());
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.stream.twitchInfo(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            title: newTitle
          }
        };
      });
      
      // Return context for rollback
      return { previousStreamInfo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
      if (!options?.onSuccess) {
        toast.success('Название стрима обновлено');
      }
    },
    onError: (error: AxiosError, newTitle, context: { previousStreamInfo?: any } | undefined) => {
      // Rollback on error
      if (context?.previousStreamInfo) {
        queryClient.setQueryData(queryKeys.stream.twitchInfo(), context.previousStreamInfo);
      }
      logger.error('Error updating Twitch stream title:', error);
      if (!options?.onError) {
        toast.error('Ошибка обновления названия стрима');
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
    },
    ...options,
  });
};

/**
 * Обновить категорию стрима Twitch
 */
export const useUpdateTwitchStreamCategory = (options?: UseMutationOptions<any, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => streamService.updateTwitchStreamCategory(categoryId),
    onMutate: async (newCategoryId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.stream.twitchInfo() });
      
      // Snapshot previous value
      const previousStreamInfo = queryClient.getQueryData(queryKeys.stream.twitchInfo());
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.stream.twitchInfo(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            game_id: newCategoryId
          }
        };
      });
      
      // Return context for rollback
      return { previousStreamInfo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
      if (!options?.onSuccess) {
        toast.success('Категория стрима обновлена');
      }
    },
    onError: (error: AxiosError, newCategoryId, context: { previousStreamInfo?: any } | undefined) => {
      // Rollback on error
      if (context?.previousStreamInfo) {
        queryClient.setQueryData(queryKeys.stream.twitchInfo(), context.previousStreamInfo);
      }
      logger.error('Error updating Twitch stream category:', error);
      if (!options?.onError) {
        toast.error('Ошибка обновления категории стрима');
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.twitchInfo() });
    },
    ...options,
  });
};

/**
 * Обновить название стрима VK
 */
export const useUpdateVkStreamTitle = (options?: UseMutationOptions<any, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => streamService.updateVkStreamTitle(title),
    onMutate: async (newTitle: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.stream.vkInfo() });
      
      // Snapshot previous value
      const previousStreamInfo = queryClient.getQueryData(queryKeys.stream.vkInfo());
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.stream.vkInfo(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            title: newTitle
          }
        };
      });
      
      // Return context for rollback
      return { previousStreamInfo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
      if (!options?.onSuccess) {
        toast.success('Название стрима обновлено');
      }
    },
    onError: (error: AxiosError, newTitle, context: { previousStreamInfo?: any } | undefined) => {
      // Rollback on error
      if (context?.previousStreamInfo) {
        queryClient.setQueryData(queryKeys.stream.vkInfo(), context.previousStreamInfo);
      }
      logger.error('Error updating VK stream title:', error);
      if (!options?.onError) {
        toast.error('Ошибка обновления названия стрима');
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
    },
    ...options,
  });
};

/**
 * Обновить категорию стрима VK
 */
export const useUpdateVkStreamCategory = (options?: UseMutationOptions<any, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => streamService.updateVkStreamCategory(categoryId),
    onMutate: async (newCategoryId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.stream.vkInfo() });
      
      // Snapshot previous value
      const previousStreamInfo = queryClient.getQueryData(queryKeys.stream.vkInfo());
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.stream.vkInfo(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            category_id: newCategoryId
          }
        };
      });
      
      // Return context for rollback
      return { previousStreamInfo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
      if (!options?.onSuccess) {
        toast.success('Категория стрима обновлена');
      }
    },
    onError: (error: AxiosError, newCategoryId, context: { previousStreamInfo?: any } | undefined) => {
      // Rollback on error
      if (context?.previousStreamInfo) {
        queryClient.setQueryData(queryKeys.stream.vkInfo(), context.previousStreamInfo);
      }
      logger.error('Error updating VK stream category:', error);
      if (!options?.onError) {
        toast.error('Ошибка обновления категории стрима');
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.vkInfo() });
    },
    ...options,
  });
};

/**
 * Получить категории Twitch
 */
export const useTwitchCategories = (search: string = '', options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.stream.twitchCategories(search),
    queryFn: () => streamService.getTwitchCategories(search),
    enabled: !!search, // Загружаем только при наличии поискового запроса
    staleTime: 5 * 60 * 1000, // 5 минут - категории редко меняются
    gcTime: 30 * 60 * 1000, // 30 минут
    ...options,
  });
};

/**
 * Получить категории VK
 */
export const useVkCategories = (search: string = '', options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.stream.vkCategories(search),
    queryFn: () => streamService.getVkCategories(search),
    enabled: !!search, // Загружаем только при наличии поискового запроса
    staleTime: 5 * 60 * 1000, // 5 минут - категории редко меняются
    gcTime: 30 * 60 * 1000, // 30 минут
    ...options,
  });
};

/**
 * Получить историю стримов
 */
export const useStreamHistory = (options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.stream.history(),
    queryFn: () => streamService.getStreamHistory(),
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchInterval: 30 * 1000, // 30 секунд
    ...options,
  });
};

/**
 * Обновить данные стрима (название и категория)
 */
export const useUpdateStream = (options?: UseMutationOptions<any, AxiosError, Record<string, any>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Record<string, any>) => streamService.updateStream(payload),
    onMutate: async (newData: Record<string, any>) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.stream.all });
      
      // Snapshot previous values
      const previousTwitchInfo = queryClient.getQueryData(queryKeys.stream.twitchInfo());
      const previousVkInfo = queryClient.getQueryData(queryKeys.stream.vkInfo());
      
      // Optimistically update based on platform
      if (newData.platform === 'twitch' || newData.platform === 'both') {
        queryClient.setQueryData(queryKeys.stream.twitchInfo(), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              ...(newData.title && { title: newData.title }),
              ...(newData.game_id && { game_id: newData.game_id })
            }
          };
        });
      }
      
      if (newData.platform === 'vk' || newData.platform === 'both') {
        queryClient.setQueryData(queryKeys.stream.vkInfo(), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              ...(newData.title && { title: newData.title }),
              ...(newData.category_id && { category_id: newData.category_id })
            }
          };
        });
      }
      
      // Return context for rollback
      return { previousTwitchInfo, previousVkInfo };
    },
    onSuccess: () => {
      // Инвалидируем все stream queries
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.all });
      if (!options?.onSuccess) {
        toast.success('Изменения сохранены');
      }
    },
    onError: (error: AxiosError, newData, context: { previousTwitchInfo?: any; previousVkInfo?: any } | undefined) => {
      // Rollback on error
      if (context?.previousTwitchInfo) {
        queryClient.setQueryData(queryKeys.stream.twitchInfo(), context.previousTwitchInfo);
      }
      if (context?.previousVkInfo) {
        queryClient.setQueryData(queryKeys.stream.vkInfo(), context.previousVkInfo);
      }
      logger.error('Error updating stream:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Не удалось сохранить изменения';
        toast.error(errorMessage);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.all });
    },
    ...options,
  });
};

