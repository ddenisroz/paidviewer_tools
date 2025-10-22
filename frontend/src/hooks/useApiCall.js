// src/hooks/useApiCall.js
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Универсальный хук для API вызовов
 * @param {Function} apiFunction - Функция API
 * @param {Object} options - Опции
 * @returns {Object} - Состояние и функции
 */
export const useApiCall = (apiFunction, options = {}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const execute = useCallback(async (...args) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await apiFunction(...args);
            setData(result);
            
            if (options.onSuccess) {
                options.onSuccess(result);
            }
            
            return result;
        } catch (err) {
            const errorMessage = err.response?.data?.detail || err.message || 'Произошла ошибка';
            setError(errorMessage);
            
            if (options.showErrorToast !== false) {
                toast.error(errorMessage);
            }
            
            if (options.onError) {
                options.onError(err);
            }
            
            throw err;
        } finally {
            setLoading(false);
        }
    }, [apiFunction, options]);

    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setData(null);
    }, []);

    return {
        loading,
        error,
        data,
        execute,
        reset
    };
};

export default useApiCall;

