/**
 * Points Queries - централизованные React Query queries для Points
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { pointsService } from '../../services/api/services/pointsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

/**
 * Получить награды платформы
 */
export const usePlatformRewards = (platform, options = {}) => {
  return useQuery({
    queryKey: queryKeys.points.rewards(platform),
    queryFn: () => pointsService.getPlatformRewards(platform),
    enabled: !!platform && (options.enabled !== false),
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    retry: (failureCount, error) => {
      // Не повторяем запрос при 403 (партнер/аффилиат требуется)
      if (error?.response?.status === 403) {
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
export const useCreatePlatformReward = (platform, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reward) => pointsService.createPlatformReward(platform, reward),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.rewards(platform) });
      if (!options.onSuccess) {
        toast.success('Награда создана');
      }
    },
    onError: (error) => {
      logger.error('Error creating platform reward:', error);
      if (!options.onError) {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Ошибка создания награды';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Обновить награду платформы
 */
export const useUpdatePlatformReward = (platform, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, reward }) => pointsService.updatePlatformReward(platform, rewardId, reward),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.rewards(platform) });
      if (!options.onSuccess) {
        toast.success('Награда обновлена');
      }
    },
    onError: (error) => {
      logger.error('Error updating platform reward:', error);
      if (!options.onError) {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Ошибка обновления награды';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Удалить награду платформы
 */
export const useDeletePlatformReward = (platform, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId) => pointsService.deletePlatformReward(platform, rewardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.rewards(platform) });
      if (!options.onSuccess) {
        toast.success('Награда удалена');
      }
    },
    onError: (error) => {
      logger.error('Error deleting platform reward:', error);
      if (!options.onError) {
        toast.error('Ошибка удаления награды');
      }
    },
    ...options,
  });
};

/**
 * Переключить статус награды платформы
 */
export const useTogglePlatformReward = (platform, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, isEnabled }) => pointsService.togglePlatformReward(platform, rewardId, isEnabled),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.points.rewards(platform) });
      if (!options.onSuccess) {
        toast.success(variables.isEnabled ? 'Награда включена' : 'Награда отключена');
      }
    },
    onError: (error) => {
      logger.error('Error toggling platform reward:', error);
      if (!options.onError) {
        toast.error('Ошибка изменения статуса награды');
      }
    },
    ...options,
  });
};

