/**
 * Типы для YouTube интеграции
 */

/**
 * Настройки YouTube
 */
export interface YoutubeSettings {
  enabled: boolean;
  channel_name?: string;
  obs_url?: string;
  auto_play?: boolean;
  volume?: number;
}

/**
 * Видео в очереди YouTube
 */
export interface YoutubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  added_by?: string;
  added_at?: string;
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
}

