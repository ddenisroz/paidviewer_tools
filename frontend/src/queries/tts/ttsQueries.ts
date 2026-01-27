/**
 * TTS Queries - централизованные React Query queries для TTS
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ttsService } from '@/services/api/services/ttsService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';


import type { ApiResponse, BlockedUser, FilteredWord, LocalTtsConfig, TtsSettings, TtsStatus, TtsVoice } from '../../types';
import type { AxiosError } from 'axios';

/**
 * Получить статус TTS
 */
export const useTtsStatus = (channelName: string | null = null, options?: Omit<UseQueryOptions<ApiResponse<TtsStatus>, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.tts.status(channelName),
    queryFn: async () => {
      const response = await unwrapResponse(ttsService.getStatus(channelName));
      const data = response as ApiResponse<TtsStatus> | TtsStatus;
      if (data && typeof (data as TtsStatus).enabled === 'boolean' && !(data as ApiResponse<TtsStatus>).success) {
        return { success: true, data: data as TtsStatus };
      }
      return data as ApiResponse<TtsStatus>;
    },
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    ...options,
  });
};

/**
 * Получить настройки TTS
 */
export const useTtsSettings = (options?: Omit<UseQueryOptions<ApiResponse<TtsSettings>, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.tts.settings(),
    queryFn: () => unwrapResponse(ttsService.getSettings()),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить настройки TTS
 */
export const useSaveTtsSettings = (options?: UseMutationOptions<ApiResponse<TtsSettings>, AxiosError, Partial<TtsSettings>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<TtsSettings>) => unwrapResponse(ttsService.saveSettings(settings)),
    onMutate: async (newSettings: Partial<TtsSettings>) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tts.settings() });
      
      // Snapshot previous value
      const previousSettings = queryClient.getQueryData(queryKeys.tts.settings());
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.tts.settings(), (old: ApiResponse<TtsSettings> | undefined) => ({
        ...old,
        success: true,
        data: {
          ...(old?.data || {} as TtsSettings),
          ...newSettings
        }
      }));
      
      // Return context for rollback
      return { previousSettings };
    },
    onSuccess: (response) => {
      // Обновляем кэш
      if (response?.success) {
        queryClient.setQueryData(queryKeys.tts.settings(), response);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      if (!options?.onSuccess) {
        toast.success('Настройки TTS сохранены');
      }
    },
    onError: (error: AxiosError, newSettings, _onMutateResult, context) => {
      // Rollback on error
      const typedContext = context as { previousSettings?: ApiResponse<TtsSettings> } | undefined;
      if (typedContext?.previousSettings) {
        queryClient.setQueryData(queryKeys.tts.settings(), typedContext.previousSettings);
      }
      logger.error('Error saving TTS settings:', error);
      if (!options?.onError) {
        toast.error('Ошибка сохранения настроек TTS');
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
    },
    ...options,
  });
};

/**
 * Получить аудио настройки TTS
 */
export const useTtsAudioSettings = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.tts.audioSettings(),
    queryFn: () => unwrapResponse(ttsService.getAudioSettings()),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить аудио настройки TTS
 */
export const useSaveTtsAudioSettings = (options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Record<string, unknown>) => unwrapResponse(ttsService.saveAudioSettings(settings)),
    onSuccess: (response) => {
      if (response?.success) {
        queryClient.setQueryData(queryKeys.tts.audioSettings(), response);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      toast.success('Аудио настройки TTS сохранены');
    },
    onError: (error: AxiosError) => {
      logger.error('Error saving TTS audio settings:', error);
      toast.error('Ошибка сохранения аудио настроек TTS');
    },
    ...options,
  });
};

/**
 * Получить настройки платформы TTS
 */
export const useTtsPlatformSettings = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.tts.platformSettings(),
    queryFn: () => unwrapResponse(ttsService.getPlatformSettings()),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить настройки платформы TTS
 */
