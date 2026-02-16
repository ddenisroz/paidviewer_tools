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

const SURFACE_CARD_CLASS = 'border-slate-800 bg-slate-950/70 backdrop-blur-sm shadow-md shadow-black/20';
const MYTHICAL_MIN_INTERVAL_PRESETS = [1, 3, 6, 12, 24];
const MYTHICAL_MAX_INTERVAL_PRESETS = [6, 12, 24, 48, 72];
const MYTHICAL_WINDOW_PRESETS = [5, 10, 15, 30, 60];
const MYTHICAL_DONATION_PRESETS = [500, 1000, 2000, 5000, 10000];

const DonationSettings: React.FC<DonationSettingsProps> = ({ user, channelName, hasRewards = false }) => {
  const navigate = useNavigate();
  const { integrations } = useIntegrations();
  const { isConnected: daConnected, connect: daConnect } = useDonationAlerts();
  const donationalertsConnected = integrations?.donationalerts?.enabled || daConnected || false;
  const platform = integrations?.twitch?.enabled ? 'twitch' : (integrations?.vk?.enabled ? 'vk' : 'twitch');

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
    mythical_donation_amount: [DROPS_CONSTANTS.MYTHICAL.DEFAULT_DONATION_AMOUNT]
  });

  // Отслеживаем предыдущее состояние подключения DonationAlerts для автоматического включения donation drops
  const [wasDonationAlertsConnected, setWasDonationAlertsConnected] = useState(donationalertsConnected);

  useEffect(() => {
    const handleDropsConfigChange = (event: CustomEvent) => {
      const { donation_enabled, channel } = event.detail;
      if (channel === channelName && donation_enabled !== undefined) {
        setFormData(prev => ({ ...prev, donation_enabled }));
      }
    };

    window.addEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
    return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
  }, [channelName]);

  const initialFormData = useMemo(() => {
    if (!config) return null;

    // Type assertion after null check
    const typedConfig = config as DropsConfig;

    // Проверяем интеграцию DonationAlerts при загрузке (используем актуальное значение)
    const currentDonationalertsConnected = integrations?.donationalerts?.enabled || daConnected || false;
    const donationEnabledFromServer = typedConfig.donation_enabled ?? false;
    // Если интеграция не подключена, принудительно ставим false
    const donationEnabled = currentDonationalertsConnected ? donationEnabledFromServer : false;

    // ✅ МИФИЧЕСКИЙ DROPS ДОСТУПЕН ТОЛЬКО С DONATIONALERTS
    // Мифический drops работает на основе донатов, поэтому требует подключения DonationAlerts
    const mythicalEnabledFromServer = typedConfig.mythical_enabled ?? false;
    const mythicalEnabled = currentDonationalertsConnected ? mythicalEnabledFromServer : false;

    return {
      donation_enabled: donationEnabled,
      donation_amount_common: [typedConfig.donation_amount_common ?? DROPS_CONSTANTS.DONATION.DEFAULT_COMMON],
      donation_amount_rare: [typedConfig.donation_amount_rare ?? DROPS_CONSTANTS.DONATION.DEFAULT_RARE],
      donation_amount_epic: [typedConfig.donation_amount_epic ?? DROPS_CONSTANTS.DONATION.DEFAULT_EPIC],
      donation_amount_legendary: [typedConfig.donation_amount_legendary ?? DROPS_CONSTANTS.DONATION.DEFAULT_LEGENDARY],
      mythical_enabled: mythicalEnabled,
      mythical_min_interval_hours: [typedConfig.mythical_min_interval_hours ?? DROPS_CONSTANTS.MYTHICAL.DEFAULT_MIN_INTERVAL_HOURS],
      mythical_max_interval_hours: [typedConfig.mythical_max_interval_hours ?? DROPS_CONSTANTS.MYTHICAL.DEFAULT_MAX_INTERVAL_HOURS],
      mythical_window_duration_minutes: [typedConfig.mythical_window_duration_minutes ?? DROPS_CONSTANTS.MYTHICAL.DEFAULT_WINDOW_DURATION_MINUTES],
      mythical_donation_amount: [typedConfig.mythical_donation_amount ?? DROPS_CONSTANTS.MYTHICAL.DEFAULT_DONATION_AMOUNT]
    };
  }, [config, integrations, daConnected]);

  useEffect(() => {
    if (initialFormData && isInitialLoad) {
      setFormData(initialFormData);
      setIsInitialLoad(false);
    }
  }, [initialFormData, isInitialLoad, setIsInitialLoad]);

  // ✅ ИСПРАВЛЕНИЕ: Используем функциональное обновление и удаляем formData из зависимостей
  // чтобы избежать бесконечного цикла. Проверяем текущие значения через ref или функциональное обновление.
  useEffect(() => {
    if (!donationalertsConnected) {
      // Отключаем donation и mythical drops если DonationAlerts отключен
      // ✅ Используем функциональное обновление для чтения актуальных значений без добавления в зависимости
      setFormData(prev => {
        // ✅ Проверяем текущие значения и обновляем только если они true
        if (prev.donation_enabled || prev.mythical_enabled) {
          return {
            ...prev,
            donation_enabled: false,
            mythical_enabled: false
          };
        }
        return prev; // Не изменяем состояние если значения уже false
      });
    }
  }, [donationalertsConnected]); // ✅ Убираем formData из зависимостей для предотвращения бесконечного цикла

  const mythicalEnabledDisplay = formData.mythical_enabled;
  const donationEnabledDisplay = donationalertsConnected ? formData.donation_enabled : false;
  const mythicalDonationMax = Math.max(
    DROPS_CONSTANTS.MYTHICAL.MAX_DONATION_AMOUNT,
    Math.ceil(formData.mythical_donation_amount[0] / 100) * 100
  );
  const mythicalIntervalMax = DROPS_CONSTANTS.MYTHICAL.MAX_INTERVAL_HOURS;
  const mythicalWindowMax = DROPS_CONSTANTS.MYTHICAL.MAX_WINDOW_DURATION_MINUTES;

  const setMythicalMinInterval = (value: number) => {
    const clamped = Math.max(1, Math.min(mythicalIntervalMax, value));
    setFormData((prev) => ({ ...prev, mythical_min_interval_hours: [clamped] }));
  };

  const setMythicalMaxInterval = (value: number) => {
    const clamped = Math.max(1, Math.min(mythicalIntervalMax, value));
    setFormData((prev) => ({ ...prev, mythical_max_interval_hours: [clamped] }));
  };

  const setMythicalWindowDuration = (value: number) => {
    const clamped = Math.max(1, Math.min(mythicalWindowMax, value));
    setFormData((prev) => ({ ...prev, mythical_window_duration_minutes: [clamped] }));
  };

  const setMythicalDonationAmount = (value: number) => {
    const clamped = Math.max(500, Math.min(mythicalDonationMax, value));
    setFormData((prev) => ({ ...prev, mythical_donation_amount: [clamped] }));
  };

  const validateMythical = (payload: Partial<DropsConfig>): string | null => {
    if (payload.mythical_enabled) {
      const minInterval = payload.mythical_min_interval_hours ?? formData.mythical_min_interval_hours[0];
      const maxInterval = payload.mythical_max_interval_hours ?? formData.mythical_max_interval_hours[0];
      if (minInterval >= maxInterval) {
        return 'Минимальный интервал должен быть меньше максимального';
      }
    }
    return null;
  };

  const { autoSave } = useAutoSave(
    (payload: Partial<DropsConfig>) => saveMutation.mutate(payload),
    1000,
    validateMythical
  );

  const createPayload = (): Partial<DropsConfig> => ({
    donation_enabled: formData.donation_enabled,
    donation_amount_common: formData.donation_amount_common[0],
    donation_amount_rare: formData.donation_amount_rare[0],
    donation_amount_epic: formData.donation_amount_epic[0],
    donation_amount_legendary: formData.donation_amount_legendary[0],
    mythical_enabled: formData.mythical_enabled,
    mythical_min_interval_hours: formData.mythical_min_interval_hours[0],
    mythical_max_interval_hours: formData.mythical_max_interval_hours[0],
    mythical_window_duration_minutes: formData.mythical_window_duration_minutes[0],
    mythical_donation_amount: formData.mythical_donation_amount[0]
  });

  useEffect(() => {
    // Если DonationAlerts только что подключился (был false, стал true)
    if (donationalertsConnected && !wasDonationAlertsConnected && !formData.donation_enabled) {
      // Автоматически включаем donation drops после подключения
      setFormData(prev => ({ ...prev, donation_enabled: true }));
      // Сохраняем автоматически через небольшую задержку, чтобы дать время обновиться состоянию
      setTimeout(() => {
        const payload = {
          donation_enabled: true,
          donation_amount_common: formData.donation_amount_common[0],
          donation_amount_rare: formData.donation_amount_rare[0],
          donation_amount_epic: formData.donation_amount_epic[0],
          donation_amount_legendary: formData.donation_amount_legendary[0],
          mythical_enabled: formData.mythical_enabled,
          mythical_min_interval_hours: formData.mythical_min_interval_hours[0],
          mythical_max_interval_hours: formData.mythical_max_interval_hours[0],
          mythical_window_duration_minutes: formData.mythical_window_duration_minutes[0],
          mythical_donation_amount: formData.mythical_donation_amount[0]
        };
        autoSave(payload);
      }, 1000);
    }
    setWasDonationAlertsConnected(donationalertsConnected);
  }, [donationalertsConnected, wasDonationAlertsConnected, formData, autoSave]);

  useEffect(() => {
    const handleDonationAlertsConnected = (event: CustomEvent) => {
      if (event.detail?.success) {
        // Событие подключения - обновляем состояние для триггера автоматического включения
        // Основная логика в useEffect выше
      }
    };

    window.addEventListener('donationalerts_connected', handleDonationAlertsConnected as EventListener);
    return () => window.removeEventListener('donationalerts_connected', handleDonationAlertsConnected as EventListener);
  }, []);

  useEffect(() => {
    if (!isInitialLoad && config) {
      autoSave({
        donation_amount_common: formData.donation_amount_common[0],
        donation_amount_rare: formData.donation_amount_rare[0],
        donation_amount_epic: formData.donation_amount_epic[0],
        donation_amount_legendary: formData.donation_amount_legendary[0],
        mythical_min_interval_hours: formData.mythical_min_interval_hours[0],
        mythical_max_interval_hours: formData.mythical_max_interval_hours[0],
        mythical_window_duration_minutes: formData.mythical_window_duration_minutes[0],
        mythical_donation_amount: formData.mythical_donation_amount[0]
      });
    }
  }, [
    formData.donation_amount_common,
    formData.donation_amount_rare,
    formData.donation_amount_epic,
    formData.donation_amount_legendary,
    formData.mythical_min_interval_hours,
    formData.mythical_max_interval_hours,
    formData.mythical_window_duration_minutes,
    formData.mythical_donation_amount,
    isInitialLoad,
    config,
    autoSave
  ]);

  if (isLoading || isInitialLoad || !config) {
    return (
      <Card className={SURFACE_CARD_CLASS}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Предупреждение если нет наград */}
      {!hasRewards && (
        <Card className="border-l-4 border-l-orange-500 border-orange-500/40 bg-slate-950/80 backdrop-blur-sm shadow-md shadow-black/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-orange-500/10 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Сначала добавьте награды на вкладке <strong className="text-foreground">"Награды"</strong>.
                </p>
                <Button
                  onClick={() => navigate('/dashboard/drops?tab=rewards')}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-700 bg-slate-900/70 hover:bg-slate-800"
                >
                  <Package className="w-3.5 h-3.5 mr-1.5" />
                  Настроить награды
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Настройки донатов - компактно */}
      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Включить donation drops</Label>
              <div title={!donationalertsConnected ? "Нажмите чтобы подключить DonationAlerts" : ""}>
                <Switch
                  checked={donationEnabledDisplay}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      // Проверяем интеграцию с DonationAlerts
                      if (!donationalertsConnected) {
                        // Автоматически включаем интеграцию DonationAlerts
                        toast.info('Подключаем интеграцию DonationAlerts...', {
                          description: 'Вы будете перенаправлены на страницу авторизации'
                        });
                        const connected = await daConnect();

                        if (!connected) {
                          toast.error('Не удалось подключить интеграцию DonationAlerts');
                          return;
                        }

                        // Если подключение успешно, daConnect() перенаправит на OAuth
                        // После возврата с OAuth интеграция будет подключена
                        return;
                      }
                    }
                    setFormData({ ...formData, donation_enabled: checked });
                    autoSave({ ...createPayload(), donation_enabled: checked });
                  }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DonationGrid
            formData={formData as unknown as { donation_amount_common: number[]; donation_amount_rare: number[]; donation_amount_epic: number[]; donation_amount_legendary: number[];[key: string]: number[] }}
            setFormData={setFormData as unknown as React.Dispatch<React.SetStateAction<{ donation_amount_common: number[]; donation_amount_rare: number[]; donation_amount_epic: number[]; donation_amount_legendary: number[];[key: string]: number[] }>>}
          />
        </CardContent>
      </Card>

      {/* Инструкция и цветовая схема */}
      {donationEnabledDisplay && (
        <Card className={SURFACE_CARD_CLASS}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="flex-1 space-y-2 text-sm">
                <p className="text-muted-foreground break-words">
                  Пороги выпадения по донатам:
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    <span className="text-muted-foreground">от {formData.donation_amount_common[0]}₽</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                    <span className="text-muted-foreground">от {formData.donation_amount_rare[0]}₽</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                    <span className="text-muted-foreground">от {formData.donation_amount_epic[0]}₽</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                    <span className="text-muted-foreground">от {formData.donation_amount_legendary[0]}₽</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Мифический lootbox - компактно */}
      <Card className={`${SURFACE_CARD_CLASS} border-emerald-500/30`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-300">
              <img src={MythycClosed} alt="Мифический" className="w-10 h-10 flex-shrink-0" />
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <span>Мифический drops</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-emerald-200">Включить mythical drops</Label>
              <div title="Мифический drops работает на основе донатов. Активация происходит только когда стрим онлайн.">
                <Switch
                  checked={mythicalEnabledDisplay}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      // Проверяем интеграцию с DonationAlerts
                      if (!donationalertsConnected) {
                        // Автоматически включаем интеграцию DonationAlerts
                        toast.info('Подключаем интеграцию DonationAlerts...', {
                          description: 'Вы будете перенаправлены на страницу авторизации'
                        });
                        const connected = await daConnect();

                        if (!connected) {
                          toast.error('Не удалось подключить интеграцию DonationAlerts');
                          return;
                        }

                        // Если подключение успешно, daConnect() перенаправит на OAuth
                        // После возврата с OAuth интеграция будет подключена
                        return;
                      }
                    }
                    setFormData({ ...formData, mythical_enabled: checked });
                    autoSave({ ...createPayload(), mythical_enabled: checked });
                  }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        {mythicalEnabledDisplay && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Мин. интервал (ч)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_min_interval_hours}
                    onValueChange={(value) => setMythicalMinInterval(value[0])}
                    min={1}
                    max={mythicalIntervalMax}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    max={String(mythicalIntervalMax)}
                    value={formData.mythical_min_interval_hours[0]}
                    onChange={(e) => setMythicalMinInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-16 text-center"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MYTHICAL_MIN_INTERVAL_PRESETS.filter((preset) => preset <= mythicalIntervalMax).map((preset) => (
                    <Button
                      key={`mythical-min-${preset}`}
                      type="button"
                      variant={formData.mythical_min_interval_hours[0] === preset ? 'secondary' : 'outline'}
                      size="sm"
                      className={`h-7 px-2 text-xs ${
                        formData.mythical_min_interval_hours[0] === preset
                          ? 'bg-slate-700 text-slate-100 border-slate-600'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                      }`}
                      onClick={() => setMythicalMinInterval(preset)}
                    >
                      {preset}ч
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Макс. интервал (ч)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_max_interval_hours}
                    onValueChange={(value) => setMythicalMaxInterval(value[0])}
                    min={1}
                    max={mythicalIntervalMax}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    max={String(mythicalIntervalMax)}
                    value={formData.mythical_max_interval_hours[0]}
                    onChange={(e) => setMythicalMaxInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-16 text-center"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MYTHICAL_MAX_INTERVAL_PRESETS.filter((preset) => preset <= mythicalIntervalMax).map((preset) => (
                    <Button
                      key={`mythical-max-${preset}`}
                      type="button"
                      variant={formData.mythical_max_interval_hours[0] === preset ? 'secondary' : 'outline'}
                      size="sm"
                      className={`h-7 px-2 text-xs ${
                        formData.mythical_max_interval_hours[0] === preset
                          ? 'bg-slate-700 text-slate-100 border-slate-600'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                      }`}
                      onClick={() => setMythicalMaxInterval(preset)}
                    >
                      {preset}ч
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Длительность окна (м)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_window_duration_minutes}
                    onValueChange={(value) => setMythicalWindowDuration(value[0])}
                    min={1}
                    max={mythicalWindowMax}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    max={String(mythicalWindowMax)}
                    value={formData.mythical_window_duration_minutes[0]}
                    onChange={(e) => setMythicalWindowDuration(parseInt(e.target.value, 10) || 1)}
                    className="w-16 text-center"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MYTHICAL_WINDOW_PRESETS.filter((preset) => preset <= mythicalWindowMax).map((preset) => (
                    <Button
                      key={`mythical-window-${preset}`}
                      type="button"
                      variant={formData.mythical_window_duration_minutes[0] === preset ? 'secondary' : 'outline'}
                      size="sm"
                      className={`h-7 px-2 text-xs ${
                        formData.mythical_window_duration_minutes[0] === preset
                          ? 'bg-slate-700 text-slate-100 border-slate-600'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                      }`}
                      onClick={() => setMythicalWindowDuration(preset)}
                    >
                      {preset}м
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Мин. сумма (₽)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_donation_amount}
                    onValueChange={(value) => setMythicalDonationAmount(value[0])}
                    min={500}
                    max={mythicalDonationMax}
                    step={100}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="500"
                    max={String(mythicalDonationMax)}
                    step="100"
                    value={formData.mythical_donation_amount[0]}
                    onChange={(e) => setMythicalDonationAmount(parseInt(e.target.value, 10) || 500)}
                    className="w-20 text-center"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MYTHICAL_DONATION_PRESETS.filter((preset) => preset <= mythicalDonationMax).map((preset) => (
                    <Button
                      key={`mythical-donation-${preset}`}
                      type="button"
                      variant={formData.mythical_donation_amount[0] === preset ? 'secondary' : 'outline'}
                      size="sm"
                      className={`h-7 px-2 text-xs ${
                        formData.mythical_donation_amount[0] === preset
                          ? 'bg-slate-700 text-slate-100 border-slate-600'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                      }`}
                      onClick={() => setMythicalDonationAmount(preset)}
                    >
                      {preset}₽
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* История донатов */}
      <DonationHistory user={user} platform={platform} channelName={channelName} />

      {/* ✅ Убрали кнопку "Сохранить" - автосохранение работает автоматически */}
    </div>
  );
};

export default DonationSettings;
