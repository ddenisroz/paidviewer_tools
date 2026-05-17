/**
 * Типы для API responses
 * Используются в JSDoc комментариях и для будущей миграции на TypeScript
 */

import { AxiosResponse } from 'axios';

/**
 * Базовый тип для API ответа
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * Тип для пагинации
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
    offset?: number;
}

/**
 * Тип для пагинированного ответа
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

/**
 * Тип для ошибки API
 * Соответствует backend core/exceptions.py AppException.to_dict()
 */
export interface ApiError {
    error_code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp?: string;
}

/**
 * Коды ошибок API (соответствуют backend core/exceptions.py)
 */
export type ApiErrorCode =
    | 'INTERNAL_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'AUTHORIZATION_ERROR'
    | 'TOKEN_EXPIRED'
    | 'INVALID_TOKEN'
    | 'SESSION_EXPIRED'
    | 'NOT_FOUND'
    | 'ALREADY_EXISTS'
    | 'VALIDATION_ERROR'
    | 'INVALID_INPUT'
    | 'PLATFORM_ERROR'
    | 'PLATFORM_CONNECTION_ERROR'
    | 'PLATFORM_API_ERROR'
    | 'BOT_ERROR'
    | 'BOT_NOT_CONNECTED'
    | 'BOT_ALREADY_CONNECTED'
    | 'TTS_ERROR'
    | 'TTS_SERVICE_UNAVAILABLE'
    | 'TTS_VOICE_NOT_FOUND'
    | 'DATABASE_ERROR'
    | 'DATABASE_CONNECTION_ERROR'
    | 'RATE_LIMIT_EXCEEDED'
    | 'EXTERNAL_SERVICE_ERROR';

/**
 * Тип для Axios response с типизированными данными
 */
export type TypedAxiosResponse<T> = AxiosResponse<ApiResponse<T>>;

/**
 * Информация о пагинации
 */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    pages: number;
    offset?: number;
}

/**
 * Типизированный ответ для админ API
 */
export interface AdminApiResponse<T> extends ApiResponse<T> {
    pagination?: PaginationInfo;
}

/**
 * Заблокированный канал
 */
export interface BlockedChannel {
    id: number;
    channel_name: string;
    platform?: 'twitch' | 'vk';
    reason?: string;
    blocked_at?: string;
}

/**
 * Ответ со списком заблокированных каналов
 */
export interface BlockedChannelsResponse {
    blocked_channels: BlockedChannel[];
}

/**
 * Информация о боте
 */
export interface BotInfo {
    connected: boolean;
    is_ready?: boolean;
    is_running?: boolean;
    channels?: number;
}

/**
 * Ответ со статусом ботов
 */
export interface BotsStatusResponse {
    twitch?: BotInfo;
    vk?: BotInfo;
}

/**
 * Статус TTS сервиса
 */
export interface TtsServiceStatus {
    healthy?: boolean;
    available?: boolean;
    status?: string;
    error?: string;
    url?: string;
}

/**
 * Ответ со статусом ботов и TTS
 */
export interface BotStatusResponse {
    bots?: BotsStatusResponse;
    tts_service?: TtsServiceStatus;
}
