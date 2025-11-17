import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Monitor, Copy, ExternalLink, Settings2, Loader2 } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

const WidgetSettings = ({ user, channelName }) => {
  const [config, setConfig] = useState(null);
  const [widgetUrl, setWidgetUrl] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const saveTimeoutRef = useRef(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [formData, setFormData] = useState({
    widget_spinning_duration_ms: [1500],
    widget_opening_duration_ms: [1000],
    widget_result_duration_ms: [5500]
  });

  useEffect(() => {
    loadConfig();
    generateWidgetUrl();
  }, [user, channelName]);

  const loadConfig = async () => {
    if (!user || !channelName) {
      return;
    }
    try {
      const response = await botService.get(`/api/drops/config/${channelName}`);
      if (response.data.success) {
        setConfig(response.data.data);
        setFormData({
          widget_spinning_duration_ms: [response.data.data.widget_spinning_duration_ms ?? 1500],
          widget_opening_duration_ms: [response.data.data.widget_opening_duration_ms ?? 1000],
          widget_result_duration_ms: [response.data.data.widget_result_duration_ms ?? 5500]
        });
        setIsInitialLoad(false);
      }
    } catch (error) {
      logger.error('Error loading widget config:', error);
    }
  };

  const generateWidgetUrl = async (regenerate = false) => {
    try {
      if (regenerate) {
        setRegenerating(true);
      }
      const response = await botService.post('/api/drops/widget-url', null, {
        params: { regenerate }
      });
      if (response.data.success) {
        setWidgetUrl(response.data.data.url);
        if (regenerate) {
          toast.success('Токен виджета перегенерирован');
        }
      }
    } catch (error) {
      logger.error('Error generating widget URL:', error);
      toast.error('Ошибка генерации URL виджета');
    } finally {
      if (regenerate) {
        setRegenerating(false);
      }
    }
  };

  // ✅ Автосохранение с дебаунсом
  const autoSave = async () => {
    if (!user || !channelName || isInitialLoad) {
      return;
    }
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
          widget_spinning_duration_ms: formData.widget_spinning_duration_ms[0],
          widget_opening_duration_ms: formData.widget_opening_duration_ms[0],
          widget_result_duration_ms: formData.widget_result_duration_ms[0]
        };
        await botService.put(`/api/drops/config/${channelName}`, payload);
        // ✅ Автосохранение работает тихо, без toast
      } catch (error) {
        logger.error('Error auto-saving widget config:', error);
      }
    }, 1000); // Дебаунс 1 секунда
  };
  
  // ✅ Автосохранение при изменении полей
  useEffect(() => {
    if (!isInitialLoad && config) {
      autoSave();
    }
  }, [
    formData.widget_spinning_duration_ms,
    formData.widget_opening_duration_ms,
    formData.widget_result_duration_ms,
    isInitialLoad
  ]);
  
  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
              <p className="text-xs text-muted-foreground">Крутка сундука перед открытием</p>
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
              <p className="text-xs text-muted-foreground">Момент открытия сундука</p>
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
              <p className="text-xs text-muted-foreground">Показ награды зрителю</p>
            </div>
          </div>

          {/* ✅ Убрали кнопки - автосохранение работает автоматически */}
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
          <CardDescription className="text-xs">
            Добавьте этот виджет в OBS как Browser Source
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ✅ Убрали инструкцию OBS */}
          {widgetUrl ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">URL виджета</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateWidgetUrl(true)}
                  disabled={regenerating}
                  className="gap-2 text-xs"
                >
                  {regenerating ? (
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

