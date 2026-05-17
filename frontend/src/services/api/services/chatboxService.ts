/**
 * Chatbox Service - инкапсуляция всех Chatbox API вызовов
 */
import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * Chatbox Service
 */
export const chatboxService = {
    /**
     * Получить настройки Chatbox
     * @returns Promise с ответом API
     */
    async getSettings(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/chatbox/settings');
    },

    /**
     * Сохранить настройки Chatbox
     * @param settings - Настройки Chatbox
     * @param regenerateToken - Регенерировать токен виджета
     * @returns Promise с ответом API
     */
    async saveSettings(
        settings: Record<string, unknown>,
        regenerateToken: boolean = false
    ): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/chatbox/settings', settings, {
            params: { regenerate_token: regenerateToken },
        });
    },

    /**
     * Получить настройки Chatbox по токену
     * @param token - Токен виджета
     * @returns Promise с ответом API
     */
    async getSettingsByToken(token: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/api/chatbox/settings/by-token/${token}`);
    },

    /**
     * Сохранить конфигурацию виджета чата
     * @param config - Конфигурация виджета
     * @returns Promise с ответом API
     */
    async saveWidgetConfig(config: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/widgets/chat/config', config);
    },
};