export const useSaveTtsPlatformSettings = (options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Record<string, unknown>) => unwrapResponse(ttsService.savePlatformSettings(settings)),
    onSuccess: (response) => {
      if (response?.success) {
        queryClient.setQueryData(queryKeys.tts.platformSettings(), response);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      toast.success('Настройки платформы TTS сохранены');
    },
    onError: (error: AxiosError) => {
      logger.error('Error saving TTS platform settings:', error);
      toast.error('Ошибка сохранения настроек платформы TTS');
    },
    ...options,
  });
};

/**
 * Получить настройки режима TTS
 */
export const useTtsModeSettings = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.tts.modeSettings(),
    queryFn: () => unwrapResponse(ttsService.getModeSettings()),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить настройки режима TTS
 */
export const useSaveTtsModeSettings = (options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Record<string, unknown>) => unwrapResponse(ttsService.saveModeSettings(settings)),
    onSuccess: (response) => {
      if (response?.success) {
        queryClient.setQueryData(queryKeys.tts.modeSettings(), response);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      toast.success('Настройки режима TTS сохранены');
    },
    onError: (error: AxiosError) => {
      logger.error('Error saving TTS mode settings:', error);
      toast.error('Ошибка сохранения настроек режима TTS');
    },
    ...options,
  });
};

/**
 * Включить TTS
 */
export const useEnableTts = (options?: UseMutationOptions<ApiResponse, AxiosError, void, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unwrapResponse(ttsService.enable()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      toast.success('TTS включен');
    },
    onError: (error: AxiosError) => {
      logger.error('Error enabling TTS:', error);
      toast.error('Ошибка включения TTS');
    },
    ...options,
  });
};

/**
 * Выключить TTS
 */
export const useDisableTts = (options?: UseMutationOptions<ApiResponse, AxiosError, void, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unwrapResponse(ttsService.disable()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      toast.success('TTS выключен');
    },
    onError: (error: AxiosError) => {
      logger.error('Error disabling TTS:', error);
      toast.error('Ошибка выключения TTS');
    },
    ...options,
  });
};

/**
 * Получить health статус TTS
 */
export const useTtsHealth = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.tts.health(),
    queryFn: () => unwrapResponse(ttsService.getHealth()),
    staleTime: 10 * 1000, // 10 секунд
    gcTime: 1 * 60 * 1000, // 1 минута
    refetchInterval: 30 * 1000, // 30 секунд
    ...options,
  });
};

/**
 * Переключить TTS (включить/выключить)
 */
export const useToggleTts = (options?: UseMutationOptions<ApiResponse, AxiosError, boolean, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => unwrapResponse(enabled ? ttsService.enable() : ttsService.disable()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      if (!options?.onSuccess) {
        toast.success('TTS переключен');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error toggling TTS:', error);
      if (!options?.onError) {
        toast.error('Ошибка переключения TTS');
      }
    },
    ...options,
  });
};

/**
 * Установить режим прослушивания TTS
 */
export const useSetTtsListeningMode = (options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: string) => unwrapResponse(ttsService.setListeningMode({ listeningMode: mode })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.status(null) });
      if (!options?.onSuccess) {
        toast.success('Режим прослушивания обновлен');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error setting listening mode:', error);
      if (!options?.onError) {
        toast.error('Ошибка обновления режима прослушивания');
      }
    },
    ...options,
  });
};

/**
 * Установить движок TTS
 */
export const useSetTtsEngine = (options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (engineType: string) => unwrapResponse(ttsService.setEngine({ engine_type: engineType })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.status(null) });
      if (!options?.onSuccess) {
        toast.success('Движок TTS обновлен');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error setting TTS engine:', error);
      if (!options?.onError) {
        toast.error('Ошибка обновления движка TTS');
      }
    },
    ...options,
  });
};

/**
 * Регенерировать OBS URL для TTS
 */
