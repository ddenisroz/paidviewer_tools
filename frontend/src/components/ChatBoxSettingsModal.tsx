// src/components/ChatBoxSettingsModal.tsx
import React, { useEffect, useState } from 'react';

import { Check, Copy, Palette, RefreshCw, Settings2, Sparkles, X } from 'lucide-react';
import ReactDOM from 'react-dom';

import { useAuth } from '@/context/AuthContext';
import ColorInput from '@/features/chatbox/components/ColorInputModern';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { SliderWithInput } from '@/shared/components/ui/slider-with-input';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/shared/utils/toastManager';

import type { ApiResponse } from '@/types/api';
import type { ChatEmote } from '@/types/chat';
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
    emotes?: ChatEmote[];
    vk_role_icon_url?: string;
    avatar_url?: string;
}

const DEFAULT_SETTINGS: ChatBoxSettings = {
    font_family: 'Inter',
    font_size: 16,
    font_weight: 'normal',
    text_color: '#FFFFFF',
    username_color: '#9147FF',
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
    show_roles: false,
    show_badges: true,
    show_avatars: false,
    show_7tv_emotes: true,
    show_links: true,
    auto_load_images: true,
    widget_url: '',
    version: 1
};

const PREVIEW_MESSAGES: PreviewMessage[] = [
    {
        id: 1,
        platform: 'twitch',
        author: 'Streamer',
        message: 'Привет всем Kappa',
        time: '12:00',
        role: 'Broadcaster',
        badges: ['broadcaster/1'],
        emotes: [
            { id: '25', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0', start: 12, end: 16 }
        ],
        avatar_url: 'https://placehold.co/40x40/1f2937/FFFFFF?text=S'
    },
    {
        id: 2,
        platform: 'twitch',
        author: 'VIPUser',
        message: 'Nice clutch PogChamp',
        time: '12:01',
        role: 'VIP',
        badges: ['vip/1'],
        emotes: [
            { id: '88', name: 'PogChamp', url: 'https://static-cdn.jtvnw.net/emoticons/v2/88/default/dark/1.0', start: 12, end: 19 }
        ],
        avatar_url: 'https://placehold.co/40x40/4f46e5/FFFFFF?text=V'
    },
    {
        id: 3,
        platform: 'vk',
        author: 'Viewer1',
        message: 'Это огонь :smile_32: и :smile_451:',
        time: '12:02',
        role: 'moderator',
        badges: [],
        emotes: [
            { id: '32', name: 'smile_32', url: 'https://images.live.vkvideo.ru/smile/32/icon/size/small', start: 10, end: 19 },
            { id: '451', name: 'smile_451', url: 'https://images.live.vkvideo.ru/smile/451/icon/size/small', start: 23, end: 33 }
        ],
        avatar_url: 'https://placehold.co/40x40/ef4444/FFFFFF?text=VK'
    },
    {
        id: 4,
        platform: 'twitch',
        author: 'Moderator',
        message: 'Го в катку JustAnotherDay',
        time: '12:03',
        role: 'Moderator',
        badges: ['moderator/1'],
        avatar_url: 'https://placehold.co/40x40/22c55e/FFFFFF?text=M'
    }
];

const FONT_OPTIONS = [
    'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Oswald',
    'Raleway', 'Poppins', 'Ubuntu', 'Nunito', 'Rubik', 'Fira Sans'
];

const ANIMATION_OPTIONS = [
    { value: 'fade', label: 'Плавное появление' },
    { value: 'slide-right', label: 'Слайд слева' },
    { value: 'slide-left', label: 'Слайд справа' },
    { value: 'scale', label: 'Масштаб' },
    { value: 'bounce', label: 'Пружина' },
    { value: 'none', label: 'Без анимации' }
];

const CHAT_DIRECTION_OPTIONS = [
    { value: 'vertical', label: 'Вертикально (снизу вверх)' },
    { value: 'horizontal', label: 'Горизонтально (бегущая строка)' }
];

const ChatBoxSettingsModal: React.FC<ChatBoxSettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<ChatBoxSettings>(DEFAULT_SETTINGS);
    const [initialSettings, setInitialSettings] = useState<ChatBoxSettings | null>(null);
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
            setInitialSettings(null);
            setLoading(false);
        }
        return () => { document.body.style.overflow = ''; };
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
            const normalized = normalizeChatBoxSettings(data);
            setSettings(normalized);
            setInitialSettings(normalized);
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
            const normalized = normalizeChatBoxSettings(updatedSettings);
            setSettings(normalized);
            setInitialSettings(normalized);
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

    const resetToDefaults = () => {
        setSettings(prev => ({
            ...DEFAULT_SETTINGS,
            widget_url: prev.widget_url,
            version: prev.version || DEFAULT_SETTINGS.version
        }));
    };

    const hasUnsavedChanges = initialSettings
        ? JSON.stringify(settings) !== JSON.stringify(initialSettings)
        : false;

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
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]" />
                <div className="fixed inset-0 z-[10000] flex items-center justify-center">
                <div className="bg-slate-900/95 p-8 rounded-lg shadow-2xl border border-slate-700/60">
                        <div className="text-white">Загрузка...</div>
                    </div>
                </div>
            </>
        );
        return ReactDOM.createPortal(loadingContent, document.body);
    }

    const modalContent = (
        <>
            <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[9999]" onClick={onClose} />

            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div
                    className="bg-slate-900/95 font-base rounded-xl max-w-5xl w-full h-[92vh] max-h-[92vh] overflow-hidden flex flex-col pointer-events-auto border border-slate-700/60 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="border-b border-slate-700/60 px-5 py-3 flex items-center justify-between bg-slate-800/80">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-white">Настройки ChatBox</h2>
                            {hasUnsavedChanges && (
                                <span className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                                    Изменения не сохранены
                                </span>
                            )}
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-5 flex flex-col lg:flex-row gap-6 min-h-0 bg-slate-900/70">
                        {/* Left: Preview */}
                        <div className="lg:w-80 w-full flex-shrink-0 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
                            <div className="flex-1 border border-slate-700/60 rounded-lg overflow-hidden bg-slate-900/70 min-h-[240px]">
                                <PreviewPanel
                                    settings={settings}
                                    previewMessages={PREVIEW_MESSAGES}
                                    twitchChannelName={(user?.integrations?.twitch as { channel_name?: string })?.channel_name || user?.twitch_username || null}
                                />
                            </div>

                            {/* OBS URL */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Ссылка для OBS</Label>
                                <div className="flex gap-1.5">
                                    <Input
                                        value={settings.widget_url || ''}
                                        readOnly
                                        className="bg-slate-800/80 text-white border-slate-600/70 h-8 flex-1 truncate text-sm font-normal font-base"
                                    />
                                    <Button onClick={copyToClipboard} variant="outline" size="sm" className="border-slate-700 h-8 w-8 p-0">
                                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </Button>
                                    <Button onClick={() => handleSave(true)} variant="outline" size="sm" className="border-slate-700 h-8 w-8 p-0" title="Обновить токен">
                                        <RefreshCw className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Right: Settings Tabs */}
                        <div className="flex-1 min-w-0 min-h-0">
                            <Tabs defaultValue="appearance" className="h-full flex flex-col overflow-hidden min-h-0">
                                <TabsList className="grid grid-cols-3 gap-1 p-1 rounded-lg border border-[#1a2a3f] bg-[#0f1a2b] mb-4 font-base">
                                    <TabsTrigger value="appearance" className="text-xs gap-1.5 rounded-md text-slate-300 data-[state=active]:bg-[#0b1220] data-[state=active]:text-white data-[state=active]:shadow-sm">
                                        <Palette className="w-3 h-3" /> Внешний вид
                                    </TabsTrigger>
                                    <TabsTrigger value="animation" className="text-xs gap-1.5 rounded-md text-slate-300 data-[state=active]:bg-[#0b1220] data-[state=active]:text-white data-[state=active]:shadow-sm">
                                        <Sparkles className="w-3 h-3" /> Анимация
                                    </TabsTrigger>
                                    <TabsTrigger value="display" className="text-xs gap-1.5 rounded-md text-slate-300 data-[state=active]:bg-[#0b1220] data-[state=active]:text-white data-[state=active]:shadow-sm">
                                        <Settings2 className="w-3 h-3" /> Отображение
                                    </TabsTrigger>
                                </TabsList>

                                {/* Appearance Tab */}
                                <TabsContent value="appearance" className="flex-1 overflow-y-auto space-y-5 mt-0 pr-2 min-h-0">
                                    <div className="rounded-lg border border-[#1a2a3f] bg-[#101d31] p-4 space-y-4">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400">Типографика</div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Шрифт</Label>
                                                <Select
                                                    value={settings.font_family}
                                                    onValueChange={(v) => handleChange('font_family', v)}
                                                >
                                                    <SelectTrigger className="h-9 bg-[#14233a] border-[#22324a] text-sm font-normal font-base">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-[#101d31] border-[#1a2a3f] z-[11000] font-base">
                                                        {FONT_OPTIONS.map(font => (
                                                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                                                                {font}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Размер</Label>
                                                <SliderWithInput
                                                    value={settings.font_size}
                                                    onChange={(v) => handleChange('font_size', v)}
                                                    min={8}
                                                    max={32}
                                                    step={1}
                                                    unit="px"
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-[#1a2a3f] bg-[#101d31] p-4 space-y-4">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400">Цвета</div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Цвет фона</Label>
                                                <ColorInput
                                                    value={settings.background_color || '#000000'}
                                                    onChange={(v) => handleChange('background_color', v)}
                                                />
                                                <div className="space-y-1.5">
                                                    <span className="text-[11px] text-muted-foreground">Прозрачность</span>
                                                    <SliderWithInput
                                                        value={Math.round(settings.background_opacity * 100)}
                                                        onChange={(v) => handleChange('background_opacity', v / 100)}
                                                        min={0}
                                                        max={100}
                                                        step={5}
                                                        unit="%"
                                                        inputWidth={56}
                                                        inputClassName="text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Цвет текста</Label>
                                                <ColorInput
                                                    value={settings.text_color || '#FFFFFF'}
                                                    onChange={(v) => handleChange('text_color', v)}
                                                />
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground">Цвет никнейма</Label>
                                                    <ColorInput
                                                        value={settings.username_color || '#9147FF'}
                                                        onChange={(v) => handleChange('username_color', v)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Обводка текста</Label>
                                            <ColorInput
                                                value={settings.text_stroke_color || '#000000'}
                                                onChange={(v) => handleChange('text_stroke_color', v)}
                                            />
                                            <div className="space-y-1.5">
                                                <span className="text-[11px] text-muted-foreground">Толщина</span>
                                                <SliderWithInput
                                                    value={settings.text_stroke_width}
                                                    onChange={(v) => handleChange('text_stroke_width', v)}
                                                    min={0}
                                                    max={3}
                                                    step={0.5}
                                                    unit="px"
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-[#1a2a3f] bg-[#101d31] p-4 space-y-3">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400">Скругление</div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Скругление углов</Label>
                                            <SliderWithInput
                                                value={settings.border_radius ?? 8}
                                                onChange={(v) => handleChange('border_radius', v)}
                                                min={0}
                                                max={32}
                                                step={1}
                                                unit="px"
                                                inputWidth={56}
                                                inputClassName="text-sm"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Animation Tab */}
                                <TabsContent value="animation" className="flex-1 overflow-y-auto space-y-5 mt-0 pr-2 min-h-0">
                                    <div className="rounded-lg border border-[#1a2a3f] bg-[#101d31] p-4 space-y-4">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400">Анимация</div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Тип анимации</Label>
                                            <Select
                                                value={settings.animation_type}
                                                onValueChange={(v) => handleChange('animation_type', v)}
                                            >
                                                <SelectTrigger className="h-9 bg-[#14233a] border-[#22324a] text-sm font-normal font-base">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#101d31] border-[#1a2a3f] z-[11000] font-base">
                                                    {ANIMATION_OPTIONS.map(option => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Длительность</Label>
                                                <SliderWithInput
                                                    value={settings.animation_duration}
                                                    onChange={(v) => handleChange('animation_duration', v)}
                                                    min={0}
                                                    max={2000}
                                                    step={50}
                                                    unit="ms"
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Исчезание</Label>
                                                <SliderWithInput
                                                    value={settings.message_fade_seconds}
                                                    onChange={(v) => handleChange('message_fade_seconds', v)}
                                                    min={10}
                                                    max={60}
                                                    step={5}
                                                    unit="с"
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Display Tab */}
                                <TabsContent value="display" className="flex-1 overflow-y-auto space-y-5 mt-0 pr-2 min-h-0">
                                    <div className="rounded-lg border border-[#1a2a3f] bg-[#101d31] p-4 space-y-3">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400">Отображение</div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="flex items-center justify-between rounded-md border border-[#22324a] bg-[#14233a] px-3 py-2">
                                                <Label className="text-sm text-slate-200">Иконки платформ</Label>
                                                <Switch checked={settings.show_platform_icons} onCheckedChange={(v) => handleChange('show_platform_icons', v)} />
                                            </div>
                                            <div className="flex items-center justify-between rounded-md border border-[#22324a] bg-[#14233a] px-3 py-2">
                                                <Label className="text-sm text-slate-200">Значки (badges)</Label>
                                                <Switch checked={settings.show_badges} onCheckedChange={(v) => handleChange('show_badges', v)} />
                                            </div>
                                            <div className="flex items-center justify-between rounded-md border border-[#22324a] bg-[#14233a] px-3 py-2">
                                                <Label className="text-sm text-slate-200">7TV Эмодзи</Label>
                                                <Switch checked={settings.show_7tv_emotes} onCheckedChange={(v) => handleChange('show_7tv_emotes', v)} />
                                            </div>
                                            <div className="flex items-center justify-between rounded-md border border-[#22324a] bg-[#14233a] px-3 py-2">
                                                <Label className="text-sm text-slate-200">Ссылки</Label>
                                                <Switch checked={settings.show_links} onCheckedChange={(v) => handleChange('show_links', v)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-[#1a2a3f] bg-[#101d31] p-4 space-y-4">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400">Разметка</div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Ширина</Label>
                                                <SliderWithInput
                                                    value={settings.chat_width}
                                                    onChange={(v) => handleChange('chat_width', v)}
                                                    min={20}
                                                    max={100}
                                                    step={1}
                                                    unit="%"
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Направление</Label>
                                            <Select
                                                value={settings.chat_direction}
                                                onValueChange={(v) => handleChange('chat_direction', v)}
                                            >
                                                <SelectTrigger className="h-9 bg-[#14233a] border-[#22324a] text-sm font-normal font-base">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#101d31] border-[#1a2a3f] z-[11000] font-base">
                                                    {CHAT_DIRECTION_OPTIONS.map(option => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Макс. сообщений</Label>
                                                <SliderWithInput
                                                    value={settings.max_messages}
                                                    onChange={(v) => handleChange('max_messages', v)}
                                                    min={1}
                                                    max={50}
                                                    step={1}
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Отступ</Label>
                                                <SliderWithInput
                                                    value={settings.message_spacing}
                                                    onChange={(v) => handleChange('message_spacing', v)}
                                                    min={0}
                                                    max={32}
                                                    step={1}
                                                    unit="px"
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-[#1a2a3f] px-5 py-3 flex items-center justify-between gap-2 bg-[#0f1a2b]">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={resetToDefaults} className="h-9 border-[#22324a] bg-[#14233a] text-slate-200 hover:bg-[#1b2f4a] hover:text-white">
                                Сбросить
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={onClose} className="h-9 border-[#22324a] bg-[#14233a] text-slate-200 hover:bg-[#1b2f4a] hover:text-white">
                                Отмена
                            </Button>
                            <Button onClick={() => handleSave(false)} disabled={saving} className="h-9 bg-none bg-primary hover:bg-primary/90">
                                {saving ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ChatBoxSettingsModal;





