import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import MessageContent from '@/features/chat/components/MessageContent';
import { getAllEmotesForChannel } from '@/features/chat/utils/emotes';
import ColorInput from '@/features/chatbox/components/ColorInputPickerOnly';
import { CHATBOX_BRAND_FONT, CHATBOX_FONT_OPTIONS } from '@/features/chatbox/constants/fontOptions';
import {
    extractSettingsFromResponse,
    loadGoogleFont,
    normalizeChatBoxSettings,
} from '@/features/chatbox/utils/chatboxHelpers';
import { chatboxService } from '@/services/api/services/chatboxService';
import { twitchBadgesService } from '@/services/twitchBadges';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Input } from '@/shared/components/ui/input';
import { formatAppTime } from '@/shared/utils/dateTime';
import { logger } from '@/shared/utils/prodLogger';

import type { ChatMessage } from '@/types/chat';
import type { ChatBoxSettings } from '@/types/chatbox';

type ChatWindowSettings = ChatBoxSettings & {
    show_timestamps: boolean;
};

interface Emotes {
    channelEmotes: Map<string, unknown>;
    globalEmotes: Map<string, unknown>;
}

const DEFAULT_CHAT_SETTINGS: ChatWindowSettings = {
    ...normalizeChatBoxSettings({
    font_size: 14,
    font_family: CHATBOX_BRAND_FONT,
    text_color: '#FFFFFF',
    username_color: '#9147FF',
    background_color: '#1A1A1A',
    background_opacity: 1,
    message_spacing: 2,
    show_platform_icons: true,
    show_badges: true,
    max_messages: 50,
    show_7tv_emotes: true,
    show_links: true,
    auto_load_images: true,
    show_roles: false,
    font_weight: 'normal',
    text_stroke_width: 0,
    text_stroke_color: '#000000',
    animation_type: 'fade',
    animation_duration: 300,
    message_fade_seconds: 60,
    chat_direction: 'vertical',
    chat_width: 100,
    border_radius: 8,
    widget_url: '',
    version: 1,
    }),
    show_timestamps: false,
};

const normalizeVkAssetUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `https://images.live.vkvideo.ru${url}`;
    return url;
};

const resolveChatWindowFontFamily = (fontFamily?: string): string => {
    const safeFontFamily = (fontFamily || CHATBOX_BRAND_FONT).replace(/[^a-zA-Z0-9,\s-]/g, '').trim();
    if (!safeFontFamily) return `${CHATBOX_BRAND_FONT}, sans-serif`;
    return safeFontFamily.includes(',') ? safeFontFamily : `${safeFontFamily}, sans-serif`;
};

