import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

import { logger } from '@/shared/utils/prodLogger';
import { ApiErrorCode as BackendErrorCode } from '@/types/api';


/**
 * Типы ошибок API (клиентская классификация)
 */
export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Структура ответа ошибки от backend
 */
interface BackendErrorResponse {
  error_code?: BackendErrorCode;
  message?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  // Legacy format
  error?: string;
  detail?: string;
}

/**
 * Структура ошибки API
 */
export interface ApiError {
  type: ApiErrorType;
  errorCode?: BackendErrorCode;
  message: string;
  statusCode?: number;
  details?: unknown;
  originalError: AxiosError;
}

/**
 * Опции для обработки ошибок
 */
export interface ErrorHandlerOptions {
  showToast?: boolean;
  customMessage?: string;
  onRetry?: () => void;
  silent?: boolean;
}

/**
 * Определяет тип ошибки на основе AxiosError
 */
function getErrorType(error: AxiosError): ApiErrorType {
  if (!error.response) {
    // Нет ответа от сервера
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return ApiErrorType.TIMEOUT_ERROR;
    }
    return ApiErrorType.NETWORK_ERROR;
  }

  const status = error.response.status;

  switch (status) {
    case 401:
      return ApiErrorType.UNAUTHORIZED;
    case 403:
      return ApiErrorType.FORBIDDEN;
    case 404:
      return ApiErrorType.NOT_FOUND;
    case 422:
      return ApiErrorType.VALIDATION_ERROR;
    case 500:
    case 502:
    case 503:
    case 504:
      return ApiErrorType.SERVER_ERROR;
    default:
      return ApiErrorType.UNKNOWN_ERROR;
  }
}

/**
 * Получает error_code из ответа backend
 */
function getBackendErrorCode(error: AxiosError): BackendErrorCode | undefined {
  const data = error.response?.data as BackendErrorResponse | undefined;
  return data?.error_code;
}

/**
 * Получает пользовательское сообщение об ошибке
 */
function getUserMessage(error: AxiosError, type: ApiErrorType): string {
  const data = error.response?.data as BackendErrorResponse | undefined;

  // Пытаемся получить сообщение от сервера (новый формат)
  if (data?.message && typeof data.message === 'string') {
    return data.message;
  }

  // Legacy format
  const serverMessage = data?.error || data?.detail;
  if (serverMessage && typeof serverMessage === 'string') {
    return serverMessage;
  }

  // Сообщения по error_code от backend
  const errorCode = data?.error_code;
  if (errorCode) {
    switch (errorCode) {
      case 'TOKEN_EXPIRED':
      case 'SESSION_EXPIRED':
        return 'Сессия истекла. Пожалуйста, войдите снова.';
      case 'INVALID_TOKEN':
        return 'Недействительный токен авторизации.';
      case 'BOT_NOT_CONNECTED':
        return 'Бот не подключен к каналу.';
      case 'BOT_ALREADY_CONNECTED':
        return 'Бот уже подключен к каналу.';
      case 'TTS_SERVICE_UNAVAILABLE':
        return 'TTS сервис временно недоступен.';
      case 'TTS_VOICE_NOT_FOUND':
        return 'Выбранный голос не найден.';
      case 'PLATFORM_CONNECTION_ERROR':
        return 'Ошибка подключения к платформе.';
      case 'RATE_LIMIT_EXCEEDED': {
        const retryAfter = data?.details?.retry_after;
        return retryAfter
          ? `Превышен лимит запросов. Повторите через ${retryAfter} сек.`
          : 'Превышен лимит запросов. Попробуйте позже.';
      }
      case 'ALREADY_EXISTS':
        return 'Такой ресурс уже существует.';
    }
  }

  // Дефолтные сообщения по типу ошибки
  switch (type) {
    case ApiErrorType.NETWORK_ERROR:
      return 'Нет связи с сервером. Проверьте подключение к интернету.';
    case ApiErrorType.TIMEOUT_ERROR:
      return 'Превышено время ожидания ответа от сервера.';
    case ApiErrorType.UNAUTHORIZED:
      return 'Требуется авторизация. Пожалуйста, войдите в систему.';
    case ApiErrorType.FORBIDDEN:
      return 'Недостаточно прав для выполнения этого действия.';
    case ApiErrorType.NOT_FOUND:
      return 'Запрашиваемый ресурс не найден.';
    case ApiErrorType.VALIDATION_ERROR:
      return 'Ошибка валидации данных. Проверьте введенные значения.';
    case ApiErrorType.SERVER_ERROR:
      return 'Ошибка сервера. Попробуйте позже.';
    default:
      return 'Произошла непредвиденная ошибка.';
  }
}

