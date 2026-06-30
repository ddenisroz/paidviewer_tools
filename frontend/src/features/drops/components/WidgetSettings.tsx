import React, { useEffect, useMemo, useState } from 'react';

import { Copy, ExternalLink, Loader2, Monitor, Sparkles, TestTube2 } from 'lucide-react';

import { DROPS_CONSTANTS } from '@/constants/drops';
import {
    useDropsConfig,
    useGenerateDropsWidgetUrl,
    useSendDropsWidgetTestEvent,
    useUpdateDropsConfig,
} from '@/queries/drops/dropsQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { SliderWithInput } from '@/shared/components/ui/slider-with-input';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { toast } from '@/utils/toastManager';

import type { DropsConfig } from '@/types/drops';

interface WidgetSettingsProps {
    user: Record<string, unknown>;
    channelName: string;
}

type RouletteSoundKind = 'pointer' | 'start' | 'open';

interface StaticSoundOption {
    value: string;
    label: string;
}

interface RouletteSoundManifest {
    pointer?: Array<string | StaticSoundOption>;
    start?: Array<string | StaticSoundOption>;
    open?: Array<string | StaticSoundOption>;
}

interface FormData {
    widget_spinning_duration_ms: number;
    widget_result_duration_ms: number;
    widget_sound_volume: number;
    widget_spin_sound_file: string;
    widget_start_sound_file: string;
    widget_reveal_sound_file: string;
    widget_frame_color: string;
    widget_text_color: string;
    widget_background_color: string;
    widget_font_scale: number;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const ACTION_CLASS = 'gap-2 border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200';
const PREVIEW_QUALITIES = [
    { value: 'common', label: 'Обычный' },
    { value: 'rare', label: 'Редкий' },
    { value: 'epic', label: 'Эпический' },
    { value: 'legendary', label: 'Легендарный' },
    { value: 'mythical', label: 'Мифический' },
] as const;

const SOUND_BASE_PATH: Record<RouletteSoundKind, string> = {
    pointer: '/sounds/drops/roulette/pointer/',
    start: '/sounds/drops/roulette/start/',
    open: '/sounds/drops/roulette/open/',
};

const clampDuration = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeSoundPath = (kind: RouletteSoundKind, entry: string): string => {
    const trimmed = entry.trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `${SOUND_BASE_PATH[kind]}${trimmed}`;
};

const normalizeSoundOptions = (
    kind: RouletteSoundKind,
    entries: Array<string | StaticSoundOption> | undefined
): StaticSoundOption[] =>
    (entries || [])
        .map((entry) => {
            if (typeof entry === 'string') {
                const value = normalizeSoundPath(kind, entry);
                return value ? { value, label: entry } : null;
            }
            const value = normalizeSoundPath(kind, String(entry.value || ''));
            const label = String(entry.label || entry.value || '').trim();
            return value && label ? { value, label } : null;
        })
        .filter((entry): entry is StaticSoundOption => Boolean(entry));

const areFormValuesEqual = (left: FormData, right: FormData): boolean =>
    left.widget_spinning_duration_ms === right.widget_spinning_duration_ms &&
    left.widget_result_duration_ms === right.widget_result_duration_ms &&
    left.widget_sound_volume === right.widget_sound_volume &&
    left.widget_spin_sound_file === right.widget_spin_sound_file &&
    left.widget_start_sound_file === right.widget_start_sound_file &&
    left.widget_reveal_sound_file === right.widget_reveal_sound_file &&
    left.widget_frame_color === right.widget_frame_color &&
    left.widget_text_color === right.widget_text_color &&
    left.widget_background_color === right.widget_background_color &&
    left.widget_font_scale === right.widget_font_scale;

const getWidgetFormData = (config: Partial<DropsConfig> | null | undefined): FormData => ({
    widget_spinning_duration_ms: clampDuration(
        Number(config?.widget_spinning_duration_ms ?? 5000),
        500,
        DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS
    ),
    widget_result_duration_ms: clampDuration(
        Number(config?.widget_result_duration_ms ?? 5500),
        2000,
        DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS
    ),
    widget_sound_volume: Math.max(0, Math.min(1, Number(config?.widget_sound_volume ?? 1))),
    widget_spin_sound_file: String(config?.widget_spin_sound_file || ''),
    widget_start_sound_file: String(config?.widget_start_sound_file || ''),
    widget_reveal_sound_file: String(config?.widget_reveal_sound_file || ''),
    widget_frame_color: String(config?.widget_frame_color || '#ff8a00'),
    widget_text_color: String(config?.widget_text_color || '#ffffff'),
    widget_background_color: String(config?.widget_background_color || '#120821'),
    widget_font_scale: Math.max(0.8, Math.min(1.6, Number(config?.widget_font_scale ?? 1))),
});

const WidgetSettings: React.FC<WidgetSettingsProps> = ({ user, channelName }) => {
    const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
    const [selectedPreviewQuality, setSelectedPreviewQuality] =
        useState<(typeof PREVIEW_QUALITIES)[number]['value']>('common');
    const [previewRun, setPreviewRun] = useState(0);
    const [soundManifest, setSoundManifest] = useState<RouletteSoundManifest>({});

    const { data: config } = useDropsConfig(channelName, {
        enabled: !!user && !!channelName,
    });
    const updateConfigMutation = useUpdateDropsConfig(channelName);
    const generateWidgetUrlMutation = useGenerateDropsWidgetUrl({
        onSuccess: (response) => {
            const payload = response as { success?: boolean; data?: { url?: string } };
            if (payload.success && payload.data?.url) {
                setWidgetUrl(payload.data.url);
            }
        },
    });
    const sendTestEventMutation = useSendDropsWidgetTestEvent(channelName);

    const [formData, setFormData] = useState<FormData>(() => getWidgetFormData(null));
    const configFormData = useMemo(() => getWidgetFormData(config), [config]);

    const pointerOptions = useMemo(
        () => normalizeSoundOptions('pointer', soundManifest.pointer),
        [soundManifest.pointer]
    );
    const startOptions = useMemo(() => normalizeSoundOptions('start', soundManifest.start), [soundManifest.start]);
    const openOptions = useMemo(() => normalizeSoundOptions('open', soundManifest.open), [soundManifest.open]);

    useEffect(() => {
        if (!config) {
            return;
        }
        setFormData((current) => (areFormValuesEqual(current, configFormData) ? current : configFormData));
    }, [config, configFormData]);

    useEffect(() => {
        if (user && channelName && !widgetUrl && !generateWidgetUrlMutation.isPending) {
            generateWidgetUrlMutation.mutate(false);
        }
    }, [user, channelName, widgetUrl, generateWidgetUrlMutation]);

    useEffect(() => {
        let cancelled = false;
        const loadManifest = async (): Promise<void> => {
            try {
                const response = await fetch('/sounds/drops/roulette/manifest.json', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Manifest HTTP ${response.status}`);
                }
                const payload = (await response.json()) as RouletteSoundManifest;
                if (!cancelled) {
                    setSoundManifest(payload || {});
                }
            } catch {
                if (!cancelled) {
                    setSoundManifest({});
                }
            }
        };

        void loadManifest();
        return () => {
            cancelled = true;
        };
    }, []);

    const { autoSave, clearAutoSave } = useAutoSave(
        (payload: Partial<DropsConfig>) => updateConfigMutation.mutate(payload),
        900,
        () => {
            if (!user || !channelName || !config) {
                return 'Недостаточно данных для сохранения';
            }
            return null;
        }
    );

    useEffect(() => {
        if (!config) {
            return;
        }
        if (areFormValuesEqual(formData, configFormData)) {
            clearAutoSave();
            return;
        }

        autoSave({
            widget_spinning_duration_ms: formData.widget_spinning_duration_ms,
            widget_result_duration_ms: formData.widget_result_duration_ms,
            widget_sound_volume: formData.widget_sound_volume,
            widget_spin_sound_file: formData.widget_spin_sound_file || undefined,
            widget_start_sound_file: formData.widget_start_sound_file || undefined,
            widget_reveal_sound_file: formData.widget_reveal_sound_file || undefined,
            widget_frame_color: formData.widget_frame_color,
            widget_text_color: formData.widget_text_color,
            widget_background_color: formData.widget_background_color,
            widget_font_scale: formData.widget_font_scale,
        });
    }, [autoSave, clearAutoSave, config, configFormData, formData]);

    const getWidgetUrlWithParams = (params: Record<string, string>): string | null => {
        if (!widgetUrl) {
            return null;
        }

        let previewUrl: URL;
        try {
            const rawUrl = new URL(widgetUrl, window.location.origin);
            if (!rawUrl.pathname.startsWith('/drops-widget/')) {
                return null;
            }
            previewUrl = new URL(`${rawUrl.pathname}${rawUrl.search}`, window.location.origin);
        } catch {
            return null;
        }

        Object.entries(params).forEach(([key, value]) => previewUrl.searchParams.set(key, value));
        return previewUrl.toString();
    };

    const handleFieldChange = <K extends keyof FormData>(key: K, value: FormData[K]): void => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const renderColorField = (
        label: string,
        field: keyof Pick<FormData, 'widget_frame_color' | 'widget_text_color' | 'widget_background_color'>
    ) => (
        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
            <Label className="text-sm font-medium text-foreground">{label}</Label>
            <div className="mt-2 flex items-center gap-2">
                <Input
                    type="color"
                    value={formData[field]}
                    onChange={(event) => handleFieldChange(field, event.target.value)}
                    className="h-8 w-12 cursor-pointer border-border/70 bg-background/60 p-1"
                />
                <Input
                    value={formData[field]}
                    onChange={(event) => handleFieldChange(field, event.target.value)}
                    className="h-8 flex-1 border-border/70 bg-background/60 text-xs uppercase"
                />
            </div>
        </div>
    );

    const copyWidgetUrl = (): void => {
        if (!widgetUrl) {
            return;
        }
        void navigator.clipboard.writeText(widgetUrl);
        toast.success('Ссылка виджета скопирована');
    };

    const openWidgetUrl = (params?: Record<string, string>): void => {
        const targetUrl = params ? getWidgetUrlWithParams(params) : widgetUrl;
        const safeUrl = targetUrl ? getSafeNavigationUrl(targetUrl) : null;

        if (!safeUrl) {
            toast.error(params ? 'Не удалось подготовить тестовый режим' : 'Некорректная ссылка виджета');
            return;
        }

        window.open(safeUrl, '_blank', 'noopener,noreferrer');
    };

    const previewUrl = getWidgetUrlWithParams(
        previewRun > 0
            ? { preview: 'true', quality: selectedPreviewQuality, background: 'green', run: String(previewRun) }
            : { preview: 'true', background: 'green' }
    );

    const renderSoundSelect = (
        kind: RouletteSoundKind,
        label: string,
        value: string,
        options: StaticSoundOption[],
        field: keyof Pick<FormData, 'widget_spin_sound_file' | 'widget_start_sound_file' | 'widget_reveal_sound_file'>
    ) => {
        const emptyLabel =
            kind === 'pointer'
                ? 'Без щелчка'
                : kind === 'start'
                  ? 'Без старта'
                  : 'Без открытия';

        return (
            <div className="rounded-lg border border-border/70 bg-background/40 p-2">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                <Select value={value || '__none__'} onValueChange={(next) => handleFieldChange(field, next === '__none__' ? '' : next)}>
                    <SelectTrigger className="mt-2 h-8 border-border/70 bg-background/60 text-xs">
                        <SelectValue placeholder="Выбрать звук" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">{emptyLabel}</SelectItem>
                        {options.map((option) => (
                            <SelectItem key={`${kind}-${option.value}`} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <Card className={SURFACE_CARD_CLASS}>
                <CardHeader className="p-3 pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5" />
                        Рулетка сундука
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
                            <Label className="text-sm font-medium text-foreground">Скорость прокрутки</Label>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={formData.widget_spinning_duration_ms}
                                    onChange={(value) =>
                                        handleFieldChange(
                                            'widget_spinning_duration_ms',
                                            clampDuration(value, 500, DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS)
                                        )
                                    }
                                    min={500}
                                    max={DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS}
                                    step={100}
                                    unit="мс"
                                    ariaLabel="Скорость прокрутки"
                                />
                            </div>
                        </div>

                        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
                            <Label className="text-sm font-medium text-foreground">Финальный кадр</Label>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={formData.widget_result_duration_ms}
                                    onChange={(value) =>
                                        handleFieldChange(
                                            'widget_result_duration_ms',
                                            clampDuration(value, 2000, DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS)
                                        )
                                    }
                                    min={2000}
                                    max={DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS}
                                    step={500}
                                    unit="мс"
                                    ariaLabel="Финальный кадр"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_200px]">
                        {renderSoundSelect('pointer', 'Указатель', formData.widget_spin_sound_file, pointerOptions, 'widget_spin_sound_file')}
                        {renderSoundSelect('start', 'Старт', formData.widget_start_sound_file, startOptions, 'widget_start_sound_file')}
                        {renderSoundSelect('open', 'Открытие', formData.widget_reveal_sound_file, openOptions, 'widget_reveal_sound_file')}
                        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
                            <Label className="text-sm font-medium text-foreground">Громкость</Label>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={Math.round(formData.widget_sound_volume * 100)}
                                    onChange={(value) =>
                                        handleFieldChange('widget_sound_volume', Math.max(0, Math.min(100, value)) / 100)
                                    }
                                    min={0}
                                    max={100}
                                    step={5}
                                    unit="%"
                                    ariaLabel="Громкость звуков виджета"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {renderColorField('Цвет рамки', 'widget_frame_color')}
                        {renderColorField('Цвет текста', 'widget_text_color')}
                        {renderColorField('Цвет фона', 'widget_background_color')}
                        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
                            <Label className="text-sm font-medium text-foreground">Размер шрифта</Label>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={Math.round(formData.widget_font_scale * 100)}
                                    onChange={(value) =>
                                        handleFieldChange('widget_font_scale', Math.max(80, Math.min(160, value)) / 100)
                                    }
                                    min={80}
                                    max={160}
                                    step={5}
                                    unit="%"
                                    ariaLabel="Размер шрифта рулетки"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className={SURFACE_CARD_CLASS}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5" />
                        Live preview
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="aspect-video overflow-hidden rounded-lg border border-border/70 bg-[#00ff00]">
                        {previewUrl ? (
                            <iframe
                                key={previewUrl}
                                title="Drops roulette preview"
                                src={previewUrl}
                                className="h-full w-full"
                                allow="autoplay"
                            />
                        ) : (
                            <div className="grid h-full place-items-center text-sm font-medium text-black/70">
                                Превью загружается...
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={selectedPreviewQuality}
                            onValueChange={(value) =>
                                setSelectedPreviewQuality(value as (typeof PREVIEW_QUALITIES)[number]['value'])
                            }
                        >
                            <SelectTrigger className="h-9 w-[210px] border-border/70 bg-transparent">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PREVIEW_QUALITIES.map((quality) => (
                                    <SelectItem key={quality.value} value={quality.value}>
                                        {quality.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewRun((value) => value + 1)}
                            className={ACTION_CLASS}
                        >
                            <TestTube2 className="h-4 w-4" />
                            Test
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <Card className={SURFACE_CARD_CLASS}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Monitor className="h-5 w-5" />
                        OBS-виджет
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {widgetUrl ? (
                        <>
                            <div className="space-y-2">
                                <Label className="text-sm">Ссылка виджета</Label>
                                <div className="flex flex-wrap gap-2">
                                    <Input
                                        value={widgetUrl}
                                        readOnly
                                        className="h-10 flex-1 border-border/70 bg-transparent font-mono text-sm text-foreground"
                                    />
                                    <Button variant="outline" size="sm" onClick={copyWidgetUrl} className={ACTION_CLASS}>
                                        <Copy className="h-4 w-4" />
                                        Копировать
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => openWidgetUrl()} className={ACTION_CLASS}>
                                        <ExternalLink className="h-4 w-4" />
                                        Открыть
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Select
                                    value={selectedPreviewQuality}
                                    onValueChange={(value) =>
                                        setSelectedPreviewQuality(value as (typeof PREVIEW_QUALITIES)[number]['value'])
                                    }
                                >
                                    <SelectTrigger className="h-9 w-[210px] border-border/70 bg-transparent">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PREVIEW_QUALITIES.map((quality) => (
                                            <SelectItem key={quality.value} value={quality.value}>
                                                {quality.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => sendTestEventMutation.mutate(selectedPreviewQuality)}
                                    disabled={sendTestEventMutation.isPending}
                                    className={ACTION_CLASS}
                                >
                                    {sendTestEventMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <TestTube2 className="h-4 w-4" />
                                    )}
                                    Test
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generateWidgetUrlMutation.mutate(true)}
                                    disabled={generateWidgetUrlMutation.isPending}
                                    className={ACTION_CLASS}
                                >
                                    {generateWidgetUrlMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Обновляем...
                                        </>
                                    ) : (
                                        <>
                                            <Monitor className="h-4 w-4" />
                                            Обновить токен
                                        </>
                                    )}
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openWidgetUrl({ background: 'transparent' })}
                                    className={ACTION_CLASS}
                                >
                                    Прозрачный
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openWidgetUrl({ background: 'green' })}
                                    className={ACTION_CLASS}
                                >
                                    Зелёный фон
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-lg border border-border/70 bg-background/30 px-4 py-5 text-sm text-muted-foreground">
                            Ссылка виджета загружается...
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default WidgetSettings;
