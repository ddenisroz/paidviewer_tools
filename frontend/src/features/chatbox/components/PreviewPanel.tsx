// src/components/chatbox/PreviewPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { API_BASE_URL } from '@/constants';
import MessageContent from '@/features/chat/components/MessageContent';
import { getGlobalEmotes } from '@/features/chat/utils/emotes';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { VkRoleBadge } from '@/shared/components/RoleBadge';

import type { ChatEmote } from '@/types/chat';

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
    show_avatars?: boolean;
    show_7tv_emotes: boolean;
    show_links: boolean;
    auto_load_images?: boolean;
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

interface EmoteData {
    id: string;
    name: string;
    url: string;
    animated: boolean;
}

const FALLBACK_7TV_EMOTE: EmoteData = {
    id: 'preview-7tv',
    name: 'JustAnotherDay',
    url: `${API_BASE_URL}/api/proxy/7tv/cdn.7tv.app/emote/01G7RPTSY00003P60HPZKBDE31/2x.webp`,
    animated: false
};

const toRenderedPreviewMessage = (message: PreviewMessage): RenderedPreviewMessage => ({
    ...message,
    preview_key: `${message.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
});

const PreviewPanel: React.FC<PreviewPanelProps> = ({ settings, previewMessages, twitchChannelName }) => {
    const [badgesReady, setBadgesReady] = useState(false);
    const [globalEmotes, setGlobalEmotes] = useState<Map<string, EmoteData>>(new Map());
    const [simulatedMessages, setSimulatedMessages] = useState<RenderedPreviewMessage[]>([]);
    const [lastAnimatedMessageKey, setLastAnimatedMessageKey] = useState<string | null>(null);
    const nextTemplateIndexRef = useRef(0);

    const isHorizontal = settings.chat_direction === 'horizontal';
    const chatWidth = Math.max(20, Math.min(100, settings.chat_width || 100));

    const hexToRgba = (hex: string, opacity: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };
    const panelBackground = hexToRgba(
        settings.background_color || '#000000',
        Math.min(0.92, Math.max(0.35, settings.background_opacity + 0.3))
    );

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
        if (globalEmotes.size > 0) return globalEmotes;
        return new Map([
            [FALLBACK_7TV_EMOTE.name, FALLBACK_7TV_EMOTE],
            [FALLBACK_7TV_EMOTE.name.toLowerCase(), FALLBACK_7TV_EMOTE]
        ]);
    }, [globalEmotes, settings.show_7tv_emotes]);

    const truncateWords = (text: string, maxWords: number = 6): string => {
        if (!text) return '';
        const words = text.trim().split(/\s+/);
        if (words.length <= maxWords) return text;
        return `${words.slice(0, maxWords).join(' ')}...`;
    };

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
        const limit = Math.max(1, settings.max_messages);
        setSimulatedMessages(previewMessages.slice(-limit).map(toRenderedPreviewMessage));
        setLastAnimatedMessageKey(null);
        nextTemplateIndexRef.current = 0;
    }, [previewMessages, settings.max_messages]);

    useEffect(() => {
        if (settings.animation_type === 'none' || settings.animation_duration <= 0) return undefined;
        if (previewMessages.length === 0) return undefined;

        const interval = setInterval(() => {
            const template = previewMessages[nextTemplateIndexRef.current % previewMessages.length];
            nextTemplateIndexRef.current = (nextTemplateIndexRef.current + 1) % previewMessages.length;

            const nextMessage = toRenderedPreviewMessage(template);
            const limit = Math.max(1, settings.max_messages);

            setSimulatedMessages((prev) => [...prev, nextMessage].slice(-limit));
            setLastAnimatedMessageKey(nextMessage.preview_key);
        }, Math.max(1800, settings.animation_duration + 600));

        return () => clearInterval(interval);
    }, [previewMessages, settings.animation_type, settings.animation_duration, settings.max_messages]);

    return (
        <div className="h-full flex flex-col">
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
                    @keyframes previewMarquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                `}
            </style>
            <div
                className="flex-1 overflow-hidden border border-white/10 rounded-md"
                style={{
                    backgroundColor: panelBackground,
                    fontFamily: settings.font_family,
                    fontSize: `${settings.font_size}px`,
                    fontWeight: settings.font_weight || 'normal'
                }}
            >
                <div
                    className="h-full p-4"
                    style={{
                        display: 'flex',
                        alignItems: isHorizontal ? 'center' : 'stretch',
                        justifyContent: isHorizontal ? 'flex-start' : 'flex-end',
                        height: '100%'
                    }}
                >
                    <div
                        className={`${isHorizontal ? 'overflow-x-hidden' : 'overflow-y-auto'} chatbox-preview-scroll`}
                        style={{
                            width: `${chatWidth}%`,
                            maxWidth: '100%',
                            height: '100%',
                            paddingBottom: isHorizontal ? '8px' : '0'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: isHorizontal ? 'row' : 'column',
                                alignItems: isHorizontal ? 'center' : 'stretch',
                                gap: isHorizontal ? '8px' : `${settings.message_spacing}px`,
                                paddingRight: isHorizontal ? '40%' : '0',
                                width: isHorizontal ? 'max-content' : '100%',
                                animation: isHorizontal ? 'previewMarquee 18s linear infinite' : undefined
                            }}
                        >
                            {!isHorizontal && <div style={{ flexGrow: 1 }} />}
                            {simulatedMessages.map((msg) => {
                            const animationName = getAnimationName(settings.animation_type);
                            const shouldAnimate = settings.animation_type !== 'none'
                                && settings.animation_duration > 0
                                && animationName
                                && msg.preview_key === lastAnimatedMessageKey;
                            const platformIconSize = Math.max(12, Math.min(24, settings.font_size));
                            const messageBackground = hexToRgba(settings.background_color || '#000000', settings.background_opacity);
                            const metaGroupStyle: React.CSSProperties = {
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                lineHeight: 1,
                                verticalAlign: 'text-bottom',
                                marginRight: '6px'
                            };
                            const showMeta = Boolean(
                                settings.show_platform_icons ||
                                (settings.show_badges && msg.badges.length > 0) ||
                                (settings.show_badges && msg.platform === 'vk' && (msg.vk_role_icon_url || msg.role))
                            );
                            const messageText = msg.message;
                            const previewText = isHorizontal
                                ? truncateWords(messageText, 6)
                                : messageText;
                            const vkInlineEmotes = new Map<string, EmoteData>();
                            if (msg.platform === 'vk' && Array.isArray(msg.emotes)) {
                                msg.emotes.forEach((emote) => {
                                    if (!emote?.name || !emote?.url) return;
                                    const mapped: EmoteData = {
                                        id: String(emote.id || emote.name),
                                        name: emote.name,
                                        url: emote.url,
                                        animated: false
                                    };
                                    vkInlineEmotes.set(emote.name, mapped);
                                    vkInlineEmotes.set(emote.name.toLowerCase(), mapped);
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
                                />
                            );
                            const baseMessageStyle: React.CSSProperties = {
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
                                lineHeight: 1.3
                            };
                            const strokeStyle = settings.text_stroke_width > 0
                                ? {
                                    WebkitTextStroke: `${settings.text_stroke_width}px ${settings.text_stroke_color || '#000000'}`,
                                    paintOrder: 'stroke fill'
                                }
                                : {};

                            return (
                                <div
                                    key={msg.preview_key}
                                    className="text-white"
                                    style={{
                                        ...baseMessageStyle,
                                        ...strokeStyle,
                                        animation: shouldAnimate ? `${animationName} ${settings.animation_duration}ms ease-out` : undefined,
                                        color: settings.text_color || '#ffffff'
                                    }}
                                >
                                    {showMeta && (
                                        <span style={metaGroupStyle}>
                                            {settings.show_platform_icons && (
                                                msg.platform === 'twitch' ? (
                                                    <TwitchIcon className="inline-block" style={{ width: `${platformIconSize}px`, height: `${platformIconSize}px`, verticalAlign: 'text-bottom', color: '#9146FF' }} />
                                                ) : (
                                                    <VKIcon className="inline-block" style={{ width: `${platformIconSize}px`, height: `${platformIconSize}px`, verticalAlign: 'text-bottom', color: '#FF4444' }} />
                                                )
                                            )}
                                            {settings.show_badges && badgesReady && msg.badges.length > 0 && msg.platform === 'twitch' && (
                                                <>
                                                    {msg.badges.map((badge) => {
                                                        const [badgeId, version] = badge.split('/');
                                                        const badgeUrl = twitchBadgesService.getBadgeUrl(
                                                            badgeId,
                                                            version,
                                                            '1x',
                                                            twitchChannelName || null
                                                        );
                                                        if (!badgeUrl) return null;

                                                        const badgeSize = Math.max(14, Math.min(24, settings.font_size * 1.1));
                                                        return (
                                                            <img
                                                                key={`${msg.id}-${badgeId}-${version}`}
                                                                src={badgeUrl}
                                                                alt={badgeId}
                                                                title={badgeId}
                                                                loading="lazy"
                                                                style={{ width: `${badgeSize}px`, height: `${badgeSize}px`, verticalAlign: 'text-bottom' }}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </>
                                            )}
                                            {settings.show_badges && msg.badges.length > 0 && msg.platform === 'vk' && (
                                                <>
                                                    {msg.badges.map((badge, idx) => (
                                                        <img
                                                            key={`${msg.id}-${idx}`}
                                                            src={badge}
                                                            alt="badge"
                                                            loading="lazy"
                                                            style={{
                                                                width: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                                height: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                                verticalAlign: 'text-bottom'
                                                            }}
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                            {settings.show_badges && msg.platform === 'vk' && msg.vk_role_icon_url && (
                                                <img
                                                    src={msg.vk_role_icon_url}
                                                    alt={msg.role ? `${msg.role} badge` : 'VK role badge'}
                                                    loading="lazy"
                                                    style={{
                                                        width: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                        height: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                        verticalAlign: 'text-bottom'
                                                    }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            )}
                                            {settings.show_badges && msg.platform === 'vk' && !msg.vk_role_icon_url && msg.role && (
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
                                            color: settings.username_color || (msg.platform === 'twitch' ? '#9146FF' : '#FF4444'),
                                            fontWeight: 600
                                        }}
                                    >
                                        {settings.show_avatars && msg.avatar_url && (
                                            <img
                                                src={msg.avatar_url}
                                                alt={msg.author}
                                                loading="lazy"
                                                style={{
                                                    width: `${Math.max(14, Math.min(22, settings.font_size * 1.1))}px`,
                                                    height: `${Math.max(14, Math.min(22, settings.font_size * 1.1))}px`,
                                                    borderRadius: '999px',
                                                    display: 'inline-block',
                                                    verticalAlign: 'text-bottom',
                                                    marginRight: '6px',
                                                }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        )}
                                        {msg.author}:
                                    </span>{' '}
                                    {settings.show_roles && msg.role && (
                                        <span className="text-[10px] text-muted-foreground mr-1">
                                            [{msg.role}]
                                        </span>
                                    )}
                                    <span>{displayMessage}</span>
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
