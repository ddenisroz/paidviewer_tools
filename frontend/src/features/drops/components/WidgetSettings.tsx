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

const SURFACE_CARD_CLASS = 'card-glass border-border/70 bg-card/75 backdrop-blur-sm shadow-sm shadow-black/10';
const BLUE_ACTION_CLASS = 'gap-2 border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200';
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
          <CardDescription className="text-xs text-muted-foreground/90">
            Три этапа: крутка, открытие и показ результата
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="space-y-3 rounded-xl border border-border/70 bg-transparent p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Крутка</Label>
                <span className="text-xs text-muted-foreground">мс</span>
              </div>
              <div className="flex items-center gap-3">
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
                  className="h-9 w-24 border-border/70 bg-transparent text-center text-base font-semibold"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-transparent p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Открытие</Label>
                <span className="text-xs text-muted-foreground">мс</span>
              </div>
              <div className="flex items-center gap-3">
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
                  className="h-9 w-24 border-border/70 bg-transparent text-center text-base font-semibold"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-transparent p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Результат</Label>
                <span className="text-xs text-muted-foreground">мс</span>
              </div>
              <div className="flex items-center gap-3">
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
                  className="h-9 w-24 border-border/70 bg-transparent text-center text-base font-semibold"
                />
              </div>
            </div>
          </div>

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
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">URL виджета</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateWidgetUrl}
                  disabled={generateWidgetUrlMutation.isPending}
                  className={`text-xs ${BLUE_ACTION_CLASS}`}
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
                  className="h-10 flex-1 border-border/70 bg-transparent font-mono text-sm text-foreground"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyWidgetUrl}
                  className={BLUE_ACTION_CLASS}
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
                  className={BLUE_ACTION_CLASS}
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
