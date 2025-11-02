// src/pages/ChatWindow.jsx
import React, { useState, useEffect, useRef } from 'react';
import { TwitchIcon, VKIcon } from '../components/PlatformIcons';
import { useAuth } from '../context/AuthContext';
import MessageContent from '../components/MessageContent';
import { twitchBadgesService } from '../services/twitchBadges';
import { useChat } from '../context/ChatContext';
import { logger } from '../utils/prodLogger';

/**
 * Чат в отдельном окне
 * Использует Shared WebSocket из ChatContext (leader election)
 * Не создает дублирующих WebSocket соединений
 */
const ChatWindow = () => {
    const { user, isAuthenticated } = useAuth();
    const { messages, isConnected } = useChat(); // ✅ Используем SHARED WebSocket через ChatContext
    
    const [settings, setSettings] = useState({
        font_size: 16,
        font_family: 'Inter, sans-serif',
        text_color: '#FFFFFF',
        background_color: '#1a1a1a',
        show_platform_icons: true,
        show_badges: true,
        show_avatars: true,
        max_messages: 50
    });
    
    const messagesEndRef = useRef(null);
    const [badgesLoaded, setBadgesLoaded] = useState(false);
    
    // Загрузка Twitch badges при монтировании
    useEffect(() => {
        if (!badgesLoaded) {
            twitchBadgesService.loadGlobalBadges()
                .then(() => setBadgesLoaded(true))
                .catch(err => logger.error('Failed to load badges:', err));
        }
    }, [badgesLoaded]);
    
    // Автопрокрутка к последнему сообщению
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    
    // Ограничение количества сообщений
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
            {/* Заголовок окна */}
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
            
            {/* Сообщения */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 12px',
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
                        {displayMessages.map((msg, index) => (
                            <div 
                                key={msg.id || `${msg.platform}-${msg.timestamp}-${msg.author_name || msg.author}`}
                                style={{
                                    marginTop: index > 0 ? '4px' : '0',
                                    padding: '6px 10px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '4px',
                                    wordBreak: 'break-word',
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: '6px',
                                    flexWrap: 'wrap'
                                }}
                            >
                                {/* Platform Icon */}
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
                                
                                {/* Badges */}
                                {settings.show_badges && msg.badges && Array.isArray(msg.badges) && msg.badges.length > 0 && (
                                    <>
                                        {msg.badges.map((badge, idx) => {
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
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                                
                                {/* Avatar */}
                                {settings.show_avatars && msg.avatar_url && (
                                    <img
                                        src={msg.avatar_url}
                                        alt={msg.author_name || msg.author}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            flexShrink: 0
                                        }}
                                    />
                                )}
                                
                                {/* Username */}
                                <span style={{ 
                                    color: msg.platform === 'twitch' ? '#9146FF' : '#FF0000',
                                    fontWeight: '600',
                                    flexShrink: 0
                                }}>
                                    {msg.author_name || msg.author}:
                                </span>
                                
                                {/* Message Content */}
                                <span style={{ color: settings.text_color, flex: 1 }}>
                                    <MessageContent message={msg.message} emotes={{}} />
                                </span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            
            {/* Подсказка внизу */}
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

