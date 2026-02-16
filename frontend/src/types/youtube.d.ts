/**
 * Типы для YouTube интеграции
 */

/**
 * Настройки YouTube (соответствует backend youtube_settings_api.py)
 */
export interface YoutubeSettings {
  playback_mode: 'browser' | 'obs';
  volume_level: number; // 0-100
  requests_command_enabled?: boolean;
  // Legacy single-platform reward settings
  requests_reward_enabled?: boolean;
  requests_reward_id?: string | null;
  requests_reward_platform?: 'twitch' | 'vk';
  // Per-platform reward settings
  requests_reward_twitch_enabled?: boolean;
  requests_reward_twitch_id?: string | null;
  requests_reward_vk_enabled?: boolean;
  requests_reward_vk_id?: string | null;
}

/**
 * Alias для совместимости
 */
export type YouTubeSettings = YoutubeSettings;

/**
 * Response для OBS URL
 */
export interface YoutubeObsUrlResponse {
  obs_token: string | null;
  has_token: boolean;
  youtube_obs_url?: string;
}

/**
 * Видео в очереди YouTube (соответствует backend queue_service.py)
 */
export interface YoutubeVideo {
  id: number; // Queue item ID
  video_id: string; // YouTube video ID
  title: string;
  duration: string; // Formatted duration (e.g., "3:45")
  thumbnail_url: string;
  url: string;
  channel_name: string;
  platform: string;
  requester_name: string;
  position: number;
  is_paid: boolean;
  points_cost: number | null;
  added_at: string | null;
  played_at: string | null;
  // Deprecated aliases for backward compatibility
  thumbnail?: string;
  added_by?: string;
  user_id?: number;
  is_playing?: boolean;
  is_played?: boolean;
}

/**
 * Очередь YouTube
 */
export interface YoutubeQueue {
  queue: YoutubeVideo[];
  current_video?: YoutubeVideo;
  is_playing: boolean;
  skip_votes?: {
    current: number;
    required: number;
    video_id?: number | string | null;
  };
}

/**
 * Элемент очереди YouTube (alias для совместимости)
 */
export type YouTubeQueueItem = YoutubeVideo;


/**
 * YouTube Player API types
 */
export interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoUrl: () => string;
  getVideoEmbedCode: () => string;
}

export interface YouTubeEvent<T> {
  target: YouTubePlayer;
  data: T;
}
