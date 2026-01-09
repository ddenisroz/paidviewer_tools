// src/features/chat/components/ChatCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import ChatBoxSettingsModal from '@/components/ChatBoxSettingsModal';
import { CHAT_CONSTANTS } from '@/constants/drops';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useChatActions } from '@/features/chat/hooks/useChatActions';
import { useChatPlatforms } from '@/features/chat/hooks/useChatPlatforms';
import {
    loadChatBadges,
    loadCompleteChatHistory
} from '@/features/chat/utils/chatHistoryHelpers';
import { getAllEmotesForChannel } from '@/features/chat/utils/emotes';
import { filterMessagesByPlatform } from '@/features/chat/utils/messageFilterHelpers';
import {
    autoScrollIfAtBottom,
    isUserAtBottom,
    scrollToBottom,
    scrollToBottomInitial
} from '@/features/chat/utils/scrollHelpers';
import { ttsService } from '@/services/api/services/ttsService';
import { twitchBadgesService } from '@/services/twitchBadges';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { useTimeout } from '@/shared/hooks/useTimeout';
import {
    didIntegrationsEnable,
    hasAnyIntegrations,
    isChatEnabled
} from '@/shared/utils/platformHelpers';
import { logger } from '@/shared/utils/prodLogger';

import ChatCardFooter from './ChatCardFooter';
import ChatCardHeader from './ChatCardHeader';
import ChatContextMenu from './ChatContextMenu';
import ChatMessageList from './ChatMessageList';


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
    donationalerts?: {
        enabled: boolean;
        username?: string | null;
    };
}

interface ChatCardProps {
    integrations: Integrations;
    isOnHomePage?: boolean;
}

interface ContextMenuState {
    x: number;
    y: number;
    message: ChatMessage;
}

interface EmoteData {
    id: string;
    name: string;
    url: string;
    animated: boolean;
}

interface EmotesState {
    channelEmotes: Map<string, EmoteData>;
    globalEmotes: Map<string, EmoteData>;
}

interface PrevIntegrationsRef {
    twitch: boolean;
    vk: boolean;
}

