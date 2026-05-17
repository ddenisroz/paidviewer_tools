import { useCallback, useRef } from 'react';

import { toast } from 'sonner';

import { useDebouncedCallback } from './useDebounce';

const normalizePayload = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((item) => normalizePayload(item));
    }

    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = normalizePayload((value as Record<string, unknown>)[key]);
                return acc;
            }, {});
    }

    return value;
};

const getPayloadSignature = (value: unknown): string => JSON.stringify(normalizePayload(value));

export const useAutoSave = <T>(
    saveFn: (payload: T) => void | Promise<void>,
    delay: number = 1000,
    validator: ((payload: T) => string | null) | null = null
): { autoSave: (payload: T) => void; clearAutoSave: () => void } => {
    const pendingSignatureRef = useRef<string | null>(null);

    const [debouncedSave, tools] = useDebouncedCallback((request: { payload: T; signature: string }) => {
        pendingSignatureRef.current = null;

        const { payload } = request;
        if (validator) {
            const validationError = validator(payload);
            if (validationError) {
                toast.error(validationError);
                return;
            }
        }
        const result = saveFn(payload);
        if (result instanceof Promise) {
            result.catch((err: Error) => {
                // Optional error handling
                toast.error(String(err?.message || 'Ошибка сохранения'));
            });
        }
    }, delay);

    const autoSave = useCallback(
        (payload: T) => {
            const signature = getPayloadSignature(payload);
            if (pendingSignatureRef.current === signature) {
                return;
            }

            pendingSignatureRef.current = signature;
            debouncedSave({ payload, signature });
        },
        [debouncedSave]
    );

    const clearAutoSave = useCallback(() => {
        pendingSignatureRef.current = null;
        tools.cancel();
    }, [tools]);

    return { autoSave, clearAutoSave };
};
