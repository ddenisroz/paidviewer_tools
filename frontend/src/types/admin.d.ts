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
  session_type: 'active_user' | 'guest';
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
    total_guests?: number;
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
export interface SupportTicket {
  id: number;
  subject: string;
  message: string;
  user_name: string;
  user_email?: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  is_archived?: boolean;
}

/**
 * Ответ на тикет
 */
export interface TicketResponse {
  id: number;
  message: string;
  is_admin_response: boolean;
  created_at: string;
  is_read?: boolean;
}

/**
 * Ответ со списком тикетов
 */
export interface TicketsResponse {
  tickets: SupportTicket[];
  pagination?: PaginationInfo;
}

/**
 * Ответ с деталями тикета
 */
export interface TicketDetailResponse {
  ticket: SupportTicket;
  responses: TicketResponse[];
}

