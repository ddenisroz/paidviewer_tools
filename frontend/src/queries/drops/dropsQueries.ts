/**
 * Drops Queries - централизованные React Query queries для Drops
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { dropsService } from '../../services/api/services/dropsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import type { AxiosError } from 'axios';
import type { ApiResponse, DropsConfig, DropsReward, DropsHistory } from '../../types';

/**
 * Получить конфигурацию Drops
 */
export const useDropsConfig = (channelName: string | null | undefined, options?: Omit<UseQueryOptions<DropsConfig | null, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<DropsConfig | null, AxiosError>({
    queryKey: queryKeys.drops.config(channelName),
    queryFn: async () => {
      if (!channelName) return null;
      const response = await dropsService.getConfig(channelName);
      // Возвращаем данные в формате, который ожидают компоненты
      return ((response.data as any)?.success ? (response.data as any)?.data : null) as DropsConfig | null;
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
export const useUpdateDropsConfig = (channelName: string, options?: UseMutationOptions<any, AxiosError, Partial<DropsConfig>, { previousConfig?: DropsConfig }>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: (config: Partial<DropsConfig>) => dropsService.updateConfig(channelName, config),
    onMutate: async (config: Partial<DropsConfig>) => {
      // Отменяем исходящие запросы
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.config(channelName) });
      
      // Сохраняем предыдущее значение
      const previousConfig = queryClient.getQueryData<DropsConfig>(queryKeys.drops.config(channelName));
      
      // Оптимистичное обновление
      queryClient.setQueryData(queryKeys.drops.config(channelName), (old: DropsConfig | undefined) => ({
        ...old,
        ...config,
      } as DropsConfig));
      
      return { previousConfig };
    },
    onError: (err: AxiosError, config: Partial<DropsConfig>, context: { previousConfig?: DropsConfig } | undefined) => {
      // Откатываем при ошибке
      if (context?.previousConfig) {
        queryClient.setQueryData(queryKeys.drops.config(channelName), context.previousConfig);
      }
      // Вызываем onError из options если он есть
      if (options?.onError) {
        (options.onError as any)(err, config, context);
      } else {
        toast.error('Ошибка сохранения настроек Drops');
        logger.error('Error updating drops config:', err);
      }
    },
    onSuccess: (response, config: Partial<DropsConfig>, context) => {
      // Обновляем кэш данными с сервера
      if ((response.data as any)?.success && (response.data as any)?.data) {
        queryClient.setQueryData(queryKeys.drops.config(channelName), (response.data as any).data);
      }
      
      // ✅ СИНХРОНИЗАЦИЯ: Отправляем события для синхронизации с другими компонентами
      // Добавляем source для предотвращения циклических обновлений
      if (config.donation_enabled !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            donation_enabled: config.donation_enabled,
            channel: channelName,
            source: 'useDropsConfig'
          }
        }));
      }
      if (config.streak_enabled_twitch !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            streak_enabled: config.streak_enabled_twitch, 
            channel: channelName, 
            platform: 'twitch',
            source: 'useDropsConfig'
          }
        }));
      }
      if (config.streak_enabled_vk !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            streak_enabled: config.streak_enabled_vk, 
            channel: channelName, 
            platform: 'vk',
            source: 'useDropsConfig'
          }
        }));
      }
      
      // Вызываем onSuccess из options если он есть
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, config, context);
      }
    },
    // ✅ УБРАНО: onSettled с invalidateQueries - не нужен, так как данные уже обновлены в onSuccess
    // Это предотвращает race condition и некорректное отображение статуса
    ...(options || {}),
  });
};

/**
 * Получить качества Drops
 */
export const useDropsQualities = (options?: Omit<UseQueryOptions<string[], AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<string[], AxiosError>({
    queryKey: queryKeys.drops.qualities(),
    queryFn: async () => {
      const response = await dropsService.getQualities();
      // Возвращаем данные в формате, который ожидают компоненты
      return ((response.data as any)?.success ? (response.data as any)?.data : []) as string[];
    },
    staleTime: 10 * 60 * 1000, // 10 минут - качества редко меняются
    gcTime: 30 * 60 * 1000, // 30 минут
    ...options,
  });
};

/**
 * Получить награды Drops
 */
export const useDropsRewards = (channelName: string | null | undefined, options?: Omit<UseQueryOptions<DropsReward[], AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<DropsReward[], AxiosError>({
    queryKey: queryKeys.drops.rewards(channelName),
    queryFn: async () => {
      if (!channelName) return [];
      const response = await dropsService.getRewards(channelName);
      // Возвращаем данные в формате, который ожидают компоненты
      if (!(response.data as any)?.success) return [];
      return ((response.data as any)?.data || []) as DropsReward[];
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
export const useCreateDropsReward = (channelName: string, options?: UseMutationOptions<any, AxiosError, Partial<DropsReward>, unknown>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: (reward: Partial<DropsReward>) => dropsService.createReward(channelName, reward),
    onMutate: async (reward: Partial<DropsReward>) => {
      // Вызываем onMutate из options если есть
      const customContext = options?.onMutate ? await (options.onMutate as any)(reward) : undefined;
      
      // Оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));
      
      // Добавляем временную награду в список
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
      
      return { previousRewards, ...(customContext || {}) };
    },
    onError: (err: AxiosError, reward: Partial<DropsReward>, context: { previousRewards?: DropsReward[] } | undefined) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options?.onError) {
        (options.onError as any)(err, reward, context);
      } else {
        logger.error('Error creating reward:', err);
        toast.error('Ошибка создания награды');
      }
    },
    onSuccess: (response, reward: Partial<DropsReward>, context) => {
      // Инвалидируем для получения актуальных данных с сервера
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, reward, context);
      } else {
        toast.success('Награда создана');
      }
    },
    ...(options || {}),
  });
};

