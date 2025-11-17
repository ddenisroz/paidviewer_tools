import { useRef, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Хук для автосохранения с дебаунсом
 * @param {Function} saveFn - Функция сохранения
 * @param {number} delay - Задержка в миллисекундах (по умолчанию 1000)
 * @param {Function} validator - Опциональная функция валидации
 * @returns {Function} Функция автосохранения
 */
export const useAutoSave = (saveFn, delay = 1000, validator = null) => {
  const timeoutRef = useRef(null);

  const autoSave = useCallback((payload) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (validator) {
        const validationError = validator(payload);
        if (validationError) {
          toast.error(validationError);
          return;
        }
      }
      saveFn(payload);
    }, delay);
  }, [saveFn, delay, validator]);

  const clearAutoSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { autoSave, clearAutoSave };
};

