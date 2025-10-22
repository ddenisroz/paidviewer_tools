// src/hooks/useAsync.js
import { useState, useEffect, useCallback } from 'react';

/**
 * Хук для асинхронных операций
 * @param {Function} asyncFunction - Асинхронная функция
 * @param {Array} dependencies - Зависимости
 * @param {boolean} immediate - Выполнить сразу
 * @returns {Object} - Состояние и функции
 */
export const useAsync = (asyncFunction, dependencies = [], immediate = true) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const execute = useCallback(async (...args) => {
        try {
            setLoading(true);
            setError(null);
            const result = await asyncFunction(...args);
            setData(result);
            return result;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [asyncFunction]);

    useEffect(() => {
        if (immediate) {
            execute();
        }
    }, dependencies);

    return {
        loading,
        data,
        error,
        execute,
        reset: () => {
            setLoading(false);
            setData(null);
            setError(null);
        }
    };
};

export default useAsync;

