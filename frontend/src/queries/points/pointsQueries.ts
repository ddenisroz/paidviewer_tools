/**
 * Points Queries - централизованные React Query queries для Points
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { pointsService } from '../../services/api/services/pointsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '../../types';

/**
 * Получить награды платформы
 */
export const usePlatformRewards = (platform: string, options?: Omit<UseQueryOptions<any, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.points.platformRewards(platform),
    queryFn: () => pointsService.getPlatformRewards(platform),
    enabled: !!platform && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    retry: (failureCount, error) => {
      // Не повторяем запрос при 403 (партнер/аффилиат требуется)
      if ((error as AxiosError)?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
};

/**
 * Создать награду платформы
 */
export const useCreatePlatformReward = (platform: string, options?: UseMutationOptions<any, AxiosError, Record<string, any>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reward: Record<string, any>) => pointsService.createPlatformReward(platform, reward),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
      if (!options?.onSuccess) {
        toast.success('Награда создана');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error creating platform reward:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Ошибка создания награды';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Обновить награду платформы
 */
export const useUpdatePlatformReward = (platform: string, options?: UseMutationOptions<any, AxiosError, { rewardId: string; reward: Record<string, any> }, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, reward }: { rewardId: string; reward: Record<string, any> }) => pointsService.updatePlatformReward(platform, rewardId, reward),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
      if (!options?.onSuccess) {
        toast.success('Награда обновлена');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error updating platform reward:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Ошибка обновления награды';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Удалить награду платформы
 */
export const useDeletePlatformReward = (platform: string, options?: UseMutationOptions<any, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) => pointsService.deletePlatformReward(platform, rewardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
      if (!options?.onSuccess) {
        toast.success('Награда удалена');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error deleting platform reward:', error);
      if (!options?.onError) {
        toast.error('Ошибка удаления награды');
      }
    },
    ...options,
  });
};

/**
 * Переключить статус награды платформы
 */
export const useTogglePlatformReward = (platform: string, options?: UseMutationOptions<any, AxiosError, { rewardId: string; isEnabled: boolean }, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, isEnabled }: { rewardId: string; isEnabled: boolean }) => pointsService.togglePlatformReward(platform, rewardId, isEnabled),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.platformRewards(platform) });
      if (!options?.onSuccess) {
        toast.success(variables.isEnabled ? 'Награда включена' : 'Награда отключена');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error toggling platform reward:', error);
      if (!options?.onError) {
        toast.error('Ошибка изменения статуса награды');
      }
    },
    ...options,
  });
};

