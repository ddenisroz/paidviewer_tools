/**
 * TTS Service - инкапсуляция всех TTS API вызовов
 * Использует единый API клиент
 */
import { logger } from '@/shared/utils/prodLogger';

import { apiClient, ttsApiClient } from '../client';

import type { ApiResponse, BlockedUser, FilteredWord, LocalTtsConfig, TtsSettings, TtsStatus, TtsVoice } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * TTS Service
 */
export const ttsService = {
  /**
   * Получить статус TTS
   * @param channelName - Имя канала (опционально)
   * @returns Promise с ответом API
   */
  async getStatus(channelName: string | null = null): Promise<AxiosResponse<ApiResponse<TtsStatus>>> {
    const params = channelName ? { channel_name: channelName } : {};
    return apiClient.get('/api/tts/status', { params });
  },

  /**
   * Включить TTS
   * @returns Promise с ответом API
   */
  async enable(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/enable');
  },

  /**
   * Выключить TTS
   * @returns Promise с ответом API
   */
  async disable(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/disable');
  },

  /**
   * Получить настройки TTS
   * @returns Promise с ответом API
   */
  async getSettings(): Promise<AxiosResponse<ApiResponse<TtsSettings>>> {
    return apiClient.get('/api/tts/settings');
  },

  /**
   * Сохранить настройки TTS
   * @param settings - Настройки TTS
   * @returns Promise с ответом API
   */
  async saveSettings(settings: Partial<TtsSettings>): Promise<AxiosResponse<ApiResponse<TtsSettings>>> {
    return apiClient.post('/api/tts/settings', settings);
  },

  /**
   * Получить аудио настройки TTS
   * @returns Promise с ответом API
   */
  async getAudioSettings(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/tts/audio-settings');
  },

  /**
   * Сохранить аудио настройки TTS
   * @param settings - Аудио настройки
   * @returns Promise с ответом API
   */
  async saveAudioSettings(settings: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/audio-settings', settings);
  },

  /**
   * Получить настройки платформы TTS
   * @returns Promise с ответом API
   */
  async getPlatformSettings(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/tts/platform-settings');
  },

  /**
   * Сохранить настройки платформы TTS
   * @param settings - Настройки платформы
   * @returns Promise с ответом API
   */
  async savePlatformSettings(settings: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/platform-settings', settings);
  },

  /**
   * Получить настройки режима TTS
   * @returns Promise с ответом API
   */
  async getModeSettings(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/tts/mode-settings');
  },

  /**
   * Сохранить настройки режима TTS
   * @param settings - Настройки режима
   * @returns Promise с ответом API
   */
  async saveModeSettings(settings: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/mode-settings', settings);
  },

  /**
   * Сгенерировать OBS URL для TTS
   * @returns Promise с ответом API
   */
  async generateObsUrl(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/generate-obs-url');
  },

  /**
   * Регенерировать OBS URL для TTS
   * @returns Promise с ответом API
   */
  async regenerateObsUrl(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/regenerate-obs-url');
  },

  /**
   * Получить OBS URL для TTS
   * @returns Promise с ответом API
   */
  async getObsUrl(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/tts/obs-url');
  },

  /**
   * Установить режим прослушивания TTS
   * @param data - Данные режима
   * @returns Promise с ответом API
   */
  async setListeningMode(data: { listeningMode: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/listening-mode', data);
  },

  /**
   * Установить движок TTS
   * @param data - Данные движка
   * @returns Promise с ответом API
   */
  async setEngine(data: { engine_type: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/engine', data);
  },

  /**
   * Получить health статус TTS сервиса
   * @returns Promise с ответом API
   */
  async getHealth(): Promise<AxiosResponse<ApiResponse>> {
    try {
      return await ttsApiClient.get('/health');
    } catch (error) {
      logger.error('Error fetching TTS health:', error);
      return {
        data: { success: false, data: { status: 'unhealthy', tts_engine_loaded: false } },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as unknown,
      } as AxiosResponse<ApiResponse>;
    }
  },

  /**
   * Получить глобальные голоса
   * @returns Promise с ответом API
   */
  async getGlobalVoices(): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> {
    return apiClient.get('/api/voices/global');
  },

  /**
   * Получить голоса пользователя
   * @param userId - ID пользователя
   * @returns Promise с ответом API
   */
  async getUserVoices(userId: number): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> {
    return ttsApiClient.get(`/api/tts/user/voices/${userId}`);
  },

  /**
   * Загрузить голос пользователя
   * @param userId - ID пользователя
   * @param formData - FormData с файлом голоса
   * @returns Promise с ответом API
   */
  async uploadUserVoice(userId: number, formData: FormData): Promise<AxiosResponse<ApiResponse<TtsVoice>>> {
    return ttsApiClient.post(`/api/tts/user/voices/upload?user_id=${userId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Загрузить голос (глобальный)
   * @param formData - FormData с файлом голоса
   * @returns Promise с ответом API
   */
  async uploadVoice(formData: FormData): Promise<AxiosResponse<ApiResponse<TtsVoice>>> {
    return apiClient.post('/api/voices/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Удалить голос пользователя
   * @param voiceId - ID голоса
   * @param userId - ID пользователя
   * @returns Promise с ответом API
   */
  async deleteUserVoice(voiceId: string, userId: number): Promise<AxiosResponse<ApiResponse>> {
    return ttsApiClient.delete(`/api/tts/user/voices/${voiceId}?user_id=${userId}`);
  },

  /**
   * Удалить голос (глобальный)
   * @param voiceId - ID голоса
   * @returns Promise с ответом API
   */
  async deleteVoice(voiceId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/voices/${voiceId}`);
  },

  /**
   * Создать TTS награду для платформы
   * @param data - Данные награды
   * @returns Promise с ответом API
   */
  async createTtsReward(data: { platform: string; title: string; cost: number; cooldown: number }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/create-reward', data);
  },

  /**
   * Удалить TTS награду для платформы
   * @param platform - Платформа (twitch/vk)
   * @returns Promise с ответом API
   */
  async deleteTtsReward(platform: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/tts/reward/${platform}`);
  },

  /**
   * Тестировать голос
   * @param voiceId - ID голоса
   * @param text - Текст для тестирования
   * @returns Promise с ответом API
   */
  async testVoice(voiceId: number, text: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post(`/api/voices/${voiceId}/test`, { text });
  },

  /**
   * Получить отфильтрованные слова
   * @returns Promise с ответом API
   */
  async getFilteredWords(): Promise<AxiosResponse<ApiResponse<FilteredWord[]>>> {
    return apiClient.get('/api/tts/filtered-words');
  },

  /**
   * Добавить отфильтрованное слово
   * @param data - Данные слова
   * @returns Promise с ответом API
   */
  async addFilteredWord(data: { word: string; channel_name?: string }): Promise<AxiosResponse<ApiResponse<FilteredWord>>> {
    return apiClient.post('/api/tts/filtered-words', data);
  },

  /**
   * Удалить отфильтрованное слово
   * @param wordId - ID слова
   * @returns Promise с ответом API
   */
  async deleteFilteredWord(wordId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/tts/filtered-words/${wordId}`);
  },

  /**
   * Получить заблокированных пользователей
   * @returns Promise с ответом API
   */
  async getBlockedUsers(): Promise<AxiosResponse<ApiResponse<BlockedUser[]>>> {
    return apiClient.get('/api/tts/blocked-users');
  },

  /**
   * Заблокировать пользователя
   * @param data - Данные для блокировки
   * @returns Promise с ответом API
   */
  async blockUser(data: { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string; reason?: string }): Promise<AxiosResponse<ApiResponse<BlockedUser>>> {
    return apiClient.post('/api/tts/block', data);
  },

  /**
   * Разблокировать пользователя
   * @param data - Данные для разблокировки
   * @returns Promise с ответом API
   */
  async unblockUser(data: { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/tts/unblock', data);
  },

  /**
   * Получить локальную конфигурацию TTS
   * @returns Promise с ответом API
   */
  async getLocalTtsConfig(): Promise<AxiosResponse<ApiResponse<LocalTtsConfig>>> {
    return apiClient.get('/api/local-tts/config');
  },

  /**
   * Сохранить локальную конфигурацию TTS
   * @param config - Конфигурация
   * @returns Promise с ответом API
   */
  async saveLocalTtsConfig(config: Partial<LocalTtsConfig>): Promise<AxiosResponse<ApiResponse<LocalTtsConfig>>> {
    return apiClient.post('/api/local-tts/config', config);
  },

  /**
   * Тестировать подключение к локальному TTS
   * @param params - Параметры подключения
   * @returns Promise с ответом API
   */
  async testLocalTtsConnection(params: { host?: string; port?: number; api_key?: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/local-tts/test-connection', params);
  },

  /**
   * Переключить локальный TTS
   * @returns Promise с ответом API
   */
  async toggleLocalTts(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/local-tts/toggle');
  },

  /**
   * Получить статус whitelist
   * @returns Promise с ответом API
   */
  async getWhitelistStatus(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/voices/whitelist-status');
  },

  /**
   * Получить включенные голоса пользователя
   * @param userId - ID пользователя
   * @returns Promise с ответом API
   */
  async getEnabledVoices(userId: number): Promise<AxiosResponse<ApiResponse<number[]>>> {
    return apiClient.get(`/api/user/voices/enabled/${userId}`);
  },

  /**
   * Сохранить включенные голоса пользователя
   * @param userId - ID пользователя
   * @param voiceIds - Массив ID голосов
   * @returns Promise с ответом API
   */
  async saveEnabledVoices(userId: number, voiceIds: number[]): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post(`/api/user/voices/enabled/${userId}`, voiceIds);
  },

  /**
   * Включить TTS для гостя
   * @param data - Данные для включения
   * @returns Promise с ответом API
   */
  async enableGuest(data: { channel_name: string; platform: 'twitch' | 'vk' }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/guest/tts/enable', data);
  },

  /**
   * Выключить TTS для гостя
   * @param data - Данные для выключения
   * @returns Promise с ответом API
   */
  async disableGuest(data: { channel_name: string; platform: 'twitch' | 'vk' }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/guest/tts/disable', data);
  },

  /**
   * Отключить гостя от канала
   * @param data - Данные для отключения
   * @returns Promise с ответом API
   */
  async disconnectGuest(data: { channel_name: string; platform: 'twitch' | 'vk' }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/guest/disconnect', data);
  },
};

