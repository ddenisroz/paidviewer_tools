import { useCallback } from 'react';
import { toast } from 'sonner';
import { useDebouncedCallback } from './useDebounce';

/**
 * Хук для автосохранения с дебаунсом
 * Использует библиотеку use-debounce для надежности
 * @param {Function} saveFn - Функция сохранения
 * @param {number} delay - Задержка в миллисекундах (по умолчанию 1000)
 * @param {Function} validator - Опциональная функция валидации
 * @returns {Object} { autoSave, clearAutoSave } - Функции автосохранения
 */
export const useAutoSave = (saveFn, delay = 1000, validator = null) => {
  // useDebouncedCallback возвращает [callback, { cancel, flush, isPending }]
  // Используем только callback для совместимости
  const [debouncedSave, { cancel }] = useDebouncedCallback(
    (payload) => {
      if (validator) {
        const validationError = validator(payload);
        if (validationError) {
          toast.error(validationError);
          return;
        }
      }
      saveFn(payload);
    },
    delay
  );

  const autoSave = useCallback((payload) => {
    debouncedSave(payload);
  }, [debouncedSave]);

  // use-debounce автоматически очищает таймеры при размонтировании
  const clearAutoSave = useCallback(() => {
    // Явная очистка через cancel из библиотеки
    if (cancel) {
      cancel();
    }
  }, [cancel]);

  return { autoSave, clearAutoSave };
};

