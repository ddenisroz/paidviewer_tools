// src/hooks/useButtonPosition.js
import { useCallback } from 'react';

export const useButtonPosition = () => {
    const getButtonPosition = useCallback((event) => {
        if (!event || !event.currentTarget) {
            return null;
        }

        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        
        // Позиционируем уведомление снизу под кнопкой
        return {
            x: rect.left + rect.width / 2, // Центр кнопки по X
            y: rect.bottom + 15 // Под кнопкой с отступом
        };
    }, []);

    return { getButtonPosition };
};
