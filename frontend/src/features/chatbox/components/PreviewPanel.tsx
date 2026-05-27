// src/components/chatbox/PreviewPanel.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import MessageContent from '@/features/chat/components/MessageContent';
import { EmoteData, getGlobalEmotes, getSevenTvFallbackEmotes, registerEmoteAliases } from '@/features/chat/utils/emotes';
import { CHATBOX_BRAND_FONT } from '@/features/chatbox/constants/fontOptions';
import { loadGoogleFont, resolveMessageBackgroundMode } from '@/features/chatbox/utils/chatboxHelpers';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { VkRoleBadge } from '@/shared/components/RoleBadge';

import type { ChatEmote } from '@/types/chat';
import type { ChatMessageBackgroundMode } from '@/types/chatbox';

interface ChatBoxSettings {
    font_family: string;
    font_size: number;
    font_weight?: string;
    text_color?: string;
    username_color?: string;
    text_stroke_width: number;
    text_stroke_color?: string;
    background_opacity: number;
    background_color?: string;
    max_messages: number;
    message_spacing: number;
    animation_type: string;
    animation_duration: number;
    message_fade_seconds: number;
    chat_direction: string;
    chat_width: number;
    border_radius?: number;
    show_platform_icons: boolean;
    show_roles?: boolean;
    show_badges: boolean;
    show_7tv_emotes: boolean;
    show_links: boolean;
    auto_load_images?: boolean;
    separate_message_backgrounds?: boolean;
    message_background_mode?: ChatMessageBackgroundMode;
}

interface PreviewMessage {
    id: number;
    platform: 'twitch' | 'vk';
    author: string;
    message: string;
    time: string;
    role: string;
    badges: string[];
    emotes?: ChatEmote[];
    vk_role_icon_url?: string;
    avatar_url?: string;
}

interface RenderedPreviewMessage extends PreviewMessage {
    preview_key: string;
}

interface PreviewPanelProps {
    settings: ChatBoxSettings;
    previewMessages: PreviewMessage[];
    twitchChannelName?: string | null;
}

const PREVIEW_7TV_FALLBACKS = getSevenTvFallbackEmotes();

const PREVIEW_TWITCH_BADGE_FALLBACKS: Record<string, string> = {
    'broadcaster/1': 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1',
    'moderator/1': 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1',
    'vip/1': 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1',
};

const sanitizeFontFamily = (fontFamily: string): string => fontFamily.replace(/[^a-zA-Z0-9,\s-]/g, '').trim();

const normalizeVkAssetUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `https://images.live.vkvideo.ru${url}`;
    return url;
};

const tryVkAssetFallback = (img: HTMLImageElement): boolean => {
    const src = img.src || '';
    if (!src.includes('images.live.vkvideo.ru')) return false;

    const hasLarge = src.includes('/size/large');
    const hasMedium = src.includes('/size/medium');
    const hasSmall = src.includes('/size/small');

    if (hasLarge) {
        img.src = src.replace('/size/large', '/size/medium');
        return true;
    }
    if (hasMedium) {
        img.src = src.replace('/size/medium', '/size/small');
        return true;
    }
    if (!hasSmall) {
        img.src = `${src.replace(/\/$/, '')}/size/small`;
        return true;
    }
    return false;
};

