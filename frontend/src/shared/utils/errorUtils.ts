/**
 * Error Utilities - Типизация и обработка ошибок
 *
 * Решает проблему с типом 'unknown' в catch блоках
 * Соответствует backend core/exceptions.py AppException.to_dict()
 */

import { ErrorInfo } from 'react';

import { ApiErrorCode, ApiError as ApiErrorType } from '@/types/api';

// Типы ошибок
export interface AxiosApiError {
    response?: {
        data?:
            | ApiErrorType
            | {
                  detail?: string;
                  message?: string;
              };
        status?: number;
    };
    message?: string;
}

export interface ErrorWithMessage {
    message: string;
}

// Type guards

/**
 * Проверяет, является ли ошибка стандартной ApiError из backend
 * Соответствует backend core/exceptions.py AppException.to_dict()
 */
export function isApiError(error: unknown): error is ApiErrorType {
    return (
        typeof error === 'object' &&
        error !== null &&
        'error_code' in error &&
        'message' in error &&
        typeof (error as ApiErrorType).error_code === 'string' &&
        typeof (error as ApiErrorType).message === 'string'
    );
}

/**
 * Проверяет, является ли ошибка Axios ошибкой с response
 */
export function isAxiosApiError(error: unknown): error is AxiosApiError {
    return typeof error === 'object' && error !== null && 'response' in error;
}

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as ErrorWithMessage).message === 'string'
    );
}

// Утилиты для извлечения сообщений об ошибках

/**
 * Безопасное извлечение сообщения ошибки из любого типа ошибки
 * Поддерживает:
 * - ApiError (backend format)
 * - Axios errors
 * - Error objects
 * - String errors
 */
export function getErrorMessage(error: unknown): string {
    // Backend ApiError format
    if (isApiError(error)) {
        return error.message;
    }

    // Axios error with ApiError in response
    if (isAxiosApiError(error)) {
        const responseData = error.response?.data;

        // Check if response.data is ApiError
        if (responseData && isApiError(responseData)) {
            return responseData.message;
        }

        // Fallback to detail or message fields
        if (responseData && typeof responseData === 'object') {
            const data = responseData as { detail?: string; message?: string };
            return data.detail || data.message || error.message || 'Произошла ошибка';
        }

        return error.message || 'Произошла ошибка';
    }

    // Error with message - but not empty message
    if (isErrorWithMessage(error)) {
        return error.message.length > 0 ? error.message : 'Произошла неизвестная ошибка';
    }

    // String error - but not empty string
    if (typeof error === 'string') {
        return error.length > 0 ? error : 'Произошла неизвестная ошибка';
    }

    return 'Произошла неизвестная ошибка';
}

/**
 * Извлекает код ошибки из ApiError
 */
export function getErrorCode(error: unknown): ApiErrorCode | undefined {
    if (isApiError(error)) {
        return error.error_code as ApiErrorCode;
    }

    if (isAxiosApiError(error)) {
        const responseData = error.response?.data;
        if (responseData && isApiError(responseData)) {
            return responseData.error_code as ApiErrorCode;
        }
    }

    return undefined;
}

/**
 * Извлекает HTTP статус из ошибки
 */
export function getErrorStatus(error: unknown): number | undefined {
    if (isAxiosApiError(error)) {
        return error.response?.status;
    }
    return undefined;
}

/**
 * Извлекает детали ошибки из ApiError
 */
export function getErrorDetails(error: unknown): Record<string, unknown> | undefined {
    if (isApiError(error)) {
        return error.details;
    }

    if (isAxiosApiError(error)) {
        const responseData = error.response?.data;
        if (responseData && isApiError(responseData)) {
            return responseData.details;
        }
    }

    return undefined;
}

/**
 * Получает понятное сообщение на основе HTTP статуса
 */
export function getStatusMessage(status: number): string {
    const messages: Record<number, string> = {
        400: 'Проверьте, что все поля заполнены правильно.',
        401: 'Вы не авторизованы. Перезагрузите страницу.',
        403: 'У вас нет доступа к этой функции.',
        404: 'Элемент не найден или был удален.',
        409: 'Данные обновлены. Перезагружаю...',
        422: 'Формат данных неправильный.',
        500: 'На сервере произошла ошибка. Свяжитесь с поддержкой.',
        502: 'Сервер временно недоступен.',
        503: 'Сервис на обслуживании. Попробуйте позже.',
        504: 'Сервер не отвечает. Попробуйте позже.',
    };
    return messages[status] || 'Попробуйте еще раз.';
}

/**
 * Получает сообщение для конкретной операции
 */
export function getOperationMessage(operation: string, error: unknown): string {
    const operationMessages: Record<string, Record<string, string>> = {
        save_settings: {
            default: 'Ошибка при сохранении настроек.',
            '409': 'Настройки были изменены. Перезагружаю...',
        },
        delete_item: { default: 'Ошибка при удалении.', '404': 'Элемент уже был удален.' },
        create_item: { default: 'Ошибка при создании.', '400': 'Проверьте данные и попробуйте снова.' },
        upload_file: { default: 'Ошибка при загрузке файла.', '413': 'Файл слишком большой. Максимум 50 МБ.' },
        login: { default: 'Ошибка входа.', '401': 'Неверные учетные данные.' },
    };
    const opMessages = operationMessages[operation];
    if (!opMessages) {
        return getErrorMessage(error);
    }

    const status = getErrorStatus(error);
    const key = status ? String(status) : 'default';
    return opMessages[key] || opMessages.default;
}

/**
 * Обработка ошибок в Error Boundary
 * Логирует ошибку и отправляет в систему мониторинга
 */
export function handleBoundaryError(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    if (import.meta.env.DEV) {
        console.error('Error Boundary caught:', error);
        console.error('Component stack:', errorInfo.componentStack);
    }

    // TODO: Send to Sentry or other monitoring service
    // This would be implemented when error monitoring is set up
}

// Утилита для безопасного доступа к свойствам объекта
export function hasProperty<T extends object, K extends PropertyKey>(obj: T, key: K): obj is T & Record<K, unknown> {
    return key in obj;
}

// Утилита для проверки наличия data в response
export function hasData<T>(response: unknown): response is { data: T } {
    return typeof response === 'object' && response !== null && 'data' in response;
}

// Утилита для безопасного приведения типов
export function assertType<T>(value: unknown, validator: (v: unknown) => v is T): T {
    if (!validator(value)) {
        throw new Error('Type assertion failed');
    }
    return value;
}

// Пример валидаторов
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number';
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}
