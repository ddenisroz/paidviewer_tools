/**
 * Типы для чата
 */

/**
 * Сообщение чата
 */
export interface ChatMessage {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  platform: 'twitch' | 'vk' | 'youtube';
  channel_name?: string;
  badges?: string[];
  emotes?: ChatEmote[];
  color?: string;
  is_action?: boolean;
  is_highlighted?: boolean;
  is_moderator?: boolean;
  is_subscriber?: boolean;
}

/**
 * Эмодзи чата
 */
export interface ChatEmote {
  id: string;
  name: string;
  url: string;
  start: number;
  end: number;
}

/**
 * История чата
 */
export interface ChatHistory {
  messages: ChatMessage[];
  total: number;
  has_more: boolean;
}

/**
 * Статус бота
 */
export interface BotStatus {
  connected: boolean;
  platform?: 'twitch' | 'vk' | 'youtube';
  channel_name?: string;
  connected_at?: string;
}

/**
 * Заглушенный пользователь
 */
export interface MutedUser {
  id: number;
  username: string;
  platform: 'twitch' | 'vk' | 'youtube';
  channel_name?: string;
  muted_until?: string;
  reason?: string;
}