const ChatWindow: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const { messages, isConnected } = useChat();

    const [settings, setSettings] = useState<ChatWindowSettings>(DEFAULT_CHAT_SETTINGS);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [, setFontVersion] = useState(0);
    const [fontStatus, setFontStatus] = useState<'idle' | 'loading' | 'ready'>('idle');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [badgesLoaded, setBadgesLoaded] = useState<boolean>(false);
    const [emotes, setEmotes] = useState<Emotes>({ channelEmotes: new Map(), globalEmotes: new Map() });
    const twitchUserId = (user?.integrations?.twitch as { platform_user_id?: string })?.platform_user_id;

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        let active = true;
        void chatboxService
            .getSettings()
            .then((response) => {
                if (!active) {
                    return;
                }
                const sharedSettings = normalizeChatBoxSettings(
                    extractSettingsFromResponse(response as never) as Partial<ChatBoxSettings>
                );
                setSettings((prev) => ({ ...prev, ...sharedSettings }));
            })
            .catch((error) => {
                logger.error('Failed to load shared chat settings:', error);
            });

        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    useEffect(() => {
        if (!settings.font_family) {
            setFontStatus('idle');
            return;
        }

        let active = true;
        setFontStatus('loading');
        loadGoogleFont(settings.font_family);
        if (typeof document === 'undefined' || !('fonts' in document)) {
            setFontStatus('ready');
            setFontVersion((prev) => prev + 1);
            return;
        }

        const primaryFont = settings.font_family.split(',')[0]?.trim() || settings.font_family;
        Promise.allSettled([
            document.fonts.load(`${settings.font_weight || 'normal'} ${settings.font_size}px "${primaryFont}"`),
            document.fonts.ready,
        ]).finally(() => {
            if (active) {
                setFontStatus('ready');
                setFontVersion((prev) => prev + 1);
            }
        });

        return () => {
            active = false;
        };
    }, [settings.font_family, settings.font_size, settings.font_weight]);

    const updateSettings = (patch: Partial<ChatWindowSettings>): void => {
        setSettings((prev) => {
            const next = {
                ...prev,
                ...normalizeChatBoxSettings({ ...prev, ...patch }),
                ...patch,
            };
            void chatboxService.saveSettings(next as unknown as Record<string, unknown>).catch((error) => {
                logger.error('Failed to save shared chat settings:', error);
            });
            return next;
        });
    };

    useEffect(() => {
        if (!settings.show_badges) {
            setBadgesLoaded(false);
            return;
        }

        if (badgesLoaded) {
            return;
        }

        twitchBadgesService
            .loadGlobalBadges()
            .then(() => setBadgesLoaded(true))
            .catch((err) => logger.error('Failed to load badges:', err));
    }, [badgesLoaded, settings.show_badges]);

    useEffect(() => {
        if (!settings.show_7tv_emotes) {
            setEmotes({ channelEmotes: new Map(), globalEmotes: new Map() });
            return;
        }

        if (user?.twitch_username) {
            getAllEmotesForChannel(user.twitch_username, twitchUserId)
                .then((data) => setEmotes(data))
                .catch((err) => logger.error('Failed to load 7TV emotes:', err));
        }
    }, [settings.show_7tv_emotes, user?.twitch_username, twitchUserId]);

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
                    logger.log(`[NEW_MSG] Auto-scrolled to bottom (ChatWindow) - ${messageCount} messages`);
                }
                previousMessageCount.current = messageCount;
            });
        } else {
            previousMessageCount.current = messageCount;
        }
    }, [messages.length]);

    const displayMessages = messages.slice(-settings.max_messages);
    const backgroundOpacity = typeof settings.background_opacity === 'number' ? settings.background_opacity : 1;
    const messageSpacing = typeof settings.message_spacing === 'number' ? settings.message_spacing : 2;
    const windowBackground =
        backgroundOpacity >= 1
            ? settings.background_color
            : `${settings.background_color}${Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0')}`;
    const resolvedFontFamily = resolveChatWindowFontFamily(settings.font_family);

    if (!isAuthenticated) {
        return (
            <div
                style={{
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    gap: '16px',
                }}
            >
                <div style={{ fontSize: '48px' }}>[AUTH]</div>
                <div style={{ fontSize: '18px' }}>Требуется авторизация</div>
                <div style={{ fontSize: '14px', opacity: 0.7 }}>Пожалуйста, войдите в систему</div>
            </div>
        );
    }

    return (
        <>
            <style>
                {`
                    .chat-window-font-scope,
                    .chat-window-font-scope * {
                        font-family: var(--chat-window-font) !important;
                    }
                `}
            </style>
            <div
            className="chat-window-font-scope"
            style={{
                ['--chat-window-font' as string]: resolvedFontFamily,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: windowBackground,
                fontFamily: resolvedFontFamily,
                fontSize: `${settings.font_size}px`,
                color: settings.text_color,
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#111',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '24px' }}>[CHAT]</div>
                    <div>
                        <div style={{ fontWeight: 'bold' }}>Чат</div>
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                            {user?.twitch_username || user?.vk_username || 'Гость'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            background: showSettings ? '#4a5568' : 'transparent',
                            border: '1px solid #4a5568',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#4a5568')}
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.background = showSettings ? '#4a5568' : 'transparent')
                        }
                    >
                        Настройки
                    </button>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            opacity: 0.7,
                        }}
                    >
                        <div
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isConnected ? '#00ff00' : '#ff0000',
                            }}
                        />
                        {isConnected ? 'Подключено' : 'Отключено'}
                    </div>
                </div>
            </div>

            {/* Панель настроек */}
            {showSettings && (
                <div
                    style={{
                        padding: '16px',
                        borderBottom: '1px solid #333',
                        backgroundColor: '#1a1a1a',
                        maxHeight: '300px',
                        overflowY: 'auto',
                    }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', opacity: 0.8 }}>Шрифт</label>
                            <select
                                value={settings.font_family}
                                onChange={(e) => updateSettings({ font_family: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    background: '#2d3748',
                                    border: '1px solid #4a5568',
                                    borderRadius: '4px',
                                    color: '#fff',
                                }}
                            >
                                {CHATBOX_FONT_OPTIONS.map((font) => (
                                    <option key={font} value={font}>
                                        {font}
                                    </option>
                                ))}
                            </select>
                            <div style={{ alignItems: 'center', display: 'flex', gap: '6px', marginTop: '6px', fontSize: '11px', opacity: 0.65 }}>
                                <span
                                    style={{
                                        background: fontStatus === 'loading' ? '#fbbf24' : '#34d399',
                                        borderRadius: 999,
                                        display: 'inline-block',
                                        height: 6,
                                        width: 6,
                                    }}
                                />
                                {fontStatus === 'loading' ? 'Загрузка' : 'Применён'}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', opacity: 0.8 }}>
                                Макс. сообщений
                            </label>
                            <Input
                                type="number"
                                value={settings.max_messages}
                                onChange={(e) => updateSettings({ max_messages: parseInt(e.target.value, 10) || 50 })}
                                className="border-slate-600 bg-slate-800 text-white"
                                min="10"
                                max="200"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', opacity: 0.8 }}>Размер шрифта</label>
                            <Input
                                type="number"
                                value={settings.font_size}
                                onChange={(e) => updateSettings({ font_size: parseInt(e.target.value, 10) || 14 })}
                                className="border-slate-600 bg-slate-800 text-white"
                                min="10"
                                max="24"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', opacity: 0.8 }}>Цвет текста</label>
                            <ColorInput
                                value={settings.text_color || '#FFFFFF'}
                                onChange={(value) => updateSettings({ text_color: value })}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', opacity: 0.8 }}>Цвет фона</label>
                            <ColorInput
                                value={settings.background_color || '#1A1A1A'}
                                onChange={(value) => updateSettings({ background_color: value })}
                                opacity={Math.round(backgroundOpacity * 100)}
                                onOpacityChange={(value) => updateSettings({ background_opacity: value / 100 })}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', opacity: 0.8 }}>
                                Интервал сообщений: {messageSpacing}px
                            </label>
                            <input
                                type="range"
                                value={messageSpacing}
                                onChange={(e) => updateSettings({ message_spacing: Number(e.target.value) })}
                                min="0"
                                max="16"
                                step="1"
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.show_platform_icons}
                                onChange={(e) => updateSettings({ show_platform_icons: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px' }}>Показывать иконки платформ</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.show_badges}
                                onChange={(e) => updateSettings({ show_badges: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px' }}>Показывать значки</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.show_timestamps ?? false}
                                onChange={(e) => updateSettings({ show_timestamps: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px' }}>Показывать время</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.show_7tv_emotes}
                                onChange={(e) => updateSettings({ show_7tv_emotes: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px' }}>Показывать 7TV смайлики</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.show_links}
                                onChange={(e) => updateSettings({ show_links: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px' }}>Показывать ссылки</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.auto_load_images}
                                onChange={(e) => updateSettings({ auto_load_images: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px' }}>Автоматически загружать картинки</span>
                        </label>
                    </div>
                </div>
            )}

            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '4px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {displayMessages.length === 0 ? (
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.5,
                            textAlign: 'center',
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
                    <>
                        <div style={{ flexGrow: 1 }} />
                        {displayMessages.map((msg: ChatMessage, index: number) => {
                            const iconSize = Math.max(12, Math.min(18, settings.font_size + 2));
                            const badgeSize = Math.max(12, Math.min(18, settings.font_size + 2));
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
                                (settings.show_badges &&
                                    msg.badges &&
                                    Array.isArray(msg.badges) &&
                                    msg.badges.length > 0)
                            );

                            return (
                                <div
                                    key={msg.id || `${msg.platform}-${msg.timestamp}-${msg.author_name || msg.author}`}
                                    style={{
                                        marginTop: index > 0 ? `${messageSpacing}px` : '0',
                                        padding: '3px 6px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '4px',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.35,
                                    }}
                                >
                                    {showMeta && (
                                        <span style={metaGroupStyle}>
                                            {settings.show_platform_icons &&
                                                (msg.platform === 'twitch' ? (
                                                    <TwitchIcon
                                                        style={{
                                                            color: '#9146FF',
                                                            width: `${iconSize}px`,
                                                            height: `${iconSize}px`,
                                                            display: 'inline-block',
                                                            verticalAlign: 'text-bottom',
                                                        }}
                                                    />
                                                ) : (
                                                    <VKIcon
                                                        style={{
                                                            color: '#FF4444',
                                                            width: `${iconSize - 2}px`,
                                                            height: `${iconSize - 2}px`,
                                                            display: 'inline-block',
                                                            verticalAlign: 'text-bottom',
                                                        }}
                                                    />
                                                ))}

                                            {settings.show_badges &&
                                                msg.badges &&
                                                Array.isArray(msg.badges) &&
                                                msg.badges.length > 0 && (
                                                    <>
                                                        {msg.badges.map((badge: string, idx: number) => {
                                                            if (msg.platform === 'vk') {
                                                                const badgeUrl = normalizeVkAssetUrl(badge);
                                                                if (!badgeUrl) return null;
                                                                return (
                                                                    <img
                                                                        key={idx}
                                                                        src={badgeUrl}
                                                                        alt="vk-badge"
                                                                        title={badge}
                                                                        style={{
                                                                            width: `${badgeSize}px`,
                                                                            height: `${badgeSize}px`,
                                                                            objectFit: 'contain',
                                                                            display: 'inline-block',
                                                                            verticalAlign: 'text-bottom',
                                                                        }}
                                                                        onError={(e) => {
                                                                            (
                                                                                e.target as HTMLImageElement
                                                                            ).style.display = 'none';
                                                                        }}
                                                                    />
                                                                );
                                                            }

                                                            const [badgeId, version] = badge.split('/');
                                                            const badgeUrl = twitchBadgesService.getBadgeUrl(
                                                                badgeId,
                                                                version,
                                                                '1x'
                                                            );

                                                            if (!badgeUrl) return null;

                                                            return (
                                                                <img
                                                                    key={idx}
                                                                    src={badgeUrl}
                                                                    alt={badgeId}
                                                                    title={badge}
                                                                    style={{
                                                                        width: `${badgeSize}px`,
                                                                        height: `${badgeSize}px`,
                                                                        objectFit: 'contain',
                                                                        display: 'inline-block',
                                                                        verticalAlign: 'text-bottom',
                                                                    }}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display =
                                                                            'none';
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </>
                                                )}
                                        </span>
                                    )}

                                    {settings.show_timestamps && (
                                        <span style={{ marginRight: '6px', color: 'rgba(255,255,255,0.45)' }}>
                                            {msg.timestamp ? formatAppTime(msg.timestamp) : ''}
                                        </span>
                                    )}

                                    <span
                                        style={{
                                            color: msg.platform === 'twitch' ? '#9146FF' : '#FF4444',
                                            fontWeight: '600',
                                            marginRight: '4px',
                                        }}
                                    >
                                        {msg.author_name || msg.author}:
                                    </span>

                                    <span style={{ color: settings.text_color }}>
                                        <MessageContent
                                            message={msg.message ?? ''}
                                            channelEmotes={settings.show_7tv_emotes ? emotes.channelEmotes : new Map()}
                                            globalEmotes={settings.show_7tv_emotes ? emotes.globalEmotes : new Map()}
                                            twitchEmotes={msg.emotes}
                                            showLinks={settings.show_links}
                                            autoLoadImages={settings.auto_load_images}
                                        />
                                    </span>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            <div
                style={{
                    padding: '8px 12px',
                    borderTop: '1px solid #333',
                    backgroundColor: '#111',
                    fontSize: '11px',
                    opacity: 0.6,
                    textAlign: 'center',
                }}
            >
                Это окно использует общее WebSocket соединение (Leader Election)
            </div>
            </div>
        </>
    );
};

export default ChatWindow;