/**
 * Обновить награду Drops
 */
export const useUpdateDropsReward = (channelName: string, options?: UseMutationOptions<any, AxiosError, { rewardId: number; reward: Partial<DropsReward> }, unknown>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: ({ rewardId, reward }: { rewardId: number; reward: Partial<DropsReward> }) => dropsService.updateReward(channelName, rewardId, reward),
    onMutate: async (variables) => {
      // Вызываем onMutate из options если есть
      const customContext = options?.onMutate ? await (options.onMutate as any)(variables) : undefined;
      
      // Оптимистичное обновление
      const { rewardId, reward } = variables;
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));
      
      queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old: DropsReward[] | undefined) => {
        if (!old) return old;
        return old.map(r => r.id === rewardId ? { ...r, ...reward } : r) as DropsReward[];
      });
      
      return { previousRewards, ...(customContext || {}) };
    },
    onError: (err: AxiosError, variables: { rewardId: number; reward: Partial<DropsReward> }, context: { previousRewards?: DropsReward[] } | undefined) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options?.onError) {
        (options.onError as any)(err, variables, context);
      } else {
        logger.error('Error updating reward:', err);
        toast.error('Ошибка обновления награды');
      }
    },
    onSuccess: (response, variables: { rewardId: number; reward: Partial<DropsReward> }, context) => {
      // Инвалидируем для получения актуальных данных с сервера
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, variables, context);
      } else {
        toast.success('Награда обновлена');
      }
    },
    ...(options || {}),
  });
};

/**
 * Удалить награду Drops
 */
export const useDeleteDropsReward = (channelName: string, options?: UseMutationOptions<any, AxiosError, number, unknown>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: (rewardId: number) => dropsService.deleteReward(channelName, rewardId),
    onMutate: async (rewardId: number) => {
      // Вызываем onMutate из options если есть
      const customContext = options?.onMutate ? await (options.onMutate as any)(rewardId) : undefined;
      
      // Оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));
      
      queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old: DropsReward[] | undefined) => {
        if (!old) return old;
        return old.filter(r => r.id !== rewardId);
      });
      
      return { previousRewards, ...(customContext || {}) };
    },
    onError: (err: AxiosError, rewardId: number, context: { previousRewards?: DropsReward[] } | undefined) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options?.onError) {
        (options.onError as any)(err, rewardId, context);
      } else {
        logger.error('Error deleting reward:', err);
        toast.error('Ошибка удаления награды');
      }
    },
    onSuccess: (response, rewardId: number, context) => {
      // Инвалидируем для синхронизации
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, rewardId, context);
      } else {
        toast.success('Награда удалена');
      }
    },
    ...(options || {}),
  });
};

/**
 * Переключить активность награды Drops
 */
export const useToggleDropsReward = (channelName: string, options?: UseMutationOptions<any, AxiosError, { rewardId: number; isActive: boolean }, unknown>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: ({ rewardId, isActive }: { rewardId: number; isActive: boolean }) => dropsService.toggleReward(channelName, rewardId, isActive),
    onMutate: async (variables) => {
      // Вызываем onMutate из options если есть
      const customContext = options?.onMutate ? await (options.onMutate as any)(variables) : undefined;
      
      // Оптимистичное обновление
      const { rewardId, isActive } = variables;
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData<DropsReward[]>(queryKeys.drops.rewards(channelName));
      
      queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old: DropsReward[] | undefined) => {
        if (!old) return old;
        return old.map(reward =>
          reward.id === rewardId ? { ...reward, is_active: isActive } : reward
        ) as DropsReward[];
      });
      
      return { previousRewards, ...(customContext || {}) };
    },
    onError: (err: AxiosError, variables: { rewardId: number; isActive: boolean }, context: { previousRewards?: DropsReward[] } | undefined) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options?.onError) {
        (options.onError as any)(err, variables, context);
      } else {
        toast.error('Ошибка переключения награды');
        logger.error('Error toggling reward:', err);
      }
    },
    onSuccess: (response, variables: { rewardId: number; isActive: boolean }, context) => {
      // Инвалидируем для синхронизации
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, variables, context);
      } else {
        toast.success((response.data as any)?.message || 'Статус награды изменен');
      }
    },
    ...(options || {}),
  });
};

/**
 * Получить историю Drops
 */
export const useDropsHistory = (channelName: string | null | undefined, params: Record<string, any> = {}, options?: Omit<UseQueryOptions<{ data: DropsHistory[]; hasMore: boolean }, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<{ data: DropsHistory[]; hasMore: boolean }, AxiosError>({
    queryKey: [...queryKeys.drops.history(channelName), params],
    queryFn: async () => {
      if (!channelName) return { data: [], hasMore: false };
      const response = await dropsService.getHistory(channelName, params);
      return {
        data: ((response.data as any)?.success ? (response.data as any)?.data : []) as DropsHistory[],
        hasMore: ((response.data as any)?.data || []).length === (params.limit || 50),
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
export const useGenerateDropsWidgetUrl = (options?: UseMutationOptions<any, AxiosError, boolean, unknown>) => {
  
  
  return useMutation({
    mutationFn: (regenerate: boolean = false) => dropsService.generateWidgetUrl(regenerate),
    onSuccess: (response, regenerate: boolean, context) => {
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, regenerate, context);
      } else if (regenerate) {
        toast.success('Токен виджета перегенерирован');
      }
    },
    onError: (error: AxiosError, regenerate: boolean, context) => {
      logger.error('Error generating widget URL:', error);
      if (options?.onError) {
        (options.onError as any)(error, regenerate, context);
      } else {
        toast.error('Ошибка генерации URL виджета');
      }
    },
    ...(options || {}),
  });
};

