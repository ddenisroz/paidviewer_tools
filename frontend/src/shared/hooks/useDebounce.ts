import { useDebouncedCallback as useDebouncedCallbackLib, useDebounce as useDebounceValue } from 'use-debounce';

export const useDebounce = <T>(value: T, delay: number = 300): T => {
    const [debouncedValue] = useDebounceValue<T>(value, delay);
    return debouncedValue;
};

type DebouncedTools = { cancel: () => void; flush: () => void; isPending: () => boolean };

// Simplified version without complex type constraints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 300
): [T, DebouncedTools] => {
    const debouncedFn = useDebouncedCallbackLib(callback, delay);

    return [
        debouncedFn as unknown as T,
        {
            cancel: debouncedFn.cancel,
            flush: debouncedFn.flush,
            isPending: debouncedFn.isPending,
        },
    ];
};
