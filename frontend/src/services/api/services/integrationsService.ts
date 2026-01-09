/**
 * Integrations Service - инкапсуляция всех Integrations API вызовов
 */
import { API_BASE_URL } from '@/constants';

import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * Integrations Service
 */
export const integrationsService = {
  /**
   * Отключить Twitch интеграцию
   * @returns Promise с ответом API
   */
  async disconnectTwitch(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/integrations/twitch/disconnect');
  },

  /**
   * Отключить VK интеграцию
   * @returns Promise с ответом API
   */
  async disconnectVk(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/integrations/vk/disconnect');
  },

  /**
   * Подключить Twitch интеграцию (редирект)
   */
  connectTwitch(): void {
    window.location.href = `${API_BASE_URL}/auth/twitch/login`;
  },

  /**
   * Подключить VK интеграцию (редирект)
   */
  connectVk(): void {
    window.location.href = `${API_BASE_URL}/auth/vk/login`;
  },

  /**
   * Подключить DonationAlerts (редирект)
   */
  connectDonationAlertsRedirect(): void {
    window.location.href = `${API_BASE_URL}/auth/donationalerts/login`;
  },

  /**
   * Получить список интеграций
   * @returns Promise с ответом API
   */
  async getIntegrations(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/integrations');
  },

  /**
   * Отключить интеграцию DonationAlerts
   * @returns Promise с ответом API
   */
  async disconnectDonationAlerts(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/integrations/donationalerts/disconnect');
  },

  /**
   * Подключить DonationAlerts (получить URL для подключения)
   * @returns Promise с ответом API
   */
  async connectDonationAlerts(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/donationalerts/connect');
  },
};

