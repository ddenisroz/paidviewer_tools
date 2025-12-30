// src/types/chatbox.d.ts

export interface ChatBoxSettings {
    font_family: string;
    font_size: number;
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
    show_badges: boolean;
    show_7tv_emotes: boolean;
    show_links: boolean;
    widget_url: string;
    version: number;
    background_color?: string;
    text_stroke_color?: string;
    border_radius?: number;
}
