// src/utils/messageFilterHelpers.ts

import type { ChatMessage } from '@/types/chat';

/**
 * Check if message should be visible based on platform settings
 */
export function shouldShowMessage(
    message: ChatMessage,
    twitchEnabled: boolean,
    vkEnabled: boolean,
    twitchVisible: boolean,
    vkVisible: boolean
): boolean {
    if (message.platform === 'twitch') {
        return twitchEnabled && twitchVisible;
    }

    if (message.platform === 'vk') {
        return vkEnabled && vkVisible;
    }

    return false;
}

/**
 * Filter messages by platform visibility
 */
export function filterMessagesByPlatform(
    messages: ChatMessage[],
    twitchEnabled: boolean,
    vkEnabled: boolean,
    twitchVisible: boolean,
    vkVisible: boolean,
    limit = 50
): ChatMessage[] {
    return messages
        .filter((msg) => shouldShowMessage(msg, twitchEnabled, vkEnabled, twitchVisible, vkVisible))
        .slice(-limit);
}

/**
 * Check if message author is blocked
 */
export function isMessageAuthorBlocked(message: ChatMessage, blockedUsers: Set<string>): boolean {
    const username = (message.author_name || message.author || '').toLowerCase();
    const key = `${message.platform}:${username}`;
    return blockedUsers.has(key);
}