/**
 * Централизованный обработчик ошибок API
 * 
 * @param error - Ошибка Axios
 * @param options - Опции обработки
 * @returns Структурированная информация об ошибке
 */
export function handleApiError(
  error: AxiosError,
  options: ErrorHandlerOptions = {}
): ApiError {
  const {
    showToast = true,
    customMessage,
    onRetry,
    silent = false,
  } = options;

  const errorType = getErrorType(error);
  const message = customMessage || getUserMessage(error, errorType);
  const statusCode = error.response?.status;

  const errorCode = getBackendErrorCode(error);
  const apiError: ApiError = {
    type: errorType,
    errorCode,
    message,
    statusCode,
    details: error.response?.data,
    originalError: error,
  };

  // Логирование
  if (!silent) {
    logger.error('[API Error]', {
      type: errorType,
      message,
      statusCode,
      url: error.config?.url,
      method: error.config?.method,
    });
  }

  // Показываем toast уведомление
  if (showToast && !silent) {
    switch (errorType) {
      case ApiErrorType.UNAUTHORIZED:
        toast.error(message, {
          description: 'Перенаправление на страницу входа...',
          duration: 3000,
        });
        break;

      case ApiErrorType.FORBIDDEN:
        toast.error(message, {
          description: 'Обратитесь к администратору',
          duration: 4000,
        });
        break;

      case ApiErrorType.VALIDATION_ERROR: {
        // Для ошибок валидации показываем детали
        const responseData = error.response?.data as BackendErrorResponse | undefined;
        const validationErrors = responseData?.details?.errors as Array<{ field: string; message: string }> | undefined;
        if (validationErrors && Array.isArray(validationErrors)) {
          const errorList = validationErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join('\n');
          toast.error(message, {
            description: errorList,
            duration: 5000,
          });
        } else {
          toast.error(message, { duration: 4000 });
        }
        break;
      }

      case ApiErrorType.SERVER_ERROR:
        toast.error(message, {
          description: onRetry ? 'Попробуйте еще раз' : undefined,
          action: onRetry ? {
            label: 'Повторить',
            onClick: onRetry,
          } : undefined,
          duration: 5000,
        });
        break;

      case ApiErrorType.NETWORK_ERROR:
      case ApiErrorType.TIMEOUT_ERROR:
        toast.error(message, {
          description: onRetry ? 'Проверьте соединение и попробуйте снова' : undefined,
          action: onRetry ? {
            label: 'Повторить',
            onClick: onRetry,
          } : undefined,
          duration: 6000,
        });
        break;

      default:
        toast.error(message, {
          action: onRetry ? {
            label: 'Повторить',
            onClick: onRetry,
          } : undefined,
          duration: 4000,
        });
    }
  }

  return apiError;
}

/**
 * Retry logic с экспоненциальной задержкой
 */
export class RetryHandler {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(maxRetries = 2, baseDelay = 1000, maxDelay = 10000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * Выполняет функцию с повторными попытками
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: unknown) => boolean = () => true
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Не повторяем, если это последняя попытка
        if (attempt === this.maxRetries) {
          break;
        }

        // Проверяем, нужно ли повторять
        if (!shouldRetry(error)) {
          break;
        }

        // Вычисляем задержку с экспоненциальным ростом
        const delay = Math.min(
          this.baseDelay * Math.pow(2, attempt),
          this.maxDelay
        );

        logger.debug(`[RetryHandler] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);

        // Ждем перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

/**
 * Определяет, стоит ли повторять запрос при данной ошибке
 */
export function shouldRetryRequest(error: AxiosError): boolean {
  // Не повторяем для клиентских ошибок (4xx)
  if (error.response && error.response.status >= 400 && error.response.status < 500) {
    return false;
  }

  // Повторяем для серверных ошибок (5xx) и сетевых ошибок
  return true;
}

/**
 * Хук для использования retry handler в компонентах
 */
export function useRetryHandler(maxRetries = 2) {
  const retryHandler = new RetryHandler(maxRetries);

  const executeWithRetry = async <T>(
    fn: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<T> => {
    try {
      return await retryHandler.execute(fn, (error) => {
        if (axios.isAxiosError(error)) {
          return shouldRetryRequest(error);
        }
        return false;
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        handleApiError(error, options);
      }
      throw error;
    }
  };

  return { executeWithRetry };
}

/**
 * Wrapper для API вызовов с автоматической обработкой ошибок
 */
export async function apiCall<T>(
  fn: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
      handleApiError(error as AxiosError, options);
    }
    throw error;
  }
}
