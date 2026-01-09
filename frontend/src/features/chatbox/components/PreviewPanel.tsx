// src/components/chatbox/PreviewPanel.tsx
import React from 'react';

import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';

interface ChatBoxSettings {
    font_family: string;
    font_size: number;
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
}

interface PreviewMessage {
    id: number;
    platform: 'twitch' | 'vk';
    author: string;
    message: string;
    time: string;
    role: string;
    badges: string[];
}

interface PreviewPanelProps {
    settings: ChatBoxSettings;
    previewMessages: PreviewMessage[];
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ settings, previewMessages }) => {
    const hexToRgba = (hex: string, opacity: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    return (
        <div className="space-y-4">
            <div className="text-white font-semibold">Предпросмотр</div>
            <div 
                className="border border-gray-600 rounded-lg overflow-hidden"
                style={{
                    width: '100%',
                    height: '400px',
                    backgroundColor: hexToRgba(settings.background_color || '#000000', settings.background_opacity),
                    borderRadius: `${settings.border_radius}px`,
                    fontFamily: settings.font_family,
                    fontSize: `${settings.font_size}px`
                }}
            >
                <div 
                    className="h-full overflow-y-auto p-4"
                    style={{
                        display: 'flex',
                        flexDirection: settings.chat_direction === 'vertical-reverse' ? 'column' : 'column-reverse',
                        gap: `${settings.message_spacing}px`
                    }}
                >
                    {previewMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className="text-white"
                            style={{
                                animation: `${settings.animation_type} ${settings.animation_duration}ms ease-out`,
                                WebkitTextStroke: `${settings.text_stroke_width}px ${settings.text_stroke_color || '#000000'}`
                            }}
                        >
                            {settings.show_platform_icons && (
                                msg.platform === 'twitch' ? (
                                    <TwitchIcon className="inline-block mr-1" style={{ width: '18px', height: '18px' }} />
                                ) : (
                                    <VKIcon className="inline-block mr-1" style={{ width: '18px', height: '18px' }} />
                                )
                            )}
                            <span className="text-gray-400 text-xs mr-2">{msg.time}</span>
                            {settings.show_badges && msg.badges.length > 0 && (
                                <span className="text-xs bg-purple-600 px-1 rounded mr-1">{msg.role}</span>
                            )}
                            <span className={msg.platform === 'twitch' ? 'text-purple-400' : 'text-red-400'}>
                                {msg.author}:
                            </span>{' '}
                            <span>{msg.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PreviewPanel;
