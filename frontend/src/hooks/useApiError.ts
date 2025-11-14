import { useCallback } from 'react';
import { AxiosError } from 'axios';
import { handleApiError, ErrorHandlerOptions, ApiError } from '../utils/apiErrorHandler';

/**
 * Hook для обработки ошибок API в компонентах
 * 
 * @example
 * const { handleError } = useApiError();
 * 
 * try {
 *   await api.post('/endpoint', data);
 * } catch (error) {
 *   handleError(error, { customMessage: 'Не удалось сохранить' });
 * }
 */
export function useApiError() {
  const handleError = useCallback((
    error: unknown,
    options?: ErrorHandlerOptions
  ): ApiError | null => {
    if (!error) return null;

    // Проверяем, что это AxiosError
    if ((error as any).isAxiosError) {
      return handleApiError(error as AxiosError, options);
    }

    // Если это не AxiosError, просто логируем
    console.error('[useApiError] Non-Axios error:', error);
    return null;
  }, []);

  return { handleError };
}

/**
 * Hook для выполнения API вызовов с автоматической обработкой ошибок
 * 
 * @example
 * const { execute, isLoading, error } = useApiCall();
 * 
 * const handleSave = async () => {
 *   await execute(
 *     () => api.post('/endpoint', data),
 *     { customMessage: 'Не удалось сохранить' }
 *   );
 * };
 */
export function useApiCall<T = any>() {
  const { handleError } = useApiError();

  const execute = useCallback(async (
    fn: () => Promise<T>,
    options?: ErrorHandlerOptions
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (error) {
      handleError(error, options);
      return null;
    }
  }, [handleError]);

  return { execute };
}
