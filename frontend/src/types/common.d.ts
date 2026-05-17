/**
 * Общие типы для всего приложения
 */

/**
 * Обработчик сообщений
 */
export type MessageHandler<T = unknown> = (data?: T) => void;

/**
 * Обработчик событий
 */
export type EventHandler<T = Event> = (event: T) => void;

/**
 * Обработчик ошибок
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Обработчик изменений
 */
export type ChangeHandler<T = unknown> = (value: T) => void;

/**
 * Обработчик WebSocket сообщений
 */
export type WebSocketHandler = (data: Record<string, unknown>) => void;

/**
 * Обработчик статуса подключения
 */
export type ConnectionStatusHandler = (status: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;

/**
 * Функция валидации
 */
export type Validator<T = unknown> = (value: T, ...args: unknown[]) => string | null;

/**
 * Конфигурация cookie
 */
export interface CookieOptions {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Результат проверки доступности
 */
export interface AvailabilityResult {
    available: boolean;
    message?: string;
}

/**
 * Базовый тип для конфигурации
 */
export type BaseConfig = Record<string, string | number | boolean | null | undefined>;

/**
 * Тип для JSON значений
 */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
    [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];
