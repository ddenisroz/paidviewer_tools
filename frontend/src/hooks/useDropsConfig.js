import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botService } from '../services/microservices';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';
import { useEffect, useState, useMemo } from 'react';

/**
 * Хук для работы с конфигурацией drops
 */
export const useDropsConfig = (channelName) => {
  const queryClient = useQueryClient();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { data: config, isLoading } = useQuery({
    queryKey: ['drops-config', channelName],
    queryFn: async () => {
      if (!channelName) return null;
      const response = await botService.get(`/api/drops/config/${channelName}`);
      return response.data.success ? response.data.data : null;
    },
    enabled: !!channelName,
    staleTime: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      return await botService.put(`/api/drops/config/${channelName}`, payload);
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
      if (payload.donation_enabled !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            donation_enabled: payload.donation_enabled,
            channel: channelName
          }
        }));
      }
      if (payload.streak_enabled_twitch !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            streak_enabled: payload.streak_enabled_twitch, 
            channel: channelName, 
            platform: 'twitch'
          }
        }));
      }
      if (payload.streak_enabled_vk !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            streak_enabled: payload.streak_enabled_vk, 
            channel: channelName, 
            platform: 'vk'
          }
        }));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['drops-config', channelName] });
    },
  });

  return {
    config,
    isLoading,
    isInitialLoad,
    setIsInitialLoad,
    saveMutation,
  };
};

