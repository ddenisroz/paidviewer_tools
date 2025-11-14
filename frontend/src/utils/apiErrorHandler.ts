import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { logger } from './prodLogger';

/**
 * Типы ошибок API
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
 * Структура ошибки API
 */
export interface ApiError {
  type: ApiErrorType;
  message: string;
  statusCode?: number;
  details?: any;
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
 * Получает пользовательское сообщение об ошибке
 */
function getUserMessage(error: AxiosError, type: ApiErrorType): string {
  // Пытаемся получить сообщение от сервера
  const serverMessage = (error.response?.data as any)?.detail || 
                       (error.response?.data as any)?.message;

  if (serverMessage && typeof serverMessage === 'string') {
    return serverMessage;
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

  const apiError: ApiError = {
    type: errorType,
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

      case ApiErrorType.VALIDATION_ERROR:
        // Для ошибок валидации показываем детали
        const validationErrors = (error.response?.data as any)?.errors;
        if (validationErrors && Array.isArray(validationErrors)) {
          const errorList = validationErrors
            .map((e: any) => `${e.field}: ${e.message}`)
            .join('\n');
          toast.error(message, {
            description: errorList,
            duration: 5000,
          });
        } else {
          toast.error(message, { duration: 4000 });
        }
        break;

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
    shouldRetry: (error: any) => boolean = () => true
  ): Promise<T> {
    let lastError: any;
    
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
        if (error.isAxiosError) {
          return shouldRetryRequest(error as AxiosError);
        }
        return false;
      });
    } catch (error) {
      if (error.isAxiosError) {
        handleApiError(error as AxiosError, options);
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
    if (error.isAxiosError) {
      handleApiError(error as AxiosError, options);
    }
    throw error;
  }
}
