/**
 * TTS Queries - централизованные React Query queries для TTS
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { ttsService } from '../../services/api/services/ttsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

/**
 * Получить статус TTS
 */
export const useTtsStatus = (channelName = null, options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.status(channelName),
    queryFn: () => ttsService.getStatus(channelName),
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    ...options,
  });
};

/**
 * Получить настройки TTS
 */
export const useTtsSettings = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.settings(),
    queryFn: () => ttsService.getSettings(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить настройки TTS
 */
export const useSaveTtsSettings = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings) => ttsService.saveSettings(settings),
    onSuccess: (response) => {
      // Обновляем кэш
      if (response.data?.success) {
        queryClient.setQueryData(queryKeys.tts.settings(), response.data);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      toast.success('Настройки TTS сохранены');
    },
    onError: (error) => {
      logger.error('Error saving TTS settings:', error);
      toast.error('Ошибка сохранения настроек TTS');
    },
    ...options,
  });
};

/**
 * Получить аудио настройки TTS
 */
export const useTtsAudioSettings = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.audioSettings(),
    queryFn: () => ttsService.getAudioSettings(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить аудио настройки TTS
 */
export const useSaveTtsAudioSettings = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings) => ttsService.saveAudioSettings(settings),
    onSuccess: (response) => {
      if (response.data?.success) {
        queryClient.setQueryData(queryKeys.tts.audioSettings(), response.data);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      toast.success('Аудио настройки TTS сохранены');
    },
    onError: (error) => {
      logger.error('Error saving TTS audio settings:', error);
      toast.error('Ошибка сохранения аудио настроек TTS');
    },
    ...options,
  });
};

/**
 * Получить настройки платформы TTS
 */
export const useTtsPlatformSettings = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.platformSettings(),
    queryFn: () => ttsService.getPlatformSettings(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить настройки платформы TTS
 */
export const useSaveTtsPlatformSettings = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings) => ttsService.savePlatformSettings(settings),
    onSuccess: (response) => {
      if (response.data?.success) {
        queryClient.setQueryData(queryKeys.tts.platformSettings(), response.data);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      toast.success('Настройки платформы TTS сохранены');
    },
    onError: (error) => {
      logger.error('Error saving TTS platform settings:', error);
      toast.error('Ошибка сохранения настроек платформы TTS');
    },
    ...options,
  });
};

/**
 * Получить настройки режима TTS
 */
export const useTtsModeSettings = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.modeSettings(),
    queryFn: () => ttsService.getModeSettings(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    ...options,
  });
};

/**
 * Сохранить настройки режима TTS
 */
export const useSaveTtsModeSettings = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings) => ttsService.saveModeSettings(settings),
    onSuccess: (response) => {
      if (response.data?.success) {
        queryClient.setQueryData(queryKeys.tts.modeSettings(), response.data);
        queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      }
      toast.success('Настройки режима TTS сохранены');
    },
    onError: (error) => {
      logger.error('Error saving TTS mode settings:', error);
      toast.error('Ошибка сохранения настроек режима TTS');
    },
    ...options,
  });
};

/**
 * Включить TTS
 */
export const useEnableTts = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ttsService.enable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      toast.success('TTS включен');
    },
    onError: (error) => {
      logger.error('Error enabling TTS:', error);
      toast.error('Ошибка включения TTS');
    },
    ...options,
  });
};

/**
 * Выключить TTS
 */
export const useDisableTts = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ttsService.disable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      toast.success('TTS выключен');
    },
    onError: (error) => {
      logger.error('Error disabling TTS:', error);
      toast.error('Ошибка выключения TTS');
    },
    ...options,
  });
};

/**
 * Получить health статус TTS
 */
export const useTtsHealth = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.health(),
    queryFn: () => ttsService.getHealth(),
    staleTime: 10 * 1000, // 10 секунд
    gcTime: 1 * 60 * 1000, // 1 минута
    refetchInterval: 30 * 1000, // 30 секунд
    ...options,
  });
};

/**
 * Переключить TTS (включить/выключить)
 */
export const useToggleTts = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled) => enabled ? ttsService.enable() : ttsService.disable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.all });
      if (!options.onSuccess) {
        toast.success('TTS переключен');
      }
    },
    onError: (error) => {
      logger.error('Error toggling TTS:', error);
      if (!options.onError) {
        toast.error('Ошибка переключения TTS');
      }
    },
    ...options,
  });
};

/**
 * Установить режим прослушивания TTS
 */
export const useSetTtsListeningMode = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode) => ttsService.setListeningMode({ listeningMode: mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
      if (!options.onSuccess) {
        toast.success('Режим прослушивания обновлен');
      }
    },
    onError: (error) => {
      logger.error('Error setting listening mode:', error);
      if (!options.onError) {
        toast.error('Ошибка обновления режима прослушивания');
      }
    },
    ...options,
  });
};

