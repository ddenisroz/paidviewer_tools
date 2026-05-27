// src/utils/chatboxHelpers.ts

import { CHATBOX_BRAND_FONT, isBundledChatFont } from '../constants/fontOptions';

import type { ApiResponse } from '@/types/api';
import type { ChatBoxSettings, ChatMessageBackgroundMode } from '@/types/chatbox';
import type { AxiosResponse } from 'axios';

/**
 * Normalize chatbox settings from API response
 */
const normalizeAnimationType = (value: string | undefined): string => {
    if (!value) return 'fade';
    if (value === 'slide') return 'slide-right';
    return value;
};

const normalizeChatDirection = (value: string | undefined): string => {
    if (!value) return 'vertical';
    if (value === 'vertical-reverse') return 'vertical';
    return value;
};

const parseIntOr = (value: unknown, fallback: number): number => {
    const parsed = Number.parseInt(String(value));
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseFloatOr = (value: unknown, fallback: number): number => {
    const parsed = Number.parseFloat(String(value));
    return Number.isNaN(parsed) ? fallback : parsed;
};

const clampNumber = (value: number, min: number, max: number): number => {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
};

const normalizeFontFamily = (value: string | undefined): string => {
    if (!value) return CHATBOX_BRAND_FONT;
    const first = value.split(',')[0]?.trim();
    if (!first) return CHATBOX_BRAND_FONT;
    return first.replace(/^['"]|['"]$/g, '') || CHATBOX_BRAND_FONT;
};

export const resolveMessageBackgroundMode = (
    data: Partial<Pick<ChatBoxSettings, 'message_background_mode' | 'separate_message_backgrounds'>>
): ChatMessageBackgroundMode => {
    if (data.message_background_mode === 'message' || data.message_background_mode === 'column' || data.message_background_mode === 'none') {
        return data.message_background_mode;
    }

    if (data.separate_message_backgrounds === false) {
        return 'none';
    }

    return 'message';
};

export function normalizeChatBoxSettings(data: Partial<ChatBoxSettings>): ChatBoxSettings {
    const parsedOpacity = Number.parseFloat(String(data.background_opacity));
    const fontSize = clampNumber(parseIntOr(data.font_size, 16), 8, 32);
    const chatWidth = clampNumber(parseIntOr(data.chat_width, 100), 20, 100);
    const messageSpacing = clampNumber(parseIntOr(data.message_spacing, 4), 0, 32);
    const borderRadius = clampNumber(parseIntOr(data.border_radius, 8), 0, 32);
    const animationDuration = clampNumber(parseIntOr(data.animation_duration, 300), 0, 2000);
    const messageFadeSeconds = clampNumber(parseIntOr(data.message_fade_seconds, 60), 10, 60);
    const textStrokeWidth = clampNumber(parseFloatOr(data.text_stroke_width, 0), 0, 3);
    const messageBackgroundMode = resolveMessageBackgroundMode(data);
    return {
        ...data,
        font_family: normalizeFontFamily(data.font_family),
        font_size: fontSize,
        font_weight: data.font_weight || 'normal',
        text_color: data.text_color || '#FFFFFF',
        username_color: data.username_color || '#9147FF',
        text_stroke_width: textStrokeWidth,
        text_stroke_color: data.text_stroke_color || '#000000',
        background_opacity: Number.isFinite(parsedOpacity) ? parsedOpacity : 0.5,
        background_color: data.background_color || '#000000',
        max_messages: parseIntOr(data.max_messages, 20),
        message_spacing: messageSpacing,
        animation_type: normalizeAnimationType(data.animation_type),
        animation_duration: animationDuration,
        message_fade_seconds: messageFadeSeconds,
        chat_width: chatWidth,
        chat_direction: normalizeChatDirection(data.chat_direction),
        border_radius: borderRadius,
        show_platform_icons: data.show_platform_icons ?? true,
        show_roles: data.show_roles ?? false,
        show_badges: data.show_badges ?? true,
        show_7tv_emotes: data.show_7tv_emotes ?? true,
        show_links: data.show_links ?? true,
        auto_load_images: data.auto_load_images ?? true,
        separate_message_backgrounds: messageBackgroundMode === 'message',
        message_background_mode: messageBackgroundMode,
        widget_url: data.widget_url || '',
        version: data.version || 1,
    };
}

/**
 * Extract settings data from API response
 */
export function extractSettingsFromResponse(response: AxiosResponse<ApiResponse<ChatBoxSettings>>): ChatBoxSettings {
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
    const normalizedFont = normalizeFontFamily(fontFamily);
    if (!normalizedFont || isBundledChatFont(normalizedFont) || document.getElementById(`font-${normalizedFont}`)) {
        return;
    }

    const link = document.createElement('link');
    link.id = `font-${normalizedFont}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${normalizedFont.replace(/\s+/g, '+')}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
}
