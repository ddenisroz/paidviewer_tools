/**
 * Modern debounce hooks using use-debounce library
 * Replaces manual implementations with battle-tested library
 */

import { useDebounce as useDebounceValue, useDebouncedCallback as useDebouncedCallbackLib } from 'use-debounce';

/**
 * Custom hook for debouncing values
 * Uses use-debounce library for better performance and reliability
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {any} - Debounced value
 */
export const useDebounce = (value, delay = 300) => {
    const [debouncedValue] = useDebounceValue(value, delay);
    return debouncedValue;
};

/**
 * Custom hook for debouncing functions
 * Uses use-debounce library for better performance and reliability
 * 
 * Note: use-debounce v10 returns [callback, { cancel, flush, isPending }]
 * We ensure it always returns an array for compatibility
 * 
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Array} [debouncedCallback, { cancel, flush, isPending }]
 */
export const useDebouncedCallback = (callback, delay = 300) => {
    const result = useDebouncedCallbackLib(callback, delay);
    // Убеждаемся, что результат - массив
    if (Array.isArray(result)) {
        return result;
    }
    // Если библиотека вернула объект, оборачиваем в массив
    return [result, { cancel: () => {}, flush: () => {}, isPending: false }];
};
