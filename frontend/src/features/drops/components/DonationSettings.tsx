import React, { useEffect, useMemo, useState } from 'react';

import { AlertTriangle, Loader2, Package, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DROPS_CONSTANTS } from '@/constants/drops';
import { useDonationAlerts } from '@/context/DonationAlertsContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useDropsConfig } from '@/features/drops/hooks/useDropsConfig';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { toast } from '@/utils/toastManager';

import MythycClosed from '../../../images/lootboxes/mythyc/mythyc_closed.png';

import DonationGrid from './DonationGrid';
import DonationHistory from './DonationHistory';

import type { DropsConfig } from '@/types/drops';

interface DonationSettingsProps {
    user: Record<string, unknown>;
    channelName: string;
    hasRewards?: boolean;
}

interface DonationSettingsFormData {
    donation_enabled: boolean;
    donation_amount_common: number[];
    donation_amount_rare: number[];
    donation_amount_epic: number[];
    donation_amount_legendary: number[];
    mythical_enabled: boolean;
    mythical_min_interval_hours: number[];
    mythical_max_interval_hours: number[];
    mythical_window_duration_minutes: number[];
    mythical_donation_amount: number[];
}

type DonationGridShape = {
    donation_amount_common: number[];
    donation_amount_rare: number[];
    donation_amount_epic: number[];
    donation_amount_legendary: number[];
    [key: string]: number[];
};

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const PRESET_BUTTON_CLASS =
    'h-7 rounded-md border-border/70 bg-card/70 px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground';
const ACTIVE_PRESET_BUTTON_CLASS =
    'h-7 rounded-md border-emerald-400/40 bg-emerald-500/15 px-2 text-xs text-emerald-200';
const MYTHICAL_MIN_INTERVAL_PRESETS = [1, 3, 6, 12, 24];
const MYTHICAL_MAX_INTERVAL_PRESETS = [6, 12, 24, 48, 72];
const MYTHICAL_WINDOW_PRESETS = [5, 10, 15, 30, 60];
const MYTHICAL_DONATION_PRESETS = [500, 1000, 2000, 5000, 10000];

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const hasDonationAlertsConnection = (enabled?: boolean, contextConnected?: boolean): boolean =>
    Boolean(enabled || contextConnected);
const getActiveDropsPlatform = (integrations: ReturnType<typeof useIntegrations>['integrations']): 'twitch' | 'vk' =>
    integrations?.vk?.enabled && !integrations?.twitch?.enabled ? 'vk' : 'twitch';

