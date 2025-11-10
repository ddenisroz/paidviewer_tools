/**
 * Stream Queries - централизованные React Query queries для Stream
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { streamService } from '../../services/api/services/streamService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

/**
 * Получить информацию о стриме Twitch
 */
export const useTwitchStreamInfo = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.stream.info.twitch(),
    queryFn: () => streamService.getTwitchStreamInfo(options.params || {}),
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
export const useVkStreamInfo = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.stream.info.vk(),
    queryFn: () => streamService.getVkStreamInfo(options.params || {}),
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
export const useUpdateTwitchStreamTitle = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title) => streamService.updateTwitchStreamTitle(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.info.twitch() });
      toast.success('Название стрима обновлено');
    },
    onError: (error) => {
      logger.error('Error updating Twitch stream title:', error);
      toast.error('Ошибка обновления названия стрима');
    },
    ...options,
  });
};

/**
 * Обновить категорию стрима Twitch
 */
export const useUpdateTwitchStreamCategory = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId) => streamService.updateTwitchStreamCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.info.twitch() });
      toast.success('Категория стрима обновлена');
    },
    onError: (error) => {
      logger.error('Error updating Twitch stream category:', error);
      toast.error('Ошибка обновления категории стрима');
    },
    ...options,
  });
};

/**
 * Обновить название стрима VK
 */
export const useUpdateVkStreamTitle = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title) => streamService.updateVkStreamTitle(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.info.vk() });
      toast.success('Название стрима обновлено');
    },
    onError: (error) => {
      logger.error('Error updating VK stream title:', error);
      toast.error('Ошибка обновления названия стрима');
    },
    ...options,
  });
};

/**
 * Обновить категорию стрима VK
 */
export const useUpdateVkStreamCategory = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId) => streamService.updateVkStreamCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.info.vk() });
      toast.success('Категория стрима обновлена');
    },
    onError: (error) => {
      logger.error('Error updating VK stream category:', error);
      toast.error('Ошибка обновления категории стрима');
    },
    ...options,
  });
};

/**
 * Получить категории Twitch
 */
export const useTwitchCategories = (search = '', options = {}) => {
  return useQuery({
    queryKey: queryKeys.stream.categories.twitch(search),
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
export const useVkCategories = (search = '', options = {}) => {
  return useQuery({
    queryKey: queryKeys.stream.categories.vk(search),
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
export const useStreamHistory = (options = {}) => {
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
export const useUpdateStream = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => streamService.updateStream(payload),
    onSuccess: () => {
      // Инвалидируем все stream queries
      queryClient.invalidateQueries({ queryKey: queryKeys.stream.all });
      if (!options.onSuccess) {
        toast.success('Изменения сохранены');
      }
    },
    onError: (error) => {
      logger.error('Error updating stream:', error);
      if (!options.onError) {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Не удалось сохранить изменения';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

