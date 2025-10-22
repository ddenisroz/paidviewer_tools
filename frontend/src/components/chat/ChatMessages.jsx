// src/components/chat/ChatMessages.jsx
import React, { useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Twitch, MessageCircle } from 'lucide-react';
import { VKIcon } from '../PlatformIcons';
import MessageContent from '../MessageContent';
import ChatContextMenu from '../ChatContextMenu';

const ChatMessages = ({
    messages,
    combinedChat,
    twitchChatEnabled,
    vkChatEnabled,
    contextMenu,
    setContextMenu,
    ttsBlockedUsers,
    setTtsBlockedUsers,
    emotes,
    handleContextMenuAction
}) => {
    const messagesEndRef = useRef(null);

    // Автоскролл к последнему сообщению
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Фильтрация сообщений по платформам
    const filteredMessages = messages.filter(msg => {
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

    const handleContextMenu = (e, message) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            message: message
        });
    };

    const handleContextMenuAction = (action, message) => {
        switch (action) {
            case 'block_tts':
                setTtsBlockedUsers(prev => new Set([...prev, message.username]));
                break;
            case 'unblock_tts':
                setTtsBlockedUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(message.username);
                    return newSet;
                });
                break;
            default:
                break;
        }
        setContextMenu(null);
    };

    const getPlatformIcon = (platform) => {
        switch (platform) {
            case 'twitch':
                return <Twitch className="h-4 w-4 text-purple-500" />;
            case 'vk':
                return <VKIcon className="h-4 w-4 text-blue-500" />;
            default:
                return <MessageCircle className="h-4 w-4 text-gray-500" />;
        }
    };

    const getPlatformBadge = (platform) => {
        switch (platform) {
            case 'twitch':
                return <Badge variant="outline" className="text-purple-400 border-purple-500">Twitch</Badge>;
            case 'vk':
                return <Badge variant="outline" className="text-blue-400 border-blue-500">VK Live</Badge>;
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
                                onContextMenu={(e) => handleContextMenu(e, message)}
                            >
                                <div className="flex-shrink-0 mt-1">
                                    {getPlatformIcon(message.platform)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-white truncate">
                                            {message.username}
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
                                            content={message.content}
                                            emotes={emotes}
                                        />
                                    </div>
                                    
                                    {message.timestamp && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {new Date(message.timestamp).toLocaleTimeString()}
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
                    onAction={handleContextMenuAction}
                    onClose={() => setContextMenu(null)}
                    isTtsBlocked={ttsBlockedUsers && ttsBlockedUsers.has(contextMenu.message?.username)}
                />
            )}
        </Card>
    );
};

export default ChatMessages;

