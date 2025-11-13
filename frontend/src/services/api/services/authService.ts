/**
 * Auth Service - инкапсуляция всех Auth API вызовов
 */
import { apiClient } from '../client';
import { API_BASE_URL } from '../../../constants';
import type { AxiosResponse } from 'axios';
import type { ApiResponse, User } from '../../../types';

/**
 * Auth Service
 */
export const authService = {
  /**
   * Получить статус аутентификации
   * @returns Promise с ответом API
   */
  async getAuthStatus(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/auth/status');
  },

  /**
   * Получить текущего пользователя
   * @returns Promise с ответом API
   */
  async getCurrentUser(): Promise<AxiosResponse<ApiResponse<User>>> {
    return apiClient.get('/api/auth/user/me');
  },

  /**
   * Выйти из системы
   * @returns Promise с ответом API
   */
  async logout(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/auth/logout');
  },

  /**
   * Войти через Twitch (редирект)
   */
  loginWithTwitch(): void {
    window.location.href = `${API_BASE_URL}/auth/twitch/login`;
  },

  /**
   * Войти через VK (редирект)
   */
  loginWithVk(): void {
    window.location.href = `${API_BASE_URL}/auth/vk/login`;
  },

  /**
   * Удалить аккаунт пользователя
   * @returns Promise с ответом API
   */
  async deleteAccount(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/user/delete-account');
  },

  /**
   * Обработать OAuth callback для DonationAlerts
   * @param code - Код авторизации
   * @param state - State параметр
   * @returns Promise с ответом API
   */
  async handleDonationAlertsCallback(code: string, state: string = ''): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/auth/donationalerts/callback', {
      params: { code, state },
    });
  },
};