const toRenderedPreviewMessage = (message: PreviewMessage): RenderedPreviewMessage => ({
    ...message,
    preview_key: `${message.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
});

const buildPreviewSequence = (messages: PreviewMessage[], limit: number): RenderedPreviewMessage[] => {
    if (messages.length === 0 || limit <= 0) return [];
    return Array.from({ length: limit }, (_, index) => toRenderedPreviewMessage(messages[index % messages.length]));
};

const PreviewPanel: React.FC<PreviewPanelProps> = ({ settings, previewMessages, twitchChannelName }) => {
    const [, setBadgesReady] = useState(false);
    const [globalEmotes, setGlobalEmotes] = useState<Map<string, EmoteData>>(new Map());
    const [simulatedMessages, setSimulatedMessages] = useState<RenderedPreviewMessage[]>([]);
    const [lastAnimatedMessageKey, setLastAnimatedMessageKey] = useState<string | null>(null);
    const [fontLoadVersion, setFontLoadVersion] = useState(0);
    const nextTemplateIndexRef = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    const isHorizontal = settings.chat_direction === 'horizontal';
    const effectiveAnimationType = isHorizontal
        ? settings.animation_type === 'none'
            ? 'none'
            : 'slide-left'
        : settings.animation_type;
    const chatWidth = Math.max(20, Math.min(100, settings.chat_width || 100));
    const messageBackgroundMode = resolveMessageBackgroundMode(settings);
    const resolvedFontFamily = useMemo(() => {
        const safeFontFamily = settings.font_family ? sanitizeFontFamily(settings.font_family) : '';
        if (!safeFontFamily) return `${CHATBOX_BRAND_FONT}, sans-serif`;
        return safeFontFamily.includes(',') ? safeFontFamily : `${safeFontFamily}, sans-serif`;
    }, [settings.font_family]);
    const previewLimit = useMemo(() => {
        if (isHorizontal) return Math.max(1, settings.max_messages);
        return Math.max(12, Math.min(Math.max(settings.max_messages, 18), 32));
    }, [isHorizontal, settings.max_messages]);

    const hexToRgba = (hex: string, opacity: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };
    const panelBackground = [
        'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0) 42%)',
        'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 14px, rgba(255,255,255,0.012) 14px 28px)',
        'linear-gradient(180deg, rgba(6,10,24,0.95) 0%, rgba(5,8,18,0.98) 100%)',
    ].join(', ');
    const sharedColumnBackground =
        messageBackgroundMode === 'column'
            ? hexToRgba(settings.background_color || '#000000', settings.background_opacity)
            : 'transparent';

    const getAnimationName = (type: string) => {
        switch (type) {
            case 'fade':
                return 'previewFade';
            case 'slide-right':
            case 'slide':
                return 'previewSlideRight';
            case 'slide-left':
                return 'previewSlideLeft';
            case 'scale':
                return 'previewScale';
            case 'bounce':
                return 'previewBounce';
            default:
                return '';
        }
    };

    const effectiveGlobalEmotes = useMemo(() => {
        if (!settings.show_7tv_emotes) return new Map<string, EmoteData>();
        const base = new Map(globalEmotes);
        PREVIEW_7TV_FALLBACKS.forEach((emote) => {
            registerEmoteAliases(base, emote);
        });
        return base;
    }, [globalEmotes, settings.show_7tv_emotes]);

    useEffect(() => {
        let isActive = true;
        const fontFamily = sanitizeFontFamily(settings.font_family);

        if (!fontFamily) return undefined;

        loadGoogleFont(fontFamily);

        if (typeof document === 'undefined' || !('fonts' in document)) {
            setFontLoadVersion((prev) => prev + 1);
            return undefined;
        }

        const primaryFont = fontFamily.split(',')[0]?.trim() || fontFamily;
        Promise.allSettled([
            document.fonts.load(`${settings.font_weight || 'normal'} ${settings.font_size}px "${primaryFont}"`),
            document.fonts.ready,
        ]).finally(() => {
            if (isActive) {
                setFontLoadVersion((prev) => prev + 1);
            }
        });

        return () => {
            isActive = false;
        };
    }, [settings.font_family, settings.font_size, settings.font_weight]);

    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return undefined;

        if (isHorizontal) {
            container.scrollLeft = container.scrollWidth;
            return undefined;
        }

        container.scrollTop = container.scrollHeight;
        return undefined;
    }, [
        fontLoadVersion,
        isHorizontal,
        simulatedMessages,
        settings.chat_width,
        settings.font_size,
        settings.message_spacing,
        settings.show_badges,
        settings.show_links,
        settings.show_platform_icons,
        settings.show_roles,
    ]);

    useEffect(() => {
        let active = true;
        if (!settings.show_badges) {
            setBadgesReady(false);
            return undefined;
        }

        const loadBadges = async () => {
            try {
                await twitchBadgesService.loadGlobalBadges();
                if (twitchChannelName) {
                    await twitchBadgesService.loadChannelBadges(twitchChannelName);
                }
                if (active) {
                    setBadgesReady(true);
                }
            } catch {
                if (active) {
                    setBadgesReady(false);
                }
            }
        };

        loadBadges();
        return () => {
            active = false;
        };
    }, [settings.show_badges, twitchChannelName]);

    useEffect(() => {
        let isActive = true;
        if (!settings.show_7tv_emotes) {
            setGlobalEmotes(new Map());
            return undefined;
        }

        getGlobalEmotes()
            .then((emotes) => {
                if (isActive) {
                    setGlobalEmotes(emotes);
                }
            })
            .catch(() => {
                if (isActive) {
                    setGlobalEmotes(new Map());
                }
            });

        return () => {
            isActive = false;
        };
    }, [settings.show_7tv_emotes]);

    useEffect(() => {
        const limit = previewLimit;
        setSimulatedMessages(buildPreviewSequence(previewMessages, limit));
        setLastAnimatedMessageKey(null);
        nextTemplateIndexRef.current = previewMessages.length === 0 ? 0 : limit % previewMessages.length;
    }, [previewMessages, previewLimit]);

    useEffect(() => {
        if (previewMessages.length === 0) return undefined;

        const interval = setInterval(
            () => {
                const template = previewMessages[nextTemplateIndexRef.current % previewMessages.length];
                nextTemplateIndexRef.current = (nextTemplateIndexRef.current + 1) % previewMessages.length;

                const nextMessage = toRenderedPreviewMessage(template);
                const limit = previewLimit;

                setSimulatedMessages((prev) => [...prev, nextMessage].slice(-limit));
                setLastAnimatedMessageKey(
                    effectiveAnimationType !== 'none' && settings.animation_duration > 0
                        ? nextMessage.preview_key
                        : null
                );
            },
            Math.max(1800, settings.animation_duration + 600)
        );

        return () => clearInterval(interval);
    }, [previewMessages, effectiveAnimationType, settings.animation_duration, previewLimit]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <style>
                {`
                    @keyframes previewFade {
                        0% { opacity: 0; transform: translateY(8px); }
                        100% { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes previewSlideRight {
                        0% { opacity: 0; transform: translateX(-24px); }
                        100% { opacity: 1; transform: translateX(0); }
                    }
                    @keyframes previewSlideLeft {
                        0% { opacity: 0; transform: translateX(24px); }
                        100% { opacity: 1; transform: translateX(0); }
                    }
                    @keyframes previewScale {
                        0% { opacity: 0; transform: scale(0.9); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                    @keyframes previewBounce {
                        0% { opacity: 0; transform: translateY(12px) scale(0.95); }
                        60% { opacity: 1; transform: translateY(-6px) scale(1.02); }
                        100% { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .chatbox-preview-scroll {
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    .chatbox-preview-scroll::-webkit-scrollbar {
                        display: none;
                    }
                    .chatbox-preview-font-scope,
                    .chatbox-preview-font-scope * {
                        font-family: var(--chatbox-preview-font) !important;
                    }
                `}
            </style>
            <div
                className="chatbox-preview-font-scope min-h-0 flex-1 overflow-hidden rounded-md border border-white/10"
                style={{
                    ['--chatbox-preview-font' as string]: resolvedFontFamily,
                    background: panelBackground,
                    fontFamily: resolvedFontFamily,
                    fontSize: `${settings.font_size}px`,
                    fontWeight: settings.font_weight || 'normal',
                }}
            >
                <div
                    className="h-full min-h-0 p-4"
                    style={{
                        display: 'flex',
                        alignItems: isHorizontal ? 'center' : 'stretch',
                        justifyContent: isHorizontal ? 'flex-start' : 'flex-end',
                        height: '100%',
                    }}
                >
                    <div
                        ref={scrollContainerRef}
                        className={`${isHorizontal ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto overflow-x-hidden'} chatbox-preview-scroll`}
                        style={{
                            width: `${chatWidth}%`,
                            maxWidth: '100%',
                            height: '100%',
                            paddingBottom: isHorizontal ? 0 : `${Math.max(14, settings.font_size * 1.15)}px`,
                            paddingTop: isHorizontal ? 0 : `${Math.max(6, settings.message_spacing)}px`,
                            boxSizing: 'border-box',
                            scrollPaddingBlockEnd: isHorizontal ? undefined : `${Math.max(14, settings.font_size * 1.15)}px`,
                            scrollbarWidth: 'none',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: isHorizontal ? 'row' : 'column',
                                alignItems: isHorizontal ? 'center' : 'stretch',
                                justifyContent: isHorizontal ? 'flex-start' : 'flex-end',
                                gap: isHorizontal ? '8px' : `${settings.message_spacing}px`,
                                width: isHorizontal ? 'max-content' : '100%',
                                minHeight: isHorizontal ? 'auto' : '100%',
                                padding:
                                    messageBackgroundMode === 'column'
                                        ? isHorizontal
                                            ? '6px 10px'
                                            : '8px'
                                        : '0',
                                boxSizing: 'border-box',
                                borderRadius:
                                    messageBackgroundMode === 'column'
                                        ? `${settings.border_radius ?? 8}px`
                                        : '0',
                                backgroundColor: sharedColumnBackground,
                                boxShadow:
                                    messageBackgroundMode === 'column' && sharedColumnBackground !== 'transparent'
                                        ? 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.18)'
                                        : 'none',
                            }}
                        >
                            {simulatedMessages.map((msg) => {
                                const animationName = getAnimationName(effectiveAnimationType);
                                const shouldAnimate =
                                    effectiveAnimationType !== 'none' &&
                                    settings.animation_duration > 0 &&
                                    animationName &&
                                    msg.preview_key === lastAnimatedMessageKey;
                                const platformIconSize = Math.max(12, Math.min(24, settings.font_size));
                                const messageBackground =
                                    messageBackgroundMode !== 'message'
                                        ? 'transparent'
                                        : hexToRgba(settings.background_color || '#000000', settings.background_opacity);
                                const metaGroupStyle: React.CSSProperties = {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    lineHeight: 1,
                                    verticalAlign: 'text-bottom',
                                    marginRight: '6px',
                                };
                                const showMeta = Boolean(
                                    settings.show_platform_icons ||
                                    (settings.show_badges && msg.badges.length > 0) ||
                                    (settings.show_badges &&
                                        msg.platform === 'vk' &&
                                        (msg.vk_role_icon_url || msg.role))
                                );
                                const messageText = msg.message;
                                const previewText = messageText;
                                const vkInlineEmotes = new Map<string, EmoteData>();
                                if (msg.platform === 'vk' && Array.isArray(msg.emotes)) {
                                    msg.emotes.forEach((emote) => {
                                        if (!emote?.name || !emote?.url) return;
                                        const mapped: EmoteData = {
                                            id: String(emote.id || emote.name),
                                            name: emote.name.replace(/^:+|:+$/g, ''),
                                            url: normalizeVkAssetUrl(emote.url),
                                            animated: false,
                                        };
                                        registerEmoteAliases(vkInlineEmotes, mapped);
                                    });
                                }
                                const messageGlobalEmotes = settings.show_7tv_emotes
                                    ? new Map<string, EmoteData>([...effectiveGlobalEmotes, ...vkInlineEmotes])
                                    : vkInlineEmotes;
                                const displayMessage = (
                                    <MessageContent
                                        message={previewText}
                                        channelEmotes={settings.show_7tv_emotes ? new Map() : new Map()}
                                        globalEmotes={messageGlobalEmotes}
                                        twitchEmotes={msg.platform === 'twitch' ? msg.emotes : []}
                                        showLinks={settings.show_links}
                                        autoLoadImages={settings.auto_load_images ?? true}
                                        imageLoading="eager"
                                    />
                                );
                                const baseMessageStyle: React.CSSProperties = {
                                    fontFamily: resolvedFontFamily,
                                    borderRadius: `${settings.border_radius ?? 8}px`,
                                    whiteSpace: isHorizontal ? 'nowrap' : 'normal',
                                    wordBreak: isHorizontal ? 'normal' : 'break-word',
                                    overflowWrap: 'anywhere',
                                    overflow: isHorizontal ? 'hidden' : 'visible',
                                    textOverflow: isHorizontal ? 'ellipsis' : 'clip',
                                    flexShrink: 0,
                                    minWidth: isHorizontal ? 'fit-content' : 'auto',
                                    maxWidth: isHorizontal ? '600px' : 'auto',
                                    padding: isHorizontal ? '6px 10px' : '4px 8px',
                                    backgroundColor: messageBackground,
                                    boxShadow:
                                        messageBackgroundMode === 'message' && messageBackground !== 'transparent'
                                            ? 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.22)'
                                            : 'none',
                                    lineHeight: 1.3,
                                };
                                const strokeStyle =
                                    settings.text_stroke_width > 0
                                        ? {
                                              WebkitTextStroke: `${settings.text_stroke_width}px ${settings.text_stroke_color || '#000000'}`,
                                              paintOrder: 'stroke fill',
                                          }
                                        : {};

                                return (
                                    <div
                                        key={msg.preview_key}
                                        className="text-white"
                                        style={{
                                            ...baseMessageStyle,
                                            ...strokeStyle,
                                            animation: shouldAnimate
                                                ? `${animationName} ${settings.animation_duration}ms ease-out`
                                                : undefined,
                                            color: settings.text_color || '#ffffff',
                                        }}
                                    >
                                        {showMeta && (
                                            <span style={metaGroupStyle}>
                                                {settings.show_platform_icons &&
                                                    (msg.platform === 'twitch' ? (
                                                        <TwitchIcon
                                                            className="inline-block"
                                                            style={{
                                                                width: `${platformIconSize}px`,
                                                                height: `${platformIconSize}px`,
                                                                verticalAlign: 'text-bottom',
                                                                color: '#9146FF',
                                                            }}
                                                        />
                                                    ) : (
                                                        <VKIcon
                                                            className="inline-block"
                                                            style={{
                                                                width: `${platformIconSize}px`,
                                                                height: `${platformIconSize}px`,
                                                                verticalAlign: 'text-bottom',
                                                                color: '#FF4444',
                                                            }}
                                                        />
                                                    ))}
                                                {settings.show_badges &&
                                                    msg.badges.length > 0 &&
                                                    msg.platform === 'twitch' && (
                                                        <>
                                                            {msg.badges.map((badge) => {
                                                                const [badgeId, version] = badge.split('/');
                                                                const cachedBadgeUrl = twitchBadgesService.getBadgeUrl(
                                                                    badgeId,
                                                                    version,
                                                                    '1x',
                                                                    twitchChannelName || null
                                                                );
                                                                const fallbackBadgeUrl =
                                                                    PREVIEW_TWITCH_BADGE_FALLBACKS[badge];
                                                                const badgeUrl = cachedBadgeUrl || fallbackBadgeUrl;
                                                                if (!badgeUrl) return null;

                                                                const badgeSize = Math.max(
                                                                    14,
                                                                    Math.min(24, settings.font_size * 1.1)
                                                                );
                                                                return (
                                                                    <img
                                                                        key={`${msg.id}-${badgeId}-${version}`}
                                                                        src={badgeUrl}
                                                                        alt={badgeId}
                                                                        title={badgeId}
                                                                        loading="eager"
                                                                        style={{
                                                                            width: `${badgeSize}px`,
                                                                            height: `${badgeSize}px`,
                                                                            verticalAlign: 'text-bottom',
                                                                        }}
                                                                        onError={(e) => {
                                                                            (
                                                                                e.target as HTMLImageElement
                                                                            ).style.display = 'none';
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                {settings.show_badges &&
                                                    msg.badges.length > 0 &&
                                                    msg.platform === 'vk' && (
                                                        <>
                                                            {msg.badges.map((badge, idx) => (
                                                                <img
                                                                    key={`${msg.id}-${idx}`}
                                                                    src={normalizeVkAssetUrl(badge)}
                                                                    alt="badge"
                                                                    loading="eager"
                                                                    style={{
                                                                        width: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                                        height: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                                        verticalAlign: 'text-bottom',
                                                                    }}
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        if (!tryVkAssetFallback(target)) {
                                                                            target.style.display = 'none';
                                                                        }
                                                                    }}
                                                                />
                                                            ))}
                                                        </>
                                                    )}
                                                {settings.show_badges && msg.platform === 'vk' && msg.role && (
                                                    <VkRoleBadge
                                                        role={msg.role}
                                                        size={Math.max(12, Math.min(18, settings.font_size * 0.9))}
                                                        style={{ lineHeight: 1, verticalAlign: 'text-bottom' }}
                                                    />
                                                )}
                                            </span>
                                        )}
                                        <span
                                            style={{
                                                fontFamily: resolvedFontFamily,
                                                color:
                                                    settings.username_color ||
                                                    (msg.platform === 'twitch' ? '#9146FF' : '#FF4444'),
                                                fontWeight: 600,
                                            }}
                                        >
                                            {msg.author}:
                                        </span>{' '}
                                        {settings.show_roles && msg.role && (
                                            <span className="text-[10px] text-muted-foreground mr-1">[{msg.role}]</span>
                                        )}
                                        <span style={{ fontFamily: resolvedFontFamily }}>{displayMessage}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewPanel;
