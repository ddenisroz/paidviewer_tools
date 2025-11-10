import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dropsService } from '../services/api/services/dropsService';
import { queryKeys } from '../queries/queryKeys';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';
import { useEffect, useState, useMemo } from 'react';

/**
 * Хук для работы с конфигурацией drops
 * @deprecated Используйте useDropsConfig и useUpdateDropsConfig из queries/drops/dropsQueries
 * Оставлен для обратной совместимости с компонентами, использующими isInitialLoad и saveMutation
 */
export const useDropsConfig = (channelName) => {
  const queryClient = useQueryClient();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.drops.config(channelName),
    queryFn: async () => {
      if (!channelName) return null;
      const response = await dropsService.getConfig(channelName);
      return response.data.success ? response.data.data : null;
    },
    enabled: !!channelName,
    staleTime: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      return await dropsService.updateConfig(channelName, payload);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['drops-config', channelName] });
      const previousConfig = queryClient.getQueryData(['drops-config', channelName]);
      queryClient.setQueryData(['drops-config', channelName], (old) => ({
        ...old,
        ...payload,
      }));
      return { previousConfig };
    },
    onError: (err, payload, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(['drops-config', channelName], context.previousConfig);
      }
      toast.error('Ошибка сохранения настроек');
      logger.error('Error saving drops config:', err);
    },
    onSuccess: (response, payload) => {
      // ✅ ОБНОВЛЕНИЕ КЭША: Обновляем кэш данными с сервера для надежности
      if (response.data?.success && response.data?.data) {
        queryClient.setQueryData(['drops-config', channelName], response.data.data);
      }
      
      // ✅ СИНХРОНИЗАЦИЯ: Отправляем события для синхронизации с другими компонентами
      // ✅ ИСПРАВЛЕНИЕ: Добавляем source для предотвращения циклических обновлений
      if (payload.donation_enabled !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            donation_enabled: payload.donation_enabled,
            channel: channelName,
            source: 'useDropsConfig'
          }
        }));
      }
      if (payload.streak_enabled_twitch !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            streak_enabled: payload.streak_enabled_twitch, 
            channel: channelName, 
            platform: 'twitch',
            source: 'useDropsConfig'
          }
        }));
      }
      if (payload.streak_enabled_vk !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            streak_enabled: payload.streak_enabled_vk, 
            channel: channelName, 
            platform: 'vk',
            source: 'useDropsConfig'
          }
        }));
      }
    },
    // ✅ УБРАНО: onSettled с invalidateQueries - не нужен, так как данные уже обновлены в onSuccess
    // Это предотвращает race condition и некорректное отображение статуса
  });

  return {
    config,
    isLoading,
    isInitialLoad,
    setIsInitialLoad,
    saveMutation,
  };
};

