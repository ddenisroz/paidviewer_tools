// src/features/chat/utils/chatHistoryHelpers.ts

import { chatService } from '@/services/api/services/chatService';
import { twitchBadgesService } from '@/services/twitchBadges';
import { logger } from '@/shared/utils/prodLogger';

import type { ChatMessage } from '@/types/chat';

interface Integrations {
    twitch?: {
        enabled: boolean;
        username?: string | null;
    };
    vk?: {
        enabled: boolean;
        username?: string | null;
    };
}

interface User {
    twitch_username?: string;
    vk_username?: string;
    vk_channel_name?: string;
}

/**
 * Load badges for chat
 */
export async function loadChatBadges(integrations: Integrations, user: User): Promise<void> {
    await twitchBadgesService.loadGlobalBadges();

    if (integrations?.twitch?.enabled && user?.twitch_username) {
        try {
            await twitchBadgesService.loadChannelBadges(user.twitch_username);
        } catch (err) {
            logger.warn('[WARN] [BADGES] Failed to load channel badges:', err);
        }
    }
}

/**
 * Fetch chat history for a platform
 */
async function fetchPlatformHistory(platform: 'twitch' | 'vk', channel: string, limit: number): Promise<ChatMessage[]> {
    try {
        const response = await chatService.getChatHistory({
            platform,
            channel,
            limit,
        });

        const data = response.data.data || response.data;
        const dataWithMessages = data as { messages?: ChatMessage[] };

        if (response.data.success && dataWithMessages.messages) {
            return dataWithMessages.messages;
        }
    } catch (error) {
        logger.error(`[ERROR] Error loading ${platform} history:`, error);
    }

    return [];
}

/**
 * Load complete chat history from all enabled platforms
 */
export async function loadCompleteChatHistory(
    integrations: Integrations,
    user: User,
    limit: number
): Promise<ChatMessage[]> {
    const historyMessages: ChatMessage[] = [];

    // Load Twitch history
    if (integrations?.twitch?.enabled && user?.twitch_username) {
        const twitchMessages = await fetchPlatformHistory('twitch', user.twitch_username, limit);
        historyMessages.push(...twitchMessages);
    }

    // Load VK history
    const vkChannel = user?.vk_channel_name || user?.vk_username;
    if (integrations?.vk?.enabled && vkChannel) {
        const vkMessages = await fetchPlatformHistory('vk', vkChannel, limit);
        historyMessages.push(...vkMessages);
    }

    // Sort by timestamp
    if (historyMessages.length > 0) {
        historyMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    return historyMessages;
}
