/**
 * Единый API клиент для всех запросов
 * Заменяет множественные axios instances (botService, api, adminApi, ttsService)
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL, TTS_SERVICE_URL } from '../../constants';
import { logger } from '../../utils/prodLogger';
import { handleApiError, shouldRetryRequest } from '../../utils/apiErrorHandler';

/**
 * Конфигурация для создания API клиента
 */
interface ApiClientConfig {
  baseURL: string;
  withCredentials?: boolean;
  timeout?: number;
}

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

  // Request interceptor - добавляем логирование и настройки
  client.interceptors.request.use(
    (config) => {
      // Логирование запросов в dev режиме
      if (import.meta.env.DEV) {
        logger.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data,
        });
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
        logger.debug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

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
      if (!originalRequest._retry) {
        originalRequest._retry = 0;
      }

      const maxRetries = 2;
      const shouldRetry = shouldRetryRequest(error) && originalRequest._retry < maxRetries;

      if (shouldRetry) {
        originalRequest._retry += 1;
        
        // Вычисляем задержку с экспоненциальным ростом
        const delay = Math.min(1000 * Math.pow(2, originalRequest._retry - 1), 10000);
        
        logger.debug(`[API] Retry attempt ${originalRequest._retry}/${maxRetries} after ${delay}ms`);
        
        // Ждем перед повторной попыткой
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Повторяем запрос
        return client(originalRequest);
      }

      // Если не повторяем или исчерпали попытки, обрабатываем ошибку
      // Не показываем toast здесь - это делается в компонентах через handleApiError
      // Просто логируем
      logger.error('[API] Response error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        retries: originalRequest._retry || 0,
      });

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

/**
 * API клиент для TTS сервиса
 */
export const ttsApiClient = createApiClient({
  baseURL: TTS_SERVICE_URL,
  withCredentials: true,
  timeout: 10000, // TTS сервис может быть медленным
});

// Экспортируем для обратной совместимости
export default apiClient;


