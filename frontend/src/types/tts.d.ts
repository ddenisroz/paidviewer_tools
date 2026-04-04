/**
 * Типы для TTS (Text-to-Speech).
 */

/**
 * Статус TTS.
 */
export interface TtsModeContract {
  provider?: 'f5' | 'gcloud' | 'qwen';
  mode?: 'cloud' | 'local';
  official_mode?: 'cloud' | 'self_host';
  available?: boolean;
  healthy?: boolean;
  status?: string;
  degraded_reason?: string | null;
  slot_allowed?: boolean;
  recommended_path?: string | null;
  official_path?: string | null;
  error_code?: string | null;
  capabilities?: Record<string, unknown>;
}

export interface TtsStatus {
  enabled: boolean;
  channel_name?: string;
  platform?: 'twitch' | 'vk' | 'youtube';
  is_playing?: boolean;
  current_voice?: string;
  engine_type?: 'gtts' | 'gcloud' | 'f5_cloud' | 'f5_local' | 'qwen_cloud' | 'qwen_local' | 'local' | 'cloud';
  advanced_provider?: 'f5' | 'gcloud' | 'qwen';
  f5_mode?: 'cloud' | 'local';
  qwen_mode?: 'cloud' | 'local';
  has_local_setup?: boolean;
  has_local_setup_f5?: boolean;
  has_local_setup_qwen?: boolean;
  has_local_endpoint_f5?: boolean;
  has_local_endpoint_qwen?: boolean;
  is_whitelisted?: boolean;
  official_mode?: 'cloud' | 'self_host';
  official_modes?: Array<'cloud' | 'self_host'>;
  recommended_path?: string;
  active_contract?: TtsModeContract;
  provider_matrix?: Record<string, Record<string, TtsModeContract>>;
  capabilities?: Record<string, unknown>;
  active_self_host_path?: 'tts_worker_agent' | 'raw_endpoint_compat' | null;
  legacy_mode_alias?: 'cloud' | 'local';
}

/**
 * Настройки TTS.
 */
export interface TtsSettings {
  enabled: boolean;
  volume?: number;
  speed?: number;
  pitch?: number;
  voiceId?: number;
  enable7TV?: boolean;
  enableTwitch?: boolean;
  filterReplies?: boolean;
  filterMentions?: boolean;
  version?: number;
  platformSettings?: {
    twitch?: TtsPlatformSettings;
    vk?: TtsPlatformSettings;
    youtube?: TtsPlatformSettings;
  };
  // Backend specific fields that might match now
  enableLexiconFilter?: boolean;
  enableCustomLexicon?: boolean;
  engine?: string;
  voice?: string;
  listeningMode?: string;
  maxMessageLength?: number;
  skipCommands?: boolean;
  useLocalTTS?: boolean;
  advancedProvider?: 'f5' | 'gcloud' | 'qwen';
  f5Mode?: 'cloud' | 'local';
  qwenMode?: 'cloud' | 'local';
  gcloudVoices?: string[];
  gcloudMood?: 'neutral' | 'sad' | 'happy';
  gcloud_mood?: 'neutral' | 'sad' | 'happy';
  qwenVoice?: string;
  qwenModel?: string;
}

/**
 * Настройки платформы для TTS.
 */
export interface TtsPlatformSettings {
  enabled: boolean;
  volume?: number;
  speed?: number;
  pitch?: number;
}

/**
 * Голос TTS.
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
  voice_type?: 'global' | 'user';
  owner_id?: number;
  cfg_strength?: number;
  speed_preset?: 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
  reference_text?: string;
  samples_count?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Отфильтрованное слово.
 */
export interface FilteredWord {
  id: number;
  word: string;
  channel_name?: string;
  created_at?: string;
}

/**
 * Заблокированный пользователь.
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
 * Локальная конфигурация TTS.
 */
export interface LocalTtsConfig {
  enabled: boolean;
  provider?: 'f5' | 'qwen';
  use_local?: boolean;
  official_mode?: 'self_host';
  recommended_path?: string;
  capabilities?: Record<string, unknown>;
  host?: string;
  port?: number;
  endpoint_url?: string;
  api_key?: string;
  api_key_redacted?: string;
  has_api_key?: boolean;
  test_connection?: boolean;
  configured?: boolean;
  healthy?: boolean;
  provider_contract?: {
    upstream_parity_ready?: boolean;
    requires_compatibility_adapter?: boolean;
    managed_topology?: 'project_hosted_worker' | 'gateway_managed';
    project_hosted_direct_supported?: boolean;
    supports_native_strict_api_key?: boolean;
    supports_native_health_endpoint?: boolean;
    supports_native_status_endpoint?: boolean;
    supports_local_voice_management?: boolean;
    official_modes?: Array<'cloud' | 'self_host'>;
    official_cloud_path?: string | null;
    official_self_host_path?: string | null;
    legacy_raw_endpoint_supported?: boolean;
    warning?: string | null;
  };
  warnings?: string[];
  diagnosis?: {
    code?: string;
    mode?: 'self_host';
    connection_kind?: string;
    endpoint_url?: string;
    has_api_key?: boolean;
  };
  data?: {
    configured?: boolean;
    healthy?: boolean;
  };
}

/**
 * Режим TTS: все сообщения или только за баллы канала.
 */
export type TtsTriggerMode = 'all_messages' | 'channel_points';

/**
 * Настройки режима TTS.
 */
export interface TtsModeSettings {
  tts_mode?: TtsTriggerMode;
  tts_reward_ids?: TtsRewardIds;
}

/**
 * ID TTS-наград по платформам.
 */
export interface TtsRewardIds {
  twitch?: string;
  vk?: string;
  [platform: string]: string | undefined;
}

/**
 * Ответ с настройками режима TTS.
 */
export interface TtsModeSettingsResponse {
  success: boolean;
  data?: TtsModeSettings;
}

/**
 * Данные для создания TTS-награды.
 */
export interface CreateTtsRewardData {
  platform: string;
  title: string;
  cost: number;
  cooldown: number;
}

/**
 * Ответ при создании TTS-награды.
 */
export interface CreateTtsRewardResponse {
  success: boolean;
  data?: {
    reward_id?: string;
    message?: string;
  };
}

/**
 * Ответ при удалении TTS-награды.
 */
export interface DeleteTtsRewardResponse {
  success: boolean;
  message?: string;
}

/**
 * Статус whitelist пользователя.
 */
export interface WhitelistStatus {
  is_whitelisted: boolean;
  data?: {
    is_whitelisted?: boolean;
  };
}
