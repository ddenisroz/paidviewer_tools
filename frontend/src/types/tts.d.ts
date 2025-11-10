/**
 * Типы для TTS (Text-to-Speech)
 */

/**
 * Статус TTS
 */
export interface TtsStatus {
  enabled: boolean;
  channel_name?: string;
  platform?: 'twitch' | 'vk' | 'youtube';
  is_playing?: boolean;
  current_voice?: string;
}

/**
 * Настройки TTS
 */
export interface TtsSettings {
  enabled: boolean;
  volume?: number;
  speed?: number;
  pitch?: number;
  voice_id?: number;
  platform_settings?: {
    twitch?: TtsPlatformSettings;
    vk?: TtsPlatformSettings;
    youtube?: TtsPlatformSettings;
  };
}

/**
 * Настройки платформы для TTS
 */
export interface TtsPlatformSettings {
  enabled: boolean;
  volume?: number;
  speed?: number;
  pitch?: number;
}

/**
 * Голос TTS
 */
export interface TtsVoice {
  id: number;
  name: string;
  description?: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
  quality?: 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';
  is_global?: boolean;
  user_id?: number;
  created_at?: string;
}

/**
 * Фильтрованное слово
 */
export interface FilteredWord {
  id: number;
  word: string;
  channel_name?: string;
  created_at?: string;
}

/**
 * Заблокированный пользователь
 */
export interface BlockedUser {
  id: number;
  username: string;
  platform: 'twitch' | 'vk' | 'youtube';
  channel_name?: string;
  reason?: string;
  created_at?: string;
}

/**
 * Локальная конфигурация TTS
 */
export interface LocalTtsConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  api_key?: string;
  test_connection?: boolean;
}

