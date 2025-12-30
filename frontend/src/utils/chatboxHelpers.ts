// src/utils/chatboxHelpers.ts

import type { ApiResponse } from '../types/api';
import type { ChatBoxSettings } from '../types/chatbox';
import type { AxiosResponse } from 'axios';

/**
 * Normalize chatbox settings from API response
 */
export function normalizeChatBoxSettings(data: Partial<ChatBoxSettings>): ChatBoxSettings {
    return {
        font_family: data.font_family || 'Inter',
        font_size: parseInt(String(data.font_size)) || 16,
        text_stroke_width: parseInt(String(data.text_stroke_width)) || 0,
        text_stroke_color: data.text_stroke_color || '#000000',
        background_opacity: parseFloat(String(data.background_opacity)) ?? 0.5,
        background_color: data.background_color || '#000000',
        max_messages: parseInt(String(data.max_messages)) || 20,
        message_spacing: parseInt(String(data.message_spacing)) || 4,
        animation_type: data.animation_type || 'fade',
        animation_duration: parseInt(String(data.animation_duration)) || 300,
        message_fade_seconds: parseInt(String(data.message_fade_seconds)) || 60,
        chat_width: parseInt(String(data.chat_width)) || 100,
        chat_direction: data.chat_direction || 'vertical',
        border_radius: parseInt(String(data.border_radius)) || 8,
        show_platform_icons: data.show_platform_icons ?? true,
        show_badges: data.show_badges ?? true,
        show_7tv_emotes: data.show_7tv_emotes ?? true,
        show_links: data.show_links ?? true,
        widget_url: data.widget_url || '',
        version: data.version || 1
    };
}

/**
 * Extract settings data from API response
 */
export function extractSettingsFromResponse(
    response: AxiosResponse<ApiResponse<ChatBoxSettings>>
): ChatBoxSettings {
    const responseData = response.data;
    // Handle nested data structure: response.data.data or response.data
    if (responseData.data) {
        return responseData.data;
    }
    // Fallback: treat the entire response.data as ChatBoxSettings
    return responseData as unknown as ChatBoxSettings;
}

/**
 * Load Google Font dynamically
 */
export function loadGoogleFont(fontFamily: string): void {
    if (!fontFamily || document.getElementById(`font-${fontFamily}`)) {
        return;
    }
    
    const link = document.createElement('link');
    link.id = `font-${fontFamily}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
}
