/**
 * Integrations Service - инкапсуляция всех Integrations API вызовов
 */
import { API_BASE_URL } from '@/constants';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';

import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

/**
 * Integrations Service
 */
export const integrationsService = {
    /**
     * Отключить Twitch интеграцию
     * @returns Promise с ответом API
     */
    async disconnectTwitch(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/integrations/twitch/disconnect');
    },

    /**
     * Отключить VK интеграцию
     * @returns Promise с ответом API
     */
    async disconnectVk(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/integrations/vk/disconnect');
    },

    /**
     * Подключить Twitch интеграцию (редирект)
     */
    connectTwitch(): void {
        const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, '/auth/twitch/login');
        if (!safeUrl) {
            logger.error('Blocked unsafe Twitch integration redirect URL', { API_BASE_URL });
            return;
        }
        window.location.href = safeUrl;
    },

    /**
     * Подключить VK интеграцию (редирект)
     */
    connectVk(): void {
        const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, '/auth/vk/login');
        if (!safeUrl) {
            logger.error('Blocked unsafe VK integration redirect URL', { API_BASE_URL });
            return;
        }
        window.location.href = safeUrl;
    },

    /**
     * Подключить DonationAlerts (редирект)
     */
    connectDonationAlertsRedirect(): boolean {
        const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, '/auth/donationalerts/login');
        if (!safeUrl) {
            logger.error('Blocked unsafe DonationAlerts integration redirect URL', { API_BASE_URL });
            return false;
        }
        window.location.href = safeUrl;
        return true;
    },

    /**
     * Получить список интеграций
     * @returns Promise с ответом API
     */
    async getIntegrations(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/integrations');
    },

    /**
     * Отключить интеграцию DonationAlerts
     * @returns Promise с ответом API
     */
    async disconnectDonationAlerts(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/donationalerts/disconnect');
    },

    /**
     * Подключить DonationAlerts (legacy JSON flow kept for compatibility)
     * @returns Promise с ответом API
     */
    async connectDonationAlerts(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/donationalerts/connect');
    },
};
