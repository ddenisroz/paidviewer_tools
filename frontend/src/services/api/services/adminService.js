/**
 * Admin Service - инкапсуляция всех Admin API вызовов
 */
import { apiClient } from '../client';

/**
 * Admin Service
 */
export const adminService = {
  /**
   * Получить список администраторов
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAdminList() {
    return apiClient.get('/api/admin/list');
  },
};

