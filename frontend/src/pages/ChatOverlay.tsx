import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import MessageContent from '@/features/chat/components/MessageContent';
import { getAllEmotesForChannel } from '@/features/chat/utils/emotes';
import { chatboxService } from '@/services/api/services/chatboxService';
import { chatService } from '@/services/api/services/chatService';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import useSharedWebSocket from '@/shared/hooks/useSharedWebSocket';
import { logger } from '@/shared/utils/prodLogger';

import type { ApiResponse } from '@/types/api';
import type { ChatBoxSettings, ChatMessage, ContextMenu, WebSocketMessage } from '@/types/chat';
import type { AxiosError } from 'axios';

interface ChatHistoryApiResponse {
    success: boolean;
    messages: ChatMessage[];
}

interface Emotes {
    channelEmotes: Map<string, unknown>;
    globalEmotes: Map<string, unknown>;
}

// Memoized message component to prevent unnecessary re-renders
interface ChatMessageItemProps {
    msg: ChatMessage;
    index: number;
    settings: ChatBoxSettings;
    lastAddedMessageId: string | null;
    emotes: Emotes;
    onNicknameClick: (e: React.MouseEvent, username: string, platform: 'twitch' | 'vk' | 'youtube') => void;
    truncateWords: (text: string | undefined, maxWords: number) => string;
}

