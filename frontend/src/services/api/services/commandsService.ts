/**
 * Commands Service - инкапсуляция всех Commands API вызовов
 */
import { apiClient } from '../client';
import type { AxiosResponse } from 'axios';
import type { ApiResponse, Command } from '../../../types';

/**
 * Commands Service
 */
export const commandsService = {
  /**
   * Получить все команды
   * @returns Promise с ответом API
   */
  async getCommands(): Promise<AxiosResponse<ApiResponse<Command[]>>> {
    return apiClient.get('/api/commands');
  },

  /**
   * Создать команду
   * @param command - Данные команды
   * @returns Promise с ответом API
   */
  async createCommand(command: Partial<Command>): Promise<AxiosResponse<ApiResponse<Command>>> {
    return apiClient.post('/api/commands', command);
  },

  /**
   * Создать override для команды
   * @param override - Данные override
   * @returns Promise с ответом API
   */
  async createOverride(override: Record<string, any>): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.post('/api/commands/override', override);
  },

  /**
   * Обновить команду
   * @param commandId - ID команды
   * @param command - Данные команды
   * @returns Promise с ответом API
   */
  async updateCommand(commandId: number, command: Partial<Command>): Promise<AxiosResponse<ApiResponse<Command>>> {
    return apiClient.put(`/api/commands/${commandId}`, command);
  },

  /**
   * Удалить команду
   * @param commandId - ID команды
   * @returns Promise с ответом API
   */
  async deleteCommand(commandId: number): Promise<AxiosResponse<ApiResponse>> {
    return apiClient.delete(`/api/commands/${commandId}`);
  },

  /**
   * Переключить команду
   * @param commandName - Имя команды
   * @param data - Данные для обновления
   * @returns Promise с ответом API
   */
  async toggleCommand(commandName: string, data: Record<string, any>): Promise<AxiosResponse<ApiResponse>> {
    // Backend использует PUT для обновления команд
    return apiClient.put(`/api/commands/${commandName}`, data);
  },
};

