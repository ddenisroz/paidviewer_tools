// src/components/chatbox/PreviewPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';

import MessageContent from '@/features/chat/components/MessageContent';
import { getGlobalEmotes } from '@/features/chat/utils/emotes';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { VkRoleBadge } from '@/shared/components/RoleBadge';

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
    show_badges: boolean;
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
    avatar_url?: string;
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
    url: 'https://cdn.7tv.app/emote/01G7RPTSY00003P60HPZKBDE31/2x.webp',
    animated: false
};

const PreviewPanel: React.FC<PreviewPanelProps> = ({ settings, previewMessages, twitchChannelName }) => {
    const [badgesReady, setBadgesReady] = useState(false);
    const [globalEmotes, setGlobalEmotes] = useState<Map<string, EmoteData>>(new Map());
    const [animationTick, setAnimationTick] = useState(0);

    const isHorizontal = settings.chat_direction === 'horizontal';
    const chatWidth = Math.max(20, Math.min(100, settings.chat_width || 100));

    const hexToRgba = (hex: string, opacity: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

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

    const emoteSample = useMemo(() => {
        if (!settings.show_7tv_emotes) return null;
        const first = effectiveGlobalEmotes.values().next().value as EmoteData | undefined;
        return first?.name ?? null;
    }, [effectiveGlobalEmotes, settings.show_7tv_emotes]);

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
        if (settings.animation_type === 'none' || settings.animation_duration <= 0) return undefined;
        const interval = setInterval(() => {
            setAnimationTick((prev) => prev + 1);
        }, Math.max(1500, settings.animation_duration + 400));
        return () => clearInterval(interval);
    }, [settings.animation_type, settings.animation_duration]);

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
                className="flex-1 overflow-hidden bg-[#020308]"
                style={{
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
                            {previewMessages.slice(-Math.max(1, settings.max_messages)).map((msg) => {
                            const animationName = getAnimationName(settings.animation_type);
                            const shouldAnimate = settings.animation_type !== 'none' && settings.animation_duration > 0 && animationName;
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
                                (settings.show_badges && msg.platform === 'vk' && msg.role)
                            );
                            const messageText = emoteSample
                                ? msg.message.replace(':hype:', `:${emoteSample}:`)
                                : msg.message;
                            const previewText = isHorizontal
                                ? truncateWords(messageText, 6)
                                : messageText;
                            const displayMessage = (
                                <MessageContent
                                    message={previewText}
                                    channelEmotes={settings.show_7tv_emotes ? new Map() : new Map()}
                                    globalEmotes={settings.show_7tv_emotes ? effectiveGlobalEmotes : new Map()}
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
                                    key={`${msg.id}-${settings.animation_type}-${settings.animation_duration}-${animationTick}`}
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
                                                                style={{ width: `${badgeSize}px`, height: `${badgeSize}px`, verticalAlign: 'text-bottom' }}
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
                                                            style={{
                                                                width: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                                height: `${Math.max(14, Math.min(24, settings.font_size * 1.1))}px`,
                                                                verticalAlign: 'text-bottom'
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
                                            color: settings.username_color || (msg.platform === 'twitch' ? '#9146FF' : '#FF4444'),
                                            fontWeight: 600
                                        }}
                                    >
                                        {msg.author}:
                                    </span>{' '}
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
