// src/shared/utils/botManagementHelpers.ts
/**
 * Вспомогательные функции для отображения состояния ботов в UI.
 */

export interface BotConfig {
    platform: 'twitch' | 'vk';
    enabled: boolean;
    channels: string[];
}

export function getBotStatusColor(isOnline: boolean): string {
    return isOnline ? 'text-green-500' : 'text-red-500';
}

export function formatBotUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}
