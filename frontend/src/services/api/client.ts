/**
 * Единый API клиент для всех запросов
 * Заменяет множественные axios instances (botService, api, adminApi, ttsService)
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL, TTS_SERVICE_URL } from '../../constants';
import { logger } from '../../utils/prodLogger';
import { getErrorMessage } from '../../utils/errorMessages';

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

  // Response interceptor - обработка ошибок
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Логирование ответов в dev режиме
      if (import.meta.env.DEV) {
        logger.debug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
      }
      return response;
    },
    (error: AxiosError) => {
      // Централизованная обработка ошибок
      const errorMessage = getErrorMessage(error);
      
      // Логирование ошибок
      logger.error('[API] Response error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        message: errorMessage,
        error,
      });

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


