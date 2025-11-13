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
 * Alias для совместимости
 */
export type YouTubeSettings = YoutubeSettings;

/**
 * Видео в очереди YouTube
 */
export interface YoutubeVideo {
  id: string;
  video_id?: string; // Alias для id
  title: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  added_by?: string;
  requester_name?: string; // Alias для added_by
  user_id?: number;
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

/**
 * Элемент очереди YouTube (alias для совместимости)
 */
export type YouTubeQueueItem = YoutubeVideo;

