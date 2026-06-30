// src/components/ChatBoxSettingsModal.tsx
import React, { useEffect, useState } from 'react';

import { Check, Copy, Palette, RefreshCw, Settings2, Sparkles, X } from 'lucide-react';
import ReactDOM from 'react-dom';

import { useAuth } from '@/context/AuthContext';
import ColorInput from '@/features/chatbox/components/ColorInputPickerOnly';
import PreviewPanel from '@/features/chatbox/components/PreviewPanel';
import { CHATBOX_BRAND_FONT, CHATBOX_FONT_OPTIONS } from '@/features/chatbox/constants/fontOptions';
import { CHATBOX_PREVIEW_MESSAGES } from '@/features/chatbox/constants/previewMessages';
import {
    extractSettingsFromResponse,
    loadGoogleFont,
    normalizeChatBoxSettings,
    resolveMessageBackgroundMode,
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
import type { ChatBoxSettings } from '@/types/chatbox';
import type { AxiosResponse } from 'axios';

interface ChatBoxSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (settings: ChatBoxSettings) => void;
}

const DEFAULT_SETTINGS: ChatBoxSettings = {
    font_family: CHATBOX_BRAND_FONT,
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
    show_7tv_emotes: true,
    show_links: true,
    auto_load_images: true,
    separate_message_backgrounds: true,
    message_background_mode: 'message',
    widget_url: '',
    version: 1,
};

const SETTINGS_SECTION_CLASS = 'rounded-lg border border-border/60 bg-card/60 p-3.5 space-y-3.5';
const SETTINGS_SECTION_TITLE_CLASS = 'text-[11px] uppercase tracking-wider text-muted-foreground';
const SETTINGS_SELECT_TRIGGER_CLASS = 'h-9 bg-background/70 border-border/60 text-sm font-normal font-base';
const BLUE_ACTIVE_CLASS =
    'data-[state=active]:bg-transparent data-[state=active]:text-sky-400 data-[state=active]:border-sky-500/60';

const FONT_WEIGHT_OPTIONS = [
    { value: 'normal', label: 'Обычный' },
    { value: '500', label: 'Средний' },
    { value: '600', label: 'Полужирный' },
    { value: '700', label: 'Жирный' },
];

const ANIMATION_OPTIONS = [
    { value: 'fade', label: 'Плавное появление' },
    { value: 'slide-right', label: 'Слайд слева' },
    { value: 'slide-left', label: 'Слайд справа' },
    { value: 'scale', label: 'Масштаб' },
    { value: 'bounce', label: 'Пружина' },
    { value: 'none', label: 'Без анимации' },
];

const CHAT_DIRECTION_OPTIONS = [
    { value: 'vertical', label: 'Вертикально' },
    { value: 'horizontal', label: 'Горизонтально' },
];

const MESSAGE_BACKGROUND_OPTIONS = [
    { value: 'message', label: 'Карточки' },
    { value: 'column', label: 'Сплошной фон' },
    { value: 'none', label: 'Без фона' },
];

