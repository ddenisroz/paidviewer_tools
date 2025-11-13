import { useCallback } from 'react';
import { toast } from 'sonner';
import { useDebouncedCallback } from './useDebounce';

export const useAutoSave = <T,>(
  saveFn: (payload: T) => void | Promise<void>,
  delay: number = 1000,
  validator: ((payload: T) => string | null) | null = null
): { autoSave: (payload: T) => void; clearAutoSave: () => void } => {
  const [debouncedSave, { cancel }] = useDebouncedCallback(
    (payload: T) => {
      if (validator) {
        const validationError = validator(payload);
        if (validationError) {
          toast.error(validationError);
          return;
        }
      }
      const result = saveFn(payload);
      if (result instanceof Promise) {
        result.catch((err) => {
          // Optional error handling
          toast.error(String(err?.message || 'Ошибка сохранения'));
        });
      }
    },
    delay
  );

  const autoSave = useCallback((payload: T) => {
    debouncedSave(payload);
  }, [debouncedSave]);

  const clearAutoSave = useCallback(() => {
    if (cancel) cancel();
  }, [cancel]);

  return { autoSave, clearAutoSave };
};


