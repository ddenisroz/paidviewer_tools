import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import { botService } from '../../services/microservices';
import StreakCalendar from './StreakCalendar';
import { AlertTriangle, Loader2, Package } from 'lucide-react';
import { useDropsConfig } from '../../hooks/useDropsConfig';
import { useAutoSave } from '../../hooks/useAutoSave';

const StreakSettings = ({ user, channelName, hasRewards = false, integrations }) => {
  const twitchAvailable = integrations?.twitch?.enabled && user?.twitch_username;
  const vkAvailable = integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name);
  
  const { config, isLoading, isInitialLoad, setIsInitialLoad, saveMutation } = useDropsConfig(channelName);
  
  const [formData, setFormData] = useState({
    streak_days_common: [1],
    streak_days_rare: [7],
    streak_days_epic: [30],
    streak_days_legendary: [60],
    streak_messages_required: [10],
    streak_reset_on_skip: true,
    streak_enabled_twitch: false,
    streak_enabled_vk: false
  });

  useEffect(() => {
    const handleDropsConfigChange = (event) => {
      const { streak_enabled, channel, platform: eventPlatform } = event.detail;
      if (channel === channelName && streak_enabled !== undefined && eventPlatform) {
        if (eventPlatform === 'twitch') {
          setFormData(prev => ({ ...prev, streak_enabled_twitch: streak_enabled }));
        } else if (eventPlatform === 'vk') {
          setFormData(prev => ({ ...prev, streak_enabled_vk: streak_enabled }));
        }
      }
    };

    window.addEventListener('drops-config-changed', handleDropsConfigChange);
    return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange);
  }, [channelName]);
  
  const initialFormData = useMemo(() => {
    if (!config) return null;
    return {
      streak_days_common: [config.streak_days_common ?? 1],
      streak_days_rare: [config.streak_days_rare ?? 7],
      streak_days_epic: [config.streak_days_epic ?? 30],
      streak_days_legendary: [config.streak_days_legendary ?? 60],
      streak_messages_required: [config.streak_messages_required ?? 10],
      streak_reset_on_skip: config.streak_reset_on_skip ?? true,
      streak_enabled_twitch: config.streak_enabled_twitch ?? false,
      streak_enabled_vk: config.streak_enabled_vk ?? false
    };
  }, [config]);
  
  useEffect(() => {
    if (initialFormData && isInitialLoad) {
      setFormData(initialFormData);
      setIsInitialLoad(false);
    }
  }, [initialFormData, isInitialLoad]);

  const queryClient = useQueryClient();
  const { autoSave } = useAutoSave(
    (payload) => saveMutation.mutate(payload),
    1000
  );

  const createPayload = () => ({
    streak_days_common: formData.streak_days_common[0],
    streak_days_rare: formData.streak_days_rare[0],
    streak_days_epic: formData.streak_days_epic[0],
    streak_days_legendary: formData.streak_days_legendary[0],
    streak_messages_required: formData.streak_messages_required[0],
    streak_reset_on_skip: formData.streak_reset_on_skip,
    streak_enabled_twitch: formData.streak_enabled_twitch,
    streak_enabled_vk: formData.streak_enabled_vk
  });

  const handlePlatformToggle = (platform, enabled) => {
    if (!hasRewards && enabled) {
      toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"');
      return;
    }
    
    const platformKey = platform === 'twitch' ? 'streak_enabled_twitch' : 'streak_enabled_vk';
    setFormData(prev => ({ ...prev, [platformKey]: enabled }));
    autoSave({ ...createPayload(), [platformKey]: enabled });
  };
  
  useEffect(() => {
    if (!isInitialLoad && config) {
      autoSave(createPayload());
    }
  }, [
    formData.streak_days_common,
    formData.streak_days_rare,
    formData.streak_days_epic,
    formData.streak_days_legendary,
    formData.streak_messages_required,
    formData.streak_reset_on_skip,
    isInitialLoad,
    autoSave
  ]);

  const resetStatsMutation = useMutation({
    mutationFn: async () => {
      return await botService.post(`/api/drops/streak/reset/${channelName}`, {});
    },
    onSuccess: (response) => {
      const deletedCount = response?.data?.data?.deleted_count || 0;
      toast.success(`Статистика стриков сброшена (удалено ${deletedCount} записей)`);
      queryClient.invalidateQueries({ queryKey: ['drops-streak-stats', channelName] });
    },
    onError: (err) => {
      toast.error('Ошибка сброса статистики');
      logger.error('Error resetting streak statistics:', err);
    },
  });

  const handleResetStatistics = async () => {
    if (!user || !channelName) {
      toast.error('Недостаточно данных');
      return;
    }

    if (!confirm('Вы уверены, что хотите сбросить всю статистику стриков? Это действие необратимо!')) {
      return;
    }

    resetStatsMutation.mutate();
  };
  
  const isStreakEnabledAnywhere = formData.streak_enabled_twitch || formData.streak_enabled_vk;

  if (isLoading || isInitialLoad || !config) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">Настройка стриков</CardTitle>
            {/* Переключатели для каждой платформы */}
            <div className="flex items-center gap-4 flex-wrap">
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
          <StreakCalendar formData={formData} setFormData={setFormData} />
        </CardContent>
      </Card>

      {/* Общие настройки - перемещены вниз */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Сообщений для засчета дня */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Сообщений для засчета стрима</Label>
              <span className="text-lg font-semibold">{formData.streak_messages_required[0]}</span>
            </div>
            <Slider
              value={formData.streak_messages_required}
              onValueChange={(value) => {
                setFormData({...formData, streak_messages_required: value});
                // Автосохранение уже в useEffect
              }}
              min={1}
              max={100}
              step={1}
            />
          </div>

          {/* Сброс при пропуске */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Сброс при пропуске</Label>
              <p className="text-xs text-muted-foreground">Обнулять стрик при неактивности во время стрима</p>
            </div>
            <Switch
              checked={formData.streak_reset_on_skip}
              onCheckedChange={(checked) => {
                setFormData({...formData, streak_reset_on_skip: checked});
                // Автосохранение уже в useEffect
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ✅ Убрали кнопку "Сохранить" - автосохранение работает автоматически */}
      {/* Кнопка сброса статистики */}
      <div className="flex items-center gap-3 justify-end">
        <Button 
          onClick={handleResetStatistics}
          disabled={resetStatsMutation.isPending}
          size="sm"
          variant="destructive"
          className="gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          {resetStatsMutation.isPending ? 'Сброс...' : 'Сбросить статистику стриков'}
        </Button>
      </div>
    </div>
  );
};

export default StreakSettings;

