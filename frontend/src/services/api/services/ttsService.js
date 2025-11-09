/**
 * TTS Service - инкапсуляция всех TTS API вызовов
 * Использует единый API клиент
 */
import { apiClient, ttsApiClient } from '../client';
import { logger } from '../../../utils/prodLogger';

/**
 * TTS Service
 */
export const ttsService = {
  /**
   * Получить статус TTS
   * @param {string|null} channelName - Имя канала (опционально)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getStatus(channelName = null) {
    const params = channelName ? { channel_name: channelName } : {};
    return apiClient.get('/api/tts/status', { params });
  },

  /**
   * Включить TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async enable() {
    return apiClient.post('/api/tts/enable');
  },

  /**
   * Выключить TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async disable() {
    return apiClient.post('/api/tts/disable');
  },

  /**
   * Получить настройки TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getSettings() {
    return apiClient.get('/api/tts/settings');
  },

  /**
   * Сохранить настройки TTS
   * @param {Object} settings - Настройки TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async saveSettings(settings) {
    return apiClient.post('/api/tts/settings', settings);
  },

  /**
   * Получить аудио настройки TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAudioSettings() {
    return apiClient.get('/api/tts/audio-settings');
  },

  /**
   * Сохранить аудио настройки TTS
   * @param {Object} settings - Аудио настройки
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async saveAudioSettings(settings) {
    return apiClient.post('/api/tts/audio-settings', settings);
  },

  /**
   * Получить настройки платформы TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getPlatformSettings() {
    return apiClient.get('/api/tts/platform-settings');
  },

  /**
   * Сохранить настройки платформы TTS
   * @param {Object} settings - Настройки платформы
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async savePlatformSettings(settings) {
    return apiClient.post('/api/tts/platform-settings', settings);
  },

  /**
   * Получить настройки режима TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getModeSettings() {
    return apiClient.get('/api/tts/mode-settings');
  },

  /**
   * Сохранить настройки режима TTS
   * @param {Object} settings - Настройки режима
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async saveModeSettings(settings) {
    return apiClient.post('/api/tts/mode-settings', settings);
  },

  /**
   * Сгенерировать OBS URL для TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async generateObsUrl() {
    return apiClient.post('/api/tts/generate-obs-url');
  },

  /**
   * Регенерировать OBS URL для TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async regenerateObsUrl() {
    return apiClient.post('/api/tts/regenerate-obs-url');
  },

  /**
   * Получить OBS URL для TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getObsUrl() {
    return apiClient.get('/api/tts/obs-url');
  },

  /**
   * Установить режим прослушивания TTS
   * @param {Object} data - Данные режима { listeningMode: string }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async setListeningMode(data) {
    return apiClient.post('/api/tts/listening-mode', data);
  },

  /**
   * Установить движок TTS
   * @param {Object} data - Данные движка { engine_type: string }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async setEngine(data) {
    return apiClient.post('/api/tts/engine', data);
  },

  // TTS Service API (для голосов)
  
  /**
   * Получить health статус TTS сервиса
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getHealth() {
    try {
      return await ttsApiClient.get('/health');
    } catch (error) {
      logger.error('Error fetching TTS health:', error);
      return { data: { status: 'unhealthy', tts_engine_loaded: false } };
    }
  },

  /**
   * Получить глобальные голоса
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getGlobalVoices() {
    return ttsApiClient.get('/api/tts/voices/global');
  },

  /**
   * Получить голоса пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getUserVoices(userId) {
    return ttsApiClient.get(`/api/tts/user/voices/${userId}`);
  },

  /**
   * Загрузить голос пользователя
   * @param {number} userId - ID пользователя
   * @param {FormData} formData - Форма с данными голоса
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async uploadUserVoice(userId, formData) {
    return ttsApiClient.post(`/api/tts/user/voices/upload?user_id=${userId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Удалить голос пользователя
   * @param {string} voiceId - ID голоса
   * @param {number} userId - ID пользователя
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async deleteUserVoice(voiceId, userId) {
    return ttsApiClient.delete(`/api/tts/user/voices/${voiceId}?user_id=${userId}`);
  },

  /**
   * Создать TTS награду для платформы
   * @param {Object} data - Данные награды { platform, title, cost, cooldown }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async createTtsReward(data) {
    return apiClient.post('/api/tts/create-reward', data);
  },

  /**
   * Удалить TTS награду для платформы
   * @param {string} platform - Платформа (twitch/vk)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async deleteTtsReward(platform) {
    return apiClient.delete(`/api/tts/reward/${platform}`);
  },

  /**
   * Получить конфигурацию локального TTS
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getLocalTtsConfig() {
    return apiClient.get('/api/local-tts/config');
  },

  /**
   * Получить статус whitelist для голосов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getWhitelistStatus() {
    return apiClient.get('/api/voices/whitelist-status');
  },

  /**
   * Получить список отфильтрованных слов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getFilteredWords() {
    return apiClient.get('/api/tts/filtered-words');
  },

  /**
   * Добавить слово в фильтр
   * @param {Object} data - Данные слова { word: string, platform: string }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async addFilteredWord(data) {
    return apiClient.post('/api/tts/filtered-words', data);
  },

  /**
   * Удалить слово из фильтра
   * @param {number} wordId - ID слова
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async deleteFilteredWord(wordId) {
    return apiClient.delete(`/api/tts/filtered-words/${wordId}`);
  },

  /**
   * Получить список заблокированных пользователей
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getBlockedUsers() {
    return apiClient.get('/api/tts/blocked-users');
  },

  /**
   * Заблокировать пользователя
   * @param {Object} data - Данные пользователя { channel_name: string, platform: string, username: string }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async blockUser(data) {
    return apiClient.post('/api/tts/block', data);
  },

  /**
   * Разблокировать пользователя
   * @param {Object} data - Данные пользователя { channel_name: string, platform: string, username: string }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async unblockUser(data) {
    return apiClient.post('/api/tts/unblock', data);
  },
};

