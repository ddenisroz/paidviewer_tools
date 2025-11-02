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
import { AlertTriangle, Loader2, Check, Package } from 'lucide-react';

const StreakSettings = ({ user, platform, channelName, hasRewards = false }) => {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
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
        setSavedSuccessfully(true);
        setTimeout(() => setSavedSuccessfully(false), 2000);
        await loadConfig();
      }
    } catch (error) {
      logger.error('Error saving streak config:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleResetStatistics = async () => {
    if (!user || !platform || !channelName) {
      toast.error('Недостаточно данных');
      return;
    }

    if (!confirm('Вы уверены, что хотите сбросить всю статистику стриков? Это действие необратимо!')) {
      return;
    }

    try {
      setResetting(true);
      const response = await botService.post(`/api/drops/streak/reset/${channelName}`, {}, {
        params: { platform }
      });
      
      if (response.data.success) {
        toast.success(`Статистика стриков сброшена (удалено ${response.data.data.deleted_count} записей)`);
      }
    } catch (error) {
      logger.error('Error resetting streak statistics:', error);
      toast.error('Ошибка сброса статистики');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Предупреждение если нет наград */}
      {!hasRewards && (
        <Card className="border-2 border-orange-500/50 bg-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-orange-400 mb-1">
                  Награды не настроены
                </h4>
                <p className="text-xs text-orange-200/80 mb-2">
                  Для работы системы стриков необходимо сначала настроить содержимое сундуков на вкладке "Награды".
                </p>
                <Button 
                  onClick={() => window.location.href = '/dashboard/drops?tab=rewards'}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                >
                  <Package className="w-3 h-3 mr-1.5" />
                  Настроить награды
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Календарь дней стрика - поднят вверх */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Дни для наград</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Включить стрик drops</Label>
              <Switch
                checked={formData.streak_enabled && hasRewards}
                disabled={!hasRewards}
                onCheckedChange={(checked) => {
                  if (!hasRewards) {
                    toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"');
                    return;
                  }
                  setFormData({...formData, streak_enabled: checked});
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StreakCalendar formData={formData} setFormData={setFormData} />
        </CardContent>
      </Card>

      {/* Общие настройки - перемещены вниз */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Дополнительные настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Сообщений для засчета дня */}
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

          {/* Сброс при пропуске */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Сброс при пропуске</Label>
              <p className="text-xs text-muted-foreground">Обнулять стрик при неактивности в течение дня</p>
            </div>
            <Switch
              checked={formData.streak_reset_on_skip}
              onCheckedChange={(checked) => setFormData({...formData, streak_reset_on_skip: checked})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Кнопки сохранения и сброса статистики */}
      <div className="flex items-center gap-3 justify-end">
        <Button 
          onClick={handleResetStatistics}
          disabled={resetting}
          size="sm"
          variant="destructive"
          className="gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          {resetting ? 'Сброс...' : 'Сбросить статистику стриков'}
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="sm"
          variant={savedSuccessfully ? "default" : "default"}
          className={`gap-2 px-6 transition-all duration-300 ${
            savedSuccessfully 
              ? 'bg-green-600 hover:bg-green-500 scale-105' 
              : saving 
                ? 'opacity-75' 
                : ''
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Сохранение...
            </>
          ) : savedSuccessfully ? (
            <>
              <Check className="w-4 h-4" />
              Сохранено!
            </>
          ) : (
            'Сохранить'
          )}
        </Button>
      </div>
    </div>
  );
};

export default StreakSettings;

