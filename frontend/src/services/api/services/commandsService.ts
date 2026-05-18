/**
 * Commands Service - инкапсуляция всех Commands API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse, Command, CommandInvocation } from '../../../types';
import type { AxiosResponse } from 'axios';

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

    async getHistory(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse<CommandInvocation[]>>> {
        return apiClient.get('/api/commands/history', { params });
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
    async createOverride(override: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
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
     * @param data - Данные для обновления (должен содержать command_id)
     * @returns Promise с ответом API
     */
    async toggleCommand(commandName: string, data: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        // Backend требует command_id, а не command_name
        if (!data.command_id) {
            throw new Error('command_id is required for toggle operation');
        }
        return apiClient.put(`/api/commands/${data.command_id}`, data);
    },
};
