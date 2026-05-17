/**
 * Утилиты для валидации никнеймов
 */

import * as React from 'react';

import { apiClient } from '@/services/api/client';
import { logger } from '@/shared/utils/prodLogger';

// Для использования в не-React контексте

/**
 * Правила валидации никнейма
 */
export const USERNAME_RULES = {
    minLength: 3,
    maxLength: 25,
    pattern: /^[a-zA-Z0-9_]+$/,
    reservedNames: ['admin', 'root', 'system', 'bot', 'moderator', 'mod'],
};

/**
 * Проверка формата никнейма (локальная валидация)
 */
export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
    if (!username || username.trim().length === 0) {
        return { valid: false, error: 'Никнейм не может быть пустым' };
    }

    const trimmed = username.trim();

    if (trimmed.length < USERNAME_RULES.minLength) {
        return { valid: false, error: `Никнейм должен содержать минимум ${USERNAME_RULES.minLength} символа` };
    }

    if (trimmed.length > USERNAME_RULES.maxLength) {
        return { valid: false, error: `Никнейм не может быть длиннее ${USERNAME_RULES.maxLength} символов` };
    }

    if (!USERNAME_RULES.pattern.test(trimmed)) {
        return { valid: false, error: 'Никнейм может содержать только латинские буквы, цифры и подчеркивание' };
    }

    if (USERNAME_RULES.reservedNames.includes(trimmed.toLowerCase())) {
        return { valid: false, error: 'Этот никнейм зарезервирован системой' };
    }

    return { valid: true };
}

/**
 * Проверка доступности никнейма на сервере
 */
export async function checkUsernameAvailability(username: string): Promise<{ available: boolean; error?: string }> {
    try {
        // Сначала проверяем формат
        const formatCheck = validateUsernameFormat(username);
        if (!formatCheck.valid) {
            return { available: false, error: formatCheck.error };
        }

        // Проверяем на сервере
        const response = await apiClient.get('/api/auth/check-username', {
            params: { username: username.trim() },
        });

        const data = response.data;

        if (data.available === false) {
            return { available: false, error: 'Этот никнейм уже занят' };
        }

        return { available: true };
    } catch (error: unknown) {
        logger.error('Error checking username availability:', error);

        const axiosError = error as { response?: { status?: number } };
        // Если endpoint не существует, возвращаем true (backward compatibility)
        if (axiosError.response?.status === 404) {
            logger.warn('Username check endpoint not found, skipping check');
            return { available: true };
        }

        return { available: false, error: 'Ошибка проверки никнейма. Попробуйте позже' };
    }
}

/**
 * Debounced проверка никнейма (для использования в формах)
 */
let usernameCheckTimeout: NodeJS.Timeout | null = null;

export function debouncedUsernameCheck(
    username: string,
    callback: (result: { available: boolean; error?: string }) => void,
    delay: number = 500
): void {
    if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
    }

    usernameCheckTimeout = setTimeout(async () => {
        const result = await checkUsernameAvailability(username);
        callback(result);
    }, delay);
}

/**
 * Очистка debounce таймера
 */
export function cancelUsernameCheck(): void {
    if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
        usernameCheckTimeout = null;
    }
}

/**
 * React hook для проверки никнейма
 */
export function useUsernameValidation() {
    const [username, setUsername] = React.useState('');
    const [checking, setChecking] = React.useState(false);
    const [error, setError] = React.useState<string | undefined>();
    const [available, setAvailable] = React.useState<boolean | undefined>();

    React.useEffect(() => {
        if (!username || username.trim().length === 0) {
            setError(undefined);
            setAvailable(undefined);
            setChecking(false);
            return;
        }

        // Локальная валидация
        const formatCheck = validateUsernameFormat(username);
        if (!formatCheck.valid) {
            setError(formatCheck.error);
            setAvailable(false);
            setChecking(false);
            return;
        }

        // Проверка на сервере с debounce
        setChecking(true);
        setError(undefined);

        debouncedUsernameCheck(username, (result) => {
            setAvailable(result.available);
            setError(result.error);
            setChecking(false);
        });

        return () => {
            cancelUsernameCheck();
        };
    }, [username]);

    return {
        username,
        setUsername,
        checking,
        error,
        available,
        isValid: available === true && !error,
    };
}
