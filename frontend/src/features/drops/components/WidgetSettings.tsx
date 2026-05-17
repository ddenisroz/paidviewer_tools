import React, { useEffect, useMemo, useState } from 'react';

import { Copy, ExternalLink, Loader2, Monitor, Sparkles, TestTube2 } from 'lucide-react';

import { DROPS_CONSTANTS } from '@/constants/drops';
import {
    useDropsConfig,
    useDropsRewards,
    useGenerateDropsWidgetUrl,
    useUpdateDropsConfig,
} from '@/queries/drops/dropsQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { SliderWithInput } from '@/shared/components/ui/slider-with-input';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { toast } from '@/utils/toastManager';

import type { DropsConfig } from '@/types/drops';

interface WidgetSettingsProps {
    user: Record<string, unknown>;
    channelName: string;
}

interface FormData {
    widget_spinning_duration_ms: number;
    widget_opening_duration_ms: number;
    widget_result_duration_ms: number;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const ACTION_CLASS = 'gap-2 border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200';

const clampDuration = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const areDurationsEqual = (left: FormData, right: FormData): boolean =>
    left.widget_spinning_duration_ms === right.widget_spinning_duration_ms &&
    left.widget_opening_duration_ms === right.widget_opening_duration_ms &&
    left.widget_result_duration_ms === right.widget_result_duration_ms;

const getWidgetFormData = (config: Partial<DropsConfig> | null | undefined): FormData => ({
    widget_spinning_duration_ms: clampDuration(
        config?.widget_spinning_duration_ms ?? 1500,
        500,
        DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS
    ),
    widget_opening_duration_ms: clampDuration(
        config?.widget_opening_duration_ms ?? 1000,
        500,
        DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS
    ),
    widget_result_duration_ms: clampDuration(
        config?.widget_result_duration_ms ?? 5500,
        2000,
        DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS
    ),
});

const getSpinProfile = (duration: number): string => {
    if (duration <= 1100) return 'Быстрый';
    if (duration <= 1800) return 'Сбалансированный';
    return 'Шоу-режим';
};

const WidgetSettings: React.FC<WidgetSettingsProps> = ({ user, channelName }) => {
    const [widgetUrl, setWidgetUrl] = useState<string | null>(null);

    const { data: config } = useDropsConfig(channelName, {
        enabled: !!user && !!channelName,
    });
    const { data: rewards = [] } = useDropsRewards(channelName, {
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

    const [formData, setFormData] = useState<FormData>({
        widget_spinning_duration_ms: 1500,
        widget_opening_duration_ms: 1000,
        widget_result_duration_ms: 5500,
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
            widget_opening_duration_ms: formData.widget_opening_duration_ms,
            widget_result_duration_ms: formData.widget_result_duration_ms,
        });
    }, [config, formData, configFormData, autoSave, clearAutoSave]);

    const activeRewardsCount = useMemo(
        () => rewards.filter((reward) => reward.is_active !== false).length,
        [rewards]
    );

    const spinProfile = useMemo(
        () => getSpinProfile(formData.widget_spinning_duration_ms),
        [formData.widget_spinning_duration_ms]
    );

    const getPreviewWidgetUrl = (): string | null => {
        if (!widgetUrl) return null;

        const safeUrl = getSafeNavigationUrl(widgetUrl);
        if (!safeUrl) return null;

        try {
            const previewUrl = new URL(safeUrl);
            previewUrl.searchParams.set('preview', 'true');
            return previewUrl.toString();
        } catch {
            return null;
        }
    };

    const handleDurationChange = (key: keyof FormData, value: number): void => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const copyWidgetUrl = () => {
        if (!widgetUrl) return;
        navigator.clipboard.writeText(widgetUrl);
        toast.success('Ссылка виджета скопирована');
    };

    const openWidgetUrl = (preview: boolean) => {
        const targetUrl = preview ? getPreviewWidgetUrl() : widgetUrl;
        const safeUrl = targetUrl ? getSafeNavigationUrl(targetUrl) : null;

        if (!safeUrl) {
            toast.error(preview ? 'Не удалось подготовить тестовый режим' : 'Некорректная ссылка виджета');
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
                        Колесо награды
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground/90">
                        Эти параметры сразу влияют и на тестовый режим, и на реальный OBS-виджет.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 xl:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                            <Label className="text-sm font-medium text-foreground">Скорость прокрутки</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Главная скорость вращения колеса.</p>
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

                        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                            <Label className="text-sm font-medium text-foreground">Подготовка</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Короткий вход перед стартом прокрутки.</p>
                            <div className="mt-4">
                                <SliderWithInput
                                    value={formData.widget_opening_duration_ms}
                                    onChange={(value) =>
                                        handleDurationChange(
                                            'widget_opening_duration_ms',
                                            clampDuration(value, 500, DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS)
                                        )
                                    }
                                    min={500}
                                    max={DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS}
                                    step={100}
                                    unit="мс"
                                    ariaLabel="Подготовка"
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                            <Label className="text-sm font-medium text-foreground">Финальный кадр</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Сколько результат остается на экране после остановки.
                            </p>
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

                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-background/30 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Профиль</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{spinProfile}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/30 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Активные награды</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{activeRewardsCount}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/30 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Сохранение</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">Автоматически</p>
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
                    <CardDescription className="text-xs text-muted-foreground/90">
                        Тестовый режим использует ваши активные награды, их изображения и звук.
                    </CardDescription>
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
                                    <Button variant="outline" size="sm" onClick={() => openWidgetUrl(false)} className={ACTION_CLASS}>
                                        <ExternalLink className="h-4 w-4" />
                                        Открыть
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => openWidgetUrl(true)} className={ACTION_CLASS}>
                                    <TestTube2 className="h-4 w-4" />
                                    Открыть тестовый режим
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

                            <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                                {activeRewardsCount > 0
                                    ? `Сейчас готово ${activeRewardsCount} активных наград для теста.`
                                    : 'Добавьте хотя бы одну активную награду, чтобы тестовый режим показывал реальные результаты.'}
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-5 text-sm text-muted-foreground">
                            Ссылка виджета загружается...
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default WidgetSettings;
