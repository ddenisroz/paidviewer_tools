import React, { useEffect, useRef, useState } from 'react';

import { Copy, ExternalLink, Loader2, Monitor, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/utils/toastManager';

import { useAutoSave } from '../../../hooks/useAutoSave';
import { useDropsConfig, useGenerateDropsWidgetUrl, useUpdateDropsConfig } from '../../../queries/drops/dropsQueries';

import type { DropsConfig } from '../../../types/drops';

interface WidgetSettingsProps {
    user: Record<string, unknown>;
    channelName: string;
}

interface FormData {
    widget_spinning_duration_ms: number[];
    widget_opening_duration_ms: number[];
    widget_result_duration_ms: number[];
}

const WidgetSettings: React.FC<WidgetSettingsProps> = ({ user, channelName }) => {
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // [OK] НОВЫЙ КОД: Используем централизованные hooks
  const { data: config, isLoading: _configLoading } = useDropsConfig(channelName, {
    enabled: !!user && !!channelName,
  });
  
  const updateConfigMutation = useUpdateDropsConfig(channelName, {
    onSuccess: () => {
      // Автосохранение работает тихо, без toast
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

  // Загружаем конфигурацию и генерируем URL виджета при монтировании
  useEffect(() => {
    if (config) {
      setFormData({
        widget_spinning_duration_ms: [config.widget_spinning_duration_ms ?? 1500],
        widget_opening_duration_ms: [config.widget_opening_duration_ms ?? 1000],
        widget_result_duration_ms: [config.widget_result_duration_ms ?? 5500]
      });
    }
  }, [config]);

  // Генерируем URL виджета при монтировании
  useEffect(() => {
    if (user && channelName && !widgetUrl) {
      generateWidgetUrlMutation.mutate(false);
    }
  }, [user, channelName]);

  // [OK] Автосохранение с дебаунсом
  const { autoSave } = useAutoSave(
    (payload: Partial<DropsConfig>) => updateConfigMutation.mutate(payload),
    1000,
    () => {
      if (!user || !channelName || !config) return 'Недостаточно данных для сохранения';
      return null;
    }
  );

  // [OK] Автосохранение при изменении полей
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
  
  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Настройки анимации
          </CardTitle>
          <CardDescription className="text-xs">
            Длительность фаз анимации открытия сундуков в OBS виджете
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Крутка (мс)</Label>
                <span className="text-lg font-semibold">{formData.widget_spinning_duration_ms[0]}</span>
              </div>
              <Slider
                value={formData.widget_spinning_duration_ms}
                onValueChange={(value) => setFormData({...formData, widget_spinning_duration_ms: value})}
                min={500}
                max={5000}
                step={100}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Открытие (мс)</Label>
                <span className="text-lg font-semibold">{formData.widget_opening_duration_ms[0]}</span>
              </div>
              <Slider
                value={formData.widget_opening_duration_ms}
                onValueChange={(value) => setFormData({...formData, widget_opening_duration_ms: value})}
                min={500}
                max={3000}
                step={100}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Результат (мс)</Label>
                <span className="text-lg font-semibold">{formData.widget_result_duration_ms[0]}</span>
              </div>
              <Slider
                value={formData.widget_result_duration_ms}
                onValueChange={(value) => setFormData({...formData, widget_result_duration_ms: value})}
                min={2000}
                max={15000}
                step={500}
              />
            </div>
          </div>

          {/* [OK] Убрали кнопки - автосохранение работает автоматически */}
          <p className="text-xs text-muted-foreground italic">
            Настройки сохраняются автоматически при изменении
          </p>
        </CardContent>
      </Card>

      {/* URL виджета */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            OBS Виджет
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* [OK] Убрали инструкцию OBS */}
          {widgetUrl ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">URL виджета</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateWidgetUrl}
                  disabled={generateWidgetUrlMutation.isPending}
                  className="gap-2 text-xs"
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
              <div className="flex gap-2">
                <Input
                  value={widgetUrl}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyWidgetUrl}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Копировать
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(widgetUrl, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть виджет
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded-lg bg-muted/50">
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


