import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import StreakCalendar from './StreakCalendar';

const StreakSettings = ({ user, platform, channelName }) => {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    streak_enabled: true,
    streak_days_common: [1],
    streak_days_rare: [7],
    streak_days_epic: [30],
    streak_days_legendary: [60],
    streak_messages_required: [10],
    streak_reset_on_skip: true
  });

  useEffect(() => {
    loadConfig();
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
          streak_enabled: response.data.data.streak_enabled ?? true,
          streak_days_common: [response.data.data.streak_days_common ?? 1],
          streak_days_rare: [response.data.data.streak_days_rare ?? 7],
          streak_days_epic: [response.data.data.streak_days_epic ?? 30],
          streak_days_legendary: [response.data.data.streak_days_legendary ?? 60],
          streak_messages_required: [response.data.data.streak_messages_required ?? 10],
          streak_reset_on_skip: response.data.data.streak_reset_on_skip ?? true
        });
      }
    } catch (error) {
      logger.error('Error loading streak config:', error);
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
        streak_enabled: formData.streak_enabled,
        streak_days_common: formData.streak_days_common[0],
        streak_days_rare: formData.streak_days_rare[0],
        streak_days_epic: formData.streak_days_epic[0],
        streak_days_legendary: formData.streak_days_legendary[0],
        streak_messages_required: formData.streak_messages_required[0],
        streak_reset_on_skip: formData.streak_reset_on_skip
      };
      const response = await botService.put(`/api/drops/config/${channelName}`, payload, {
        params: { platform }
      });
      
      if (response.data.success) {
        toast.success('Настройки стрика сохранены');
        await loadConfig();
      }
    } catch (error) {
      logger.error('Error saving streak config:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Общие настройки - компактно */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Общие настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Включить стрик */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h3 className="text-sm font-medium">Включить стрик</h3>
                <p className="text-xs text-muted-foreground">Награды за активность</p>
              </div>
              <Switch
                checked={formData.streak_enabled}
                onCheckedChange={(checked) => setFormData({...formData, streak_enabled: checked})}
              />
            </div>

            {/* Сброс стрика */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h3 className="text-sm font-medium">Сброс при пропуске</h3>
                <p className="text-xs text-muted-foreground">Обнулять при неактивности</p>
              </div>
              <Switch
                checked={formData.streak_reset_on_skip}
                onCheckedChange={(checked) => setFormData({...formData, streak_reset_on_skip: checked})}
              />
            </div>
          </div>

          {/* Сообщений для засчета дня - компактно */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Сообщений для засчета дня</Label>
              <span className="text-lg font-semibold">{formData.streak_messages_required[0]}</span>
            </div>
            <Slider
              value={formData.streak_messages_required}
              onValueChange={(value) => setFormData({...formData, streak_messages_required: value})}
              min={1}
              max={100}
              step={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Календарь дней стрика */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Дни для наград</CardTitle>
          <CardDescription className="text-xs">
            Количество дней стрика для каждого качества
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StreakCalendar formData={formData} setFormData={setFormData} />
        </CardContent>
      </Card>

      {/* Кнопка сохранения - компактно справа */}
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
    </div>
  );
};

export default StreakSettings;

