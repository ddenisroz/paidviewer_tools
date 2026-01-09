// src/components/ChatBoxSettingsModal.tsx
import React, { useEffect, useState } from 'react';

import { Check, Copy, RefreshCw, X } from 'lucide-react';
import ReactDOM from 'react-dom';



import AnimationSettings from '@/features/chatbox/components/AnimationSettings';
import ColorSettings from '@/features/chatbox/components/ColorSettings';
import FontSettings from '@/features/chatbox/components/FontSettings';
import PlatformSettings from '@/features/chatbox/components/PlatformSettings';
import PreviewPanel from '@/features/chatbox/components/PreviewPanel';
import {
    extractSettingsFromResponse,
    loadGoogleFont,
    normalizeChatBoxSettings
} from '@/features/chatbox/utils/chatboxHelpers';
import { chatboxService } from '@/services/api/services/chatboxService';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/shared/utils/toastManager';

import type { ApiResponse } from '@/types/api';
import type { ChatBoxSettings } from '@/types/chatbox';
import type { AxiosResponse } from 'axios';

interface ChatBoxSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (settings: ChatBoxSettings) => void;
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

const DEFAULT_SETTINGS: ChatBoxSettings = {
    font_family: 'Inter',
    font_size: 16,
    text_stroke_width: 0,
    text_stroke_color: '#000000',
    background_opacity: 0.5,
    background_color: '#000000',
    max_messages: 20,
    message_spacing: 4,
    animation_type: 'fade',
    animation_duration: 300,
    message_fade_seconds: 60,
    chat_direction: 'vertical',
    chat_width: 100,
    border_radius: 8,
    show_platform_icons: true,
    show_badges: true,
    show_7tv_emotes: true,
    show_links: true,
    widget_url: '',
    version: 1
};

const PREVIEW_MESSAGES: PreviewMessage[] = [
    { id: 1, platform: 'twitch', author: 'Streamer', message: 'Привет всем! 👋', time: '12:00', role: 'Broadcaster', badges: ['broadcaster/1'] },
    { id: 2, platform: 'vk', author: 'Viewer1', message: 'Привет! Как дела?', time: '12:01', role: 'Viewer', badges: [] },
    { id: 3, platform: 'twitch', author: 'Moderator', message: 'Всем привет!', time: '12:02', role: 'Moderator', badges: ['moderator/1'] }
];

