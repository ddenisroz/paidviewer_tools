import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { TwitchIcon, VKIcon } from '../shared/components/PlatformIcons';
import { useAuth } from '../context/AuthContext';
import MessageContent from '../components/MessageContent';
import { twitchBadgesService } from '../services/twitchBadges';
import { useChat } from '../context/ChatContext';
import { logger } from '../utils/prodLogger';
import { getAllEmotesForChannel } from '../utils/emotes';
import type { ChatMessage } from '../types/chat';

interface ChatSettings {
    font_size: number;
    font_family: string;
    text_color: string;
    background_color: string;
    show_platform_icons: boolean;
    show_badges: boolean;
    show_avatars: boolean;
    max_messages: number;
    show_7tv_emotes: boolean;
    show_links: boolean;
    auto_load_images: boolean;
}

interface Emotes {
    channelEmotes: Map<string, any>;
    globalEmotes: Map<string, any>;
}

const ChatWindow: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const { messages, isConnected } = useChat();
    
    const [settings, setSettings] = useState<ChatSettings>({
        font_size: 14,
        font_family: 'Inter, sans-serif',
        text_color: '#FFFFFF',
        background_color: '#1a1a1a',
        show_platform_icons: true,
        show_badges: true,
        show_avatars: true,
        max_messages: 50,
        show_7tv_emotes: true,
        show_links: true,
        auto_load_images: true
    });
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [badgesLoaded, setBadgesLoaded] = useState<boolean>(false);
    const [emotes, setEmotes] = useState<Emotes>({ channelEmotes: new Map(), globalEmotes: new Map() });
    
    useEffect(() => {
        if (!badgesLoaded) {
            twitchBadgesService.loadGlobalBadges()
                .then(() => setBadgesLoaded(true))
                .catch(err => logger.error('Failed to load badges:', err));
        }
        
        if (settings.show_7tv_emotes && user?.twitch_username) {
            getAllEmotesForChannel(user.twitch_username)
                .then(data => setEmotes(data))
                .catch(err => logger.error('Failed to load 7TV emotes:', err));
        }
    }, [badgesLoaded, settings.show_7tv_emotes, user?.twitch_username]);
    
    const previousMessageCount = useRef<number>(0);
    
    useLayoutEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
            previousMessageCount.current = messages.length;
        }
    }, [messages.length]);
    
    useEffect(() => {
        if (messages.length === 0) {
            previousMessageCount.current = 0;
            return;
        }
        
        const messageCount = messages.length;
        const hasNewMessages = messageCount > previousMessageCount.current;
        
        if (hasNewMessages && messagesEndRef.current) {
            requestAnimationFrame(() => {
                if (messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    logger.log(`⬇️ [NEW_MSG] Auto-scrolled to bottom (ChatWindow) - ${messageCount} messages`);
                }
                previousMessageCount.current = messageCount;
            });
        } else {
            previousMessageCount.current = messageCount;
        }
    }, [messages.length]);
    
    const displayMessages = messages.slice(-settings.max_messages);
    
    if (!isAuthenticated) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px' }}>🔐</div>
                <div style={{ fontSize: '18px' }}>Требуется авторизация</div>
                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                    Пожалуйста, войдите в систему
                </div>
            </div>
        );
    }
    
    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: settings.background_color,
            fontFamily: settings.font_family,
            fontSize: `${settings.font_size}px`,
            color: settings.text_color,
            overflow: 'hidden'
        }}>
            <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#111'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '24px' }}>💬</div>
                    <div>
                        <div style={{ fontWeight: 'bold' }}>Чат</div>
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                            {user?.twitch_username || user?.vk_username || 'Гость'}
                        </div>
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    opacity: 0.7
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isConnected ? '#00ff00' : '#ff0000'
                    }} />
                    {isConnected ? 'Подключено' : 'Отключено'}
                </div>
            </div>
            
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '4px 8px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {displayMessages.length === 0 ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.5,
                        textAlign: 'center'
                    }}>
                        <div>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                            <div>Ожидание сообщений...</div>
                            <div style={{ fontSize: '0.8em', marginTop: '8px' }}>
                                Сообщения появятся здесь автоматически
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ flexGrow: 1 }} />
                        {displayMessages.map((msg: ChatMessage, index: number) => (
                            <div 
                                key={msg.id || `${msg.platform}-${msg.timestamp}-${(msg as any).author_name || (msg as any).author}`}
                                style={{
                                    marginTop: index > 0 ? '2px' : '0',
                                    padding: '4px 6px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '4px',
                                    wordBreak: 'break-word',
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: '6px',
                                    flexWrap: 'wrap'
                                }}
                            >
                                {settings.show_platform_icons && (
                                    msg.platform === 'twitch' ? (
                                        <TwitchIcon 
                                            style={{ 
                                                color: '#9147FF',
                                                width: '16px',
                                                height: '16px',
                                                flexShrink: 0
                                            }} 
                                        />
                                    ) : (
                                        <VKIcon 
                                            style={{ 
                                                color: '#EF4444',
                                                width: '14px',
                                                height: '14px',
                                                flexShrink: 0
                                            }} 
                                        />
                                    )
                                )}
                                
                                {settings.show_badges && (msg as any).badges && Array.isArray((msg as any).badges) && (msg as any).badges.length > 0 && (
                                    <>
                                        {(msg as any).badges.map((badge: string, idx: number) => {
                                            const [badgeId, version] = badge.split('/');
                                            const badgeUrl = twitchBadgesService.getBadgeUrl(badgeId, version, '1x');
                                            
                                            if (!badgeUrl) return null;
                                            
                                            return (
                                                <img 
                                                    key={idx} 
                                                    src={badgeUrl}
                                                    alt={badgeId}
                                                    title={badge}
                                                    style={{ 
                                                        width: '18px', 
                                                        height: '18px',
                                                        flexShrink: 0
                                                    }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                                
                                {settings.show_avatars && (msg as any).avatar_url && (
                                    <img
                                        src={(msg as any).avatar_url}
                                        alt={(msg as any).author_name || (msg as any).author}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            flexShrink: 0
                                        }}
                                    />
                                )}
                                
                                <span style={{ 
                                    color: msg.platform === 'twitch' ? '#9146FF' : '#FF0000',
                                    fontWeight: '600',
                                    flexShrink: 0
                                }}>
                                    {(msg as any).author_name || (msg as any).author}:
                                </span>
                                
                                <span style={{ color: settings.text_color, flex: 1 }}>
                                    <MessageContent 
                                        message={msg.message} 
                                        channelEmotes={settings.show_7tv_emotes ? emotes.channelEmotes : new Map()}
                                        globalEmotes={settings.show_7tv_emotes ? emotes.globalEmotes : new Map()}
                                        showLinks={settings.show_links}
                                        autoLoadImages={settings.auto_load_images}
                                    />
                                </span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            
            <div style={{
                padding: '8px 12px',
                borderTop: '1px solid #333',
                backgroundColor: '#111',
                fontSize: '11px',
                opacity: 0.6,
                textAlign: 'center'
            }}>
                💡 Это окно использует общее WebSocket соединение (Leader Election)
            </div>
        </div>
    );
};

export default ChatWindow;

