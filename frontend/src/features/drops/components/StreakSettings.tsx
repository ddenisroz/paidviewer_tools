import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { logger } from '../../../utils/prodLogger';
import { dropsService } from '../../../services/api/services/dropsService';
import StreakCalendar from './StreakCalendar';
import { AlertTriangle, Loader2, Package, Gift } from 'lucide-react';
import { useDropsConfig } from '../../../hooks/useDropsConfig';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { DROPS_CONSTANTS } from '../../../constants/drops';

interface StreakSettingsProps {
    user: any;
    channelName: string;
    hasRewards?: boolean;
    integrations?: any;
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
  const twitchAvailable = integrations?.twitch?.enabled && user?.twitch_username;
  const vkAvailable = integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name);
  
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
      // ✅ ИСПРАВЛЕНИЕ: Обновляем локальное состояние только если событие пришло от QuickActionsBar
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
    return {
      streak_days_common: [config.streak_days_common ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON],
      streak_days_rare: [config.streak_days_rare ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE],
      streak_days_epic: [config.streak_days_epic ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC],
      streak_days_legendary: [config.streak_days_legendary ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY],
      streak_messages_required: [config.streak_messages_required ?? DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED],
      streak_reset_on_skip: config.streak_reset_on_skip ?? true,
      streak_enabled_twitch: config.streak_enabled_twitch ?? false,
      streak_enabled_vk: config.streak_enabled_vk ?? false
    };
  }, [config]);
  
  // ✅ ИНИЦИАЛИЗАЦИЯ: Загружаем данные при первой загрузке
  useEffect(() => {
    if (initialFormData && isInitialLoad) {
      setFormData(initialFormData);
      setIsInitialLoad(false);
    }
  }, [initialFormData, isInitialLoad]);
  
  // ✅ СИНХРОНИЗАЦИЯ: Синхронизируем formData с config из React Query
  // Обновляем все поля, включая streak_enabled (fallback если событие не было обработано)
  useEffect(() => {
    if (!isInitialLoad && config && initialFormData) {
      setFormData(prev => {
        // ✅ Проверяем, изменились ли значения в config
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
    (payload: any) => saveMutation.mutate(payload),
    1000
  );

  const createPayload = (includeEnabledFlags = true): any => {
    const payload: any = {
      streak_days_common: formData.streak_days_common[0],
      streak_days_rare: formData.streak_days_rare[0],
      streak_days_epic: formData.streak_days_epic[0],
      streak_days_legendary: formData.streak_days_legendary[0],
      streak_messages_required: formData.streak_messages_required[0],
      streak_reset_on_skip: formData.streak_reset_on_skip
    };
    
    // ✅ Включаем streak_enabled только если explicitly requested (для handlePlatformToggle)
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
  
  // ✅ ИСПРАВЛЕНИЕ: Автосохранение только для настроек, НЕ для streak_enabled_twitch/vk
  // streak_enabled_twitch/vk сохраняются отдельно через handlePlatformToggle
  // Это предотвращает повторное сохранение при обновлении из QuickActionsBar
  useEffect(() => {
    if (!isInitialLoad && config) {
      // ✅ Создаем payload БЕЗ streak_enabled полей для автосохранения
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
    // ✅ ИСКЛЮЧЕНО: formData.streak_enabled_twitch, formData.streak_enabled_vk
    // Эти поля сохраняются отдельно через handlePlatformToggle
  ]);

  const resetStatsMutation = useMutation({
    mutationFn: async () => {
      return await dropsService.resetStreak(channelName);
    },
    onSuccess: (response) => {
      const deletedCount = response?.data?.data?.deleted_count || 0;
      toast.success(`Статистика стриков сброшена (удалено ${deletedCount} записей)`);
      queryClient.invalidateQueries({ queryKey: ['drops-streak-stats', channelName] });
    },
    onError: (err: any) => {
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
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-orange-500/10 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Для работы системы стриков необходимо настроить содержимое сундуков на вкладке <strong className="text-foreground">"Награды"</strong>.
                </p>
                <Button 
                  onClick={() => window.location.href = '/dashboard/drops?tab=rewards'}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                >
                  <Package className="w-3.5 h-3.5 mr-1.5" />
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
          <div className="flex items-center justify-end flex-wrap gap-3">
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
          <StreakCalendar formData={formData as any} setFormData={setFormData as any} />
        </CardContent>
      </Card>

      {/* Информация о расчёте наград */}
      {isStreakEnabledAnywhere && (
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
                <Gift className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 space-y-2 text-sm">
                <p className="text-muted-foreground leading-relaxed">
                  Зритель получает награду за <strong className="text-foreground">{formData.streak_messages_required[0]}+ сообщений</strong> в чате. Редкость зависит от дней подряд:
                </p>
                
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    <span className="text-muted-foreground">{formData.streak_days_common[0]} {formData.streak_days_common[0] === 1 ? 'день' : 'дня'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                    <span className="text-muted-foreground">{formData.streak_days_rare[0]} {formData.streak_days_rare[0] === 1 ? 'день' : formData.streak_days_rare[0] < 5 ? 'дня' : 'дней'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                    <span className="text-muted-foreground">{formData.streak_days_epic[0]} {formData.streak_days_epic[0] < 5 ? 'дня' : 'дней'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                    <span className="text-muted-foreground">{formData.streak_days_legendary[0]} {formData.streak_days_legendary[0] < 5 ? 'дня' : 'дней'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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


