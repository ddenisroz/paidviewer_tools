import React, { useEffect, useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DROPS_CONSTANTS } from '@/constants/drops';
import { useDropsConfig } from '@/features/drops/hooks/useDropsConfig';
import { dropsService } from '@/services/api/services/dropsService';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import StreakCalendar from './StreakCalendar';

import type { DropsConfig } from '@/types/drops';
import type { User, UserIntegrations } from '@/types/user';

interface StreakSettingsProps {
    user: User;
    channelName: string;
    hasRewards?: boolean;
    integrations?: UserIntegrations;
}

interface StreakSettingsFormData {
    streak_days_common: number[];
    streak_days_rare: number[];
    streak_days_epic: number[];
    streak_days_legendary: number[];
    streak_messages_required: number[];
    streak_reset_on_skip: boolean;
    streak_enabled_twitch: boolean;
    streak_enabled_vk: boolean;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const BLUE_TEXT_BUTTON_CLASS = 'border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200';
const hasStreakSettingsChanges = (payload: Partial<DropsConfig>, config: Partial<DropsConfig> | null | undefined): boolean =>
    (payload.streak_days_common ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON) !==
        (config?.streak_days_common ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON) ||
    (payload.streak_days_rare ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE) !==
        (config?.streak_days_rare ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE) ||
    (payload.streak_days_epic ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC) !==
        (config?.streak_days_epic ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC) ||
    (payload.streak_days_legendary ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY) !==
        (config?.streak_days_legendary ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY) ||
    (payload.streak_messages_required ?? DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED) !==
        (config?.streak_messages_required ?? DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED) ||
    (payload.streak_reset_on_skip ?? true) !== (config?.streak_reset_on_skip ?? true);

const StreakSettings: React.FC<StreakSettingsProps> = ({ user, channelName, hasRewards = false, integrations }) => {
    const navigate = useNavigate();
    const twitchAvailable = integrations?.twitch?.connected && user?.twitch_username;
    const vkAvailable = integrations?.vk?.connected && (user?.vk_username || user?.vk_channel_name);

    const { config, isLoading, isInitialLoad, setIsInitialLoad, saveMutation } = useDropsConfig(channelName);

    const [formData, setFormData] = useState<StreakSettingsFormData>({
        streak_days_common: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON],
        streak_days_rare: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE],
        streak_days_epic: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC],
        streak_days_legendary: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY],
        streak_messages_required: [DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED],
        streak_reset_on_skip: true,
        streak_enabled_twitch: false,
        streak_enabled_vk: false,
    });
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    useEffect(() => {
        const handleDropsConfigChange = (event: CustomEvent) => {
            const { streak_enabled, channel, platform: eventPlatform, source } = event.detail;
            // [OK] FIX: update local state only for QuickActionsBar events
            // Если событие пришло от useDropsConfig (наш собственный saveMutation), то состояние уже обновлено через setFormData
            if (
                channel === channelName &&
                streak_enabled !== undefined &&
                eventPlatform &&
                source === 'QuickActionsBar'
            ) {
                if (eventPlatform === 'twitch') {
                    setFormData((prev) => ({ ...prev, streak_enabled_twitch: streak_enabled }));
                } else if (eventPlatform === 'vk') {
                    setFormData((prev) => ({ ...prev, streak_enabled_vk: streak_enabled }));
                }
            }
        };

        window.addEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
        return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
    }, [channelName]);

    const initialFormData = useMemo(() => {
        if (!config) return null;

        // Type assertion after null check
        const typedConfig = config as DropsConfig;

        return {
            streak_days_common: [typedConfig.streak_days_common ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON],
            streak_days_rare: [typedConfig.streak_days_rare ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE],
            streak_days_epic: [typedConfig.streak_days_epic ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC],
            streak_days_legendary: [typedConfig.streak_days_legendary ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY],
            streak_messages_required: [
                typedConfig.streak_messages_required ?? DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED,
            ],
            streak_reset_on_skip: typedConfig.streak_reset_on_skip ?? true,
            streak_enabled_twitch: typedConfig.streak_enabled_twitch ?? false,
            streak_enabled_vk: typedConfig.streak_enabled_vk ?? false,
        };
    }, [config]);

    // [OK] INIT: load data on first render
    useEffect(() => {
        if (initialFormData && isInitialLoad) {
            setFormData(initialFormData);
            setIsInitialLoad(false);
        }
    }, [initialFormData, isInitialLoad, setIsInitialLoad]);

    // [OK] SYNC: keep formData aligned with React Query config
    // Обновляем все поля, включая streak_enabled (fallback если событие не было обработано)
    useEffect(() => {
        if (!isInitialLoad && config && initialFormData) {
            setFormData((prev) => {
                // [OK] Проверяем, изменились ли значения в config
                const needsUpdate =
                    prev.streak_days_common[0] !== initialFormData.streak_days_common[0] ||
                    prev.streak_days_rare[0] !== initialFormData.streak_days_rare[0] ||
                    prev.streak_days_epic[0] !== initialFormData.streak_days_epic[0] ||
                    prev.streak_days_legendary[0] !== initialFormData.streak_days_legendary[0] ||
                    prev.streak_messages_required[0] !== initialFormData.streak_messages_required[0] ||
                    prev.streak_reset_on_skip !== initialFormData.streak_reset_on_skip ||
                    prev.streak_enabled_twitch !== initialFormData.streak_enabled_twitch ||
                    prev.streak_enabled_vk !== initialFormData.streak_enabled_vk;

                // Обновляем только если значения изменились (предотвращаем лишние обновления)
                if (needsUpdate) {
                    return {
                        ...prev,
                        streak_days_common: initialFormData.streak_days_common,
                        streak_days_rare: initialFormData.streak_days_rare,
                        streak_days_epic: initialFormData.streak_days_epic,
                        streak_days_legendary: initialFormData.streak_days_legendary,
                        streak_messages_required: initialFormData.streak_messages_required,
                        streak_reset_on_skip: initialFormData.streak_reset_on_skip,
                        streak_enabled_twitch: initialFormData.streak_enabled_twitch,
                        streak_enabled_vk: initialFormData.streak_enabled_vk,
                    };
                }
                return prev;
            });
        }
    }, [config, isInitialLoad, initialFormData]);

    const queryClient = useQueryClient();
    const { autoSave, clearAutoSave } = useAutoSave((payload: Partial<DropsConfig>) => saveMutation.mutate(payload), 1000);

    const createPayload = (includeEnabledFlags = true): Partial<DropsConfig> => {
        const payload: Partial<DropsConfig> = {
            streak_days_common: formData.streak_days_common[0],
            streak_days_rare: formData.streak_days_rare[0],
            streak_days_epic: formData.streak_days_epic[0],
            streak_days_legendary: formData.streak_days_legendary[0],
            streak_messages_required: formData.streak_messages_required[0],
            streak_reset_on_skip: formData.streak_reset_on_skip,
        };

        // [OK] Включаем streak_enabled только если explicitly requested (для handlePlatformToggle)
        if (includeEnabledFlags) {
            payload.streak_enabled_twitch = formData.streak_enabled_twitch;
            payload.streak_enabled_vk = formData.streak_enabled_vk;
        }

        return payload;
    };

    const handlePlatformToggle = (platform: string, enabled: boolean) => {
        if (!hasRewards && enabled) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"');
            return;
        }

        const platformKey = platform === 'twitch' ? 'streak_enabled_twitch' : 'streak_enabled_vk';
        setFormData((prev) => ({ ...prev, [platformKey]: enabled }));
        autoSave({ ...createPayload(), [platformKey]: enabled });
    };

    const streakSettingsPayload = useMemo<Partial<DropsConfig>>(
        () => ({
            streak_days_common: formData.streak_days_common[0],
            streak_days_rare: formData.streak_days_rare[0],
            streak_days_epic: formData.streak_days_epic[0],
            streak_days_legendary: formData.streak_days_legendary[0],
            streak_messages_required: formData.streak_messages_required[0],
            streak_reset_on_skip: formData.streak_reset_on_skip,
        }),
        [
            formData.streak_days_common,
            formData.streak_days_rare,
            formData.streak_days_epic,
            formData.streak_days_legendary,
            formData.streak_messages_required,
            formData.streak_reset_on_skip,
        ]
    );

    // [OK] FIX: autosave only settings, not streak_enabled_twitch/vk
    // streak_enabled_twitch/vk сохраняются отдельно через handlePlatformToggle
    // Это предотвращает повторное сохранение при обновлении из QuickActionsBar
    useEffect(() => {
        if (!isInitialLoad && config) {
            if (!hasStreakSettingsChanges(streakSettingsPayload, config)) {
                clearAutoSave();
                return;
            }

            autoSave(streakSettingsPayload);
        }
    }, [
        formData.streak_days_common,
        formData.streak_days_rare,
        formData.streak_days_epic,
        formData.streak_days_legendary,
        formData.streak_messages_required,
        formData.streak_reset_on_skip,
        isInitialLoad,
        config,
        streakSettingsPayload,
        autoSave,
        clearAutoSave,
        // [OK] EXCLUDED: formData.streak_enabled_twitch, formData.streak_enabled_vk
        // Эти поля сохраняются отдельно через handlePlatformToggle
    ]);

    const resetStatsMutation = useMutation({
        mutationFn: async () => {
            return await dropsService.resetStreak(channelName);
        },
        onSuccess: (response) => {
            const responseData = response?.data as { data?: { deleted_count?: number } } | undefined;
            const deletedCount = responseData?.data?.deleted_count || 0;
            toast.success(`Статистика стриков сброшена (удалено ${deletedCount} записей)`);
            queryClient.invalidateQueries({ queryKey: ['drops-streak-stats', channelName] });
        },
        onError: (err: Error) => {
            toast.error('Ошибка сброса статистики');
            logger.error('Error resetting streak statistics:', err);
        },
    });

    const handleResetStatistics = async () => {
        if (!user || !channelName) {
            toast.error('Недостаточно данных');
            return;
        }
        if (!showResetConfirm) {
            setShowResetConfirm(true);
            return;
        }
        setShowResetConfirm(false);
        resetStatsMutation.mutate();
    };

    const _isStreakEnabledAnywhere = formData.streak_enabled_twitch || formData.streak_enabled_vk;
    const messagesRequired = formData.streak_messages_required[0];
    const maxMessagesRequired = DROPS_CONSTANTS.STREAK.MAX_MESSAGES_REQUIRED;

    const handleMessagesRequiredChange = (value: number) => {
        const clamped = Math.max(1, Math.min(maxMessagesRequired, value));
        setFormData({ ...formData, streak_messages_required: [clamped] });
    };

    if (isLoading && isInitialLoad) {
        return (
            <div className="space-y-4">
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Если config не загрузился (ошибка валидации), показываем предупреждение
    if (!config && !isLoading) {
        return (
            <div className="space-y-4">
                <Card className="border-red-500/35 bg-red-500/10 shadow-sm shadow-black/20">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-red-500/15 border border-red-400/40 flex-shrink-0">
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground break-words">
                                    Не удалось загрузить настройки стриков. Убедитесь, что сервер запущен на{' '}
                                    <strong className="text-foreground font-mono">порту 8000</strong>.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {!hasRewards && (
                <Card className="border-amber-500/35 bg-amber-500/10 shadow-sm shadow-black/20">
                    <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="flex-shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/15 p-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                                </div>
                                <p className="text-sm text-amber-100/90">
                                    Сначала добавьте награды на вкладке{' '}
                                    <strong className="text-amber-50">"Награды"</strong>.
                                </p>
                            </div>
                            <Button
                                onClick={() => navigate('/dashboard/drops?tab=rewards')}
                                variant="outline"
                                size="sm"
                                className="h-8 flex-shrink-0 border-amber-300/40 bg-amber-500/10 text-xs text-amber-100 hover:bg-amber-500/20"
                            >
                                <Package className="mr-1.5 h-3.5 w-3.5" />
                                Настроить награды
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className={SURFACE_CARD_CLASS}>
                <CardHeader className="pb-3">
                    <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-lg">Календарь стриков</CardTitle>

                        <div className="flex flex-wrap items-center gap-4">
                            {twitchAvailable && (
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium">Twitch</Label>
                                    <Switch
                                        checked={formData.streak_enabled_twitch}
                                        onCheckedChange={(checked) => handlePlatformToggle('twitch', checked)}
                                    />
                                </div>
                            )}
                            {vkAvailable && (
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium">VK Live</Label>
                                    <Switch
                                        checked={formData.streak_enabled_vk}
                                        onCheckedChange={(checked) => handlePlatformToggle('vk', checked)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <StreakCalendar
                        formData={
                            formData as unknown as {
                                streak_days_common: number[];
                                streak_days_rare: number[];
                                streak_days_epic: number[];
                                streak_days_legendary: number[];
                                [key: string]: number[];
                            }
                        }
                        setFormData={
                            setFormData as unknown as React.Dispatch<
                                React.SetStateAction<{
                                    streak_days_common: number[];
                                    streak_days_rare: number[];
                                    streak_days_epic: number[];
                                    streak_days_legendary: number[];
                                    [key: string]: number[];
                                }>
                            >
                        }
                    />
                </CardContent>
            </Card>

            {/* Общие настройки - перемещены вниз */}
            <Card className={SURFACE_CARD_CLASS}>
                <CardContent className="space-y-4 pt-6">
                    {/* Сообщений для засчета дня */}
                    <div className="space-y-2 rounded-xl border border-border/70 bg-transparent p-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm">Сообщений для засчета стрима</Label>
                            <Input
                                type="number"
                                value={messagesRequired}
                                onChange={(e) => handleMessagesRequiredChange(parseInt(e.target.value, 10) || 1)}
                                className="h-9 w-24 border-border/70 bg-transparent text-center text-base font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min={1}
                                max={maxMessagesRequired}
                            />
                        </div>
                        <Slider
                            value={formData.streak_messages_required}
                            onValueChange={(value) => handleMessagesRequiredChange(value[0])}
                            min={1}
                            max={maxMessagesRequired}
                            step={1}
                        />
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/70 bg-transparent p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <Label className="text-sm font-medium">Сброс при пропуске</Label>
                                <p className="text-xs text-muted-foreground">
                                    Обнулять стрик при неактивности во время стрима
                                </p>
                            </div>
                            <Switch
                                checked={formData.streak_reset_on_skip}
                                onCheckedChange={(checked) => {
                                    setFormData({ ...formData, streak_reset_on_skip: checked });
                                }}
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
                            {showResetConfirm ? (
                                <>
                                    <Button
                                        onClick={handleResetStatistics}
                                        disabled={resetStatsMutation.isPending}
                                        size="sm"
                                        variant="outline"
                                        className="gap-2 border-red-500/40 bg-transparent text-red-300 hover:bg-transparent hover:text-red-200"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                        {resetStatsMutation.isPending ? 'Сброс...' : 'Подтвердить сброс'}
                                    </Button>
                                    <Button
                                        onClick={() => setShowResetConfirm(false)}
                                        size="sm"
                                        variant="outline"
                                        className={BLUE_TEXT_BUTTON_CLASS}
                                    >
                                        Отмена
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    onClick={handleResetStatistics}
                                    disabled={resetStatsMutation.isPending}
                                    size="sm"
                                    variant="outline"
                                    className={BLUE_TEXT_BUTTON_CLASS}
                                >
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Сбросить статистику стриков
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StreakSettings;
