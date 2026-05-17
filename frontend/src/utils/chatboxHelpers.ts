// src/utils/chatboxHelpers.ts
/**
 * Helper functions for ChatBox settings.
 */

export interface ChatBoxSettings {
    fontSize: number;
    fontFamily: string;
    textColor: string;
    backgroundColor: string;
    showTimestamp: boolean;
    showBadges: boolean;
    animation: string;
    maxMessages: number;
    platform: string;
}

export const defaultChatBoxSettings: ChatBoxSettings = {
    fontSize: 16,
    fontFamily: 'Inter',
    textColor: '#ffffff',
    backgroundColor: 'transparent',
    showTimestamp: false,
    showBadges: true,
    animation: 'fade',
    maxMessages: 50,
    platform: 'all',
};

export const fontFamilies = ['Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Ubuntu', 'Fira Code'];

export const animationTypes = [
    { value: 'none', label: 'Нет' },
    { value: 'fade', label: 'Плавное появление' },
    { value: 'slide', label: 'Выезд сбоку' },
    { value: 'bounce', label: 'Прыжок' },
];

export const validateHexColor = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
};

export const generateChatBoxUrl = (userId: string, settings: ChatBoxSettings): string => {
    const params = new URLSearchParams({
        userId,
        fontSize: String(settings.fontSize),
        fontFamily: settings.fontFamily,
        textColor: settings.textColor.replace('#', ''),
        animation: settings.animation,
        showBadges: String(settings.showBadges),
        showTimestamp: String(settings.showTimestamp),
    });

    return `/chatbox?${params.toString()}`;
};

export default {
    defaultChatBoxSettings,
    fontFamilies,
    animationTypes,
    validateHexColor,
    generateChatBoxUrl,
};
