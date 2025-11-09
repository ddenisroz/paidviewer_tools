/**
 * Drops Queries - централизованные React Query queries для Drops
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { dropsService } from '../../services/api/services/dropsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

/**
 * Получить конфигурацию Drops
 */
export const useDropsConfig = (channelName, options = {}) => {
  return useQuery({
    queryKey: queryKeys.drops.config(channelName),
    queryFn: async () => {
      if (!channelName) return null;
      const response = await dropsService.getConfig(channelName);
      // Возвращаем данные в формате, который ожидают компоненты
      return response.data.success ? response.data.data : null;
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
export const useUpdateDropsConfig = (channelName, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config) => dropsService.updateConfig(channelName, config),
    onMutate: async (config) => {
      // Отменяем исходящие запросы
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.config(channelName) });
      
      // Сохраняем предыдущее значение
      const previousConfig = queryClient.getQueryData(queryKeys.drops.config(channelName));
      
      // Оптимистичное обновление
      queryClient.setQueryData(queryKeys.drops.config(channelName), (old) => ({
        ...old,
        ...config,
      }));
      
      return { previousConfig };
    },
    onError: (err, config, context) => {
      // Откатываем при ошибке
      if (context?.previousConfig) {
        queryClient.setQueryData(queryKeys.drops.config(channelName), context.previousConfig);
      }
      // Вызываем onError из options если он есть
      if (options.onError) {
        options.onError(err, config, context);
      } else {
        toast.error('Ошибка сохранения настроек Drops');
        logger.error('Error updating drops config:', err);
      }
    },
    onSuccess: (response, config, context) => {
      // Обновляем кэш данными с сервера
      if (response.data?.success && response.data?.data) {
        queryClient.setQueryData(queryKeys.drops.config(channelName), response.data.data);
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
      if (options.onSuccess) {
        options.onSuccess(response, config, context);
      }
    },
    // ✅ УБРАНО: onSettled с invalidateQueries - не нужен, так как данные уже обновлены в onSuccess
    // Это предотвращает race condition и некорректное отображение статуса
    ...options,
  });
};

/**
 * Получить качества Drops
 */
export const useDropsQualities = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.drops.qualities(),
    queryFn: async () => {
      const response = await dropsService.getQualities();
      // Возвращаем данные в формате, который ожидают компоненты
      return response.data.success ? response.data.data : [];
    },
    staleTime: 10 * 60 * 1000, // 10 минут - качества редко меняются
    gcTime: 30 * 60 * 1000, // 30 минут
    ...options,
  });
};

/**
 * Получить награды Drops
 */
export const useDropsRewards = (channelName, options = {}) => {
  return useQuery({
    queryKey: queryKeys.drops.rewards(channelName),
    queryFn: async () => {
      if (!channelName) return [];
      const response = await dropsService.getRewards(channelName);
      // Возвращаем данные в формате, который ожидают компоненты
      if (!response.data.success) return [];
      return response.data.data || [];
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
export const useCreateDropsReward = (channelName, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reward) => dropsService.createReward(channelName, reward),
    onMutate: async (reward) => {
      // Оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData(queryKeys.drops.rewards(channelName));
      
      // Добавляем временную награду в список
      const tempReward = {
        id: `temp-${Date.now()}`,
        ...reward,
        is_active: reward.is_active !== undefined ? reward.is_active : true,
      };
      
      queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old) => {
        if (!old) return [tempReward];
        return [...old, tempReward];
      });
      
      return { previousRewards };
    },
    onError: (err, reward, context) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options.onError) {
        options.onError(err, reward, context);
      } else {
        logger.error('Error creating reward:', err);
        toast.error('Ошибка создания награды');
      }
    },
    onSuccess: (response, reward, context) => {
      // Инвалидируем для получения актуальных данных с сервера
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options.onSuccess) {
        options.onSuccess(response, reward, context);
      } else {
        toast.success('Награда создана');
      }
    },
    ...options,
  });
};

/**
 * Обновить награду Drops
 */
