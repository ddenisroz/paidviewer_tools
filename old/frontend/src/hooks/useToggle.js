// src/hooks/useToggle.js
import { useState, useCallback } from 'react';

/**
 * Хук для переключения boolean значений
 * @param {boolean} initialValue - Начальное значение
 * @returns {Array} - [value, toggle, setValue]
 */
export const useToggle = (initialValue = false) => {
    const [value, setValue] = useState(initialValue);

    const toggle = useCallback(() => {
        setValue(prev => !prev);
    }, []);

    return [value, toggle, setValue];
};

export default useToggle;

