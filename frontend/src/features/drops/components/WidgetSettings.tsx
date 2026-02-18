import React, { useEffect, useRef, useState } from 'react';

import { Copy, ExternalLink, Loader2, Monitor, Settings2 } from 'lucide-react';

import { DROPS_CONSTANTS } from '@/constants/drops';
import { useDropsConfig, useGenerateDropsWidgetUrl, useUpdateDropsConfig } from '@/queries/drops/dropsQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { toast } from '@/utils/toastManager';


import type { DropsConfig } from '@/types/drops';

interface WidgetSettingsProps {
  user: Record<string, unknown>;
  channelName: string;
}

interface FormData {
  widget_spinning_duration_ms: number[];
  widget_opening_duration_ms: number[];
  widget_result_duration_ms: number[];
}

interface TimingPreset {
  id: string;
  label: string;
  description: string;
  spinning: number;
  opening: number;
  result: number;
}

const SURFACE_CARD_CLASS = 'card-glass border-border/70 bg-card/75 backdrop-blur-sm shadow-sm shadow-black/10';
const WIDGET_TIMING_PRESETS: TimingPreset[] = [
  { id: 'fast', label: 'Быстро', description: 'Короткая анимация', spinning: 900, opening: 700, result: 3200 },
  { id: 'balanced', label: 'Баланс', description: 'Оптимальный вариант', spinning: 1500, opening: 1000, result: 5500 },
  { id: 'cinematic', label: 'Кино', description: 'Более эффектно', spinning: 2400, opening: 1400, result: 8200 },
];
const clampDuration = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const WidgetSettings: React.FC<WidgetSettingsProps> = ({ user, channelName }) => {
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // [OK] React Query hooks
  const { data: config, isLoading: _configLoading } = useDropsConfig(channelName, {
    enabled: !!user && !!channelName,
  });

  const updateConfigMutation = useUpdateDropsConfig(channelName, {
    onSuccess: () => {
      // toast suppressed
    },
  });

  const generateWidgetUrlMutation = useGenerateDropsWidgetUrl({
    onSuccess: (response) => {
      const responseData = response as { success?: boolean; data?: { url?: string } };
      if (responseData.success && responseData.data?.url) {
        setWidgetUrl(responseData.data.url);
      }
    },
  });

  const [formData, setFormData] = useState<FormData>({
    widget_spinning_duration_ms: [1500],
    widget_opening_duration_ms: [1000],
    widget_result_duration_ms: [5500]
  });

  const setSpinningDuration = (value: number): void => {
    setFormData((prev) => ({
      ...prev,
      widget_spinning_duration_ms: [clampDuration(value, 500, DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS)],
    }));
  };

  const setOpeningDuration = (value: number): void => {
    setFormData((prev) => ({
      ...prev,
      widget_opening_duration_ms: [clampDuration(value, 500, DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS)],
    }));
  };

  const setResultDuration = (value: number): void => {
    setFormData((prev) => ({
      ...prev,
      widget_result_duration_ms: [clampDuration(value, 2000, DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS)],
    }));
  };

  const applyTimingPreset = (preset: TimingPreset): void => {
    setFormData({
      widget_spinning_duration_ms: [clampDuration(preset.spinning, 500, DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS)],
      widget_opening_duration_ms: [clampDuration(preset.opening, 500, DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS)],
      widget_result_duration_ms: [clampDuration(preset.result, 2000, DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS)],
    });
  };

  // Init settings
  useEffect(() => {
    if (config) {
      setFormData({
        widget_spinning_duration_ms: [
          clampDuration(config.widget_spinning_duration_ms ?? 1500, 500, DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS)
        ],
        widget_opening_duration_ms: [
          clampDuration(config.widget_opening_duration_ms ?? 1000, 500, DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS)
        ],
        widget_result_duration_ms: [
          clampDuration(config.widget_result_duration_ms ?? 5500, 2000, DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS)
        ]
      });
    }
  }, [config]);

  // Load widget URL
  useEffect(() => {
    if (user && channelName && !widgetUrl && !generateWidgetUrlMutation.isPending) {
      generateWidgetUrlMutation.mutate(false);
    }
  }, [user, channelName, widgetUrl, generateWidgetUrlMutation, generateWidgetUrlMutation.isPending, generateWidgetUrlMutation.mutate]);

  // [OK] Auto-save
  const { autoSave } = useAutoSave(
    (payload: Partial<DropsConfig>) => updateConfigMutation.mutate(payload),
    1000,
    () => {
      if (!user || !channelName || !config) return 'Недостаточно данных для сохранения';
      return null;
    }
  );

  // [OK] Trigger auto-save on change
  useEffect(() => {
    if (config) {
      const payload = {
        widget_spinning_duration_ms: formData.widget_spinning_duration_ms[0],
        widget_opening_duration_ms: formData.widget_opening_duration_ms[0],
        widget_result_duration_ms: formData.widget_result_duration_ms[0]
      };
      autoSave(payload);
    }
  }, [
    formData.widget_spinning_duration_ms,
    formData.widget_opening_duration_ms,
    formData.widget_result_duration_ms,
    config,
    autoSave
  ]);

  useEffect(() => {
    const timeoutRef = saveTimeoutRef;
    return () => {
      const timeoutId = timeoutRef.current;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const handleRegenerateWidgetUrl = () => {
    generateWidgetUrlMutation.mutate(true);
  };

  const copyWidgetUrl = () => {
    if (widgetUrl) {
      navigator.clipboard.writeText(widgetUrl);
      toast.success('URL скопирован в буфер обмена');
    }
  };

  return (
    <div className="space-y-4">
      {/* Настройки анимации */}
      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Настройки анимации
          </CardTitle>
          <CardDescription className="text-xs">
            Длительность этапов анимации в OBS-виджете
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {WIDGET_TIMING_PRESETS.map((preset) => {
              const isActive =
                formData.widget_spinning_duration_ms[0] === preset.spinning &&
                formData.widget_opening_duration_ms[0] === preset.opening &&
                formData.widget_result_duration_ms[0] === preset.result;
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant={isActive ? 'secondary' : 'outline'}
                  className={`h-auto min-h-14 flex-col items-start gap-0.5 py-2 px-3 text-left ${
                    isActive
                      ? 'bg-accent text-foreground border-border/70'
                      : 'border-border/70 bg-card/70 text-muted-foreground hover:bg-accent'
                  }`}
                  onClick={() => applyTimingPreset(preset)}
                >
                  <span className="text-xs font-semibold">{preset.label}</span>
                  <span className="text-[11px] text-muted-foreground">{preset.description}</span>
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Крутка (мс)</Label>
                <span className="text-lg font-semibold">{formData.widget_spinning_duration_ms[0]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={formData.widget_spinning_duration_ms}
                  onValueChange={(value) => setSpinningDuration(value[0])}
                  min={500}
                  max={DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS}
                  step={100}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={formData.widget_spinning_duration_ms[0]}
                  onChange={(e) => setSpinningDuration(parseInt(e.target.value, 10) || 500)}
                  min={500}
                  max={DROPS_CONSTANTS.WIDGET.MAX_SPINNING_MS}
                  className="w-24 text-center"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Открытие (мс)</Label>
                <span className="text-lg font-semibold">{formData.widget_opening_duration_ms[0]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={formData.widget_opening_duration_ms}
                  onValueChange={(value) => setOpeningDuration(value[0])}
                  min={500}
                  max={DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS}
                  step={100}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={formData.widget_opening_duration_ms[0]}
                  onChange={(e) => setOpeningDuration(parseInt(e.target.value, 10) || 500)}
                  min={500}
                  max={DROPS_CONSTANTS.WIDGET.MAX_OPENING_MS}
                  className="w-24 text-center"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Результат (мс)</Label>
                <span className="text-lg font-semibold">{formData.widget_result_duration_ms[0]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={formData.widget_result_duration_ms}
                  onValueChange={(value) => setResultDuration(value[0])}
                  min={2000}
                  max={DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS}
                  step={500}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={formData.widget_result_duration_ms[0]}
                  onChange={(e) => setResultDuration(parseInt(e.target.value, 10) || 2000)}
                  min={2000}
                  max={DROPS_CONSTANTS.WIDGET.MAX_RESULT_MS}
                  className="w-24 text-center"
                />
              </div>
            </div>
          </div>

          {/* [OK] Removed save button - auto-save works */}
          <p className="text-xs text-muted-foreground">
            Сохранение происходит автоматически
          </p>
        </CardContent>
      </Card>

      {/* URL виджета */}
      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            OBS Виджет
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* [OK] Instructions removed */}
          {widgetUrl ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">URL виджета</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateWidgetUrl}
                  disabled={generateWidgetUrlMutation.isPending}
                  className="gap-2 text-xs border-border/70 bg-card/70 hover:bg-accent"
                >
                  {generateWidgetUrlMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Перегенерация...
                    </>
                  ) : (
                    <>
                      <Settings2 className="w-3 h-3" />
                      Перегенерировать
                    </>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={widgetUrl}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyWidgetUrl}
                  className="gap-2 border-border/70 bg-card/70 hover:bg-accent"
                >
                  <Copy className="w-4 h-4" />
                  Копировать
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const safeUrl = getSafeNavigationUrl(widgetUrl);
                    if (!safeUrl) {
                      toast.error('Некорректный URL виджета');
                      return;
                    }
                    window.open(safeUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="gap-2 border-border/70 bg-card/70 hover:bg-accent"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть виджет
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 border border-border/70 rounded-lg bg-card/60">
              <p className="text-sm text-muted-foreground">
                URL виджета загружается...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default WidgetSettings;
