/**
 * Типы для чата
 */

/**
 * Сообщение чата
 */
export interface ChatMessage {
    id: string;
    author: string;
    author_name?: string; // Альтернативное имя автора
    avatar_url?: string; // URL аватара пользователя
    content?: string;
    message?: string; // Альтернативное поле для содержимого
    timestamp: string;
    platform: 'twitch' | 'vk' | 'youtube';
    channel_name?: string;
    channel?: string; // Альтернативное поле для канала
    badges?: string[]; // Twitch: badgeId/version, VK: badge image URLs
    emotes?: ChatEmote[];
    role?: string;
    color?: string;
    author_color?: string; // Альтернативное поле для цвета
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

/**
 * Настройки ChatBox для OBS overlay
 */
export interface ChatBoxSettings {
    message_background_mode?: 'message' | 'column' | 'none';
    font_size?: number;
    font_family?: string;
    font_weight?: string;
    text_color?: string;
    username_color?: string;
    text_stroke_width?: number;
    text_stroke_color?: string;
    background_color?: string;
    background_opacity?: number;
    chat_width?: number;
    max_messages?: number;
    message_spacing?: number;
    animation_type?: 'fade' | 'slide' | 'slide-right' | 'slide-left' | 'scale' | 'bounce' | 'none';
    animation_duration?: number;
    chat_direction?: 'vertical' | 'horizontal';
    message_fade_seconds?: number;
    border_radius?: number;
    show_platform_icons?: boolean;
    show_badges?: boolean;
    show_7tv_emotes?: boolean;
    show_links?: boolean;
    auto_load_images?: boolean;
    separate_message_backgrounds?: boolean;
    widget_url?: string;
    version?: number;
    channel_name?: string;
    user_id?: number;
    twitch_user_id?: string;
    avatar_url?: string;
    [key: string]: string | number | boolean | undefined;
}

/**
 * Контекстное меню
 */
export interface ContextMenu {
    x: number;
    y: number;
    username: string;
    platform: 'twitch' | 'vk' | 'youtube';
}

/**
 * WebSocket сообщение
 */
export interface WebSocketMessage {
    type: string;
    id?: string;
    timestamp?: number;
    author?: string;
    author_name?: string;
    message?: string;
    platform?: 'twitch' | 'vk' | 'youtube';
    channel?: string;
    channel_name?: string;
    badges?: string[];
    emotes?: ChatEmote[];
    role?: string;
    messages?: ChatMessage[];
    data?: Record<string, unknown>;
    cache_key?: string;
    [key: string]: string | number | ChatMessage[] | Record<string, unknown> | undefined;
}
