import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Monitor, Copy, ExternalLink, Settings2 } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

const WidgetSettings = ({ user, platform, channelName }) => {
  const [config, setConfig] = useState(null);
  const [widgetUrl, setWidgetUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    widget_spinning_duration_ms: [1500],
    widget_opening_duration_ms: [1000],
    widget_result_duration_ms: [5500],
    widget_closing_duration_ms: [500]
  });

  useEffect(() => {
    loadConfig();
    generateWidgetUrl();
  }, [user, platform, channelName]);

  const loadConfig = async () => {
    if (!user || !platform || !channelName) {
      return;
    }
    try {
      const response = await botService.get(`/api/drops/config/${channelName}`, {
        params: { platform }
      });
      if (response.data.success) {
        setConfig(response.data.data);
        setFormData({
          widget_spinning_duration_ms: [response.data.data.widget_spinning_duration_ms ?? 1500],
          widget_opening_duration_ms: [response.data.data.widget_opening_duration_ms ?? 1000],
          widget_result_duration_ms: [response.data.data.widget_result_duration_ms ?? 5500],
          widget_closing_duration_ms: [response.data.data.widget_closing_duration_ms ?? 500]
        });
      }
    } catch (error) {
      logger.error('Error loading widget config:', error);
    }
  };

  const generateWidgetUrl = async () => {
    try {
      const response = await botService.post('/api/drops/widget-url');
      if (response.data.success) {
        setWidgetUrl(response.data.data.url);
      }
    } catch (error) {
      logger.error('Error generating widget URL:', error);
    }
  };

  const handleSave = async () => {
    if (!user || !platform || !channelName) {
      toast.error('Недостаточно данных для сохранения');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        widget_spinning_duration_ms: formData.widget_spinning_duration_ms[0],
        widget_opening_duration_ms: formData.widget_opening_duration_ms[0],
        widget_result_duration_ms: formData.widget_result_duration_ms[0],
        widget_closing_duration_ms: formData.widget_closing_duration_ms[0]
      };
      const response = await botService.put(`/api/drops/config/${channelName}`, payload, {
        params: { platform }
      });
      if (response.data.success) {
        toast.success('Настройки виджета сохранены');
        await loadConfig();
      }
    } catch (error) {
      logger.error('Error saving widget config:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Закрытие (мс)</Label>
                <span className="text-lg font-semibold">{formData.widget_closing_duration_ms[0]}</span>
              </div>
              <Slider
                value={formData.widget_closing_duration_ms}
                onValueChange={(value) => setFormData({...formData, widget_closing_duration_ms: value})}
                min={200}
                max={2000}
                step={100}
              />
              <p className="text-xs text-muted-foreground">Скрытие виджета</p>
            </div>
          </div>

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={saving}
              size="sm"
              variant="default"
              className="gap-2 px-6"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
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
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Настройка OBS</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
              <li>В OBS добавьте новый источник «Browser Source»</li>
              <li>Вставьте URL виджета в поле URL</li>
              <li>Установите ширину 1280px и высоту 720px</li>
              <li>Включите опцию «Shutdown source when not visible»</li>
            </ol>
          </div>

          {widgetUrl && (
            <div className="space-y-2">
              <Label className="text-sm">URL виджета</Label>
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
                  Открыть
                </Button>
              </div>
            </div>
          )}

          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              <strong>💡 Совет:</strong> Виджет автоматически отображает анимацию когда зрители получают награды через систему Drops.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WidgetSettings;

