/**
 * User Settings Queries - централизованные React Query queries для User Settings
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { userSettingsService } from '../../services/api/services/userSettingsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '../../types';

/**
 * Получить настройки пользователя
 */
export const useUserSettings = (options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.userSettings.settings(),
    queryFn: async () => {
      const response = await userSettingsService.getUserSettings();
      return (response.data as any)?.settings || response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 30 * 60 * 1000, // 30 минут
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
};

/**
 * Сохранить настройки пользователя
 */
export const useSaveUserSettings = (options?: UseMutationOptions<any, AxiosError, Record<string, any>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Record<string, any>) => userSettingsService.saveUserSettings(settings),
    onMutate: async (newSettings: Record<string, any>) => {
      // Отменяем исходящие запросы
      await queryClient.cancelQueries({ queryKey: queryKeys.userSettings.settings() });
      
      // Сохраняем предыдущее значение для отката
      const previousSettings = queryClient.getQueryData(queryKeys.userSettings.settings());
      
      // Оптимистично обновляем кэш
      queryClient.setQueryData(queryKeys.userSettings.settings(), (old: any) => ({
        ...old,
        ...newSettings,
      }));
      
      return { previousSettings };
    },
    onSuccess: (response) => {
      // Обновляем кэш с данными с сервера
      const settings = (response.data as any)?.settings || response.data;
      queryClient.setQueryData(queryKeys.userSettings.settings(), settings);
      if (!options?.onSuccess) {
          toast.success('Настройки сохранены');
      }
    },
    onError: (error: AxiosError, newSettings, context: { previousSettings?: any } | undefined) => {
      // Откатываем к предыдущему значению при ошибке
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.userSettings.settings(), context.previousSettings);
      }
      logger.error('Error saving user settings:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Не удалось сохранить настройки';
        toast.error(errorMessage);
      }
    },
    onSettled: () => {
      // Инвалидируем кэш для синхронизации
      queryClient.invalidateQueries({ queryKey: queryKeys.userSettings.settings() });
    },
    ...options,
  });
};

