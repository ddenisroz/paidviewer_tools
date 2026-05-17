// src/features/chat/components/ChatMessages.tsx
import React, { useEffect, useRef } from 'react';

import { MessageCircle, MessageSquare, Twitch } from 'lucide-react';

import { formatLocalMessageTime } from '@/features/chat/utils/time';
import { twitchBadgesService } from '@/services/twitchBadges';
import { VKIcon } from '@/shared/components/PlatformIcons';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import ChatContextMenu from './ChatContextMenu';
import MessageContent from './MessageContent';

import type { ChatMessage } from '@/types/chat';

interface Message extends ChatMessage {
    username?: string; // Alias для author для обратной совместимости
    userRole?: string;
}

interface ContextMenu {
    x: number;
    y: number;
    message: Message;
}

interface ChatMessagesProps {
    messages: Message[];
    combinedChat: boolean;
    twitchChatEnabled: boolean;
    vkChatEnabled: boolean;
    contextMenu: ContextMenu | null;
    setContextMenu: (menu: ContextMenu | null) => void;
    ttsBlockedUsers: Set<string>;
    setTtsBlockedUsers: React.Dispatch<React.SetStateAction<Set<string>>>;
    emotes?: Record<string, unknown>;
    handleContextMenuAction?: (action: string, message: Message) => void;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
    messages,
    combinedChat,
    twitchChatEnabled,
    vkChatEnabled,
    contextMenu,
    setContextMenu,
    ttsBlockedUsers,
    setTtsBlockedUsers,
    emotes,
    handleContextMenuAction,
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Автоскролл к последнему сообщению
    useEffect(() => {
        if (messagesEndRef.current) {
            // Используем scrollIntoView с block: 'nearest' для скролла ТОЛЬКО внутри родителя
            messagesEndRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest',
            });
        }
    }, [messages]);

    // Фильтрация сообщений по платформам
    const filteredMessages = messages.filter((msg) => {
        if (combinedChat) {
            return true; // Показываем все сообщения в объединенном чате
        }

        if (msg.platform === 'twitch' && twitchChatEnabled) {
            return true;
        }

        if (msg.platform === 'vk' && vkChatEnabled) {
            return true;
        }

        return false;
    });

    const handleContextMenuClick = (e: React.MouseEvent, message: Message) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            message: message,
        });
    };

    const handleContextMenuActionLocal = (action: string, message: Message) => {
        if (handleContextMenuAction) {
            handleContextMenuAction(action, message);
        } else {
            const username = message.username || message.author || '';
            switch (action) {
                case 'block_tts':
                    setTtsBlockedUsers((prev) => new Set([...prev, username]));
                    break;
                case 'unblock_tts':
                    setTtsBlockedUsers((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(username);
                        return newSet;
                    });
                    break;
                default:
                    break;
            }
        }
        setContextMenu(null);
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'twitch':
                return <Twitch className="h-4 w-4 text-purple-500" />;
            case 'vk':
                return <VKIcon className="h-4 w-4 text-[#FF4444]" />;
            default:
                return <MessageCircle className="h-4 w-4 text-gray-500" />;
        }
    };

    const getPlatformBadge = (platform: string) => {
        switch (platform) {
            case 'twitch':
                return (
                    <Badge variant="outline" className="text-purple-400 border-purple-500">
                        Twitch
                    </Badge>
                );
            case 'vk':
                return (
                    <Badge variant="outline" className="text-rose-400 border-rose-500">
                        VK Live
                    </Badge>
                );
            default:
                return null;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Чат
                    {combinedChat && (
                        <Badge variant="secondary" className="ml-2">
                            Объединенный
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-96 overflow-y-auto space-y-2 p-4 bg-gray-900 rounded-lg">
                    {filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <MessageSquare className="h-12 w-12 mb-2" />
                            <p>Нет сообщений</p>
                        </div>
                    ) : (
                        filteredMessages.map((message, index) => (
                            <div
                                key={`${message.platform}-${message.id || index}`}
                                className="flex items-start gap-2 p-2 rounded hover:bg-gray-800 transition-colors cursor-context-menu"
                                onContextMenu={(e) => handleContextMenuClick(e, message)}
                            >
                                <div className="flex-shrink-0 mt-1">{getPlatformIcon(message.platform)}</div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {/* Render Twitch badges if present */}
                                        {message.badges &&
                                            message.badges.length > 0 &&
                                            message.platform === 'twitch' && (
                                                <span className="flex items-center gap-0.5">
                                                    {message.badges.map((badge, idx) => {
                                                        const [badgeId, version] = badge.split('/');
                                                        // Try to get URL from global cache (badges should be preloaded)
                                                        const url = twitchBadgesService.getBadgeUrl(
                                                            badgeId,
                                                            version || '1',
                                                            '1x'
                                                        );
                                                        if (url) {
                                                            return (
                                                                <img
                                                                    key={`${badgeId}-${idx}`}
                                                                    src={url}
                                                                    alt={badgeId}
                                                                    title={badgeId}
                                                                    className="h-4 w-4 inline-block object-contain align-text-bottom"
                                                                />
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </span>
                                            )}
                                        {message.badges && message.badges.length > 0 && message.platform === 'vk' && (
                                            <span className="flex items-center gap-0.5">
                                                {message.badges.map((badge, idx) => {
                                                    if (!badge || typeof badge !== 'string') return null;
                                                    return (
                                                        <img
                                                            key={`vk-badge-${idx}`}
                                                            src={badge}
                                                            alt="vk-badge"
                                                            className="h-4 w-4 inline-block object-contain align-text-bottom"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </span>
                                        )}
                                        <span className="font-medium text-white truncate">
                                            {message.username || message.author || message.author_name || 'Unknown'}
                                        </span>
                                        {getPlatformBadge(message.platform)}
                                        {message.userRole && (
                                            <Badge variant="outline" className="text-xs">
                                                {message.userRole}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="text-sm text-gray-300">
                                        <MessageContent
                                            message={message.content || message.message || ''}
                                            channelEmotes={emotes ? new Map(Object.entries(emotes)) : new Map()}
                                            twitchEmotes={message.emotes}
                                        />
                                    </div>

                                    {message.timestamp && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {formatLocalMessageTime(message.timestamp)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </CardContent>

            {/* Контекстное меню */}
            {contextMenu && (
                <ChatContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    message={contextMenu.message}
                    onAction={handleContextMenuActionLocal}
                    onClose={() => setContextMenu(null)}
                    isTtsBlocked={
                        ttsBlockedUsers &&
                        ttsBlockedUsers.has(contextMenu.message?.username || contextMenu.message?.author || '')
                    }
                />
            )}
        </Card>
    );
};

export default ChatMessages;
