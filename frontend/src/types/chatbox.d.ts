// src/types/chatbox.d.ts

export type ChatMessageBackgroundMode = 'message' | 'column' | 'none';

export interface ChatBoxSettings {
    font_family: string;
    font_size: number;
    font_weight?: string;
    text_color?: string;
    username_color?: string;
    text_stroke_width: number;
    background_opacity: number;
    max_messages: number;
    message_spacing: number;
    animation_type: string;
    animation_duration: number;
    message_fade_seconds: number;
    chat_direction: string;
    chat_width: number;
    show_platform_icons: boolean;
    show_roles?: boolean;
    show_badges: boolean;
    show_7tv_emotes: boolean;
    show_links: boolean;
    auto_load_images?: boolean;
    separate_message_backgrounds?: boolean;
    message_background_mode?: ChatMessageBackgroundMode;
    widget_url: string;
    version: number;
    background_color?: string;
    text_stroke_color?: string;
    border_radius?: number;
    twitch_user_id?: string;
}