export const useRegenerateTtsObsUrl = (options?: UseMutationOptions<ApiResponse, AxiosError, void, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unwrapResponse(ttsService.regenerateObsUrl()),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.obsUrl() });
      if (!options?.onSuccess) {
        toast.success('OBS URL регенерирован');
      }
      return response;
    },
    onError: (error: AxiosError) => {
      logger.error('Error regenerating OBS URL:', error);
      if (!options?.onError) {
        toast.error('Ошибка регенерации OBS URL');
      }
    },
    ...options,
  });
};

/**
 * Создать TTS награду для платформы
 */
export const useCreateTtsReward = (options?: UseMutationOptions<ApiResponse, AxiosError, { platform: string; title: string; cost: number; cooldown: number }, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { platform: string; title: string; cost: number; cooldown: number }) => unwrapResponse(ttsService.createTtsReward(data)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
      if (!options?.onSuccess) {
        toast.success('Награда создана');
      }
      return response;
    },
    onError: (error: AxiosError) => {
      logger.error('Error creating TTS reward:', error);
      if (!options?.onError) {
        toast.error('Ошибка создания награды');
      }
    },
    ...options,
  });
};

/**
 * Удалить TTS награду для платформы
 */
export const useDeleteTtsReward = (options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (platform: string) => unwrapResponse(ttsService.deleteTtsReward(platform)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
      if (!options?.onSuccess) {
        toast.success('Награда удалена');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error deleting TTS reward:', error);
      if (!options?.onError) {
        toast.error('Ошибка удаления награды');
      }
    },
    ...options,
  });
};

/**
 * Получить конфигурацию локального TTS
 */
export const useLocalTtsConfig = (options?: Omit<UseQueryOptions<LocalTtsConfig | null, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<LocalTtsConfig | null, AxiosError>({
    queryKey: queryKeys.tts.localTtsConfig(),
    queryFn: async () => {
      const response = await unwrapResponse(ttsService.getLocalTtsConfig()) as ApiResponse<LocalTtsConfig> & { config?: LocalTtsConfig };
      return response?.config || response?.data || null;
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000, // 10 минут
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false, // Не повторяем запрос при ошибке
    ...options,
  });
};

/**
 * Сохранить конфигурацию локального TTS
 */
export const useSaveLocalTtsConfig = (options?: UseMutationOptions<ApiResponse<LocalTtsConfig>, AxiosError, Partial<LocalTtsConfig>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<LocalTtsConfig>) => unwrapResponse(ttsService.saveLocalTtsConfig(config)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.localTtsConfig() });
      if (!options?.onSuccess) {
        toast.success('Настройки локального TTS сохранены');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error saving local TTS config:', error);
      if (!options?.onError) {
        toast.error('Ошибка сохранения настроек локального TTS');
      }
    },
    ...options,
  });
};

/**
 * Протестировать соединение с локальным TTS сервером
 */
export const useTestLocalTtsConnection = (options?: UseMutationOptions<ApiResponse, AxiosError, { host?: string; port?: number; api_key?: string }, unknown>) => {
  return useMutation({
    mutationFn: (params: { host?: string; port?: number; api_key?: string }) => unwrapResponse(ttsService.testLocalTtsConnection(params)),
    onSuccess: (response) => {
      if (!options?.onSuccess) {
        if (response?.success) {
          toast.success('Соединение успешно!');
        } else {
          toast.error('Не удалось подключиться');
        }
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error testing local TTS connection:', error);
      if (!options?.onError) {
        toast.error('Ошибка подключения к серверу');
      }
    },
    ...options,
  });
};

/**
 * Переключить использование локального TTS
 */
export const useToggleLocalTts = (options?: UseMutationOptions<ApiResponse, AxiosError, void, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unwrapResponse(ttsService.toggleLocalTts()),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.localTtsConfig() });
      if (!options?.onSuccess) {
        toast.success(response?.message || 'Локальный TTS переключен');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error toggling local TTS:', error);
      if (!options?.onError) {
        toast.error('Ошибка переключения локального TTS');
      }
    },
    ...options,
  });
};

/**
 * Получить статус whitelist для голосов
 */
