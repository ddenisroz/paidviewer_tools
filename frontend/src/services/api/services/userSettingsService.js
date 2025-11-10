/**
 * User Settings Service - инкапсуляция всех User Settings API вызовов
 */
import { apiClient } from '../client';

/**
 * User Settings Service
 */
export const userSettingsService = {
  /**
   * Получить настройки пользователя
   * @returns {Promise<AxiosResponse>}
   */
  async getUserSettings() {
    return apiClient.get('/api/user-settings/');
  },

  /**
   * Сохранить настройки пользователя
   * @param {Object} settings - Настройки для сохранения
   * @returns {Promise<AxiosResponse>}
   */
  async saveUserSettings(settings) {
    return apiClient.post('/api/user-settings/', settings);
  },
};

