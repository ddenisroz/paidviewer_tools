/**
 * Support Service - инкапсуляция всех Support API вызовов
 */
import { apiClient } from '../client';
import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '../../../types';

/**
 * Support Service
 */
export const supportService = {
  /**
   * Получить тикеты пользователя
   * @returns Promise с ответом API
   */
  async getMyTickets(): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/support/my-tickets');
  },

  /**
   * Получить ответы на тикет
   * @param ticketId - ID тикета
   * @returns Promise с ответом API
   */
  async getTicketResponses(ticketId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get(`/api/support/tickets/${ticketId}/responses`);
  },

  /**
   * Ответить на тикет
   * @param ticketId - ID тикета
   * @param formData - Данные ответа (может содержать файлы)
   * @returns Promise с ответом API
   */
  async respondToTicket(ticketId: number, formData: FormData): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post(`/api/support/tickets/${ticketId}/respond`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Создать новый тикет
   * @param formData - Данные тикета (может содержать файлы)
   * @returns Promise с ответом API
   */
  async createTicket(formData: FormData): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/support/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Получить тикеты (админ)
   * @param params - Параметры запроса (status)
   * @returns Promise с ответом API
   */
  async getAdminTickets(params: Record<string, any> = {}): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get('/api/admin/support/tickets', { params });
  },

  /**
   * Получить тикет (админ)
   * @param ticketId - ID тикета
   * @returns Promise с ответом API
   */
  async getAdminTicket(ticketId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.get(`/api/admin/support/tickets/${ticketId}`);
  },

  /**
   * Отправить ответ на тикет (админ)
   * @param ticketId - ID тикета
   * @param message - Текст ответа
   * @returns Promise с ответом API
   */
  async sendAdminResponse(ticketId: number, message: string): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post(`/api/admin/support/tickets/${ticketId}/responses`, null, {
      params: { message },
    });
  },

  /**
   * Обновить статус тикета (админ)
   * @param ticketId - ID тикета
   * @param data - Данные для обновления
   * @returns Promise с ответом API
   */
  async updateTicketStatus(ticketId: number, data: { status: string; admin_notes?: string }): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.patch(`/api/admin/support/tickets/${ticketId}/status`, data);
  },

  /**
   * Удалить тикет (админ)
   * @param ticketId - ID тикета
   * @returns Promise с ответом API
   */
  async deleteTicket(ticketId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/admin/support/tickets/${ticketId}`);
  },

  /**
   * Разархивировать тикет (админ)
   * @param ticketId - ID тикета
   * @returns Promise с ответом API
   */
  async unarchiveTicket(ticketId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.put(`/api/admin/support/tickets/${ticketId}/unarchive`);
  },
};

