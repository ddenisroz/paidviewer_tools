/**
 * Улучшенный хук для работы с API
 * Обеспечивает типизацию, обработку ошибок и автоматическую очистку
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_BOT_SERVICE_URL || 'http://localhost:8000';

/**
 * @typedef {Object} ApiState
 * @property {any} data - Данные ответа
 * @property {boolean} loading - Идет ли загрузка
 * @property {Error|null} error - Ошибка если есть
 */

/**
 * Хук для выполнения API запросов с автоматической обработкой состояния
 * 
 * @param {string} endpoint - API endpoint (относительный путь)
 * @param {Object} options - Опции запроса
 * @param {boolean} options.immediate - Выполнить запрос сразу
 * @param {string} options.method - HTTP метод (GET, POST, etc.)
 * @param {Function} options.onSuccess - Callback при успехе
 * @param {Function} options.onError - Callback при ошибке
 * @param {boolean} options.showSuccessToast - Показать toast при успехе
 * @param {boolean} options.showErrorToast - Показать toast при ошибке
 * @returns {Object} Состояние и функции для работы с API
 */
export function useApi(endpoint, options = {}) {
  const {
    immediate = false,
    method = 'GET',
    onSuccess,
    onError,
    showSuccessToast = false,
    showErrorToast = true
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Cleanup при unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (requestData = null, customOptions = {}) => {
    // Отменяем предыдущий запрос если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const requestOptions = {
        method: customOptions.method || method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...customOptions.headers
        },
        signal: abortControllerRef.current.signal
      };

      if (requestData && (requestOptions.method !== 'GET')) {
        requestOptions.body = JSON.stringify(requestData);
      }

      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          errorData.detail || 
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const responseData = await response.json();
      setData(responseData);

      if (showSuccessToast) {
        toast.success(responseData.message || 'Операция выполнена успешно');
      }

      if (onSuccess) {
        onSuccess(responseData);
      }

      return responseData;
    } catch (err) {
      // Игнорируем ошибки отмены
      if (err.name === 'AbortError') {
        return null;
      }

      setError(err);

      if (showErrorToast) {
        toast.error(err.message || 'Произошла ошибка');
      }

      if (onError) {
        onError(err);
      }

      throw err;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [endpoint, method, onSuccess, onError, showSuccessToast, showErrorToast]);

  // Автоматический запрос при монтировании
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    execute,
    refetch: () => execute()
  };
}

/**
 * Хук для пагинированных запросов
 * 
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Опции
 * @returns {Object} Состояние и функции пагинации
 */
export function usePaginatedApi(endpoint, options = {}) {
  const { itemsPerPage = 20, ...restOptions } = options;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [allData, setAllData] = useState([]);

  const api = useApi(`${endpoint}?page=${page}&limit=${itemsPerPage}`, {
    ...restOptions,
    onSuccess: (response) => {
      if (Array.isArray(response.data)) {
        setAllData(prev => page === 1 ? response.data : [...prev, ...response.data]);
        setHasMore(response.data.length === itemsPerPage);
      } else {
        setAllData(prev => page === 1 ? [response] : [...prev, response]);
        setHasMore(false);
      }
      
      if (restOptions.onSuccess) {
        restOptions.onSuccess(response);
      }
    }
  });

  const loadMore = useCallback(() => {
    if (!api.loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [api.loading, hasMore]);

  const reset = useCallback(() => {
    setPage(1);
    setAllData([]);
    setHasMore(true);
  }, []);

  return {
    data: allData,
    loading: api.loading,
    error: api.error,
    hasMore,
    loadMore,
    reset,
    refetch: () => {
      reset();
      api.execute();
    }
  };
}

/**
 * Хук для оптимистичных обновлений
 * 
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Опции
 * @returns {Object} Состояние и функции
 */
export function useOptimisticApi(endpoint, options = {}) {
  const [optimisticData, setOptimisticData] = useState(null);
  const api = useApi(endpoint, options);

  const executeWithOptimisticUpdate = useCallback(async (requestData, optimisticValue) => {
    // Сразу обновляем UI
    setOptimisticData(optimisticValue);

    try {
      const result = await api.execute(requestData);
      setOptimisticData(null); // Очищаем оптимистичное значение
      return result;
    } catch (err) {
      // При ошибке откатываем оптимистичное обновление
      setOptimisticData(null);
      throw err;
    }
  }, [api]);

  return {
    ...api,
    data: optimisticData !== null ? optimisticData : api.data,
    executeWithOptimisticUpdate
  };
}

export default useApi;