export const useUpdateDropsReward = (channelName, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, reward }) => dropsService.updateReward(channelName, rewardId, reward),
    onMutate: async ({ rewardId, reward }) => {
      // Оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData(queryKeys.drops.rewards(channelName));
      
      queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old) => {
        if (!old) return old;
        return old.map(r => r.id === rewardId ? { ...r, ...reward } : r);
      });
      
      return { previousRewards };
    },
    onError: (err, variables, context) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options.onError) {
        options.onError(err, variables, context);
      } else {
        logger.error('Error updating reward:', err);
        toast.error('Ошибка обновления награды');
      }
    },
    onSuccess: (response, variables, context) => {
      // Инвалидируем для получения актуальных данных с сервера
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options.onSuccess) {
        options.onSuccess(response, variables, context);
      } else {
        toast.success('Награда обновлена');
      }
    },
    ...options,
  });
};

/**
 * Удалить награду Drops
 */
export const useDeleteDropsReward = (channelName, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId) => dropsService.deleteReward(channelName, rewardId),
    onMutate: async (rewardId) => {
      // Оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData(queryKeys.drops.rewards(channelName));
      
      queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old) => {
        if (!old) return old;
        return old.filter(r => r.id !== rewardId);
      });
      
      return { previousRewards };
    },
    onError: (err, rewardId, context) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options.onError) {
        options.onError(err, rewardId, context);
      } else {
        logger.error('Error deleting reward:', err);
        toast.error('Ошибка удаления награды');
      }
    },
    onSuccess: (response, rewardId, context) => {
      // Инвалидируем для синхронизации
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options.onSuccess) {
        options.onSuccess(response, rewardId, context);
      } else {
        toast.success('Награда удалена');
      }
    },
    ...options,
  });
};

/**
 * Переключить активность награды Drops
 */
export const useToggleDropsReward = (channelName, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, isActive }) => dropsService.toggleReward(channelName, rewardId, isActive),
    onMutate: async ({ rewardId, isActive }) => {
      // Оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      const previousRewards = queryClient.getQueryData(queryKeys.drops.rewards(channelName));
      
      queryClient.setQueryData(queryKeys.drops.rewards(channelName), (old) => {
        if (!old) return old;
        return old.map(reward =>
          reward.id === rewardId ? { ...reward, is_active: isActive } : reward
        );
      });
      
      return { previousRewards };
    },
    onError: (err, variables, context) => {
      // Откатываем при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.drops.rewards(channelName), context.previousRewards);
      }
      // Вызываем onError из options если он есть
      if (options.onError) {
        options.onError(err, variables, context);
      } else {
        toast.error('Ошибка переключения награды');
        logger.error('Error toggling reward:', err);
      }
    },
    onSuccess: (response, variables, context) => {
      // Инвалидируем для синхронизации
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.rewards(channelName) });
      // Вызываем onSuccess из options если он есть
      if (options.onSuccess) {
        options.onSuccess(response, variables, context);
      } else {
        toast.success(response.data?.message || 'Статус награды изменен');
      }
    },
    ...options,
  });
};

/**
 * Получить историю Drops
 */
export const useDropsHistory = (channelName, params = {}, options = {}) => {
  return useQuery({
    queryKey: [...queryKeys.drops.history(channelName), params],
    queryFn: async () => {
      if (!channelName) return { data: [], hasMore: false };
      const response = await dropsService.getHistory(channelName, params);
      return {
        data: response.data.success ? response.data.data : [],
        hasMore: (response.data.data || []).length === (params.limit || 50),
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
export const useGenerateDropsWidgetUrl = (options = {}) => {
  return useMutation({
    mutationFn: (regenerate = false) => dropsService.generateWidgetUrl(regenerate),
    onSuccess: (response, regenerate) => {
      if (options.onSuccess) {
        options.onSuccess(response, regenerate);
      } else if (regenerate) {
        toast.success('Токен виджета перегенерирован');
      }
    },
    onError: (error, regenerate) => {
      logger.error('Error generating widget URL:', error);
      if (options.onError) {
        options.onError(error, regenerate);
      } else {
        toast.error('Ошибка генерации URL виджета');
      }
    },
    ...options,
  });
};