const ChatBoxSettingsModal: React.FC<ChatBoxSettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<ChatBoxSettings>(DEFAULT_SETTINGS);
    const [initialSettings, setInitialSettings] = useState<ChatBoxSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [fontStatus, setFontStatus] = useState<'idle' | 'loading' | 'ready'>('idle');

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
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!settings?.font_family) {
            setFontStatus('idle');
            return undefined;
        }

        let active = true;
        setFontStatus('loading');
        loadGoogleFont(settings.font_family);

        if (typeof document === 'undefined' || !('fonts' in document)) {
            setFontStatus('ready');
            return undefined;
        }

        const primaryFont = settings.font_family.split(',')[0]?.trim() || settings.font_family;
        Promise.allSettled([
            document.fonts.load(`${settings.font_weight || 'normal'} ${settings.font_size}px "${primaryFont}"`),
            document.fonts.ready,
        ]).finally(() => {
            if (active) {
                setFontStatus('ready');
            }
        });

        return () => {
            active = false;
        };
    }, [settings?.font_family, settings?.font_size, settings?.font_weight]);

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
            const response = (await chatboxService.getSettings()) as AxiosResponse<ApiResponse<ChatBoxSettings>>;
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
            const response = (await chatboxService.saveSettings(
                {
                    ...settings,
                    text_stroke_width: Math.round(Number(settings.text_stroke_width) || 0),
                    version: settings.version || 1,
                },
                regenerateToken
            )) as AxiosResponse<ApiResponse<ChatBoxSettings>>;
            const updatedSettings = extractSettingsFromResponse(response);
            const normalized = normalizeChatBoxSettings(updatedSettings);
            setSettings(normalized);
            setInitialSettings(normalized);
            toast.success('Настройки сохранены');
            if (onSave) onSave(updatedSettings);
        } catch (error) {
            logger.error('Ошибка сохранения настроек:', error);
            const detail =
                typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
                    ? (error as { response: { data: { detail: string } } }).response.data.detail
                    : 'Ошибка сохранения настроек';
            toast.error(detail);
        } finally {
            setSaving(false);
        }
    };

    const availableAnimationOptions =
        settings.chat_direction === 'horizontal'
            ? [
                  { value: 'slide-left', label: 'Слайд справа' },
                  { value: 'none', label: 'Без анимации' },
              ]
            : ANIMATION_OPTIONS;
    const isHorizontalPreview = settings.chat_direction === 'horizontal';

    const handleChange = (key: keyof ChatBoxSettings, value: string | number | boolean) => {
        setSettings((prev) => {
            if (key === 'message_background_mode') {
                const nextMode = value as ChatBoxSettings['message_background_mode'];
                return {
                    ...prev,
                    message_background_mode: nextMode,
                    separate_message_backgrounds: nextMode === 'message',
                };
            }

            if (key === 'separate_message_backgrounds') {
                const nextMode = value === false ? 'none' : 'message';
                return {
                    ...prev,
                    separate_message_backgrounds: Boolean(value),
                    message_background_mode: nextMode,
                };
            }

            if (key === 'chat_direction') {
                const nextDirection = String(value);
                return {
                    ...prev,
                    chat_direction: nextDirection,
                    animation_type:
                        nextDirection === 'horizontal'
                            ? prev.animation_type === 'none'
                                ? 'none'
                                : 'slide-left'
                            : prev.animation_type,
                };
            }

            if (key === 'animation_type' && prev.chat_direction === 'horizontal') {
                return {
                    ...prev,
                    animation_type: value === 'none' ? 'none' : 'slide-left',
                };
            }

            return { ...prev, [key]: value };
        });
    };

    const resetToDefaults = () => {
        setSettings((prev) => ({
            ...DEFAULT_SETTINGS,
            widget_url: prev.widget_url,
            version: prev.version || DEFAULT_SETTINGS.version,
        }));
    };

    const hasUnsavedChanges = initialSettings ? JSON.stringify(settings) !== JSON.stringify(initialSettings) : false;

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
                <div className="fixed inset-0 bg-black/75 z-[9999]" />
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
            <div className="fixed inset-0 bg-black/75 z-[9999]" onClick={onClose} />

            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div
                    className="bg-background/95 font-base rounded-lg max-w-5xl w-full h-[92vh] max-h-[92vh] overflow-hidden flex flex-col pointer-events-auto border border-border/60 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="border-b border-border/60 px-5 py-3 flex items-center justify-between bg-card/70">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-white">Настройки ChatBox</h2>
                            {hasUnsavedChanges && (
                                <span className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                                    Изменения не сохранены
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent/60"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="grid flex-1 grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)] gap-5 overflow-hidden bg-background p-4">
                        {/* Left: Preview */}
                        <div
                            className="flex min-h-0 w-full flex-col gap-3"
                        >
                            <div
                                className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-card/60"
                            >
                                <PreviewPanel
                                    settings={settings}
                                    previewMessages={CHATBOX_PREVIEW_MESSAGES}
                                    twitchChannelName={
                                        (user?.integrations?.twitch as { channel_name?: string })?.channel_name ||
                                        user?.twitch_username ||
                                        null
                                    }
                                />
                            </div>

                            {/* OBS URL */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Ссылка для OBS</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={settings.widget_url || ''}
                                        readOnly
                                        className="h-9 flex-1 truncate border-sky-500/35 bg-background/60 text-sm font-medium text-foreground font-base shadow-[0_0_0_1px_rgba(14,165,233,0.15)]"
                                    />
                                    <Button
                                        onClick={copyToClipboard}
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 border-sky-500/40 bg-transparent p-0 text-sky-300 hover:bg-sky-500/10 hover:text-sky-200"
                                    >
                                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </Button>
                                    <Button
                                        onClick={() => handleSave(true)}
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 border-sky-500/40 bg-transparent p-0 text-sky-300 hover:bg-sky-500/10 hover:text-sky-200"
                                        title="Обновить токен"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Right: Settings Tabs */}
                        <div className="min-h-0 min-w-0">
                            <Tabs defaultValue="appearance" className="h-full flex flex-col overflow-hidden min-h-0">
                                <TabsList className="mb-4 grid grid-cols-3 gap-2 bg-transparent p-0 font-base">
                                    <TabsTrigger
                                        value="appearance"
                                        className={`text-xs gap-1.5 rounded-md border border-border/60 bg-transparent text-muted-foreground ${BLUE_ACTIVE_CLASS}`}
                                    >
                                        <Palette className="w-3 h-3" /> Внешний вид
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="animation"
                                        className={`text-xs gap-1.5 rounded-md border border-border/60 bg-transparent text-muted-foreground ${BLUE_ACTIVE_CLASS}`}
                                    >
                                        <Sparkles className="w-3 h-3" /> Анимация
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="display"
                                        className={`text-xs gap-1.5 rounded-md border border-border/60 bg-transparent text-muted-foreground ${BLUE_ACTIVE_CLASS}`}
                                    >
                                        <Settings2 className="w-3 h-3" /> Отображение
                                    </TabsTrigger>
                                </TabsList>

                                {/* Appearance Tab */}
                                <TabsContent
                                    value="appearance"
                                    className="flex-1 overflow-y-auto space-y-5 mt-0 pr-2 min-h-0"
                                >
                                    <div className={SETTINGS_SECTION_CLASS}>
                                        <div className={SETTINGS_SECTION_TITLE_CLASS}>Типографика</div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Шрифт</Label>
                                                <Select
                                                    value={settings.font_family}
                                                    onValueChange={(v) => handleChange('font_family', v)}
                                                >
                                                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-card border-border/60 z-[11000] font-base">
                                                        {CHATBOX_FONT_OPTIONS.map((font) => (
                                                            <SelectItem
                                                                key={font}
                                                                value={font}
                                                                style={{ fontFamily: font }}
                                                            >
                                                                {font}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${
                                                            fontStatus === 'loading'
                                                                ? 'bg-amber-300'
                                                                : 'bg-emerald-300'
                                                        }`}
                                                    />
                                                    {fontStatus === 'loading' ? 'Загрузка' : 'Применён'}
                                                </div>
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
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Насыщенность</Label>
                                                <Select
                                                    value={String(settings.font_weight || 'normal')}
                                                    onValueChange={(v) => handleChange('font_weight', v)}
                                                >
                                                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-card border-border/60 z-[11000] font-base">
                                                        {FONT_WEIGHT_OPTIONS.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={SETTINGS_SECTION_CLASS}>
                                        <div className={SETTINGS_SECTION_TITLE_CLASS}>Цвета</div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Цвет фона</Label>
                                                <ColorInput
                                                    value={settings.background_color || '#000000'}
                                                    onChange={(v) => handleChange('background_color', v)}
                                                    opacity={Math.round(settings.background_opacity * 100)}
                                                    onOpacityChange={(v) => handleChange('background_opacity', v / 100)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Цвет текста</Label>
                                                <ColorInput
                                                    value={settings.text_color || '#FFFFFF'}
                                                    onChange={(v) => handleChange('text_color', v)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Цвет никнейма</Label>
                                                <ColorInput
                                                    value={settings.username_color || '#9147FF'}
                                                    onChange={(v) => handleChange('username_color', v)}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Обводка текста</Label>
                                                <ColorInput
                                                    value={settings.text_stroke_color || '#000000'}
                                                    onChange={(v) => handleChange('text_stroke_color', v)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Толщина</Label>
                                                <SliderWithInput
                                                    value={settings.text_stroke_width}
                                                    onChange={(v) => handleChange('text_stroke_width', v)}
                                                    min={0}
                                                    max={3}
                                                    step={1}
                                                    unit="px"
                                                    inputWidth={56}
                                                    inputClassName="text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className={SETTINGS_SECTION_CLASS}>
                                        <div className={SETTINGS_SECTION_TITLE_CLASS}>Скругление</div>
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
                                <TabsContent
                                    value="animation"
                                    className="flex-1 overflow-y-auto space-y-5 mt-0 pr-2 min-h-0"
                                >
                                    <div className={SETTINGS_SECTION_CLASS}>
                                        <div className={SETTINGS_SECTION_TITLE_CLASS}>Анимация</div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Тип анимации</Label>
                                            <Select
                                                value={settings.animation_type}
                                                onValueChange={(v) => handleChange('animation_type', v)}
                                            >
                                                <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card border-border/60 z-[11000] font-base">
                                                    {availableAnimationOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
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
                                <TabsContent
                                    value="display"
                                    className="flex-1 overflow-y-auto space-y-5 mt-0 pr-2 min-h-0"
                                >
                                    <div className={SETTINGS_SECTION_CLASS}>
                                        <div className={SETTINGS_SECTION_TITLE_CLASS}>Отображение</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
                                                <Label className="text-sm text-foreground">Иконки платформ</Label>
                                                <Switch
                                                    checked={settings.show_platform_icons}
                                                    onCheckedChange={(v) => handleChange('show_platform_icons', v)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
                                                <Label className="text-sm text-foreground">Значки (badges)</Label>
                                                <Switch
                                                    checked={settings.show_badges}
                                                    onCheckedChange={(v) => handleChange('show_badges', v)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
                                                <Label className="text-sm text-foreground">7TV Эмодзи</Label>
                                                <Switch
                                                    checked={settings.show_7tv_emotes}
                                                    onCheckedChange={(v) => handleChange('show_7tv_emotes', v)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
                                                <Label className="text-sm text-foreground">Ссылки</Label>
                                                <Switch
                                                    checked={settings.show_links}
                                                    onCheckedChange={(v) => handleChange('show_links', v)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
                                                <Label className="text-sm text-foreground">Автозагрузка медиа</Label>
                                                <Switch
                                                    checked={settings.auto_load_images ?? true}
                                                    onCheckedChange={(v) => handleChange('auto_load_images', v)}
                                                />
                                            </div>
                                            <div className="space-y-2 rounded-md border border-border/60 bg-background/70 px-3 py-2">
                                                <Label className="text-sm text-foreground">Режим фона сообщений</Label>
                                                <Select
                                                    value={resolveMessageBackgroundMode(settings)}
                                                    onValueChange={(v) => handleChange('message_background_mode', v)}
                                                >
                                                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-card border-border/60 z-[11000] font-base">
                                                        {MESSAGE_BACKGROUND_OPTIONS.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={SETTINGS_SECTION_CLASS}>
                                        <div className={SETTINGS_SECTION_TITLE_CLASS}>Разметка</div>
                                        <div className="grid grid-cols-2 gap-4">
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
                                                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-card border-border/60 z-[11000] font-base">
                                                        {CHAT_DIRECTION_OPTIONS.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
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
                    <div className="border-t border-border/60 px-5 py-3 flex items-center justify-between gap-2 bg-card/60">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={resetToDefaults}
                                className="h-9 border-border/60 bg-background/70 text-foreground hover:bg-accent hover:text-foreground"
                            >
                                Сбросить
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="h-9 border-border/60 bg-background/70 text-foreground hover:bg-accent hover:text-foreground"
                            >
                                Отмена
                            </Button>
                            <Button
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="h-9 min-w-[132px] bg-none bg-primary hover:bg-primary/90"
                            >
                                <span className="inline-block text-center">
                                    {saving ? 'Сохранение...' : 'Сохранить'}
                                </span>
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
