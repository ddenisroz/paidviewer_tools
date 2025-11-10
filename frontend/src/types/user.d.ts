/**
 * Типы для пользователя
 */

/**
 * Пользователь
 */
export interface User {
  id: number;
  username: string;
  email?: string;
  twitch_username?: string;
  vk_username?: string;
  vk_channel_name?: string;
  is_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Настройки пользователя
 */
export interface UserSettings {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  notifications_enabled?: boolean;
  [key: string]: any;
}

/**
 * Сессия пользователя
 */
export interface UserSession {
  user: User;
  expires_at: string;
  token?: string;
}

