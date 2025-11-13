/**
 * Типы для админ-панели
 */

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
  [key: string]: any;
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
  [key: string]: any;
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

