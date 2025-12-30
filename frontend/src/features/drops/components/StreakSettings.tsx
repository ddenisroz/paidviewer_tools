import React, { useEffect, useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Gift, Loader2, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/utils/toastManager';

import { DROPS_CONSTANTS } from '../../../constants/drops';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useDropsConfig } from '../../../hooks/useDropsConfig';
import { dropsService } from '../../../services/api/services/dropsService';
import { logger } from '../../../utils/prodLogger';

import StreakCalendar from './StreakCalendar';



import type { DropsConfig } from '../../../types/drops';
import type { User, UserIntegrations } from '../../../types/user';

interface StreakSettingsProps {
    user: User;
    channelName: string;
    hasRewards?: boolean;
    integrations?: UserIntegrations;
}

interface StreakSettingsFormData {
    streak_days_common: number[];
    streak_days_rare: number[];
    streak_days_epic: number[];
    streak_days_legendary: number[];
    streak_messages_required: number[];
    streak_reset_on_skip: boolean;
    streak_enabled_twitch: boolean;
    streak_enabled_vk: boolean;
}

const StreakSettings: React.FC<StreakSettingsProps> = ({ user, channelName, hasRewards = false, integrations }) => {
  const twitchAvailable = integrations?.twitch?.connected && user?.twitch_username;
  const vkAvailable = integrations?.vk?.connected && (user?.vk_username || user?.vk_channel_name);
  
  const { config, isLoading, isInitialLoad, setIsInitialLoad, saveMutation } = useDropsConfig(channelName);
  
  const [formData, setFormData] = useState<StreakSettingsFormData>({
    streak_days_common: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON],
    streak_days_rare: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE],
    streak_days_epic: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC],
    streak_days_legendary: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY],
    streak_messages_required: [DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED],
    streak_reset_on_skip: true,
    streak_enabled_twitch: false,
    streak_enabled_vk: false
  });

  useEffect(() => {
    const handleDropsConfigChange = (event: CustomEvent) => {
      const { streak_enabled, channel, platform: eventPlatform, source } = event.detail;
      // [OK] ИСПРАВЛЕНИЕ: Обновляем локальное состояние только если событие пришло от QuickActionsBar
      // Если событие пришло от useDropsConfig (наш собственный saveMutation), то состояние уже обновлено через setFormData
      if (channel === channelName && streak_enabled !== undefined && eventPlatform && source === 'QuickActionsBar') {
        if (eventPlatform === 'twitch') {
          setFormData(prev => ({ ...prev, streak_enabled_twitch: streak_enabled }));
        } else if (eventPlatform === 'vk') {
          setFormData(prev => ({ ...prev, streak_enabled_vk: streak_enabled }));
        }
      }
    };

    window.addEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
    return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
  }, [channelName]);
  
  const initialFormData = useMemo(() => {
    if (!config) return null;
    
    // Type assertion after null check
    const typedConfig = config as DropsConfig;
    
    return {
      streak_days_common: [typedConfig.streak_days_common ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON],
      streak_days_rare: [typedConfig.streak_days_rare ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE],
      streak_days_epic: [typedConfig.streak_days_epic ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC],
      streak_days_legendary: [typedConfig.streak_days_legendary ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY],
      streak_messages_required: [typedConfig.streak_messages_required ?? DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED],
      streak_reset_on_skip: typedConfig.streak_reset_on_skip ?? true,
      streak_enabled_twitch: typedConfig.streak_enabled_twitch ?? false,
      streak_enabled_vk: typedConfig.streak_enabled_vk ?? false
    };
  }, [config]);
  
  // [OK] ИНИЦИАЛИЗАЦИЯ: Загружаем данные при первой загрузке
  useEffect(() => {
    if (initialFormData && isInitialLoad) {
      setFormData(initialFormData);
      setIsInitialLoad(false);
    }
  }, [initialFormData, isInitialLoad]);
  
  // [OK] СИНХРОНИЗАЦИЯ: Синхронизируем formData с config из React Query
  // Обновляем все поля, включая streak_enabled (fallback если событие не было обработано)
  useEffect(() => {
    if (!isInitialLoad && config && initialFormData) {
      setFormData(prev => {
        // [OK] Проверяем, изменились ли значения в config
        const needsUpdate = 
          prev.streak_days_common[0] !== initialFormData.streak_days_common[0] ||
          prev.streak_days_rare[0] !== initialFormData.streak_days_rare[0] ||
          prev.streak_days_epic[0] !== initialFormData.streak_days_epic[0] ||
          prev.streak_days_legendary[0] !== initialFormData.streak_days_legendary[0] ||
          prev.streak_messages_required[0] !== initialFormData.streak_messages_required[0] ||
          prev.streak_reset_on_skip !== initialFormData.streak_reset_on_skip ||
          prev.streak_enabled_twitch !== initialFormData.streak_enabled_twitch ||
          prev.streak_enabled_vk !== initialFormData.streak_enabled_vk;
        
        // Обновляем только если значения изменились (предотвращаем лишние обновления)
        if (needsUpdate) {
          return {
            ...prev,
            streak_days_common: initialFormData.streak_days_common,
            streak_days_rare: initialFormData.streak_days_rare,
            streak_days_epic: initialFormData.streak_days_epic,
            streak_days_legendary: initialFormData.streak_days_legendary,
            streak_messages_required: initialFormData.streak_messages_required,
            streak_reset_on_skip: initialFormData.streak_reset_on_skip,
            streak_enabled_twitch: initialFormData.streak_enabled_twitch,
            streak_enabled_vk: initialFormData.streak_enabled_vk
          };
        }
        return prev;
      });
    }
  }, [config, isInitialLoad, initialFormData]);

  const queryClient = useQueryClient();
  const { autoSave } = useAutoSave(
    (payload: Partial<DropsConfig>) => saveMutation.mutate(payload),
    1000
  );

  const createPayload = (includeEnabledFlags = true): Partial<DropsConfig> => {
    const payload: Partial<DropsConfig> = {
      streak_days_common: formData.streak_days_common[0],
      streak_days_rare: formData.streak_days_rare[0],
      streak_days_epic: formData.streak_days_epic[0],
      streak_days_legendary: formData.streak_days_legendary[0],
      streak_messages_required: formData.streak_messages_required[0],
      streak_reset_on_skip: formData.streak_reset_on_skip
    };
    
    // [OK] Включаем streak_enabled только если explicitly requested (для handlePlatformToggle)
    if (includeEnabledFlags) {
      payload.streak_enabled_twitch = formData.streak_enabled_twitch;
      payload.streak_enabled_vk = formData.streak_enabled_vk;
    }
    
    return payload;
  };

  const handlePlatformToggle = (platform: string, enabled: boolean) => {
    if (!hasRewards && enabled) {
      toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"');
      return;
    }
    
    const platformKey = platform === 'twitch' ? 'streak_enabled_twitch' : 'streak_enabled_vk';
    setFormData(prev => ({ ...prev, [platformKey]: enabled }));
    autoSave({ ...createPayload(), [platformKey]: enabled });
  };
  
  // [OK] ИСПРАВЛЕНИЕ: Автосохранение только для настроек, НЕ для streak_enabled_twitch/vk
  // streak_enabled_twitch/vk сохраняются отдельно через handlePlatformToggle
  // Это предотвращает повторное сохранение при обновлении из QuickActionsBar
  useEffect(() => {
    if (!isInitialLoad && config) {
      // [OK] Создаем payload БЕЗ streak_enabled полей для автосохранения
      autoSave(createPayload(false));
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
    // [OK] ИСКЛЮЧЕНО: formData.streak_enabled_twitch, formData.streak_enabled_vk
    // Эти поля сохраняются отдельно через handlePlatformToggle
  ]);

  const resetStatsMutation = useMutation({
    mutationFn: async () => {
      return await dropsService.resetStreak(channelName);
    },
    onSuccess: (response) => {
      const responseData = response?.data as { data?: { deleted_count?: number } } | undefined;
      const deletedCount = responseData?.data?.deleted_count || 0;
      toast.success(`Статистика стриков сброшена (удалено ${deletedCount} записей)`);
      queryClient.invalidateQueries({ queryKey: ['drops-streak-stats', channelName] });
    },
    onError: (err: Error) => {
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
  
  const _isStreakEnabledAnywhere = formData.streak_enabled_twitch || formData.streak_enabled_vk;

  // Показываем loader только если это начальная загрузка И данные еще не загружены
  // Если config === null после загрузки, значит бэкенд недоступен - показываем форму с дефолтными значениями
  if (isLoading && isInitialLoad) {
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
  
  // Если config не загрузился (бэкенд недоступен), показываем предупреждение
  if (!config && !isLoading) {
    return (
      <div className="space-y-4">
        <Card className="border-l-4 border-l-red-500 border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-red-500/10 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Не удалось загрузить настройки стриков. Убедитесь, что бэкенд запущен на <strong className="text-foreground font-mono">порту 8000</strong>.
                </p>
              </div>
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
        <Card className="border-l-4 border-l-orange-500 border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-1.5 rounded-lg bg-orange-500/10 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Для работы системы стриков настройте содержимое сундуков на вкладке <strong className="text-foreground">"Награды"</strong>
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = '/dashboard/drops?tab=rewards'}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-shrink-0"
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Настроить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Календарь дней стрика - поднят вверх */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Основной заголовок - слева */}
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Система стриков</h3>
            </div>
            
            {/* Переключатели для каждой платформы - справа */}
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
          <StreakCalendar 
            formData={formData as unknown as { streak_days_common: number[]; streak_days_rare: number[]; streak_days_epic: number[]; streak_days_legendary: number[]; [key: string]: number[] }} 
            setFormData={setFormData as unknown as React.Dispatch<React.SetStateAction<{ streak_days_common: number[]; streak_days_rare: number[]; streak_days_epic: number[]; streak_days_legendary: number[]; [key: string]: number[] }>>} 
          />
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

      {/* [OK] Убрали кнопку "Сохранить" - автосохранение работает автоматически */}
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


