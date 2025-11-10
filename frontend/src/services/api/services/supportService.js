/**
 * Support Service - инкапсуляция всех Support API вызовов
 */
import { apiClient } from '../client';

/**
 * Support Service
 */
export const supportService = {
  /**
   * Получить тикеты пользователя
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getMyTickets() {
    return apiClient.get('/api/support/my-tickets');
  },

  /**
   * Получить ответы на тикет
   * @param {number} ticketId - ID тикета
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getTicketResponses(ticketId) {
    return apiClient.get(`/api/support/tickets/${ticketId}/responses`);
  },

  /**
   * Ответить на тикет
   * @param {number} ticketId - ID тикета
   * @param {FormData} formData - Данные ответа (может содержать файлы)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async respondToTicket(ticketId, formData) {
    return apiClient.post(`/api/support/tickets/${ticketId}/respond`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Создать новый тикет
   * @param {FormData} formData - Данные тикета (может содержать файлы)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async createTicket(formData) {
    return apiClient.post('/api/support/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Получить тикеты (админ)
   * @param {Object} params - Параметры запроса (status)
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAdminTickets(params = {}) {
    return apiClient.get('/api/admin/support/tickets', { params });
  },

  /**
   * Получить тикет (админ)
   * @param {number} ticketId - ID тикета
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async getAdminTicket(ticketId) {
    return apiClient.get(`/api/admin/support/tickets/${ticketId}`);
  },

  /**
   * Отправить ответ на тикет (админ)
   * @param {number} ticketId - ID тикета
   * @param {string} message - Текст ответа
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async sendAdminResponse(ticketId, message) {
    return apiClient.post(`/api/admin/support/tickets/${ticketId}/responses`, null, {
      params: { message },
    });
  },

  /**
   * Обновить статус тикета (админ)
   * @param {number} ticketId - ID тикета
   * @param {Object} data - Данные { status, admin_notes? }
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async updateTicketStatus(ticketId, data) {
    return apiClient.patch(`/api/admin/support/tickets/${ticketId}/status`, data);
  },

  /**
   * Удалить тикет (админ)
   * @param {number} ticketId - ID тикета
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async deleteTicket(ticketId) {
    return apiClient.delete(`/api/admin/support/tickets/${ticketId}`);
  },

  /**
   * Разархивировать тикет (админ)
   * @param {number} ticketId - ID тикета
   * @returns {Promise<import('axios').AxiosResponse>}
   */
  async unarchiveTicket(ticketId) {
    return apiClient.put(`/api/admin/support/tickets/${ticketId}/unarchive`);
  },
};

