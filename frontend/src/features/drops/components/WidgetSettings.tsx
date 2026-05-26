import React, { useEffect, useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Loader2, Monitor, Sparkles, TestTube2 } from 'lucide-react';

import { DROPS_CONSTANTS } from '@/constants/drops';
import {
    useDropsConfig,
    useGenerateDropsWidgetUrl,
    useSendDropsWidgetTestEvent,
    useUpdateDropsConfig,
} from '@/queries/drops/dropsQueries';
import { WidgetSoundUpload } from '@/features/drops/components/WidgetSoundUpload';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { SliderWithInput } from '@/shared/components/ui/slider-with-input';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { toast } from '@/utils/toastManager';
import { dropsService } from '@/services/api/services/dropsService';
import { queryKeys } from '@/queries/queryKeys';

import type { DropsConfig } from '@/types/drops';

interface WidgetSettingsProps {
    user: Record<string, unknown>;
    channelName: string;
}

interface FormData {
    widget_spinning_duration_ms: number;
    widget_result_duration_ms: number;
    widget_sound_volume: number;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const ACTION_CLASS = 'gap-2 border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200';

const clampDuration = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const areDurationsEqual = (left: FormData, right: FormData): boolean =>
    left.widget_spinning_duration_ms === right.widget_spinning_duration_ms &&
    left.widget_result_duration_ms === right.widget_result_duration_ms &&
    left.widget_sound_volume === right.widget_sound_volume;

const getWidgetFormData = (config: Partial<DropsConfig> | null | undefined): FormData => ({
    widget_spinning_duration_ms: clampDuration(
        config?.widget_spinning_duration_ms ?? 1500,
        500,
        DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS
    ),
    widget_result_duration_ms: clampDuration(
        config?.widget_result_duration_ms ?? 5500,
        2000,
        DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS
    ),
    widget_sound_volume: Math.max(0, Math.min(1, Number(config?.widget_sound_volume ?? 1))),
});

const PREVIEW_QUALITIES = [
    { value: 'common', label: 'Обычный' },
    { value: 'rare', label: 'Редкий' },
    { value: 'epic', label: 'Эпический' },
    { value: 'legendary', label: 'Легендарный' },
    { value: 'mythical', label: 'Мифический' },
] as const;

const WidgetSettings: React.FC<WidgetSettingsProps> = ({ user, channelName }) => {
    const [widgetUrl, setWidgetUrl] = useState<string | null>(null);

    const { data: config } = useDropsConfig(channelName, {
        enabled: !!user && !!channelName,
    });

    const updateConfigMutation = useUpdateDropsConfig(channelName);
    const generateWidgetUrlMutation = useGenerateDropsWidgetUrl({
        onSuccess: (response) => {
            const responseData = response as { success?: boolean; data?: { url?: string } };
            if (responseData.success && responseData.data?.url) {
                setWidgetUrl(responseData.data.url);
            }
        },
    });
    const sendTestEventMutation = useSendDropsWidgetTestEvent(channelName);

    const [formData, setFormData] = useState<FormData>({
        widget_spinning_duration_ms: 1500,
        widget_result_duration_ms: 5500,
        widget_sound_volume: 1,
    });
    const queryClient = useQueryClient();
    const uploadWidgetSoundMutation = useMutation({
        mutationFn: ({ kind, file }: { kind: 'spin' | 'reveal'; file: File }) =>
            dropsService.uploadWidgetSound(channelName, kind, file),
        onSuccess: (response) => {
            const payload = response.data as { success?: boolean; data?: { config?: DropsConfig } };
            if (payload.data?.config) {
                queryClient.setQueryData(queryKeys.drops.config(channelName), payload.data.config);
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.drops.config(channelName) });
            }
            toast.success('Звук виджета загружен');
        },
        onError: () => toast.error('Не удалось загрузить звук'),
    });

    const configFormData = useMemo(() => getWidgetFormData(config), [config]);

    useEffect(() => {
        if (!config) return;
        setFormData((current) => (areDurationsEqual(current, configFormData) ? current : configFormData));
    }, [config, configFormData]);

    useEffect(() => {
        if (user && channelName && !widgetUrl && !generateWidgetUrlMutation.isPending) {
            generateWidgetUrlMutation.mutate(false);
        }
    }, [user, channelName, widgetUrl, generateWidgetUrlMutation]);

    const { autoSave, clearAutoSave } = useAutoSave(
        (payload: Partial<DropsConfig>) => updateConfigMutation.mutate(payload),
        1000,
        () => {
            if (!user || !channelName || !config) return 'Недостаточно данных для сохранения';
            return null;
        }
    );

    useEffect(() => {
        if (!config) return;
        if (areDurationsEqual(formData, configFormData)) {
            clearAutoSave();
            return;
        }

        autoSave({
            widget_spinning_duration_ms: formData.widget_spinning_duration_ms,
            widget_result_duration_ms: formData.widget_result_duration_ms,
            widget_sound_volume: formData.widget_sound_volume,
        });
    }, [config, formData, configFormData, autoSave, clearAutoSave]);

    const getWidgetUrlWithParams = (params: Record<string, string>): string | null => {
        if (!widgetUrl) return null;

        const safeUrl = getSafeNavigationUrl(widgetUrl);
        if (!safeUrl) return null;

        try {
            const previewUrl = new URL(safeUrl);
            Object.entries(params).forEach(([key, value]) => previewUrl.searchParams.set(key, value));
            return previewUrl.toString();
        } catch {
            return null;
        }
    };

    const handleDurationChange = (key: keyof FormData, value: number): void => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSoundUpload = (kind: 'spin' | 'reveal', file?: File): void => {
        if (!file) return;
        uploadWidgetSoundMutation.mutate({ kind, file });
    };

    const copyWidgetUrl = () => {
        if (!widgetUrl) return;
        navigator.clipboard.writeText(widgetUrl);
        toast.success('Ссылка виджета скопирована');
    };

    const openWidgetUrl = (params?: Record<string, string>) => {
        const targetUrl = params ? getWidgetUrlWithParams(params) : widgetUrl;
        const safeUrl = targetUrl ? getSafeNavigationUrl(targetUrl) : null;

        if (!safeUrl) {
            toast.error(params ? 'Не удалось подготовить тестовый режим' : 'Некорректная ссылка виджета');
            return;
        }

        window.open(safeUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="space-y-4">
            <Card className={SURFACE_CARD_CLASS}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5" />
                        Рулетка сундука
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                            <Label className="text-sm font-medium text-foreground">Скорость прокрутки</Label>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={formData.widget_spinning_duration_ms}
                                    onChange={(value) =>
                                        handleDurationChange(
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

                        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                            <Label className="text-sm font-medium text-foreground">Финальный кадр</Label>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={formData.widget_result_duration_ms}
                                    onChange={(value) =>
                                        handleDurationChange(
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
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px] gap-3">
                        <WidgetSoundUpload
                            label="Звук прокрутки"
                            value={config?.widget_spin_sound_file}
                            disabled={uploadWidgetSoundMutation.isPending}
                            onFile={(file) => handleSoundUpload('spin', file)}
                        />
                        <WidgetSoundUpload
                            label="Звук раскрытия"
                            value={config?.widget_reveal_sound_file}
                            disabled={uploadWidgetSoundMutation.isPending}
                            onFile={(file) => handleSoundUpload('reveal', file)}
                        />
                        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                            <Label className="text-sm font-medium text-foreground">Громкость</Label>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={Math.round(formData.widget_sound_volume * 100)}
                                    onChange={(value) =>
                                        handleDurationChange('widget_sound_volume', Math.max(0, Math.min(100, value)) / 100)
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
                                {PREVIEW_QUALITIES.map((quality) => (
                                    <Button
                                        key={quality.value}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => sendTestEventMutation.mutate(quality.value)}
                                        disabled={sendTestEventMutation.isPending}
                                        className={ACTION_CLASS}
                                    >
                                        {sendTestEventMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <TestTube2 className="h-4 w-4" />
                                        )}
                                        {quality.label}
                                    </Button>
                                ))}
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
                                    Зеленый фон
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
