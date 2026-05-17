/**
 * User Settings Service - инкапсуляция всех User Settings API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * User Settings Service
 */
export const userSettingsService = {
    /**
     * Получить настройки пользователя
     * @returns Promise с ответом API
     */
    async getUserSettings(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/user-settings/');
    },

    /**
     * Сохранить настройки пользователя
     * @param settings - Настройки для сохранения
     * @returns Promise с ответом API
     */
    async saveUserSettings(settings: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/user-settings/', settings);
    },
};