const ChatMessageItem = memo<ChatMessageItemProps>(({ 
    msg, 
    index, 
    settings, 
    lastAddedMessageId, 
    emotes, 
    onNicknameClick,
    truncateWords 
}) => {
    const messageId = msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`;
    const isNewMessage = messageId === lastAddedMessageId;
    
    const messageStyle = useMemo(() => {
        const baseStyle: React.CSSProperties = {
            borderRadius: `${settings?.border_radius || 8}px`,
            whiteSpace: settings.chat_direction === 'horizontal' ? 'nowrap' : 'normal',
            wordBreak: settings.chat_direction === 'horizontal' ? 'normal' : 'keep-all',
            overflowWrap: 'anywhere',
            flexShrink: 0,
            minWidth: settings.chat_direction === 'horizontal' ? 'fit-content' : 'auto',
            maxWidth: settings.chat_direction === 'horizontal' ? '600px' : 'auto',
            padding: settings.chat_direction === 'horizontal' ? '6px 10px' : '0',
            backgroundColor: settings.chat_direction === 'horizontal' ? 'rgba(0, 0, 0, 0.3)' : 'transparent',
            marginTop: index > 0 && settings.chat_direction !== 'horizontal' ? `${settings?.message_spacing || 4}px` : '0'
        };
        
        if (isNewMessage) {
            const animationType = settings?.animation_type || 'fade';
            const animationDuration = settings?.animation_duration || 300;
            
            const animationName = 
                animationType === 'fade' ? 'fadeIn' :
                animationType === 'slide-right' ? 'slideRight' :
                animationType === 'slide-left' ? 'slideLeft' :
                animationType === 'scale' ? 'scale' :
                animationType === 'bounce' ? 'bounce' :
                'fadeIn';
            
            return {
                ...baseStyle,
                animation: `${animationName} ${animationDuration}ms ease-out`
            };
        }
        
        return baseStyle;
    }, [isNewMessage, settings, index]);
    
    return (
        <div 
            key={messageId}
            style={messageStyle}
        >
            {settings?.show_platform_icons && (
                msg.platform === 'twitch' ? (
                    <TwitchIcon 
                        style={{ 
                            color: '#9147FF',
                            width: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                            height: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                            display: 'inline-block',
                            verticalAlign: 'text-bottom',
                            marginRight: '4px'
                        }} 
                    />
                ) : (
                    <VKIcon 
                        style={{ 
                            color: '#EF4444',
                            width: `${Math.round(Math.max(12, Math.min(24, settings?.font_size || 16)) * 0.85)}px`,
                            height: `${Math.round(Math.max(12, Math.min(24, settings?.font_size || 16)) * 0.85)}px`,
                            display: 'inline-block',
                            verticalAlign: 'text-bottom',
                            marginRight: '4px'
                        }} 
                    />
                )
            )}
            
            {settings?.show_badges && msg.badges && Array.isArray(msg.badges) && msg.badges.length > 0 && (
                <>
                    {msg.badges.map((badge: string, idx: number) => {
                        const [badgeId, version] = badge.split('/');
                        const badgeUrl = twitchBadgesService.getBadgeUrl(badgeId, version, '1x');
                        
                        if (!badgeUrl) return null;
                        
                        const badgeSize = Math.max(14, Math.min(28, (settings?.font_size || 16) * 1.1));
                        return (
                            <img 
                                key={idx} 
                                src={badgeUrl}
                                alt={badgeId}
                                title={badge}
                                style={{ 
                                    width: `${badgeSize}px`, 
                                    height: `${badgeSize}px`,
                                    display: 'inline-block',
                                    verticalAlign: 'text-bottom',
                                    marginRight: '2px'
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        );
                    })}
                </>
            )}
            
            {settings?.show_avatars && msg.avatar_url && (
                <img
                    src={msg.avatar_url}
                    alt={msg.author_name || msg.author}
                    style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'inline-block',
                        verticalAlign: 'text-bottom',
                        marginRight: '6px'
                    }}
                />
            )}
            
            <span style={{ 
                ...(settings.text_stroke_width && settings.text_stroke_width > 0 ? {
                    WebkitTextStroke: `${settings.text_stroke_width}px ${settings.text_stroke_color || '#000000'}`,
                    paintOrder: 'stroke fill'
                } : {})
            }}>
                <span 
                    onClick={(e) => onNicknameClick(e, msg.author_name || msg.author || 'Unknown', msg.platform)}
                    style={{ 
                        color: msg.platform === 'twitch' ? '#9146FF' : '#FF0000',
                        fontWeight: '600',
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                    title="Кликните для открытия меню"
                >
                    {msg.author_name || msg.author}
                </span>
                {': '}
                <span style={{ color: settings.text_color }}>
                    {settings.chat_direction === 'horizontal' ? (
                        truncateWords(msg.message || msg.content, 6)
                    ) : (
                        <MessageContent 
                            message={msg.message || msg.content || ''} 
                            channelEmotes={settings?.show_7tv_emotes !== false ? emotes.channelEmotes : new Map()}
                            globalEmotes={settings?.show_7tv_emotes !== false ? emotes.globalEmotes : new Map()}
                            showLinks={settings?.show_links !== false}
                        />
                    )}
                </span>
            </span>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for memo
    // Only re-render if these specific props change
    return (
        prevProps.msg.id === nextProps.msg.id &&
        prevProps.index === nextProps.index &&
        prevProps.lastAddedMessageId === nextProps.lastAddedMessageId &&
        prevProps.settings.font_size === nextProps.settings.font_size &&
        prevProps.settings.animation_type === nextProps.settings.animation_type &&
        prevProps.settings.chat_direction === nextProps.settings.chat_direction &&
        prevProps.settings.show_platform_icons === nextProps.settings.show_platform_icons &&
        prevProps.settings.show_badges === nextProps.settings.show_badges &&
        prevProps.settings.show_7tv_emotes === nextProps.settings.show_7tv_emotes
    );
});

ChatMessageItem.displayName = 'ChatMessageItem';

const ChatOverlay: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [settings, setSettings] = useState<ChatBoxSettings | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [channelName, setChannelName] = useState<string | null>(null);
    const [lastAddedMessageId, setLastAddedMessageId] = useState<string | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    
    const [emotes, setEmotes] = useState<Emotes>({ channelEmotes: new Map(), globalEmotes: new Map() });
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const processedMessageIds = useRef<Set<string>>(new Set());
    const historyLoadedRef = useRef<boolean>(false);
    
    const containerStyle = useMemo<React.CSSProperties>(() => {
        if (!settings) return {};
        
        logger.log('[STYLES] Recalculating containerStyle with font_family:', settings?.font_family);
        
        return {
            width: `${settings?.chat_width || 100}vw`,
            height: '100vh',
            padding: '16px',
            fontFamily: settings?.font_family || 'Inter, sans-serif',
            fontSize: `${settings?.font_size || 16}px`,
            fontWeight: settings?.font_weight || 'normal',
            color: settings?.text_color || '#FFFFFF',
            backgroundColor: (() => {
                const hex = settings?.background_color || '#000000';
                const opacity = settings?.background_opacity ?? 0.8;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
            })(),
            overflow: 'hidden'
        };
    }, [settings?.font_family, settings?.font_size, settings?.font_weight, settings?.text_color, settings?.background_color, settings?.background_opacity, settings?.chat_width]);
    
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .horizontal-chat-scroll::-webkit-scrollbar {
                height: 8px;
            }
            .horizontal-chat-scroll::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            .horizontal-chat-scroll::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 4px;
            }
            .horizontal-chat-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }
            .horizontal-chat-scroll {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);
    
    useEffect(() => {
        if (!settings?.font_family) return;
        
        const systemFonts = [
            'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 'Courier',
            'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS', 'Trebuchet MS',
            'Arial Black', 'Impact', 'Inter', 'sans-serif', 'serif', 'monospace'
        ];
        
        const fontFamily = settings.font_family;
        const isSystemFont = systemFonts.some(sf => fontFamily.includes(sf));
        
        if (isSystemFont) {
            logger.log(`[FONT] Using system font: ${fontFamily}`);
            return;
        }
        
        const existingLink = document.querySelector(`link[href*="${fontFamily.replace(/\s+/g, '+')}"]`);
        if (existingLink) {
            logger.log(`[FONT] Font already loaded: ${fontFamily}`);
            return;
        }
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap`;
        
        logger.log(`[FONT] Loading Google Font: ${fontFamily}`);
        logger.log(`[LINK] [FONT] URL: ${link.href}`);
        
        document.head.appendChild(link);
        
        return () => {
            if (document.head.contains(link)) {
                document.head.removeChild(link);
                logger.log(`[DELETE] [FONT] Removed font: ${fontFamily}`);
            }
        };
    }, [settings?.font_family]);
    

    
    const loadSettings = useCallback(async (isPolling: boolean = false): Promise<void> => {
        if (!token) return;
        
        try {
            const response = await chatboxService.getSettingsByToken(token);
            const responseData = response.data as ApiResponse<ChatBoxSettings>;
            const data = responseData.data || {} as ChatBoxSettings;
            
            const normalizedSettings: ChatBoxSettings = {
                ...data,
                font_size: parseInt(String(data.font_size)) || 16,
                text_stroke_width: parseInt(String(data.text_stroke_width)) || 0,
                text_stroke_color: data.text_stroke_color || '#000000',
                background_opacity: parseFloat(String(data.background_opacity)) ?? 0.5,
                background_color: data.background_color || '#000000',
                max_messages: parseInt(String(data.max_messages)) || 20,
                message_spacing: parseInt(String(data.message_spacing)) || 4,
                animation_type: (data.animation_type || 'fade') as 'fade' | 'slide-right' | 'slide-left' | 'scale' | 'bounce',
                animation_duration: parseInt(String(data.animation_duration)) || 300,
                chat_direction: (data.chat_direction || 'vertical') as 'vertical' | 'horizontal',
                chat_width: parseInt(String(data.chat_width)) || 100,
                border_radius: parseInt(String(data.border_radius)) || 8
            };
            
            if (!isPolling) {
                logger.log(`[OK] [SETTINGS] Animation: ${normalizedSettings.animation_type} (${normalizedSettings.animation_duration}ms)`);
                logger.log(`[OK] [SETTINGS] Chat direction: ${normalizedSettings.chat_direction}`);
            }
            
            setSettings(normalizedSettings);
            
            if (!isPolling) {
                await twitchBadgesService.loadGlobalBadges();
                
                if (data.channel_name) {
                    setChannelName(data.channel_name);
                    await twitchBadgesService.loadChannelBadges(data.channel_name);
                    logger.log(`[OK] [BADGES] Loaded badges for channel: ${data.channel_name}`);
                    
                    if (normalizedSettings.show_7tv_emotes !== false) {
                        try {
                            const emotesData = await getAllEmotesForChannel(data.channel_name);
                            setEmotes(emotesData);
                            logger.log(`[OK] [7TV] Loaded emotes for channel: ${data.channel_name}`);
                        } catch (error: unknown) {
                            logger.error('Error loading 7TV emotes:', error);
                        }
                    }
                }
                
                setUserId(normalizedSettings.user_id || null);
            }
        } catch (error: unknown) {
            const axiosError = error as AxiosError<{ detail?: string }>;
            logger.error('[ERROR] Error loading ChatBox settings:', error);
            logger.error('Full error:', axiosError.response?.data || axiosError.message);
            if (!isPolling) {
                setError(`Ошибка загрузки настроек: ${axiosError.response?.data?.detail || axiosError.message}`);
            }
        } finally {
            if (!isPolling) {
                setLoading(false);
            }
        }
    }, [token]);
    
    useEffect(() => {
        if (!token) {
            setError('Токен не указан в URL');
            setLoading(false);
            return;
        }
        
        loadSettings();
        
        const pollInterval = setInterval(() => {
            loadSettings(true);
        }, 30000);
        
        return () => clearInterval(pollInterval);
    }, [token, loadSettings]);
    
    useEffect(() => {
        if (!userId || !settings || historyLoadedRef.current) return;
        
        const timeoutId = setTimeout(async () => {
            if (messages.length === 0 && !historyLoadedRef.current) {
                logger.log('[CHATOVERLAY] WebSocket history not received, loading via API...');
                try {
                    const response = await chatService.getChatHistory({
                        limit: settings.max_messages || 50
                    });
                    
                    const apiResponse = response.data as ChatHistoryApiResponse;
                    if (apiResponse.success && apiResponse.messages && apiResponse.messages.length > 0) {
                        const uniqueMessages: ChatMessage[] = [];
                        const seenIds = new Set<string>();
                        
                        for (const msg of apiResponse.messages) {
                            const uniqueKey = msg.id || `${msg.timestamp}-${msg.author}-${msg.message}`;
                            if (!seenIds.has(uniqueKey)) {
                                seenIds.add(uniqueKey);
                                uniqueMessages.push(msg);
                            }
                        }
                        
                        setMessages(uniqueMessages);
                        processedMessageIds.current = new Set(uniqueMessages.map(msg => 
                            msg.id || `${msg.timestamp}-${msg.author}-${msg.message || msg.content}`
                        ));
                        historyLoadedRef.current = true;
                        
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
                        }, 100);
                        
                        logger.log(`[CHATOVERLAY] Loaded ${uniqueMessages.length} messages via API fallback`);
                    }
                } catch (error: unknown) {
                    logger.error('[ERROR] [CHATOVERLAY] Error loading history via API:', error);
                }
            }
        }, 3000);
        
        return () => clearTimeout(timeoutId);
    }, [userId, settings, messages.length]);
    
    const handleWebSocketMessage = useCallback((data: WebSocketMessage): void => {
        if (data.type === 'cache_invalidate') {
            logger.log('[REFRESH] [CACHE] Received cache invalidation:', data.cache_key);
            if (data.cache_key === 'cache_chatbox_settings') {
                logger.log('[REFRESH] [CHATBOX] Reloading settings due to backend update...');
                loadSettings(true);
            }
            return;
        }
        
        if (data.type === 'chatbox_settings_updated') {
            logger.log('[REFRESH] [CHATBOX] Received settings update event');
            
            const updateData = data.data as Partial<ChatBoxSettings> | undefined;
            setSettings(prevSettings => {
                if (!prevSettings) return prevSettings;
                const updatedSettings: ChatBoxSettings = {
                    ...prevSettings,
                    ...updateData,
                    font_size: parseInt(String(updateData?.font_size)) || prevSettings.font_size || 16,
                    text_stroke_width: parseInt(String(updateData?.text_stroke_width)) || prevSettings.text_stroke_width || 0,
                    text_stroke_color: updateData?.text_stroke_color || prevSettings.text_stroke_color || '#000000',
                    background_opacity: parseFloat(String(updateData?.background_opacity)) ?? prevSettings.background_opacity ?? 0.5,
                    background_color: updateData?.background_color || prevSettings.background_color || '#000000',
                    max_messages: parseInt(String(updateData?.max_messages)) || prevSettings.max_messages || 20,
                    message_spacing: parseInt(String(updateData?.message_spacing)) || prevSettings.message_spacing || 4,
                    message_fade_seconds: parseInt(String(updateData?.message_fade_seconds)) || prevSettings.message_fade_seconds || 60,
                    animation_duration: parseInt(String(updateData?.animation_duration)) || prevSettings.animation_duration || 300,
                    chat_width: parseInt(String(updateData?.chat_width)) || prevSettings.chat_width || 100,
                    border_radius: parseInt(String(updateData?.border_radius)) || prevSettings.border_radius || 8
                };
                
                logger.log('[REFRESH] [CHATBOX] Settings updated:', updatedSettings);
                return updatedSettings;
            });
            return;
        }
        
        if (data.type === 'message' || data.type === 'chat_message') {
            const messageId = data.id || `${data.timestamp}-${data.author || data.author_name}-${data.message}`;
            
            if (processedMessageIds.current.has(messageId)) {
                return;
            }
            
            processedMessageIds.current.add(messageId);
            setLastAddedMessageId(messageId);
            
            setTimeout(() => {
                setLastAddedMessageId(null);
            }, (settings?.animation_duration || 300) + 100);
            
            setMessages(prev => {
                const isDuplicate = prev.some(msg => 
                    msg.id === data.id || 
                    (msg.timestamp === String(data.timestamp) && (msg.author === data.author || msg.author_name === data.author_name) && (msg.message || msg.content) === data.message)
                );
                
                if (isDuplicate) return prev;
                
                const newMessage: ChatMessage = {
                    id: data.id || messageId,
                    author: data.author || data.author_name || 'Unknown',
                    author_name: data.author_name || data.author,
                    message: data.message || '',
                    timestamp: String(data.timestamp || Date.now()),
                    platform: data.platform || 'twitch',
                    badges: (data as WebSocketMessage & { badges?: string[] }).badges
                };
                
                const newMessages = [...prev, newMessage];
                const maxMessages = settings?.max_messages || 20;
                const result = newMessages.slice(-maxMessages);
                
                if (processedMessageIds.current.size > maxMessages * 2) {
                    const recentIds = new Set(result.map(msg => 
                        msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`
                    ));
                    processedMessageIds.current = recentIds;
                }
                
                return result;
            });
        } 
        else if (data.type === 'chat_history') {
            logger.log(`[CHAT] Loaded ${data.messages?.length || 0} messages from history`);
            
            const uniqueMessages: ChatMessage[] = [];
            const seenIds = new Set<string>();
            
            for (const msg of (data.messages || [])) {
                const uniqueKey = msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`;
                if (!seenIds.has(uniqueKey)) {
                    seenIds.add(uniqueKey);
                    uniqueMessages.push(msg);
                }
            }
            
            setMessages(uniqueMessages);
            processedMessageIds.current = new Set(uniqueMessages.map(msg => 
                msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`
            ));
            historyLoadedRef.current = true;
            
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
            }, 100);
        }
    }, [settings, loadSettings]);
    
    useSharedWebSocket(userId, handleWebSocketMessage as (message: Record<string, unknown>) => void);
    
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ 
                behavior: 'smooth',
                block: settings?.chat_direction === 'horizontal' ? 'nearest' : 'end',
                inline: settings?.chat_direction === 'horizontal' ? 'end' : 'nearest'
            });
        }
    }, [messages, settings?.chat_direction]);
    
    useEffect(() => {
        const fadeSeconds = settings?.message_fade_seconds;
        
        if (!fadeSeconds || fadeSeconds >= 60) {
            return;
        }
        
        const interval = setInterval(() => {
            const now = Date.now();
            
            setMessages(prev => {
                if (prev.length === 0) return prev;
                
                const filtered = prev.filter(msg => {
                    const messageAge = (now - Number(msg.timestamp)) / 1000;
                    return messageAge < fadeSeconds;
                });
                
                if (filtered.length < prev.length) {
                    logger.log(`[DELETE] [FADE] Removed ${prev.length - filtered.length} old messages (>${fadeSeconds}s)`);
                }
                
                return filtered;
            });
        }, 1000);
        
        return () => clearInterval(interval);
    }, [settings?.message_fade_seconds]);
    
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);
    
    // Move hooks before early returns to comply with rules-of-hooks
    const truncateWords = useCallback((text: string | undefined, maxWords: number = 6): string => {
        if (!text) return '';
        const words = text.trim().split(/\s+/);
        if (words.length <= maxWords) return text;
        return `${words.slice(0, maxWords).join(' ')  }...`;
    }, []);
    
    const handleNicknameClick = useCallback((e: React.MouseEvent, username: string, platform: 'twitch' | 'vk' | 'youtube'): void => {
        e.preventDefault();
        e.stopPropagation();
        
        const x = e.clientX + 5;
        const y = e.clientY + 5;
        
        setContextMenu({ x, y, username, platform });
    }, []);
    
    if (loading) {
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
                <div style={{ fontSize: '48px' }}>⏳</div>
                <div style={{ fontSize: '18px' }}>Загрузка настроек ChatBox...</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Токен: {token?.slice(0, 8)}...</div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                padding: '20px',
                textAlign: 'center',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px' }}>[ERROR]</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Ошибка загрузки настроек</div>
                <div style={{ fontSize: '14px', maxWidth: '600px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                    {error}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Откройте консоль (F12) для деталей</div>
            </div>
        );
    }
    
    if (!settings) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
                color: '#2d3436',
                fontFamily: 'Inter, sans-serif',
                padding: '20px',
                textAlign: 'center',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px' }}>[WARN]</div>
                <div style={{ fontSize: '18px' }}>Настройки не найдены</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Токен: {token}</div>
            </div>
        );
    }
    
    return (
        <>
            <style>
                {`
                    @keyframes fadeIn {
                        0% {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        100% {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes slideRight {
                        0% {
                            opacity: 0;
                            transform: translateX(-40px) scale(0.95);
                        }
                        60% {
                            transform: translateX(5px) scale(1.02);
                        }
                        100% {
                            opacity: 1;
                            transform: translateX(0) scale(1);
                        }
                    }
                    
                    @keyframes slideLeft {
                        0% {
                            opacity: 0;
                            transform: translateX(40px) scale(0.95);
                        }
                        60% {
                            transform: translateX(-5px) scale(1.02);
                        }
                        100% {
                            opacity: 1;
                            transform: translateX(0) scale(1);
                        }
                    }
                    
                    @keyframes scale {
                        0% {
                            opacity: 0;
                            transform: scale(0.7) rotate(-3deg);
                        }
                        50% {
                            transform: scale(1.05) rotate(1deg);
                        }
                        100% {
                            opacity: 1;
                            transform: scale(1) rotate(0deg);
                        }
                    }
                    
                    @keyframes bounce {
                        0% {
                            opacity: 0;
                            transform: translateY(30px) scale(0.8);
                        }
                        40% {
                            opacity: 1;
                            transform: translateY(-10px) scale(1.05);
                        }
                        60% {
                            transform: translateY(5px) scale(0.98);
                        }
                        80% {
                            transform: translateY(-3px) scale(1.01);
                        }
                        100% {
                            transform: translateY(0) scale(1);
                        }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { 
                            opacity: 1;
                            transform: scale(1);
                        }
                        50% { 
                            opacity: 0.7;
                            transform: scale(0.98);
                        }
                    }
                `}
            </style>
            
            <div style={containerStyle}>
                {messages.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: settings.text_color,
                        opacity: 0.5,
                        textAlign: 'center',
                        fontSize: `${settings.font_size}px`
                    }}>
                        <div>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>[CHAT]</div>
                            <div>Ожидание сообщений...</div>
                            <div style={{ fontSize: '0.8em', marginTop: '8px' }}>
                                Сообщения появятся здесь автоматически
                            </div>
                        </div>
                    </div>
                ) : (
                    <div 
                        className={settings.chat_direction === 'horizontal' ? 'horizontal-chat-scroll' : ''}
                        style={{ 
                            display: 'flex', 
                            flexDirection: settings.chat_direction === 'horizontal' ? 'row' : 'column',
                            minHeight: '100%',
                            height: '100%',
                            overflowX: settings.chat_direction === 'horizontal' ? 'auto' : 'hidden',
                            overflowY: settings.chat_direction === 'horizontal' ? 'hidden' : 'auto',
                            alignItems: settings.chat_direction === 'horizontal' ? 'center' : 'stretch',
                            gap: settings.chat_direction === 'horizontal' ? '8px' : '0',
                            paddingBottom: settings.chat_direction === 'horizontal' ? '8px' : '0'
                        }}
                    >
                        {settings.chat_direction !== 'horizontal' && <div style={{ flexGrow: 1 }} />}
                        {messages.map((msg, index) => (
                            <ChatMessageItem
                                key={msg.id || `${msg.platform}-${msg.timestamp}-${msg.author_name || msg.author}`}
                                msg={msg}
                                index={index}
                                settings={settings}
                                lastAddedMessageId={lastAddedMessageId}
                                emotes={emotes}
                                onNicknameClick={handleNicknameClick}
                                truncateWords={truncateWords}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: `${contextMenu.y}px`,
                        left: `${contextMenu.x}px`,
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '8px',
                        padding: '8px 0',
                        zIndex: 9999,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                        minWidth: '180px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{
                        padding: '8px 16px',
                        borderBottom: '1px solid #333',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}>
                        {contextMenu.username}
                    </div>
                    
                    <button
                        onClick={async () => {
                            try {
                                await chatService.toggleMute({
                                    username: contextMenu.username,
                                    platform: contextMenu.platform,
                                    channel_name: channelName || 'unknown'
                                });
                                setContextMenu(null);
                            } catch (error: unknown) {
                                logger.error('Ошибка блокировки TTS:', error);
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#ff4444',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                    >
                        Заглушить
                    </button>
                    
                    <button
                        onClick={async () => {
                            try {
                                await chatService.toggleMute({
                                    username: contextMenu.username,
                                    platform: contextMenu.platform,
                                    channel_name: channelName || 'unknown'
                                });
                                setContextMenu(null);
                            } catch (error: unknown) {
                                logger.error('Ошибка разблокировки TTS:', error);
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#00c851',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                    >
                        [VOLUME] Разглушить
                    </button>
                </div>
            )}
        </>
    );
};

export default ChatOverlay;

