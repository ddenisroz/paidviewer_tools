// src/features/chat/components/ChatCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import ChatBoxSettingsModal from '@/components/ChatBoxSettingsModal';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useChatActions } from '@/features/chat/hooks/useChatActions';
import { useChatPlatforms } from '@/features/chat/hooks/useChatPlatforms';
import { filterMessagesByPlatform } from '@/features/chat/utils/messageFilterHelpers';
import {
    autoScrollIfAtBottom,
    isUserAtBottom,
    scrollToBottom,
    scrollToBottomInitial,
} from '@/features/chat/utils/scrollHelpers';
import QuickActionsBar from '@/features/home/components/QuickActionsBar';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { isChatEnabled } from '@/shared/utils/platformHelpers';

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
    showQuickActionsInCard?: boolean;
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

const EMPTY_EMOTES: EmotesState = { channelEmotes: new Map(), globalEmotes: new Map() };

const ChatCard: React.FC<ChatCardProps> = ({ integrations, isOnHomePage = true, showQuickActionsInCard = false }) => {
    const { user } = useAuth();
    const { messages: chatMessages, isConnected, setMessages } = useChat();

    // Use custom hooks for platform management and actions
    const { twitchChatVisible, vkChatVisible, handleTwitchToggle, handleVkToggle } = useChatPlatforms(user?.id);

    const {
        ttsBlockedUsers,
        handleContextMenuAction: handleContextMenuActionFromHook,
        loadBlockedUsers,
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
    // Refs
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

    // Filter messages - show all messages from enabled platforms (no filtering by TTS toggle)
    const filteredMessages = useMemo(() => {
        if (!isOnHomePage) return [];

        return filterMessagesByPlatform(
            chatMessages,
            twitchChatEnabled,
            vkChatEnabled,
            true, // Always show twitch messages if platform is enabled
            true, // Always show vk messages if platform is enabled
            50
        );
    }, [chatMessages, twitchChatEnabled, vkChatEnabled, isOnHomePage]);

    useEffect(() => {
        if (user?.id) {
            loadBlockedUsers();
        }
    }, [user?.id, loadBlockedUsers]);

    useEffect(() => {
        if (!integrations?.twitch?.enabled && !integrations?.vk?.enabled) {
            setMessages([]);
        }
    }, [integrations?.twitch?.enabled, integrations?.vk?.enabled, setMessages]);

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
            message: msg,
        });
    };

    const handleContextMenuAction = React.useCallback(
        async (action: string, msg: ChatMessage): Promise<void> => {
            await handleContextMenuActionFromHook(action, msg, user);
        },
        [handleContextMenuActionFromHook, user]
    );

    // Open chat window
    const handleOpenChatWindow = (): void => {
        const width = 600;
        const height = 800;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
            '/chat-window',
            'ChatWindow',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
        );
    };

    // Export functions for separate chat window
    useEffect(() => {
        (window as { handleChatContextMenuAction?: typeof handleContextMenuAction }).handleChatContextMenuAction =
            handleContextMenuAction;

        return () => {
            delete (window as { handleChatContextMenuAction?: typeof handleContextMenuAction })
                .handleChatContextMenuAction;
        };
    }, [handleContextMenuAction]);

    return (
        <Card className="card-glass h-full flex flex-col">
            <CardHeader className="py-2 px-4">
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
            <CardContent className="pt-0 flex-1 min-h-0">
                {chatMessagesVisible && (twitchChatEnabled || vkChatEnabled) && isOnHomePage ? (
                    <ChatMessageList
                        messages={filteredMessages}
                        isConnected={isConnected}
                        showImages={showImages}
                        showScrollButton={showScrollButton}
                        badgesLoaded={true}
                        channelEmotes={EMPTY_EMOTES.channelEmotes}
                        globalEmotes={EMPTY_EMOTES.globalEmotes}
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
                        isTtsBlocked={ttsBlockedUsers.has(
                            `${contextMenu.message.platform}:${(contextMenu.message.author_name || contextMenu.message.author || '').toLowerCase()}`
                        )}
                    />
                )}
            </CardContent>

            {showQuickActionsInCard && (
                <div className="px-4 pb-3 pt-3">
                    <QuickActionsBar embedded={true} />
                </div>
            )}

            <ChatBoxSettingsModal
                isOpen={showChatBoxModal}
                onClose={() => setShowChatBoxModal(false)}
                onSave={() => {}}
            />
        </Card>
    );
};

export default ChatCard;