export const useWhitelistStatus = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.tts.whitelistStatus(),
    queryFn: () => unwrapResponse(ttsService.getWhitelistStatus()),
    staleTime: 60 * 1000, // 1 минута
    gcTime: 5 * 60 * 1000, // 5 минут
    retry: false, // Не повторяем запрос при ошибке
    ...options,
  });
};

/**
 * Получить список отфильтрованных слов
 */
export const useFilteredWords = (options?: Omit<UseQueryOptions<FilteredWord[], AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<FilteredWord[], AxiosError>({
    queryKey: queryKeys.tts.filteredWords(),
    queryFn: async () => {
      const response = await unwrapResponse(ttsService.getFilteredWords());
      return (response as { data?: FilteredWord[] })?.data || [];
    },
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    ...options,
  });
};

/**
 * Добавить слово в фильтр
 */
export const useAddFilteredWord = (options?: UseMutationOptions<ApiResponse<FilteredWord>, AxiosError, { word: string; channel_name?: string }, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { word: string; channel_name?: string }) => unwrapResponse(ttsService.addFilteredWord(data)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
      if (!options?.onSuccess) {
        toast.success('Слово добавлено в фильтр');
      }
      return response;
    },
    onError: (error: AxiosError) => {
      logger.error('Error adding filtered word:', error);
      if (!options?.onError) {
        toast.error('Ошибка добавления слова в фильтр');
      }
    },
    ...options,
  });
};

/**
 * Удалить слово из фильтра
 */
export const useDeleteFilteredWord = (options?: UseMutationOptions<ApiResponse, AxiosError, number, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (wordId: number) => unwrapResponse(ttsService.deleteFilteredWord(wordId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
      if (!options?.onSuccess) {
        toast.success('Слово удалено из фильтра');
      }
    },
    onError: (error: AxiosError) => {
      logger.error('Error deleting filtered word:', error);
      if (!options?.onError) {
        toast.error('Ошибка удаления слова из фильтра');
      }
    },
    ...options,
  });
};

/**
 * Получить список заблокированных пользователей
 */
export const useBlockedUsers = (options?: Omit<UseQueryOptions<BlockedUser[], AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<BlockedUser[], AxiosError>({
    queryKey: queryKeys.tts.blockedUsers(),
    queryFn: async () => {
      const response = await unwrapResponse(ttsService.getBlockedUsers());
      return (response as { data?: BlockedUser[] })?.data || [];
    },
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    ...options,
  });
};

/**
 * Заблокировать пользователя
 */
export const useBlockUser = (options?: UseMutationOptions<ApiResponse<BlockedUser>, AxiosError, { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string; reason?: string }, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string; reason?: string }) => unwrapResponse(ttsService.blockUser(data)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
      if (!options?.onSuccess) {
        toast.success('Пользователь заблокирован');
      }
      return response;
    },
    onError: (error: AxiosError) => {
      logger.error('Error blocking user:', error);
      if (!options?.onError) {
        toast.error('Ошибка блокировки пользователя');
      }
    },
    ...options,
  });
};

/**
 * Разблокировать пользователя
 */
export const useUnblockUser = (options?: UseMutationOptions<ApiResponse, AxiosError, { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string }, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string }) => unwrapResponse(ttsService.unblockUser(data)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
      if (!options?.onSuccess) {
        toast.success('Пользователь разблокирован');
      }
      return response;
    },
    onError: (error: AxiosError) => {
      logger.error('Error unblocking user:', error);
      if (!options?.onError) {
        toast.error('Ошибка разблокировки пользователя');
      }
    },
    ...options,
  });
};

/**
 * Получить глобальные голоса TTS
 */
export const useGlobalVoices = (options?: Omit<UseQueryOptions<TtsVoice[], AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<TtsVoice[], AxiosError>({
    queryKey: queryKeys.tts.voices.global(),
    queryFn: async () => {
      const response = await unwrapResponse(ttsService.getGlobalVoices());
      return response?.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 минут - голоса редко меняются
    gcTime: 30 * 60 * 1000, // 30 минут
    retry: 1,
    ...options,
  });
};

