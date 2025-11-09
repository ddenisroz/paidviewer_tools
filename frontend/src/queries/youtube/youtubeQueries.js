/**
 * YouTube Queries - централизованные React Query queries для YouTube
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { youtubeService } from '../../services/api/services/youtubeService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

/**
 * Получить очередь YouTube
 */
export const useYoutubeQueue = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.youtube.queue(),
    queryFn: () => youtubeService.getQueue(),
    staleTime: 15 * 1000, // 15 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchInterval: 15 * 1000, // 15 секунд
    ...options,
  });
};

/**
 * Добавить видео в очередь YouTube
 */
export const useAddYoutubeVideo = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => {
      // Поддерживаем как строку (URL), так и объект
      if (typeof data === 'string') {
        return youtubeService.addToQueue({ video_url: data });
      }
      return youtubeService.addToQueue(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
      if (!options.onSuccess) {
        toast.success('Видео добавлено в очередь');
      }
    },
    onError: (error) => {
      logger.error('Error adding video to queue:', error);
      if (!options.onError) {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Ошибка добавления видео в очередь';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Удалить видео из очереди YouTube
 */
export const useDeleteYoutubeVideo = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (queueId) => youtubeService.removeFromQueue(queueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
      if (!options.onSuccess) {
        toast.success('Видео удалено из очереди');
      }
    },
    onError: (error) => {
      logger.error('Error removing video from queue:', error);
      if (!options.onError) {
        toast.error('Ошибка удаления видео из очереди');
      }
    },
    ...options,
  });
};

/**
 * Удалить видео из очереди YouTube (алиас для совместимости)
 */
export const useRemoveYoutubeVideo = useDeleteYoutubeVideo;

/**
 * Очистить очередь YouTube
 */
export const useClearYoutubeQueue = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => youtubeService.clearQueue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
      if (!options.onSuccess) {
        toast.success('Очередь очищена');
      }
    },
    onError: (error) => {
      logger.error('Error clearing queue:', error);
      if (!options.onError) {
        toast.error('Ошибка очистки очереди');
      }
    },
    ...options,
  });
};

/**
 * Отметить видео как проигранное
 */
export const useMarkYoutubeVideoAsPlayed = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (queueId) => youtubeService.markAsPlayed(queueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
      if (!options.onSuccess) {
        toast.success('Видео отмечено как проигранное');
      }
    },
    onError: (error) => {
      logger.error('Error marking video as played:', error);
      if (!options.onError) {
        toast.error('Ошибка обновления статуса видео');
      }
    },
    ...options,
  });
};

/**
 * Перейти к следующему видео YouTube
 */
export const useNextYoutubeVideo = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => youtubeService.nextVideo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtube.queue() });
      if (!options.onSuccess) {
        toast.success('Переход к следующему видео');
      }
    },
    onError: (error) => {
      logger.error('Error going to next video:', error);
      if (!options.onError) {
        toast.error('Ошибка перехода к следующему видео');
      }
    },
    ...options,
  });
};

/**
 * Пропустить видео (алиас для useNextYoutubeVideo)
 */
export const useSkipYoutubeVideo = useNextYoutubeVideo;

/**
 * Получить настройки YouTube
 */
export const useYoutubeSettings = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.youtube.settings(),
    queryFn: () => youtubeService.getSettings(),
    staleTime: 60 * 1000, // 1 минута
    gcTime: 10 * 60 * 1000, // 10 минут
    ...options,
  });
};

/**
 * Сохранить настройки YouTube
 */
export const useSaveYoutubeSettings = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings) => youtubeService.saveSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtube.settings() });
      toast.success('Настройки YouTube сохранены');
    },
    onError: (error) => {
      logger.error('Error saving YouTube settings:', error);
      toast.error('Ошибка сохранения настроек YouTube');
    },
    ...options,
  });
};

