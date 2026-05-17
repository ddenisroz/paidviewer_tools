/**
 * Типы для админ-панели
 */

import { PaginationInfo } from './api';
import { User } from './user';

/**
 * Сессия пользователя (для админ-панели)
 */
export interface UserSession {
    id: string;
    user_id: number;
    session_type: 'active_user';
    created_at?: string;
    expires_at?: string;
    [key: string]: string | number | undefined;
}

/**
 * Интеграция (для админ-панели)
 */
export interface Integration {
    id: number;
    user_id: number;
    platform: 'twitch' | 'vk' | 'youtube';
    connected: boolean;
    username?: string;
    channel_name?: string;
    [key: string]: string | number | boolean | undefined;
}

/**
 * Ответ с пользователями (с пагинацией)
 */
export interface UsersResponse {
    users: User[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        total_users?: number;
    };
}

/**
 * Лог администратора
 */
export interface AdminLog {
    id: number;
    action_type?: string;
    description?: string;
    admin_name?: string;
    target_user_name?: string;
    timestamp?: string;
    status: 'success' | 'failed' | 'warning';
    old_value?: Record<string, unknown>;
    new_value?: Record<string, unknown>;
    details?: Record<string, unknown>;
    error_message?: string;
    user_agent?: string;
    target_resource?: string;
}

/**
 * Статистика логов
 */
export interface LogStats {
    total_logs: number;
    days: number;
    actions_by_type?: string[];
    top_admins?: Array<{
        admin_id: number;
        admin_name: string;
        action_count: number;
    }>;
}

/**
 * Ответ со списком логов
 */
export interface LogsResponse {
    logs: AdminLog[];
    stats?: LogStats;
    pagination?: PaginationInfo;
}

/**
 * Тикет поддержки
 */
/**
 * Ответ на тикет
 */
/**
 * Ответ со списком тикетов
 */
/**
 * Ответ с деталями тикета
 */
