/**
 * Единый API клиент для всех запросов
 * Заменяет множественные axios instances (botService, api, adminApi, ttsService)
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { API_BASE_URL } from '@/constants';
import { shouldRetryRequest } from '@/shared/utils/apiErrorHandler';
import { logger } from '@/shared/utils/prodLogger';

/**
 * Конфигурация для создания API клиента
 */
interface ApiClientConfig {
    baseURL: string;
    withCredentials?: boolean;
    timeout?: number;
}

type RetryableRequestConfig = AxiosRequestConfig & {
    _retry?: number;
    skipRetry?: boolean;
};

/**
 * Создает настроенный axios instance
 * @param config - Конфигурация клиента
 * @returns Настроенный Axios instance
 */
function createApiClient({ baseURL, withCredentials = true, timeout = 30000 }: ApiClientConfig): AxiosInstance {
    const client = axios.create({
        baseURL,
        withCredentials,
        timeout,
    });

    // Request interceptor - добавляем логирование, настройки и дедупликацию
    client.interceptors.request.use(
        (config) => {
            // Логирование запросов в dev режиме
            if (import.meta.env.DEV) {
                logger.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
                    params: config.params,
                    data: config.data,
                });
            }

            // CSRF protection for cookie-based session requests
            const method = config.method?.toLowerCase();
            const isMutatingMethod = method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
            if (isMutatingMethod && typeof document !== 'undefined') {
                const csrfToken = document.cookie
                    .split('; ')
                    .find((row) => row.startsWith('csrf_token='))
                    ?.split('=')[1];
                if (csrfToken) {
                    config.headers = config.headers || {};
                    config.headers['X-CSRF-Token'] = decodeURIComponent(csrfToken);
                }
            }

            // Добавляем ключ для дедупликации GET запросов
            if (config.method?.toLowerCase() === 'get') {
                const dedupeKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
                (config as AxiosRequestConfig & { __dedupeKey?: string }).__dedupeKey = dedupeKey;
            }

            return config;
        },
        (error: AxiosError) => {
            logger.error('[API] Request error:', error);
            return Promise.reject(error);
        }
    );

    // Response interceptor - обработка ошибок и retry logic
    client.interceptors.response.use(
        (response: AxiosResponse) => {
            // Логирование ответов в dev режиме
            if (import.meta.env.DEV) {
                logger.debug(
                    `[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`
                );
            }
            return response;
        },
        async (error: AxiosError) => {
            const originalRequest = (error.config || {}) as RetryableRequestConfig;

            // Обработка 401 - не авторизован
            if (error.response?.status === 401) {
                // Не перенаправляем на /login для overlay routes
                const isOverlayRoute =
                    window.location.pathname.startsWith('/chat-overlay') ||
                    window.location.pathname.startsWith('/tts-obs') ||
                    window.location.pathname.startsWith('/youtube-obs') ||
                    window.location.pathname.startsWith('/drops-widget');

                if (!isOverlayRoute) {
                    // Перенаправляем на страницу логина только для основного приложения
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }

            // Retry logic с экспоненциальной задержкой
            const originalRequestWithRetry = originalRequest;
            if (!originalRequestWithRetry._retry) {
                originalRequestWithRetry._retry = 0;
            }

            const maxRetries = 2;
            const shouldRetry =
                !originalRequestWithRetry.skipRetry &&
                shouldRetryRequest(error) &&
                originalRequestWithRetry._retry < maxRetries;

            if (shouldRetry) {
                originalRequestWithRetry._retry += 1;

                // Вычисляем задержку с экспоненциальным ростом
                const delay = Math.min(1000 * Math.pow(2, originalRequestWithRetry._retry - 1), 10000);

                logger.debug(`[API] Retry attempt ${originalRequestWithRetry._retry}/${maxRetries} after ${delay}ms`);

                // Ждем перед повторной попыткой
                await new Promise((resolve) => setTimeout(resolve, delay));

                // Повторяем запрос
                return client(originalRequestWithRetry);
            }

            // Если не повторяем или исчерпали попытки, обрабатываем ошибку
            // Не показываем toast здесь - это делается в компонентах через handleApiError
            // Логируем только неожиданные ошибки (не 403, 404)
            const status = error.response?.status;
            const isExpectedError = status === 403 || status === 404;

            if (!isExpectedError || import.meta.env.DEV) {
                logger.error('[API] Response error:', {
                    url: error.config?.url,
                    method: error.config?.method,
                    status: status,
                    retries: originalRequestWithRetry._retry || 0,
                });
            }

            // Пробрасываем ошибку дальше для обработки в компонентах
            return Promise.reject(error);
        }
    );

    return client;
}

/**
 * Основной API клиент для bot_service
 */
export const apiClient = createApiClient({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 30000,
});

// Экспортируем для обратной совместимости
export default apiClient;