const ChatCard: React.FC<ChatCardProps> = ({ integrations, isOnHomePage = true }) => {
    const { user } = useAuth();
    const { messages: chatMessages, isConnected, setMessages } = useChat();

    // Use custom hooks for platform management and actions
    const {
        twitchChatVisible,
        vkChatVisible,
        handleTwitchToggle,
        handleVkToggle
    } = useChatPlatforms(user?.id);

    const {
        ttsBlockedUsers,
        handleContextMenuAction: handleContextMenuActionFromHook,
        loadBlockedUsers
    } = useChatActions(user);

    // UI state
    const [showScrollButton, setShowScrollButton] = useState<boolean>(false);
    const [chatMessagesVisible, setChatMessagesVisible] = useState<boolean>(() => {
        const saved = localStorage.getItem('chatMessagesVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showImages, setShowImages] = useState<boolean>(() => {
        const saved = localStorage.getItem('chatShowImages');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showChatBoxModal, setShowChatBoxModal] = useState<boolean>(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [badgesLoaded, setBadgesLoaded] = useState<boolean>(false);
    const [emotes, setEmotes] = useState<EmotesState>({ channelEmotes: new Map(), globalEmotes: new Map() });

    // Refs
    const badgesLoadedRef = useRef<boolean>(false);
    const historyLoadedRef = useRef<boolean>(false);
    const prevIntegrationsRef = useRef<PrevIntegrationsRef>({ twitch: false, vk: false });
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const hasSetInitialScroll = useRef<boolean>(false);
    const previousMessageCount = useRef<number>(0);
    const previousIsOnHomePage = useRef<boolean>(isOnHomePage);

    // Save state to localStorage
    useEffect(() => {
        localStorage.setItem('chatMessagesVisible', JSON.stringify(chatMessagesVisible));
    }, [chatMessagesVisible]);

    useEffect(() => {
        localStorage.setItem('chatShowImages', JSON.stringify(showImages));
    }, [showImages]);

    // Platform enabled flags
    const twitchEnabled = integrations?.twitch?.enabled || false;
    const vkEnabled = integrations?.vk?.enabled || false;
    const twitchChatEnabled = isChatEnabled(integrations, 'twitch', isOnHomePage);
    const vkChatEnabled = isChatEnabled(integrations, 'vk', isOnHomePage);

    // Filter messages
    const filteredMessages = useMemo(() => {
        if (!isOnHomePage) return [];

        return filterMessagesByPlatform(
            chatMessages,
            twitchChatEnabled,
            vkChatEnabled,
            twitchChatVisible,
            vkChatVisible,
            50
        );
    }, [chatMessages, twitchChatEnabled, vkChatEnabled, twitchChatVisible, vkChatVisible, isOnHomePage]);

    // Load badges
    useEffect(() => {
        const loadBadges = async (): Promise<void> => {
            if (badgesLoadedRef.current) {
                setBadgesLoaded(true);
                return;
            }

            try {
                await twitchBadgesService.loadGlobalBadges();
                badgesLoadedRef.current = true;
                setBadgesLoaded(true);
            } catch (error) {
                logger.error('[ERROR] [BADGES] Error loading badges:', error);
            }
        };

        setTimeout(() => loadBadges(), 50);
    }, [user?.id]);

    // Load channel badges
    useEffect(() => {
        const loadChannelBadges = async (): Promise<void> => {
            if (!badgesLoaded || !integrations?.twitch?.enabled || !user?.twitch_username) return;
            if (badgesLoadedRef.current) return;

            try {
                badgesLoadedRef.current = true;
                await twitchBadgesService.loadChannelBadges(user.twitch_username);
            } catch (err) {
                badgesLoadedRef.current = false;
                logger.warn('[WARN] [BADGES] Failed to load channel badges:', err);
            }
        };

        if (integrations?.twitch?.enabled && user?.twitch_username && badgesLoaded) {
            setTimeout(() => loadChannelBadges(), 200);
        }
    }, [integrations?.twitch?.enabled, user?.twitch_username, badgesLoaded]);

    // Disable TTS on page unload
    useEffect(() => {
        const handleBeforeUnload = async () => {
            try {
                await ttsService.savePlatformSettings({ enabled_platforms: [] });
            } catch (error) {
                logger.error('[ERROR] [TTS] Error disabling TTS on unload:', error);
            }
        };

        const handleVisibilityChange = async () => {
            if (document.hidden) {
                try {
                    await ttsService.savePlatformSettings({ enabled_platforms: [] });
                } catch (error) {
                    logger.error('[ERROR] [TTS] Error disabling TTS on visibility change:', error);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Load blocked users
    useEffect(() => {
        if (user?.id) loadBlockedUsers();
    }, [user, loadBlockedUsers]);

    // Load chat history
    useEffect(() => {
        const hasIntegrations = hasAnyIntegrations(integrations);
        const integrationsEnabled = didIntegrationsEnable(integrations, prevIntegrationsRef.current);

        prevIntegrationsRef.current = {
            twitch: integrations?.twitch?.enabled || false,
            vk: integrations?.vk?.enabled || false
        };

        if (!hasIntegrations) {
            if (historyLoadedRef.current) {
                setMessages([]);
                historyLoadedRef.current = false;
            }
            return;
        }

        if (integrationsEnabled) {
            historyLoadedRef.current = false;
        }

        if (!historyLoadedRef.current && user?.id) {
            historyLoadedRef.current = true;
        }
    }, [user?.id, integrations?.twitch?.enabled, integrations?.vk?.enabled, setMessages]);

    // Load chat history with delay
    const shouldLoadHistory = !historyLoadedRef.current && user?.id;
    useTimeout(() => {
        if (shouldLoadHistory) loadChatHistory();
    }, shouldLoadHistory ? CHAT_CONSTANTS.RENDER_DELAY : null);

    // Load emotes with delay
    useTimeout(() => {
        if (user?.twitch_username) loadEmotes();
    }, user?.twitch_username ? CHAT_CONSTANTS.EMOJI_LOAD_DELAY : null);

    const loadEmotes = async (): Promise<void> => {
        try {
            const emotesData = await getAllEmotesForChannel(user?.twitch_username || '');
            setEmotes(emotesData);
        } catch (error) {
            logger.error('Error loading emotes:', error);
        }
    };

    const loadChatHistory = async (): Promise<void> => {
        try {
            await loadChatBadges(integrations, user || {});
            setBadgesLoaded(true);

            const historyMessages = await loadCompleteChatHistory(
                integrations,
                user || {},
                CHAT_CONSTANTS.MESSAGE_LIMIT
            );

            if (historyMessages.length > 0) {
                setMessages(historyMessages);
            }
        } catch (error) {
            logger.error('[ERROR] Error loading chat history:', error);
        }
    };

    // Scroll management
    const setMessagesContainerRef = (node: HTMLDivElement | null): void => {
        messagesContainerRef.current = node;

        if (node && isOnHomePage && filteredMessages.length > 0 && !hasSetInitialScroll.current) {
            scrollToBottomInitial(node);
            hasSetInitialScroll.current = true;
        }
    };

    const handleScrollToBottom = (): void => {
        scrollToBottom(messagesContainerRef.current);
    };

    const handleScroll = (): void => {
        setShowScrollButton(!isUserAtBottom(messagesContainerRef.current));
    };

    // Auto-scroll effects
    useEffect(() => {
        if (isOnHomePage && filteredMessages.length > 0 && !hasSetInitialScroll.current) {
            const container = messagesContainerRef.current;
            if (container) {
                container.scrollTop = container.scrollHeight;
                hasSetInitialScroll.current = true;
                previousMessageCount.current = filteredMessages.length;
            }
        }

        if (!isOnHomePage) hasSetInitialScroll.current = false;
    }, [isOnHomePage, filteredMessages.length]);

    useEffect(() => {
        if (isOnHomePage && !previousIsOnHomePage.current && filteredMessages.length > 0) {
            const container = messagesContainerRef.current;
            if (container) {
                requestAnimationFrame(() => {
                    if (container) container.scrollTop = container.scrollHeight;
                });
            }
        }
        previousIsOnHomePage.current = isOnHomePage;
    }, [isOnHomePage, filteredMessages.length]);

    useEffect(() => {
        if (!isOnHomePage || filteredMessages.length === 0 || !hasSetInitialScroll.current) {
            previousMessageCount.current = filteredMessages.length;
            return;
        }

        const messageCount = filteredMessages.length;
        const hasNewMessages = messageCount > previousMessageCount.current;

        if (hasNewMessages) {
            const container = messagesContainerRef.current;
            const wasAtBottom = isUserAtBottom(container) || previousMessageCount.current === 0;

            if (container) {
                requestAnimationFrame(() => {
                    autoScrollIfAtBottom(container, wasAtBottom);
                    previousMessageCount.current = messageCount;
                });
            }
        } else {
            previousMessageCount.current = messageCount;
        }
    }, [filteredMessages.length, isOnHomePage]);

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage): void => {
        e.preventDefault();
        e.stopPropagation();

        setContextMenu({
            x: e.clientX + 2,
            y: e.clientY + 2,
            message: msg
        });
    };

    const handleContextMenuAction = async (action: string, msg: ChatMessage): Promise<void> => {
        await handleContextMenuActionFromHook(action, msg, user);
    };

    // Open chat window
    const handleOpenChatWindow = (): void => {
        const width = 600;
        const height = 800;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        window.open(
            '/chat-window',
            'ChatWindow',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
        );
    };

    // Export functions for separate chat window
    useEffect(() => {
        (window as { handleChatContextMenuAction?: typeof handleContextMenuAction }).handleChatContextMenuAction = handleContextMenuAction;

        return () => {
            delete (window as { handleChatContextMenuAction?: typeof handleContextMenuAction }).handleChatContextMenuAction;
        };
    }, [handleContextMenuAction]);

    return (
        <Card>
            <CardHeader className="pb-2">
                <ChatCardHeader
                    twitchChatEnabled={twitchChatEnabled}
                    vkChatEnabled={vkChatEnabled}
                    twitchChatVisible={twitchChatVisible}
                    vkChatVisible={vkChatVisible}
                    chatMessagesVisible={chatMessagesVisible}
                    showImages={showImages}
                    onTwitchToggle={handleTwitchToggle}
                    onVkToggle={handleVkToggle}
                    onSettingsClick={() => setShowChatBoxModal(true)}
                    onOpenChatWindow={handleOpenChatWindow}
                    onToggleImages={() => setShowImages(!showImages)}
                    onToggleChatVisibility={() => setChatMessagesVisible(!chatMessagesVisible)}
                />
            </CardHeader>
            <CardContent className="pt-0">
                {chatMessagesVisible && (twitchChatEnabled || vkChatEnabled) && isOnHomePage ? (
                    <ChatMessageList
                        messages={filteredMessages}
                        isConnected={isConnected}
                        showImages={showImages}
                        showScrollButton={showScrollButton}
                        badgesLoaded={badgesLoaded}
                        channelEmotes={emotes.channelEmotes}
                        globalEmotes={emotes.globalEmotes}
                        onContextMenu={handleContextMenu}
                        onContextMenuAction={handleContextMenuAction}
                        onScroll={handleScroll}
                        onScrollToBottom={handleScrollToBottom}
                        setMessagesContainerRef={setMessagesContainerRef}
                    />
                ) : (
                    <ChatCardFooter
                        twitchEnabled={twitchEnabled}
                        vkEnabled={vkEnabled}
                        chatMessagesVisible={chatMessagesVisible}
                        isOnHomePage={isOnHomePage}
                    />
                )}

                {contextMenu && (
                    <ChatContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        message={contextMenu.message}
                        onClose={() => setContextMenu(null)}
                        onAction={handleContextMenuAction}
                        isTtsBlocked={ttsBlockedUsers.has(`${contextMenu.message.platform}:${(contextMenu.message.author_name || contextMenu.message.author || '').toLowerCase()}`)}
                    />
                )}
            </CardContent>

            <ChatBoxSettingsModal
                isOpen={showChatBoxModal}
                onClose={() => setShowChatBoxModal(false)}
                onSave={() => { }}
            />
        </Card>
    );
};

export default ChatCard;
