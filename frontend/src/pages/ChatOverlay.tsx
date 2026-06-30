import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import MessageContent from '@/features/chat/components/MessageContent';
import { getAllEmotesForChannel } from '@/features/chat/utils/emotes';
import { CHATBOX_BRAND_FONT } from '@/features/chatbox/constants/fontOptions';
import { loadGoogleFont, normalizeChatBoxSettings, resolveMessageBackgroundMode } from '@/features/chatbox/utils/chatboxHelpers';
import { chatboxService } from '@/services/api/services/chatboxService';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { VkRoleBadge } from '@/shared/components/RoleBadge';
import { logger } from '@/shared/utils/prodLogger';

import { useChatOverlayWebSocket } from './useChatOverlayWebSocket';

import type { ApiResponse } from '@/types/api';
import type { ChatBoxSettings, ChatMessage, WebSocketMessage } from '@/types/chat';
import type { AxiosError } from 'axios';

interface Emotes {
    channelEmotes: Map<string, unknown>;
    globalEmotes: Map<string, unknown>;
}

const toRgba = (hex: string, opacity: number): string => {
    if (!hex || !hex.startsWith('#')) {
        return `rgba(0, 0, 0, ${opacity})`;
    }
    const normalized = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const parseIntOr = (value: unknown, fallback: number): number => {
    const parsed = Number.parseInt(String(value));
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseFloatOr = (value: unknown, fallback: number): number => {
    const parsed = Number.parseFloat(String(value));
    return Number.isNaN(parsed) ? fallback : parsed;
};

const clampNumber = (value: number, min: number, max: number): number => {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
};

const normalizeVkAssetUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `https://images.live.vkvideo.ru${url}`;
    return url;
};

// Memoized message component to prevent unnecessary re-renders
interface ChatMessageItemProps {
    msg: ChatMessage;
    index: number;
    settings: ChatBoxSettings;
    lastAddedMessageId: string | null;
    emotes: Emotes;
    channelName: string | null;
    onNicknameClick: (e: React.MouseEvent, username: string, platform: 'twitch' | 'vk' | 'youtube') => void;
    onMediaLoad: () => void;
}

const ChatMessageItem = memo<ChatMessageItemProps>(
    ({ msg, index, settings, lastAddedMessageId, emotes, channelName, onNicknameClick, onMediaLoad }) => {
        const messageId = msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`;
        const isNewMessage = messageId === lastAddedMessageId;
        const isHorizontal = settings.chat_direction === 'horizontal';
        const metaGroupStyle: React.CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            lineHeight: 1,
            verticalAlign: 'top',
            whiteSpace: 'nowrap',
            flexShrink: 0,
        };
        const showMeta = Boolean(
            settings?.show_platform_icons ||
            (settings?.show_badges && msg.badges && Array.isArray(msg.badges) && msg.badges.length > 0) ||
            (settings?.show_badges && msg.platform === 'vk' && msg.role)
        );
        const usernameColor = settings.username_color || (msg.platform === 'twitch' ? '#9146FF' : '#FF4444');
        const messageBackgroundMode = resolveMessageBackgroundMode(settings);

        const messageStyle = useMemo(() => {
            const resolvedFontFamily = settings?.font_family
                ? settings.font_family.includes(',')
                    ? settings.font_family
                    : `${settings.font_family}, sans-serif`
                : undefined;
            const messageBackground =
                messageBackgroundMode !== 'message'
                    ? 'transparent'
                    : (settings?.background_opacity ?? 0) > 0
                    ? toRgba(settings?.background_color || '#000000', settings?.background_opacity ?? 0.5)
                    : 'transparent';
            const baseFontSize = settings?.font_size || 16;
            const verticalPadding = settings.chat_direction === 'horizontal' ? 6 : 4;
            const minMessageHeight = Math.round(baseFontSize * 1.35 + verticalPadding * 2);
            const baseStyle: React.CSSProperties = {
                fontFamily: resolvedFontFamily,
                borderRadius: `${settings?.border_radius ?? 8}px`,
                whiteSpace: isHorizontal ? 'nowrap' : 'normal',
                wordBreak: isHorizontal ? 'normal' : 'break-word',
                overflowWrap: isHorizontal ? 'normal' : 'anywhere',
                overflow: isHorizontal ? 'hidden' : 'visible',
                textOverflow: isHorizontal ? 'ellipsis' : 'clip',
                flexShrink: 0,
                minWidth: 0,
                maxWidth: isHorizontal ? 'min(560px, 82vw)' : '100%',
                padding: settings.chat_direction === 'horizontal' ? '6px 10px' : '4px 8px',
                backgroundColor: messageBackground,
                boxShadow:
                    messageBackgroundMode === 'message' && messageBackground !== 'transparent'
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.18)'
                        : 'none',
                textShadow:
                    messageBackgroundMode === 'none'
                        ? '0 2px 4px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.95)'
                        : undefined,
                lineHeight: 1.25,
                display: settings.chat_direction === 'horizontal' ? 'inline-grid' : 'grid',
                gridTemplateColumns: 'max-content minmax(0, 1fr)',
                alignItems: 'start',
                columnGap: '6px',
                width: isHorizontal ? 'max-content' : '100%',
                minHeight: settings.chat_direction === 'horizontal' ? undefined : `${minMessageHeight}px`,
                marginTop:
                    index > 0 && settings.chat_direction !== 'horizontal' ? `${settings?.message_spacing ?? 4}px` : '0',
            };

            if (isNewMessage) {
                const animationType =
                    settings?.chat_direction === 'horizontal'
                        ? settings?.animation_type === 'none'
                            ? 'none'
                            : 'slide-left'
                        : settings?.animation_type || 'fade';
                const animationDuration = settings?.animation_duration || 300;
                const shouldAnimate = animationType !== 'none' && animationDuration > 0;

                const animationName =
                    animationType === 'fade'
                        ? 'fadeIn'
                        : animationType === 'slide-right' || animationType === 'slide'
                          ? 'slideRight'
                          : animationType === 'slide-left'
                            ? 'slideLeft'
                            : animationType === 'scale'
                              ? 'scale'
                              : animationType === 'bounce'
                                ? 'bounce'
                                : 'fadeIn';

                if (shouldAnimate) {
                    return {
                        ...baseStyle,
                        animation: `${animationName} ${animationDuration}ms ease-out`,
                    };
                }
            }

            return baseStyle;
        }, [isNewMessage, settings, index, messageBackgroundMode]);

        return (
            <div key={messageId} style={messageStyle}>
                <span
                    style={{
                        ...(settings.text_stroke_width && settings.text_stroke_width > 0
                            ? {
                                  WebkitTextStroke: `${settings.text_stroke_width}px ${settings.text_stroke_color || '#000000'}`,
                                  paintOrder: 'stroke fill',
                              }
                            : {}),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        minWidth: 0,
                        maxWidth: isHorizontal ? '220px' : 'min(44vw, 260px)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'top',
                    }}
                >
                    {showMeta && (
                        <span style={metaGroupStyle}>
                        {settings?.show_platform_icons &&
                            (msg.platform === 'twitch' ? (
                                <TwitchIcon
                                    style={{
                                        color: '#9146FF',
                                        width: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                        height: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                        display: 'inline-block',
                                        verticalAlign: 'text-bottom',
                                    }}
                                />
                            ) : (
                                <VKIcon
                                    style={{
                                        color: '#FF4444',
                                        width: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                        height: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                        display: 'inline-block',
                                        verticalAlign: 'text-bottom',
                                    }}
                                />
                            ))}

                        {settings?.show_badges &&
                            msg.badges &&
                            Array.isArray(msg.badges) &&
                            msg.badges.length > 0 &&
                            msg.platform === 'twitch' && (
                                <>
                                    {msg.badges.map((badge: string, idx: number) => {
                                        const [badgeId, version] = badge.split('/');
                                        const badgeUrl = twitchBadgesService.getBadgeUrl(
                                            badgeId,
                                            version,
                                            '1x',
                                            msg.channel_name || msg.channel || channelName
                                        );

                                        if (!badgeUrl) return null;

                                        const badgeSize = Math.max(16, Math.min(32, (settings?.font_size || 16) * 1.2));
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
                                                }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        );
                                    })}
                                </>
                            )}

                        {settings?.show_badges &&
                            msg.badges &&
                            Array.isArray(msg.badges) &&
                            msg.badges.length > 0 &&
                            msg.platform === 'vk' && (
                                <>
                                    {msg.badges.map((badge: string, idx: number) => (
                                        <img
                                            key={idx}
                                            src={normalizeVkAssetUrl(badge)}
                                            alt="badge"
                                            style={{
                                                width: `${Math.max(16, Math.min(32, (settings?.font_size || 16) * 1.2))}px`,
                                                height: `${Math.max(16, Math.min(32, (settings?.font_size || 16) * 1.2))}px`,
                                                display: 'inline-block',
                                                verticalAlign: 'text-bottom',
                                            }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ))}
                                </>
                            )}

                        {settings?.show_badges && msg.platform === 'vk' && msg.role && (
                            <VkRoleBadge
                                role={msg.role}
                                size={Math.max(12, Math.min(18, (settings?.font_size || 16) * 0.9))}
                                style={{ lineHeight: 1, verticalAlign: 'text-bottom' }}
                            />
                        )}
                    </span>
                    )}
                    <span
                        onClick={(e) => onNicknameClick(e, msg.author_name || msg.author || 'Unknown', msg.platform)}
                        style={{
                            color: usernameColor,
                            fontWeight: '600',
                            cursor: 'pointer',
                            userSelect: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        title="Кликните для открытия меню"
                    >
                        {msg.author_name || msg.author}
                    </span>
                    <span style={{ color: settings.text_color }}>:</span>
                </span>

                <span
                    style={{
                        color: settings.text_color,
                        minWidth: 0,
                        maxWidth: '100%',
                        overflow: isHorizontal ? 'hidden' : 'visible',
                        overflowWrap: isHorizontal ? 'normal' : 'anywhere',
                        textOverflow: isHorizontal ? 'ellipsis' : 'clip',
                        wordBreak: isHorizontal ? 'normal' : 'break-word',
                        whiteSpace: isHorizontal ? 'nowrap' : 'normal',
                        alignSelf: 'start',
                    }}
                >
                        <MessageContent
                            message={msg.message || msg.content || ''}
                            channelEmotes={!isHorizontal && settings?.show_7tv_emotes !== false ? emotes.channelEmotes : new Map()}
                            globalEmotes={!isHorizontal && settings?.show_7tv_emotes !== false ? emotes.globalEmotes : new Map()}
                            twitchEmotes={isHorizontal ? [] : msg.emotes}
                            showLinks={!isHorizontal && settings?.show_links !== false}
                            autoLoadImages={!isHorizontal && settings?.auto_load_images !== false}
                            imageLoading="eager"
                            plainTextOnly={isHorizontal}
                            onMediaLoad={isHorizontal ? undefined : onMediaLoad}
                        />
                </span>
            </div>
        );
    },

    (prevProps, nextProps) => {
        // Custom comparison function for memo
        // Only re-render if these specific props change
        return (
            prevProps.msg.id === nextProps.msg.id &&
            prevProps.index === nextProps.index &&
            prevProps.lastAddedMessageId === nextProps.lastAddedMessageId &&
            prevProps.settings.font_family === nextProps.settings.font_family &&
            prevProps.settings.font_size === nextProps.settings.font_size &&
            prevProps.settings.font_weight === nextProps.settings.font_weight &&
            prevProps.settings.animation_type === nextProps.settings.animation_type &&
            prevProps.settings.animation_duration === nextProps.settings.animation_duration &&
            prevProps.settings.chat_direction === nextProps.settings.chat_direction &&
            prevProps.settings.border_radius === nextProps.settings.border_radius &&
            prevProps.settings.message_spacing === nextProps.settings.message_spacing &&
            prevProps.settings.text_color === nextProps.settings.text_color &&
            prevProps.settings.text_stroke_width === nextProps.settings.text_stroke_width &&
            prevProps.settings.text_stroke_color === nextProps.settings.text_stroke_color &&
            prevProps.settings.show_platform_icons === nextProps.settings.show_platform_icons &&
            prevProps.settings.show_badges === nextProps.settings.show_badges &&
            prevProps.settings.show_links === nextProps.settings.show_links &&
            prevProps.settings.show_7tv_emotes === nextProps.settings.show_7tv_emotes &&
            prevProps.settings.separate_message_backgrounds === nextProps.settings.separate_message_backgrounds &&
            prevProps.settings.message_background_mode === nextProps.settings.message_background_mode &&
            prevProps.settings.auto_load_images === nextProps.settings.auto_load_images &&
            prevProps.onMediaLoad === nextProps.onMediaLoad &&
            prevProps.emotes.channelEmotes === nextProps.emotes.channelEmotes &&
            prevProps.emotes.globalEmotes === nextProps.emotes.globalEmotes
        );
    }
);

ChatMessageItem.displayName = 'ChatMessageItem';

const sanitizeFontFamily = (fontFamily: string): string => fontFamily.replace(/[^a-zA-Z0-9,\s-]/g, '').trim();

const ChatOverlay: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const debugBackground = searchParams.get('debugBackground') === 'dark' ? 'dark' : 'transparent';

    const [settings, setSettings] = useState<ChatBoxSettings | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [channelName, setChannelName] = useState<string | null>(null);
    const [lastAddedMessageId, setLastAddedMessageId] = useState<string | null>(null);
    const [, setFontVersion] = useState(0);

    const [emotes, setEmotes] = useState<Emotes>({ channelEmotes: new Map(), globalEmotes: new Map() });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const processedMessageIds = useRef<Set<string>>(new Set());
    const historyLoadedRef = useRef<boolean>(false);

    const containerStyle = useMemo<React.CSSProperties>(() => {
        if (!settings) return {};

        const safeFontFamily = settings?.font_family ? sanitizeFontFamily(settings.font_family) : '';
        const resolvedFontFamily = safeFontFamily
            ? safeFontFamily.includes(',')
                ? safeFontFamily
                : `${safeFontFamily}, sans-serif`
            : `${CHATBOX_BRAND_FONT}, sans-serif`;

        return {
            ['--chatbox-overlay-font' as string]: resolvedFontFamily,
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            padding: '0',
            margin: 0,
            fontFamily: resolvedFontFamily,
            fontSize: `${settings?.font_size || 16}px`,
            fontWeight: settings?.font_weight || 'normal',
            color: settings?.text_color || '#FFFFFF',
            backgroundColor: debugBackground === 'dark' ? '#05070d' : 'transparent',
            borderRadius: `${settings?.border_radius || 0}px`,
            overflow: 'hidden',
            boxSizing: 'border-box',
        };
    }, [settings, debugBackground]);

    const chatFrameStyle = useMemo<React.CSSProperties>(() => {
        if (!settings) return {};
        const width = `${clampNumber(Number(settings.chat_width || 100), 20, 100)}%`;

        return {
            width,
            maxWidth: '100vw',
            height: '100%',
            minWidth: 0,
            marginLeft: '0',
            marginRight: 'auto',
            overflow: 'hidden',
            boxSizing: 'border-box',
        };
    }, [settings]);

    const messageBackgroundMode = useMemo(
        () => (settings ? resolveMessageBackgroundMode(settings) : 'message'),
        [settings]
    );

    useEffect(() => {
        const root = document.getElementById('root');
        const previous = {
            htmlBackground: document.documentElement.style.background,
            htmlMargin: document.documentElement.style.margin,
            htmlPadding: document.documentElement.style.padding,
            bodyBackground: document.body.style.background,
            bodyMargin: document.body.style.margin,
            bodyPadding: document.body.style.padding,
            rootBackground: root?.style.background || '',
            rootMargin: root?.style.margin || '',
            rootPadding: root?.style.padding || '',
        };
        const background = debugBackground === 'dark' ? '#05070d' : 'transparent';

        document.documentElement.style.background = background;
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.body.style.background = background;
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        if (root) {
            root.style.background = background;
            root.style.margin = '0';
            root.style.padding = '0';
        }

        return () => {
            document.documentElement.style.background = previous.htmlBackground;
            document.documentElement.style.margin = previous.htmlMargin;
            document.documentElement.style.padding = previous.htmlPadding;
            document.body.style.background = previous.bodyBackground;
            document.body.style.margin = previous.bodyMargin;
            document.body.style.padding = previous.bodyPadding;
            if (root) {
                root.style.background = previous.rootBackground;
                root.style.margin = previous.rootMargin;
                root.style.padding = previous.rootPadding;
            }
        };
    }, [debugBackground]);

    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .horizontal-chat-scroll::-webkit-scrollbar {
                display: none;
            }
            .horizontal-chat-scroll {
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    useEffect(() => {
        if (!settings?.font_family) return undefined;

        let active = true;
        loadGoogleFont(settings.font_family);

        if (typeof document === 'undefined' || !('fonts' in document)) {
            setFontVersion((prev) => prev + 1);
            return undefined;
        }

        const primaryFont = settings.font_family.split(',')[0]?.trim() || settings.font_family;
        Promise.allSettled([
            document.fonts.load(`${settings.font_weight || 'normal'} ${settings.font_size}px "${primaryFont}"`),
            document.fonts.ready,
        ]).finally(() => {
            if (active) {
                setFontVersion((prev) => prev + 1);
            }
        });

        return () => {
            active = false;
        };
    }, [settings?.font_family, settings?.font_size, settings?.font_weight]);

    const loadSettings = useCallback(async (): Promise<void> => {
        if (!token) return;

        try {
            const response = await chatboxService.getSettingsByToken(token);
            const responseData = response.data as ApiResponse<ChatBoxSettings> | ChatBoxSettings;
            const data = (
                'data' in responseData && responseData.data ? responseData.data : responseData
            ) as ChatBoxSettings;
            const normalizedSettings = normalizeChatBoxSettings(data as never) as ChatBoxSettings;

            logger.log(
                `[OK] [SETTINGS] Animation: ${normalizedSettings.animation_type} (${normalizedSettings.animation_duration}ms)`
            );
            logger.log(`[OK] [SETTINGS] Chat direction: ${normalizedSettings.chat_direction}`);

            setSettings(normalizedSettings);

            const resolvedChannelName = data.channel_name || normalizedSettings.channel_name || null;
            setChannelName(resolvedChannelName);
        } catch (error: unknown) {
            const axiosError = error as AxiosError<{ detail?: string }>;
            logger.error('[ERROR] Error loading ChatBox settings:', error);
            logger.error('Full error:', axiosError.response?.data || axiosError.message);
            setError(`Ошибка загрузки настроек: ${axiosError.response?.data?.detail || axiosError.message}`);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!settings?.show_badges) return;

        twitchBadgesService.loadGlobalBadges().catch((err: unknown) => {
            logger.warn('[WARN] [BADGES] Failed to load global badges:', err);
        });
    }, [settings?.show_badges]);

    useEffect(() => {
        if (!settings?.show_badges || !channelName) return;

        twitchBadgesService
            .loadChannelBadges(channelName)
            .then(() => {
                logger.log(`[OK] [BADGES] Loaded badges for channel: ${channelName}`);
            })
            .catch((err: unknown) => {
                logger.warn(`[WARN] [BADGES] Failed to load channel badges for ${channelName}:`, err);
            });
    }, [settings?.show_badges, channelName]);

    useEffect(() => {
        const loadEmotes = async (): Promise<void> => {
            if (!settings) return;

            if (settings?.show_7tv_emotes === false) {
                setEmotes({ channelEmotes: new Map(), globalEmotes: new Map() });
                return;
            }

            const twitchUserId = settings?.twitch_user_id || null;

            try {
                if (channelName || twitchUserId) {
                    const emotesData = await getAllEmotesForChannel(channelName || '', twitchUserId);
                    setEmotes(emotesData);
                    logger.log(`[OK] [7TV] Loaded emotes for channel: ${channelName || twitchUserId}`);
                } else {
                    const { getGlobalEmotes } = await import('@/features/chat/utils/emotes');
                    const globalEmotes = await getGlobalEmotes();
                    setEmotes({ channelEmotes: new Map(), globalEmotes });
                }
            } catch (error: unknown) {
                logger.error('Error loading 7TV emotes:', error);
            }
        };

        loadEmotes();
    }, [settings, channelName]);

    useEffect(() => {
        if (!token) {
            setError('Токен не указан в URL');
            setLoading(false);
            return;
        }

        loadSettings();
    }, [token, loadSettings]);

    const handleWebSocketMessage = useCallback(
        (data: WebSocketMessage): void => {
            if (data.type === 'cache_invalidate') {
                return;
            }

            if (data.type === 'chatbox_settings_updated') {
                logger.log('[REFRESH] [CHATBOX] Received settings update event');

                const updateData = data.data as Partial<ChatBoxSettings> | undefined;
                setSettings((prevSettings) => {
                    if (!prevSettings) return prevSettings;
                    const parsedUpdateOpacity = Number.parseFloat(String(updateData?.background_opacity));
                    const fontSize = clampNumber(
                        parseIntOr(updateData?.font_size ?? prevSettings.font_size, prevSettings.font_size || 16),
                        8,
                        32
                    );
                    const chatWidth = clampNumber(
                        parseIntOr(updateData?.chat_width ?? prevSettings.chat_width, prevSettings.chat_width || 100),
                        20,
                        100
                    );
                    const messageSpacing = clampNumber(
                        parseIntOr(
                            updateData?.message_spacing ?? prevSettings.message_spacing,
                            prevSettings.message_spacing || 4
                        ),
                        0,
                        32
                    );
                    const borderRadius = clampNumber(
                        parseIntOr(
                            updateData?.border_radius ?? prevSettings.border_radius,
                            prevSettings.border_radius || 8
                        ),
                        0,
                        32
                    );
                    const animationDuration = clampNumber(
                        parseIntOr(
                            updateData?.animation_duration ?? prevSettings.animation_duration,
                            prevSettings.animation_duration || 300
                        ),
                        0,
                        2000
                    );
                    const messageFadeSeconds = clampNumber(
                        parseIntOr(
                            updateData?.message_fade_seconds ?? prevSettings.message_fade_seconds,
                            prevSettings.message_fade_seconds || 60
                        ),
                        10,
                        60
                    );
                    const textStrokeWidth = clampNumber(
                        parseFloatOr(
                            updateData?.text_stroke_width ?? prevSettings.text_stroke_width,
                            prevSettings.text_stroke_width || 0
                        ),
                        0,
                        3
                    );

                    const updatedSettings: ChatBoxSettings = {
                        ...prevSettings,
                        ...updateData,
                        font_size: fontSize,
                        text_stroke_width: textStrokeWidth,
                        text_stroke_color: updateData?.text_stroke_color || prevSettings.text_stroke_color || '#000000',
                        background_opacity: Number.isFinite(parsedUpdateOpacity)
                            ? parsedUpdateOpacity
                            : (prevSettings.background_opacity ?? 0.5),
                        background_color: updateData?.background_color || prevSettings.background_color || '#000000',
                        max_messages: parseIntOr(
                            updateData?.max_messages ?? prevSettings.max_messages,
                            prevSettings.max_messages || 20
                        ),
                        message_spacing: messageSpacing,
                        message_fade_seconds: messageFadeSeconds,
                        animation_duration: animationDuration,
                        chat_width: chatWidth,
                        border_radius: borderRadius,
                        message_background_mode:
                            resolveMessageBackgroundMode({
                                message_background_mode:
                                    updateData?.message_background_mode ?? prevSettings.message_background_mode,
                                separate_message_backgrounds:
                                    updateData?.separate_message_backgrounds ?? prevSettings.separate_message_backgrounds,
                            }),
                        separate_message_backgrounds:
                            resolveMessageBackgroundMode({
                                message_background_mode:
                                    updateData?.message_background_mode ?? prevSettings.message_background_mode,
                                separate_message_backgrounds:
                                    updateData?.separate_message_backgrounds ?? prevSettings.separate_message_backgrounds,
                            }) === 'message',
                    };

                    return updatedSettings;
                });

                if (updateData?.channel_name) {
                    setChannelName(updateData.channel_name);
                }
                return;
            }

            if (data.type === 'message' || data.type === 'chat_message') {
                const payloadMessage = String(data.message ?? data.content ?? '');
                const messageId =
                    data.id ||
                    `${data.timestamp}-${data.platform || 'twitch'}-${data.author || data.author_name}-${payloadMessage}`;
                const inferredChannel = data.channel_name || data.channel;
                if (inferredChannel) {
                    setChannelName((prev) => prev || inferredChannel);
                }

                if (processedMessageIds.current.has(messageId)) {
                    return;
                }

                processedMessageIds.current.add(messageId);
                setLastAddedMessageId(messageId);

                setTimeout(
                    () => {
                        setLastAddedMessageId(null);
                    },
                    (settings?.animation_duration || 300) + 100
                );

                setMessages((prev) => {
                    const isDuplicate = prev.some(
                        (msg) =>
                            msg.id === data.id ||
                            (msg.timestamp === String(data.timestamp) &&
                                msg.platform === (data.platform || 'twitch') &&
                                (msg.author === data.author || msg.author_name === data.author_name) &&
                                (msg.message || msg.content) === payloadMessage)
                    );

                    if (isDuplicate) return prev;

                    const newMessage: ChatMessage = {
                        id: data.id || messageId,
                        author: data.author || data.author_name || 'Unknown',
                        author_name: data.author_name || data.author,
                        message: payloadMessage,
                        timestamp: String(data.timestamp || Date.now()),
                        platform: data.platform || 'twitch',
                        badges: (data as WebSocketMessage & { badges?: string[] }).badges,
                        emotes: (data as WebSocketMessage & { emotes?: ChatMessage['emotes'] }).emotes,
                        avatar_url: (data as WebSocketMessage & { avatar_url?: string }).avatar_url,
                        role: (data as WebSocketMessage & { role?: string }).role,
                        channel: (data as WebSocketMessage & { channel?: string }).channel,
                        channel_name: (data as WebSocketMessage & { channel_name?: string }).channel_name,
                    };

                    const newMessages = [...prev, newMessage];
                    const maxMessages = settings?.max_messages || 20;
                    const result = newMessages.slice(-maxMessages);

                    if (processedMessageIds.current.size > maxMessages * 2) {
                        const recentIds = new Set(
                            result.map(
                                (msg) =>
                                    msg.id ||
                                    `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`
                            )
                        );
                        processedMessageIds.current = recentIds;
                    }

                    return result;
                });
            } else if (data.type === 'chat_history') {
                logger.log(`[CHAT] Loaded ${data.messages?.length || 0} messages from history`);

                const uniqueMessages: ChatMessage[] = [];
                const seenIds = new Set<string>();

                for (const msg of data.messages || []) {
                    const uniqueKey =
                        msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`;
                    if (!seenIds.has(uniqueKey)) {
                        seenIds.add(uniqueKey);
                        uniqueMessages.push(msg);
                    }
                }

                const maxMessages = Math.max(1, settings?.max_messages || 20);
                const visibleMessages = uniqueMessages.slice(-maxMessages);
                setMessages(visibleMessages);
                processedMessageIds.current = new Set(
                    visibleMessages.map(
                        (msg) =>
                            msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`
                    )
                );
                historyLoadedRef.current = true;
                if (uniqueMessages.length > 0) {
                    const inferredChannel = uniqueMessages[0].channel_name || uniqueMessages[0].channel;
                    if (inferredChannel) {
                        setChannelName((prev) => prev || inferredChannel);
                    }
                }

                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
                }, 100);
            }
        },
        [settings]
    );

    useChatOverlayWebSocket(
        settings ? token : null,
        handleWebSocketMessage as (message: Record<string, unknown>) => void
    );

    const scrollToEnd = useCallback((behavior: ScrollBehavior = 'smooth'): void => {
        const scroll = () => {
            messagesEndRef.current?.scrollIntoView({
                behavior,
                block: settings?.chat_direction === 'horizontal' ? 'nearest' : 'end',
                inline: settings?.chat_direction === 'horizontal' ? 'end' : 'nearest',
            });
        };

        scroll();
        window.requestAnimationFrame(() => {
            scroll();
            window.requestAnimationFrame(scroll);
        });
    }, [settings?.chat_direction]);

    const handleMediaLoad = useCallback((): void => {
        scrollToEnd('auto');
    }, [scrollToEnd]);

    useEffect(() => {
        if (messagesEndRef.current) {
            scrollToEnd('smooth');
        }
    }, [messages, scrollToEnd]);

    useEffect(() => {
        const maxMessages = Math.max(1, settings?.max_messages || 20);
        setMessages((prev) => {
            if (prev.length <= maxMessages) {
                return prev;
            }

            const nextMessages = prev.slice(-maxMessages);
            processedMessageIds.current = new Set(
                nextMessages.map(
                    (msg) =>
                        msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message || msg.content}`
                )
            );
            return nextMessages;
        });
    }, [settings?.max_messages]);

    useEffect(() => {
        const fadeSeconds = settings?.message_fade_seconds;

        if (!fadeSeconds || fadeSeconds >= 60) {
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();

            setMessages((prev) => {
                if (prev.length === 0) return prev;

                const filtered = prev.filter((msg) => {
                    const messageAge = (now - Number(msg.timestamp)) / 1000;
                    return messageAge < fadeSeconds;
                });

                if (filtered.length < prev.length) {
                    logger.log(
                        `[DELETE] [FADE] Removed ${prev.length - filtered.length} old messages (>${fadeSeconds}s)`
                    );
                }

                return filtered;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [settings?.message_fade_seconds]);

    // Move hooks before early returns to comply with rules-of-hooks
    const handleNicknameClick = useCallback((e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    if (loading) {
        return (
            <div
                style={{
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: debugBackground === 'dark' ? '#05070d' : 'transparent',
                    color: '#fff',
                    fontFamily: `${CHATBOX_BRAND_FONT}, sans-serif`,
                    gap: '16px',
                }}
            >
                <div style={{ fontSize: '18px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>Загрузка ChatBox...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: debugBackground === 'dark' ? '#05070d' : 'transparent',
                    color: '#fff',
                    fontFamily: `${CHATBOX_BRAND_FONT}, sans-serif`,
                    padding: '0',
                    textAlign: 'center',
                    gap: '16px',
                }}
            >
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Ошибка загрузки настроек</div>
                <div
                    style={{
                        fontSize: '14px',
                        maxWidth: '600px',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '16px',
                        borderRadius: '8px',
                    }}
                >
                    {error}
                </div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div
                style={{
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: debugBackground === 'dark' ? '#05070d' : 'transparent',
                    color: '#fff',
                    fontFamily: `${CHATBOX_BRAND_FONT}, sans-serif`,
                    padding: '0',
                    textAlign: 'center',
                    gap: '16px',
                }}
            >
                <div style={{ fontSize: '18px' }}>Настройки не найдены</div>
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
                    .chatbox-overlay-font-scope,
                    .chatbox-overlay-font-scope * {
                        font-family: var(--chatbox-overlay-font) !important;
                    }
                `}
            </style>

            <div className="chatbox-overlay-font-scope" style={containerStyle}>
                <div style={chatFrameStyle}>
                    {messages.length === 0 ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: settings.text_color,
                            opacity: 0.5,
                            textAlign: 'center',
                            fontSize: `${settings.font_size}px`,
                        }}
                    >
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
                            width: '100%',
                            paddingTop: '0',
                            paddingBottom: '0',
                            boxSizing: 'border-box',
                            backgroundColor:
                                messageBackgroundMode === 'column'
                                    ? toRgba(settings.background_color || '#000000', settings.background_opacity ?? 0.5)
                                    : 'transparent',
                            borderRadius:
                                messageBackgroundMode === 'column' ? `${settings.border_radius ?? 8}px` : '0',
                            boxShadow:
                                messageBackgroundMode === 'column'
                                    ? 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.18)'
                                    : 'none',
                            paddingLeft: messageBackgroundMode === 'column' ? '8px' : '0',
                            paddingRight: messageBackgroundMode === 'column' ? '8px' : '0',
                            scrollPaddingBlockEnd: settings.chat_direction === 'horizontal' ? undefined : '0',
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
                                channelName={channelName}
                                onNicknameClick={handleNicknameClick}
                                onMediaLoad={handleMediaLoad}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ChatOverlay;