const ChatBoxSettingsModal: React.FC<ChatBoxSettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const [settings, setSettings] = useState<ChatBoxSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            setSettings(DEFAULT_SETTINGS);
            setLoading(false);
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        if (settings?.font_family) {
            loadGoogleFont(settings.font_family);
        }
    }, [settings?.font_family]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await chatboxService.getSettings() as AxiosResponse<ApiResponse<ChatBoxSettings>>;
            const data = extractSettingsFromResponse(response);
            const normalizedSettings = normalizeChatBoxSettings(data);
            setSettings(normalizedSettings);
        } catch (error) {
            logger.error('Ошибка загрузки настроек ChatBox:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (regenerateToken = false) => {
        try {
            setSaving(true);
            const response = await chatboxService.saveSettings(
                { ...settings, version: settings.version || 1 },
                regenerateToken
            ) as AxiosResponse<ApiResponse<ChatBoxSettings>>;
            const updatedSettings = extractSettingsFromResponse(response);

            setSettings(prev => ({ ...prev, ...updatedSettings }));
            toast.success('Настройки сохранены');
            if (onSave) onSave(updatedSettings);
        } catch (error) {
            logger.error('Ошибка сохранения настроек:', error);
            toast.error('Ошибка сохранения настроек');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: keyof ChatBoxSettings, value: string | number | boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(settings.widget_url);
        setCopied(true);
        toast.success('URL скопирован');
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    if (loading) {
        const loadingContent = (
            <>
                <div className="fixed inset-0 bg-black/80 z-[9999]" />
                <div className="fixed inset-0 z-[10000] flex items-center justify-center">
                    <div className="bg-gray-900 p-8 rounded-lg shadow-2xl">
                        <div className="text-white">Загрузка...</div>
                    </div>
                </div>
            </>
        );
        return ReactDOM.createPortal(loadingContent, document.body);
    }

    const modalContent = (
        <>
            <div className="fixed inset-0 bg-black/80 z-[9999]" onClick={onClose} />

            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-gray-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto border border-gray-700"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="border-b border-gray-700 p-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white">Настройки ChatBox для OBS</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-2 gap-6 h-full">
                            <div className="space-y-6">
                                {/* OBS Link */}
                                <div className="space-y-2">
                                    <Label className="text-white font-semibold">Ссылка для OBS</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={settings.widget_url || ''}
                                            readOnly
                                            className="bg-gray-800 text-white border-gray-600 font-mono text-xs flex-1"
                                        />
                                        <Button
                                            onClick={copyToClipboard}
                                            variant="outline"
                                            size="sm"
                                            className="border-gray-600 hover:bg-gray-700"
                                        >
                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </Button>
                                        <Button
                                            onClick={() => handleSave(true)}
                                            variant="outline"
                                            size="sm"
                                            className="border-gray-600 hover:bg-gray-700"
                                            title="Обновить токен"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <FontSettings
                                    fontFamily={settings.font_family}
                                    fontSize={settings.font_size}
                                    textStrokeWidth={settings.text_stroke_width}
                                    onFontFamilyChange={(value) => handleChange('font_family', value)}
                                    onFontSizeChange={(value) => handleChange('font_size', value)}
                                    onTextStrokeWidthChange={(value) => handleChange('text_stroke_width', value)}
                                />

                                <ColorSettings
                                    backgroundColor={settings.background_color || '#000000'}
                                    backgroundOpacity={settings.background_opacity}
                                    textStrokeColor={settings.text_stroke_color || '#000000'}
                                    borderRadius={settings.border_radius || 8}
                                    onBackgroundColorChange={(value) => handleChange('background_color', value)}
                                    onBackgroundOpacityChange={(value) => handleChange('background_opacity', value)}
                                    onTextStrokeColorChange={(value) => handleChange('text_stroke_color', value)}
                                    onBorderRadiusChange={(value) => handleChange('border_radius', value)}
                                />

                                <AnimationSettings
                                    animationType={settings.animation_type}
                                    animationDuration={settings.animation_duration}
                                    messageFadeSeconds={settings.message_fade_seconds}
                                    onAnimationTypeChange={(value) => handleChange('animation_type', value)}
                                    onAnimationDurationChange={(value) => handleChange('animation_duration', value)}
                                    onMessageFadeSecondsChange={(value) => handleChange('message_fade_seconds', value)}
                                />

                                <PlatformSettings
                                    showPlatformIcons={settings.show_platform_icons}
                                    showBadges={settings.show_badges}
                                    show7tvEmotes={settings.show_7tv_emotes}
                                    showLinks={settings.show_links}
                                    maxMessages={settings.max_messages}
                                    messageSpacing={settings.message_spacing}
                                    chatDirection={settings.chat_direction}
                                    chatWidth={settings.chat_width}
                                    onShowPlatformIconsChange={(value) => handleChange('show_platform_icons', value)}
                                    onShowBadgesChange={(value) => handleChange('show_badges', value)}
                                    onShow7tvEmotesChange={(value) => handleChange('show_7tv_emotes', value)}
                                    onShowLinksChange={(value) => handleChange('show_links', value)}
                                    onMaxMessagesChange={(value) => handleChange('max_messages', value)}
                                    onMessageSpacingChange={(value) => handleChange('message_spacing', value)}
                                    onChatDirectionChange={(value) => handleChange('chat_direction', value)}
                                    onChatWidthChange={(value) => handleChange('chat_width', value)}
                                />
                            </div>

                            <div>
                                <PreviewPanel settings={settings} previewMessages={PREVIEW_MESSAGES} />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-700 p-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose} className="border-gray-600">
                            Отмена
                        </Button>
                        <Button onClick={() => handleSave(false)} disabled={saving}>
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ChatBoxSettingsModal;