/**
 * Установить движок TTS
 */
export const useSetTtsEngine = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (engineType) => ttsService.setEngine({ engine_type: engineType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
      if (!options.onSuccess) {
        toast.success('Движок TTS обновлен');
      }
    },
    onError: (error) => {
      logger.error('Error setting TTS engine:', error);
      if (!options.onError) {
        toast.error('Ошибка обновления движка TTS');
      }
    },
    ...options,
  });
};

/**
 * Регенерировать OBS URL для TTS
 */
export const useRegenerateTtsObsUrl = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ttsService.regenerateObsUrl(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.obsUrl() });
      if (!options.onSuccess) {
        toast.success('OBS URL регенерирован');
      }
      return response;
    },
    onError: (error) => {
      logger.error('Error regenerating OBS URL:', error);
      if (!options.onError) {
        toast.error('Ошибка регенерации OBS URL');
      }
    },
    ...options,
  });
};

/**
 * Создать TTS награду для платформы
 */
export const useCreateTtsReward = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => ttsService.createTtsReward(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
      if (!options.onSuccess) {
        toast.success('Награда создана');
      }
      return response;
    },
    onError: (error) => {
      logger.error('Error creating TTS reward:', error);
      if (!options.onError) {
        toast.error('Ошибка создания награды');
      }
    },
    ...options,
  });
};

/**
 * Удалить TTS награду для платформы
 */
export const useDeleteTtsReward = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (platform) => ttsService.deleteTtsReward(platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
      if (!options.onSuccess) {
        toast.success('Награда удалена');
      }
    },
    onError: (error) => {
      logger.error('Error deleting TTS reward:', error);
      if (!options.onError) {
        toast.error('Ошибка удаления награды');
      }
    },
    ...options,
  });
};

/**
 * Получить конфигурацию локального TTS
 */
export const useLocalTtsConfig = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.localTtsConfig(),
    queryFn: () => ttsService.getLocalTtsConfig(),
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    retry: false, // Не повторяем запрос при ошибке
    ...options,
  });
};

/**
 * Получить статус whitelist для голосов
 */
export const useWhitelistStatus = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.whitelistStatus(),
    queryFn: () => ttsService.getWhitelistStatus(),
    staleTime: 60 * 1000, // 1 минута
    gcTime: 5 * 60 * 1000, // 5 минут
    retry: false, // Не повторяем запрос при ошибке
    ...options,
  });
};

/**
 * Получить список отфильтрованных слов
 */
export const useFilteredWords = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.filteredWords(),
    queryFn: () => ttsService.getFilteredWords(),
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    ...options,
  });
};

/**
 * Добавить слово в фильтр
 */
export const useAddFilteredWord = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => ttsService.addFilteredWord(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
      if (!options.onSuccess) {
        toast.success('Слово добавлено в фильтр');
      }
      return response;
    },
    onError: (error) => {
      logger.error('Error adding filtered word:', error);
      if (!options.onError) {
        toast.error('Ошибка добавления слова в фильтр');
      }
    },
    ...options,
  });
};

/**
 * Удалить слово из фильтра
 */
export const useDeleteFilteredWord = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (wordId) => ttsService.deleteFilteredWord(wordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
      if (!options.onSuccess) {
        toast.success('Слово удалено из фильтра');
      }
    },
    onError: (error) => {
      logger.error('Error deleting filtered word:', error);
      if (!options.onError) {
        toast.error('Ошибка удаления слова из фильтра');
      }
    },
    ...options,
  });
};

/**
 * Получить список заблокированных пользователей
 */
export const useBlockedUsers = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.blockedUsers(),
    queryFn: () => ttsService.getBlockedUsers(),
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    ...options,
  });
};

/**
 * Заблокировать пользователя
 */
export const useBlockUser = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => ttsService.blockUser(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
      if (!options.onSuccess) {
        toast.success('Пользователь заблокирован');
      }
      return response;
    },
    onError: (error) => {
      logger.error('Error blocking user:', error);
      if (!options.onError) {
        toast.error('Ошибка блокировки пользователя');
      }
    },
    ...options,
  });
};

/**
 * Разблокировать пользователя
 */
export const useUnblockUser = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => ttsService.unblockUser(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
      if (!options.onSuccess) {
        toast.success('Пользователь разблокирован');
      }
      return response;
    },
    onError: (error) => {
      logger.error('Error unblocking user:', error);
      if (!options.onError) {
        toast.error('Ошибка разблокировки пользователя');
      }
    },
    ...options,
  });
};

/**
 * Получить глобальные голоса TTS
 */
export const useGlobalVoices = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.tts.voices.global(),
    queryFn: async () => {
      const response = await ttsService.getGlobalVoices();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 минут - голоса редко меняются
    gcTime: 30 * 60 * 1000, // 30 минут
    retry: 1,
    ...options,
  });
};