const DonationSettings: React.FC<DonationSettingsProps> = ({ user, channelName, hasRewards = false }) => {
    const navigate = useNavigate();
    const { integrations } = useIntegrations();
    const { isConnected: daConnected, connect: daConnect } = useDonationAlerts();
    const donationAlertsConnected = hasDonationAlertsConnection(integrations?.donationalerts?.enabled, daConnected);
    const platform = getActiveDropsPlatform(integrations);
    const { config, isLoading, isInitialLoad, setIsInitialLoad, saveMutation } = useDropsConfig(channelName);

    const [formData, setFormData] = useState<DonationSettingsFormData>({
        donation_enabled: false,
        donation_amount_common: [DROPS_CONSTANTS.DONATION.DEFAULT_COMMON],
        donation_amount_rare: [DROPS_CONSTANTS.DONATION.DEFAULT_RARE],
        donation_amount_epic: [DROPS_CONSTANTS.DONATION.DEFAULT_EPIC],
        donation_amount_legendary: [DROPS_CONSTANTS.DONATION.DEFAULT_LEGENDARY],
        mythical_enabled: false,
        mythical_min_interval_hours: [DROPS_CONSTANTS.MYTHICAL.DEFAULT_MIN_INTERVAL_HOURS],
        mythical_max_interval_hours: [DROPS_CONSTANTS.MYTHICAL.DEFAULT_MAX_INTERVAL_HOURS],
        mythical_window_duration_minutes: [DROPS_CONSTANTS.MYTHICAL.DEFAULT_WINDOW_DURATION_MINUTES],
        mythical_donation_amount: [DROPS_CONSTANTS.MYTHICAL.DEFAULT_DONATION_AMOUNT],
    });

    const initialFormData = useMemo<DonationSettingsFormData | null>(() => {
        if (!config) return null;
        const typedConfig = config as DropsConfig;
        const enabledByDa = donationAlertsConnected;

        return {
            donation_enabled: enabledByDa,
            donation_amount_common: [typedConfig.donation_amount_common ?? DROPS_CONSTANTS.DONATION.DEFAULT_COMMON],
            donation_amount_rare: [typedConfig.donation_amount_rare ?? DROPS_CONSTANTS.DONATION.DEFAULT_RARE],
            donation_amount_epic: [typedConfig.donation_amount_epic ?? DROPS_CONSTANTS.DONATION.DEFAULT_EPIC],
            donation_amount_legendary: [
                typedConfig.donation_amount_legendary ?? DROPS_CONSTANTS.DONATION.DEFAULT_LEGENDARY,
            ],
            mythical_enabled: enabledByDa ? Boolean(typedConfig.mythical_enabled) : false,
            mythical_min_interval_hours: [
                typedConfig.mythical_min_interval_hours ?? DROPS_CONSTANTS.MYTHICAL.DEFAULT_MIN_INTERVAL_HOURS,
            ],
            mythical_max_interval_hours: [
                typedConfig.mythical_max_interval_hours ?? DROPS_CONSTANTS.MYTHICAL.DEFAULT_MAX_INTERVAL_HOURS,
            ],
            mythical_window_duration_minutes: [
                typedConfig.mythical_window_duration_minutes ??
                    DROPS_CONSTANTS.MYTHICAL.DEFAULT_WINDOW_DURATION_MINUTES,
            ],
            mythical_donation_amount: [
                typedConfig.mythical_donation_amount ?? DROPS_CONSTANTS.MYTHICAL.DEFAULT_DONATION_AMOUNT,
            ],
        };
    }, [config, donationAlertsConnected]);

    useEffect(() => {
        if (initialFormData && isInitialLoad) {
            setFormData(initialFormData);
            setIsInitialLoad(false);
        }
    }, [initialFormData, isInitialLoad, setIsInitialLoad]);

    useEffect(() => {
        if (!donationAlertsConnected) {
            setFormData((prev) => ({ ...prev, donation_enabled: false, mythical_enabled: false }));
        }
    }, [donationAlertsConnected]);

    const validateMythical = (payload: Partial<DropsConfig>): string | null => {
        if (!payload.mythical_enabled) return null;
        const minInterval = payload.mythical_min_interval_hours ?? formData.mythical_min_interval_hours[0];
        const maxInterval = payload.mythical_max_interval_hours ?? formData.mythical_max_interval_hours[0];
        if (minInterval >= maxInterval) {
            return 'Минимальный интервал должен быть меньше максимального';
        }
        return null;
    };

    const { autoSave } = useAutoSave(
        (payload: Partial<DropsConfig>) => saveMutation.mutate(payload),
        1000,
        validateMythical
    );

    useEffect(() => {
        if (!donationAlertsConnected || !config || isInitialLoad || saveMutation.isPending) return;
        if (!(config as DropsConfig).donation_enabled) {
            saveMutation.mutate({ donation_enabled: true });
        }
    }, [config, donationAlertsConnected, isInitialLoad, saveMutation]);

    const createPayload = (next = formData): Partial<DropsConfig> => ({
        donation_enabled: donationAlertsConnected,
        donation_amount_common: next.donation_amount_common[0],
        donation_amount_rare: next.donation_amount_rare[0],
        donation_amount_epic: next.donation_amount_epic[0],
        donation_amount_legendary: next.donation_amount_legendary[0],
        mythical_enabled: next.mythical_enabled,
        mythical_min_interval_hours: next.mythical_min_interval_hours[0],
        mythical_max_interval_hours: next.mythical_max_interval_hours[0],
        mythical_window_duration_minutes: next.mythical_window_duration_minutes[0],
        mythical_donation_amount: next.mythical_donation_amount[0],
    });

    const saveNext = (next: DonationSettingsFormData, patch?: Partial<DropsConfig>): void => {
        setFormData(next);
        autoSave({ ...createPayload(next), ...patch });
    };

    const openDonationAlertsSetup = async (): Promise<void> => {
        toast.info('Открываю подключение DonationAlerts...', {
            description: 'После авторизации вернитесь на эту вкладку, drops включатся автоматически.',
        });
        const redirected = await daConnect();
        if (!redirected) {
            navigate('/dashboard/settings?focus=donationalerts');
        }
    };

    const handleMythicalToggle = async (checked: boolean): Promise<void> => {
        if (checked && !donationAlertsConnected) {
            await openDonationAlertsSetup();
            return;
        }
        const next = { ...formData, mythical_enabled: checked };
        saveNext(next, { mythical_enabled: checked });
    };

    const setMythicalField = (
        key:
            | 'mythical_min_interval_hours'
            | 'mythical_max_interval_hours'
            | 'mythical_window_duration_minutes'
            | 'mythical_donation_amount',
        value: number,
        min: number,
        max: number
    ): void => {
        const next = { ...formData, [key]: [clamp(value, min, max)] };
        saveNext(next);
    };

    const mythicalDonationMax = Math.max(
        DROPS_CONSTANTS.MYTHICAL.MAX_DONATION_AMOUNT,
        Math.ceil(formData.mythical_donation_amount[0] / 100) * 100
    );
    const mythicalIntervalMax = DROPS_CONSTANTS.MYTHICAL.MAX_INTERVAL_HOURS;
    const mythicalWindowMax = DROPS_CONSTANTS.MYTHICAL.MAX_WINDOW_DURATION_MINUTES;

    if (isLoading || isInitialLoad || !config) {
        return (
            <Card className={SURFACE_CARD_CLASS}>
                <CardContent className="flex justify-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
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
                    <div className="flex min-h-10 items-center justify-between gap-3">
                        <CardTitle className="text-lg">Платные вознаграждения</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <DonationGrid
                        formData={formData as unknown as DonationGridShape}
                        setFormData={setFormData as unknown as React.Dispatch<React.SetStateAction<DonationGridShape>>}
                        onChange={(next) => autoSave(createPayload(next as unknown as DonationSettingsFormData))}
                    />
                </CardContent>
            </Card>

            {donationAlertsConnected && formData.donation_enabled && (
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="space-y-3 py-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 rounded-lg bg-emerald-500/10 p-2">
                                <Sparkles className="h-4 w-4 text-emerald-300" />
                            </div>
                            <div className="space-y-2 text-sm">
                                <p className="text-muted-foreground">Пороги выпадения по донатам:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        Обычный от {formData.donation_amount_common[0]} ₽
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Редкий от {formData.donation_amount_rare[0]} ₽
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Эпический от {formData.donation_amount_epic[0]} ₽
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Легендарный от {formData.donation_amount_legendary[0]} ₽
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className={`${SURFACE_CARD_CLASS} border-emerald-500/30`}>
                <CardHeader className="pb-3">
                    <div className="flex min-h-12 items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-lg text-emerald-300">
                            <img src={MythycClosed} alt="Мифический" className="h-10 w-10 flex-shrink-0" />
                            <span>Мифический drops</span>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-emerald-200">Включить Мифический drops</Label>
                            <Switch
                                variant="donation"
                                checked={donationAlertsConnected ? formData.mythical_enabled : false}
                                onCheckedChange={(checked) => void handleMythicalToggle(checked)}
                            />
                        </div>
                    </div>
                </CardHeader>

                {formData.mythical_enabled && (
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 min-[1280px]:gap-4">
                            <MythicalControl
                                label="Мин. интервал"
                                unit="ч"
                                value={formData.mythical_min_interval_hours[0]}
                                min={1}
                                max={mythicalIntervalMax}
                                sliderStep={1}
                                presets={MYTHICAL_MIN_INTERVAL_PRESETS}
                                onChange={(value) =>
                                    setMythicalField('mythical_min_interval_hours', value, 1, mythicalIntervalMax)
                                }
                            />
                            <MythicalControl
                                label="Макс. интервал"
                                unit="ч"
                                value={formData.mythical_max_interval_hours[0]}
                                min={1}
                                max={mythicalIntervalMax}
                                sliderStep={1}
                                presets={MYTHICAL_MAX_INTERVAL_PRESETS}
                                onChange={(value) =>
                                    setMythicalField('mythical_max_interval_hours', value, 1, mythicalIntervalMax)
                                }
                            />
                            <MythicalControl
                                label="Длительность окна"
                                unit="м"
                                value={formData.mythical_window_duration_minutes[0]}
                                min={1}
                                max={mythicalWindowMax}
                                sliderStep={1}
                                presets={MYTHICAL_WINDOW_PRESETS}
                                onChange={(value) =>
                                    setMythicalField('mythical_window_duration_minutes', value, 1, mythicalWindowMax)
                                }
                            />
                            <MythicalControl
                                label="Мин. донат"
                                unit="₽"
                                value={formData.mythical_donation_amount[0]}
                                min={500}
                                max={mythicalDonationMax}
                                sliderStep={100}
                                presets={MYTHICAL_DONATION_PRESETS}
                                onChange={(value) =>
                                    setMythicalField('mythical_donation_amount', value, 500, mythicalDonationMax)
                                }
                            />
                        </div>
                    </CardContent>
                )}
            </Card>

            <DonationHistory user={user} platform={platform} channelName={channelName} />
        </div>
    );
};

interface MythicalControlProps {
    label: string;
    unit: string;
    value: number;
    min: number;
    max: number;
    sliderStep: number;
    presets: number[];
    onChange: (value: number) => void;
}

const MythicalControl: React.FC<MythicalControlProps> = ({
    label,
    unit,
    value,
    min,
    max,
    sliderStep,
    presets,
    onChange,
}) => (
    <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-2">
            <Slider
                value={[value]}
                onValueChange={(next) => onChange(next[0])}
                min={min}
                max={max}
                step={sliderStep}
                className="flex-1"
            />
            <Input
                type="number"
                min={String(min)}
                max={String(max)}
                step="1"
                value={value}
                onChange={(event) => onChange(Number(event.target.value) || min)}
                className="h-9 w-20 border-border/70 bg-card/70 text-center"
            />
        </div>
        <div className="flex flex-wrap gap-1.5">
            {presets
                .filter((preset) => preset <= max)
                .map((preset) => (
                    <Button
                        key={`${label}-${preset}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={value === preset ? ACTIVE_PRESET_BUTTON_CLASS : PRESET_BUTTON_CLASS}
                        onClick={() => onChange(preset)}
                    >
                        {preset}
                        {unit}
                    </Button>
                ))}
        </div>
    </div>
);

export default DonationSettings;
