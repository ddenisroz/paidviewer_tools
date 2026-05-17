/**
 * Типы для пользователя
 */

/**
 * Интеграции пользователя
 */
export interface UserIntegrations {
    twitch?: {
        connected: boolean;
        username?: string;
        channel_name?: string;
    };
    vk?: {
        connected: boolean;
        username?: string;
        channel_name?: string;
    };
    youtube?: {
        connected: boolean;
        channel_id?: string;
    };
    donationalerts?: {
        connected: boolean;
        user_id?: number;
    };
    [key: string]:
        | { connected: boolean; username?: string; channel_name?: string; channel_id?: string; user_id?: number }
        | undefined;
}

/**
 * Пользователь
 */
export interface User {
    id: number;
    username: string;
    email?: string;
    role?: 'admin' | 'user' | string;
    twitch_username?: string;
    vk_username?: string;
    vk_channel_name?: string;
    is_admin?: boolean;
    is_blocked?: boolean;
    is_whitelisted?: boolean;
    platform?: 'twitch' | 'vk' | 'youtube';
    integrations?: UserIntegrations;
    created_at?: string;
    updated_at?: string;
    total_integrations?: number;
    whitelisted_platforms?: ('twitch' | 'vk')[];
    whitelisted_channels?: {
        twitch?: string;
        vk?: string;
    };
    [key: string]:
        | string
        | number
        | boolean
        | string[]
        | UserIntegrations
        | { twitch?: string; vk?: string }
        | undefined;
}

/**
 * Настройки пользователя
 */
export interface UserSettings {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    notifications_enabled?: boolean;
    chat_enabled?: boolean;
    chat_max_messages?: number;
    chat_show_timestamps?: boolean;
    chat_show_platform?: boolean;
    chat_show_user_roles?: boolean;
    chat_animation_duration?: number;
    chat_animation_type?: string;
    chat_message_fade_seconds?: number;
    obs_width?: number;
    obs_height?: number;
    obs_font_size?: number;
    obs_font_family?: string;
    obs_font_weight?: string;
    obs_background_color?: string;
    obs_background_image?: string | null;
    obs_text_color?: string;
    obs_border_radius?: number;
    obs_border_color?: string;
    obs_border_width?: number;
    obs_message_bg?: string;
    obs_message_border_radius?: number;
    obs_message_margin?: number;
    obs_message_padding?: number;
    obs_moderator_color?: string;
    obs_vip_color?: string;
    obs_subscriber_color?: string;
    obs_normal_color?: string;
    combine_titles?: boolean;
    combine_categories?: boolean;
    [key: string]: string | number | boolean | null | undefined;
}

/**
 * Сессия пользователя
 */
export interface UserSession {
    user: User;
    expires_at: string;
    token?: string;
}
