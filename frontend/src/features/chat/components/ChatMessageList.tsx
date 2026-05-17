// src/features/chat/components/ChatMessageList.tsx
import React, { useRef } from 'react';

import { ArrowDown, MessageSquare } from 'lucide-react';

import { formatLocalMessageTime } from '@/features/chat/utils/time';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { logger } from '@/shared/utils/prodLogger';

import MessageContent from './MessageContent';
import SwipeableMessage from './SwipeableMessage';

import type { ChatMessage } from '@/types/chat';

interface EmoteData {
    id: string;
    name: string;
    url: string;
    animated: boolean;
}

interface ChatMessageListProps {
    messages: ChatMessage[];
    isConnected: boolean;
    showImages: boolean;
    showScrollButton: boolean;
    badgesLoaded: boolean;
    channelEmotes: Map<string, EmoteData>;
    globalEmotes: Map<string, EmoteData>;
    onContextMenu: (e: React.MouseEvent, msg: ChatMessage) => void;
    onContextMenuAction: (action: string, msg: ChatMessage) => Promise<void>;
    onScroll: () => void;
    onScrollToBottom: () => void;
    setMessagesContainerRef: (node: HTMLDivElement | null) => void;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
    messages,
    isConnected,
    showImages,
    showScrollButton,
    badgesLoaded,
    channelEmotes,
    globalEmotes,
    onContextMenu,
    onContextMenuAction,
    onScroll,
    onScrollToBottom,
    setMessagesContainerRef,
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    if (messages.length === 0) {
        return (
            <div
                ref={setMessagesContainerRef}
                onScroll={onScroll}
                className="h-full min-h-[280px] border rounded-lg bg-gray-900/40 overflow-y-auto p-4"
            >
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm">Нет сообщений</p>
                    <p className="text-xs mt-1">{isConnected ? 'Ожидание сообщений...' : 'Ожидание подключения...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <div
                ref={setMessagesContainerRef}
                onScroll={onScroll}
                className="h-full min-h-[280px] border rounded-lg bg-gray-900/40 overflow-y-auto p-4"
            >
                <div className="flex flex-col min-h-full">
                    <div className="flex-grow" />
                    <div className="space-y-0.5">
                        {messages.map((msg) => (
                            <SwipeableMessage
                                key={msg.id || `${msg.platform}-${msg.timestamp}-${msg.author}`}
                                message={msg}
                                onSwipeAction={onContextMenuAction}
                            >
                                <div className="p-1" onContextMenu={(e) => onContextMenu(e, msg)}>
                                    <div className="text-sm leading-[1.35]">
                                        {msg.platform === 'twitch' ? (
                                            <TwitchIcon
                                                className="text-purple-400 inline-block align-text-bottom mr-1"
                                                style={{ width: '16px', height: '16px' }}
                                            />
                                        ) : (
                                            <VKIcon
                                                className="text-red-400 inline-block align-text-bottom mr-1"
                                                style={{ width: '16px', height: '16px' }}
                                            />
                                        )}
                                        <span className="text-xs text-muted-foreground mr-1.5 timestamp">
                                            {formatLocalMessageTime(msg.timestamp)}
                                        </span>
                                        {msg.platform === 'twitch' &&
                                            msg.badges &&
                                            Array.isArray(msg.badges) &&
                                            msg.badges.length > 0 && (
                                                <>
                                                    {msg.badges.map((badge, idx) => {
                                                        if (
                                                            !badge ||
                                                            typeof badge !== 'string' ||
                                                            !badge.includes('/')
                                                        ) {
                                                            logger.debug('Invalid badge format:', badge);
                                                            return null;
                                                        }

                                                        const [badgeId, version] = badge.split('/');
                                                        if (!badgeId || !version) {
                                                            logger.debug('Badge missing id or version:', badge);
                                                            return null;
                                                        }

                                                        const badgeUrl = twitchBadgesService.getBadgeUrl(
                                                            badgeId,
                                                            version,
                                                            '1x'
                                                        );

                                                        if (!badgeUrl) {
                                                            if (badgesLoaded) {
                                                                return null;
                                                            } else {
                                                                return (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-block align-text-bottom mr-0.5 w-[16px] h-[16px] bg-gray-600 rounded"
                                                                        title={badge}
                                                                    />
                                                                );
                                                            }
                                                        }

                                                        return (
                                                            <img
                                                                key={idx}
                                                                src={badgeUrl}
                                                                alt={badgeId}
                                                                title={badge}
                                                                className="inline-block align-text-bottom mr-0.5 object-contain"
                                                                style={{ width: '16px', height: '16px' }}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display =
                                                                        'none';
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </>
                                            )}
                                        {msg.platform === 'vk' &&
                                            msg.badges &&
                                            Array.isArray(msg.badges) &&
                                            msg.badges.length > 0 && (
                                                <>
                                                    {msg.badges.map((badge, idx) => {
                                                        if (!badge || typeof badge !== 'string') {
                                                            return null;
                                                        }
                                                        return (
                                                            <img
                                                                key={idx}
                                                                src={badge}
                                                                alt="vk-badge"
                                                                className="inline-block align-text-bottom mr-0.5 object-contain"
                                                                style={{ width: '16px', height: '16px' }}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display =
                                                                        'none';
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </>
                                            )}
                                        <span
                                            className={`font-medium cursor-pointer hover:underline ${
                                                msg.platform === 'twitch'
                                                    ? 'text-purple-400'
                                                    : msg.platform === 'vk'
                                                      ? 'text-red-400'
                                                      : ''
                                            }`}
                                            style={
                                                msg.platform === 'twitch' || msg.platform === 'vk'
                                                    ? undefined
                                                    : { color: msg.author_color || msg.color || '#ffffff' }
                                            }
                                            onClick={(e) => onContextMenu(e, msg)}
                                            title="Кликните для открытия меню действий"
                                        >
                                            {msg.author_name || msg.author || 'Unknown'}:
                                        </span>{' '}
                                        <span className="break-words">
                                            <MessageContent
                                                message={msg.content || msg.message || 'Нет содержимого'}
                                                channelEmotes={channelEmotes}
                                                globalEmotes={globalEmotes}
                                                twitchEmotes={msg.emotes}
                                                showLinks={true}
                                                autoLoadImages={showImages}
                                            />
                                        </span>
                                    </div>
                                </div>
                            </SwipeableMessage>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {showScrollButton && (
                <button
                    onClick={onScrollToBottom}
                    className="absolute bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg transition-colors duration-200 z-10"
                    title="Промотать вниз"
                >
                    <ArrowDown className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};

export default ChatMessageList;
