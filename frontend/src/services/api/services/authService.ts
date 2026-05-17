/**
 * Auth Service - инкапсуляция всех Auth API вызовов
 */
import { API_BASE_URL } from '@/constants';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';

import { apiClient } from '../client';

import type { ApiResponse, User } from '../../../types';
import type { AxiosResponse } from 'axios';

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
     * Временный локальный вход по существующему нику без OAuth
     */
    async devLogin(nickname: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/auth/dev-login', { nickname });
    },

    async getChatWebSocketToken(): Promise<AxiosResponse<ApiResponse<{ token: string; user_id: number }>>> {
        return apiClient.get('/api/auth/ws-token');
    },

    /**
     * Войти через Twitch (редирект на полную OAuth авторизацию)
     */
    loginWithTwitch(): void {
        const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, '/auth/twitch/login');
        if (!safeUrl) {
            logger.error('Blocked unsafe Twitch auth redirect URL', { API_BASE_URL });
            return;
        }
        window.location.href = safeUrl;
    },

    /**
     * Войти через VK (редирект на полную OAuth авторизацию)
     */
    loginWithVk(): void {
        const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, '/auth/vk/login');
        if (!safeUrl) {
            logger.error('Blocked unsafe VK auth redirect URL', { API_BASE_URL });
            return;
        }
        window.location.href = safeUrl;
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
