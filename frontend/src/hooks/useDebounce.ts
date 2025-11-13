import { useDebounce as useDebounceValue, useDebouncedCallback as useDebouncedCallbackLib } from 'use-debounce';

export const useDebounce = <T,>(value: T, delay: number = 300): T => {
  const [debouncedValue] = useDebounceValue<T>(value, delay);
  return debouncedValue;
};

type DebouncedTools = { cancel: () => void; flush: () => void; isPending: boolean };

export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): [T, DebouncedTools] => {
  const result = useDebouncedCallbackLib(callback, delay) as any;
  if (Array.isArray(result)) {
    return result as [T, DebouncedTools];
  }
  return [result as T, { cancel: () => {}, flush: () => {}, isPending: false }];
};


