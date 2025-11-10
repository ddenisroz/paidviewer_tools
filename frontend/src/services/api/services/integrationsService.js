/**
 * Integrations Service - инкапсуляция всех Integrations API вызовов
 */
import { apiClient } from '../client';
import { API_BASE_URL } from '../../../constants';

/**
 * Integrations Service
 */
export const integrationsService = {
  /**
   * Отключить Twitch интеграцию
   * @returns {Promise<AxiosResponse>}
   */
  async disconnectTwitch() {
    return apiClient.post('/api/integrations/twitch/disconnect');
  },

  /**
   * Отключить VK интеграцию
   * @returns {Promise<AxiosResponse>}
   */
  async disconnectVk() {
    return apiClient.post('/api/integrations/vk/disconnect');
  },

  /**
   * Подключить Twitch интеграцию (редирект)
   */
  connectTwitch() {
    window.location.href = `${API_BASE_URL}/auth/twitch/login`;
  },

  /**
   * Подключить VK интеграцию (редирект)
   */
  connectVk() {
    window.location.href = `${API_BASE_URL}/auth/vk/login`;
  },

  /**
   * Подключить DonationAlerts (редирект)
   */
  connectDonationAlerts() {
    window.location.href = `${API_BASE_URL}/auth/donationalerts/login`;
  },

  /**
   * Получить список интеграций
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getIntegrations() {
    return apiClient.get('/api/integrations');
  },

  /**
   * Отключить интеграцию DonationAlerts
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async disconnectDonationAlerts() {
    return apiClient.post('/api/integrations/donationalerts/disconnect');
  },

  /**
   * Подключить DonationAlerts (получить URL для подключения)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async connectDonationAlerts() {
    return apiClient.post('/api/donationalerts/connect');
  },
};

