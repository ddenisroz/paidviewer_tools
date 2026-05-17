import { useCallback } from 'react';

type Position = { x: number; y: number } | null;

export const useButtonPosition = () => {
    const getButtonPosition = useCallback(
        (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> | unknown): Position => {
            const evt = event as { currentTarget?: HTMLElement };
            const target = evt?.currentTarget ?? null;
            if (!target) return null;
            const rect = target.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.bottom + 15 };
        },
        []
    );
    return { getButtonPosition };
};
