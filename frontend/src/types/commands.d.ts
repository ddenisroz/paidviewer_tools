/**
 * Типы для команд чата
 */

/**
 * Команда чата
 */
export interface ChatCommand {
  id: number;
  name: string;
  description?: string;
  response: string;
  enabled: boolean;
  cooldown?: number;
  user_level?: 'everyone' | 'subscriber' | 'moderator' | 'broadcaster';
  platform?: 'twitch' | 'vk' | 'youtube' | 'all';
  channel_name?: string;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Override команды
 */
export interface CommandOverride {
  id: number;
  command_id: number;
  channel_name: string;
  platform: 'twitch' | 'vk' | 'youtube';
  response?: string;
  enabled?: boolean;
  cooldown?: number;
  user_level?: 'everyone' | 'subscriber' | 'moderator' | 'broadcaster';
}

