import React, { useEffect, useRef } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageSquare } from 'lucide-react';

import { formatLocalMessageTime } from '@/features/chat/utils/time';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';

import SwipeableMessage from './SwipeableMessage';

import type { ChatMessage } from '@/types/chat';

interface VirtualizedMessageListProps {
    messages: ChatMessage[];
    onContextMenu: (e: React.MouseEvent, msg: ChatMessage) => void;
    onSwipeAction: (action: string, msg: ChatMessage) => void;
    badgesLoaded: boolean;
    isConnected: boolean;
    containerHeight?: number;
}

/**
 * Virtualized message list for ChatCard
 * Uses @tanstack/react-virtual to render only visible messages
 * Improves performance for large message lists
 */
export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = React.memo(
    ({ messages, onContextMenu, onSwipeAction, badgesLoaded, isConnected, containerHeight = 400 }) => {
        const parentRef = useRef<HTMLDivElement>(null);
        const previousScrollTop = useRef<number>(0);
        const isUserScrolling = useRef<boolean>(false);

        // Initialize virtualizer
        const virtualizer = useVirtualizer({
            count: messages.length,
            getScrollElement: () => parentRef.current,
            estimateSize: () => 60, // Estimated height of each message
            overscan: 5, // Render 5 extra items above and below viewport
        });

        // Auto-scroll to bottom on new messages (only if user is at bottom)
        useEffect(() => {
            if (messages.length === 0) return;

            const container = parentRef.current;
            if (!container) return;

            // Check if user is at bottom (within 150px threshold)
            const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

            if (isAtBottom && !isUserScrolling.current) {
                // Scroll to bottom
                virtualizer.scrollToIndex(messages.length - 1, {
                    align: 'end',
                    behavior: 'smooth',
                });
            }
        }, [messages.length, virtualizer]);

        // Track user scrolling
        const handleScroll = () => {
            const container = parentRef.current;
            if (!container) return;

            const currentScrollTop = container.scrollTop;
            const isScrollingUp = currentScrollTop < previousScrollTop.current;

            if (isScrollingUp) {
                isUserScrolling.current = true;
            } else {
                // Check if at bottom
                const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                if (isAtBottom) {
                    isUserScrolling.current = false;
                }
            }

            previousScrollTop.current = currentScrollTop;
        };

        // Empty state
        if (messages.length === 0) {
            return (
                <div
                    className="border rounded-lg bg-gray-900/40 overflow-y-auto p-4"
                    style={{ height: `${containerHeight}px` }}
                >
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                        <p className="text-sm">Нет сообщений</p>
                        <p className="text-xs mt-1">
                            {isConnected ? 'Ожидание сообщений...' : 'Ожидание подключения...'}
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div
                ref={parentRef}
                onScroll={handleScroll}
                className="border rounded-lg bg-gray-900/40 overflow-y-auto"
                style={{ height: `${containerHeight}px` }}
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                        const msg = messages[virtualItem.index];

                        return (
                            <div
                                key={virtualItem.key}
                                data-index={virtualItem.index}
                                ref={virtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualItem.start}px)`,
                                }}
                            >
                                <SwipeableMessage message={msg} onSwipeAction={onSwipeAction}>
                                    <div className="p-1" onContextMenu={(e) => onContextMenu(e, msg)}>
                                        <div className="text-sm leading-[1.35]">
                                            {/* Platform icon */}
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
                                            {/* Timestamp */}
                                            <span className="text-xs text-muted-foreground mr-1.5 timestamp">
                                                {formatLocalMessageTime(msg.timestamp)}
                                            </span>
                                            {/* Badges */}
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
                                                                return null;
                                                            }

                                                            const [badgeId, version] = badge.split('/');
                                                            if (!badgeId || !version) {
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
                                            {/* Author name */}
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
                                            {/* Message content */}
                                            <span className="break-words">
                                                {msg.content || msg.message || 'Нет содержимого'}
                                            </span>
                                        </div>
                                    </div>
                                </SwipeableMessage>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
);

VirtualizedMessageList.displayName = 'VirtualizedMessageList';
