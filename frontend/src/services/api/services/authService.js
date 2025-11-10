/**
 * Auth Service - инкапсуляция всех Auth API вызовов
 */
import { apiClient } from '../client';
import { API_BASE_URL } from '../../../constants';

/**
 * Auth Service
 */
export const authService = {
  /**
   * Получить статус аутентификации
   * @returns {Promise<AxiosResponse>}
   */
  async getAuthStatus() {
    return apiClient.get('/api/auth/status');
  },

  /**
   * Получить текущего пользователя
   * @returns {Promise<AxiosResponse>}
   */
  async getCurrentUser() {
    return apiClient.get('/api/auth/user/me');
  },

  /**
   * Выйти из системы
   * @returns {Promise<AxiosResponse>}
   */
  async logout() {
    return apiClient.post('/api/auth/logout');
  },

  /**
   * Войти через Twitch (редирект)
   */
  loginWithTwitch() {
    window.location.href = `${API_BASE_URL}/auth/twitch/login`;
  },

  /**
   * Войти через VK (редирект)
   */
  loginWithVk() {
    window.location.href = `${API_BASE_URL}/auth/vk/login`;
  },
};

