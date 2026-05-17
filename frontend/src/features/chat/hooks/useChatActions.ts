// src/features/chat/hooks/useChatActions.ts
import { useCallback, useState } from 'react';

import { chatService } from '@/services/api/services/chatService';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/shared/utils/toastManager';

import type { ChatMessage } from '@/types/chat';

interface User {
    id?: number;
    twitch_username?: string;
    vk_username?: string;
    vk_channel_name?: string;
}

interface UseChatActionsReturn {
    ttsBlockedUsers: Set<string>;
    setTtsBlockedUsers: (users: Set<string>) => void;
    handleContextMenuAction: (action: string, msg: ChatMessage, user?: User | null) => Promise<void>;
    loadBlockedUsers: () => Promise<void>;
}

export const useChatActions = (_user?: User | null): UseChatActionsReturn => {
    const [ttsBlockedUsers, setTtsBlockedUsers] = useState<Set<string>>(new Set());

    const loadBlockedUsers = useCallback(async (): Promise<void> => {
        try {
            logger.log('[CHAT] Loading muted users...');

            const response = await chatService.getMutedUsers();
            const data = response.data.data || response.data;
            const dataWithUsers = data as { blocked_users?: Array<{ platform: string; username: string }> };

            if (response.data.success) {
                const blockedSet = new Set<string>();

                (dataWithUsers.blocked_users || []).forEach((u: { platform: string; username: string }) => {
                    blockedSet.add(`${u.platform}:${u.username.toLowerCase()}`);
                });

                logger.log(`[CHAT] Loaded ${blockedSet.size} muted users:`, Array.from(blockedSet));
                setTtsBlockedUsers(blockedSet);
            }
        } catch (error: unknown) {
            logger.error('Error loading blocked users:', error);
            const err = error as { response?: { data?: { detail?: string } }; message?: string };
            const errorMessage =
                err.response?.data?.detail ||
                err.message ||
                'Не удалось загрузить список заблокированных пользователей';
            toast.error(`Ошибка загрузки: ${errorMessage}`);
        }
    }, []);

    const handleContextMenuAction = useCallback(
        async (action: string, msg: ChatMessage, currentUser?: User | null): Promise<void> => {
            const username = msg.author_name || msg.author;
            const platform = msg.platform;

            let channelName = msg.channel || msg.channel_name;
            if (!channelName) {
                channelName =
                    platform === 'twitch'
                        ? currentUser?.twitch_username
                        : currentUser?.vk_channel_name || currentUser?.vk_username;
            }

            if (!channelName) {
                logger.error('Channel name not found:', { platform, user: currentUser });
                toast.error('Канал не найден');
                return;
            }

            try {
                switch (action) {
                    case 'block_tts':
                    case 'unblock_tts': {
                        logger.log(`[CHAT MUTE] ${action} для ${username} (${platform})`);

                        const response = await chatService.toggleMute({
                            username,
                            platform,
                            channel_name: channelName,
                        });

                        logger.log('[CHAT MUTE] Response:', response.data);
                        const data = response.data.data || response.data;
                        const dataWithAction = data as { action?: string };
                        const resultAction = dataWithAction?.action;

                        if (resultAction === 'muted') {
                            setTtsBlockedUsers((prev) => new Set(prev).add(`${platform}:${username.toLowerCase()}`));
                            toast.success(`${username} заглушен в TTS`);
                        } else {
                            setTtsBlockedUsers((prev) => {
                                const newSet = new Set(prev);
                                newSet.delete(`${platform}:${username.toLowerCase()}`);
                                return newSet;
                            });
                            toast.success(`[VOLUME] ${username} разглушен в TTS`);
                        }
                        break;
                    }

                    default:
                        logger.warn('Unknown action:', action);
                        break;
                }
            } catch (error: unknown) {
                logger.error('Error executing moderation action:', error);
                const err = error as { response?: { data?: { detail?: string } } };
                toast.error(err.response?.data?.detail || 'Ошибка выполнения действия');
            }
        },
        []
    );

    return {
        ttsBlockedUsers,
        setTtsBlockedUsers,
        handleContextMenuAction,
        loadBlockedUsers,
    };
};
