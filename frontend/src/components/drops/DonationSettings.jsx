import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Check, AlertTriangle, Package } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import { useIntegrations } from '../../context/IntegrationsContext';
import { useDonationAlerts } from '../../context/DonationAlertsContext';
import DonationGrid from './DonationGrid';
import DonationHistory from './DonationHistory';
import MythycClosed from '../../images/lootboxes/mythyc/mythyc_closed.png';

const DonationSettings = ({ user, channelName, hasRewards = false }) => {
  const { integrations } = useIntegrations();
  const { isConnected: daConnected, connect: daConnect } = useDonationAlerts();
  const queryClient = useQueryClient();
  const donationalertsConnected = integrations?.donationalerts?.enabled || daConnected || false;
  const saveTimeoutRef = useRef(null);
  
  // Определяем платформу для истории донатов
  const platform = integrations?.twitch?.enabled ? 'twitch' : (integrations?.vk?.enabled ? 'vk' : 'twitch');
  
  // Флаг для отслеживания первой загрузки
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // 🚀 FIX: Начальное состояние должно учитывать статус подключения DonationAlerts
  // Если DonationAlerts не подключен, начинаем с false
  const [formData, setFormData] = useState({
    donation_enabled: false,
    donation_amount_common: [50.0],
    donation_amount_rare: [100.0],
    donation_amount_epic: [500.0],
    donation_amount_legendary: [1000.0],
    mythical_enabled: false,
    mythical_min_interval_hours: [2],
    mythical_max_interval_hours: [8],
    mythical_window_duration_minutes: [5],
    mythical_donation_amount: [2000.0]
  });

  // Listen to drops config changes from QuickActionsBar
  useEffect(() => {
    const handleDropsConfigChange = (event) => {
      const { donation_enabled, channel, platform: eventPlatform } = event.detail;
      // Only update if it's for the same channel
      if (channel === channelName && donation_enabled !== undefined) {
        setFormData(prev => ({ ...prev, donation_enabled }));
        // Invalidate query to refetch
        queryClient.invalidateQueries({ queryKey: ['drops-config', channelName] });
      }
    };

    window.addEventListener('drops-config-changed', handleDropsConfigChange);
    return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange);
  }, [channelName, queryClient]);

  // React Query: загружаем конфигурацию (общие настройки, без platform)
  const { data: config, isLoading } = useQuery({
    queryKey: ['drops-config', channelName],
    queryFn: async () => {
      if (!channelName) return null;
      const response = await botService.get(`/api/drops/config/${channelName}`);
      return response.data.success ? response.data.data : null;
    },
    enabled: !!channelName,
    staleTime: 30000, // 30 секунд - данные актуальны
  });
  
  // ✅ Загружаем данные из конфига СРАЗУ при получении (без мерцания)
  // Используем useMemo для мгновенного обновления formData при получении config
  const initialFormData = React.useMemo(() => {
    if (!config) return null;
    // Проверяем интеграцию DonationAlerts при загрузке (используем актуальное значение)
    const currentDonationalertsConnected = integrations?.donationalerts?.enabled || daConnected || false;
    const donationEnabledFromServer = config.donation_enabled ?? false;
    // Если интеграция не подключена, принудительно ставим false
    const donationEnabled = currentDonationalertsConnected ? donationEnabledFromServer : false;
    
    // ✅ НАСТРОЙКИ МИФИЧЕСКОГО DROPS ДОСТУПНЫ ВСЕГДА
    // Активация (появление сундука) происходит только когда стрим онлайн
    // Но настройки можно включать/выключать и настраивать параметры всегда
    const mythicalEnabledFromServer = config.mythical_enabled ?? false;
    const mythicalEnabled = mythicalEnabledFromServer;
    
    return {
      donation_enabled: donationEnabled,
      donation_amount_common: [config.donation_amount_common ?? 50.0],
      donation_amount_rare: [config.donation_amount_rare ?? 100.0],
      donation_amount_epic: [config.donation_amount_epic ?? 500.0],
      donation_amount_legendary: [config.donation_amount_legendary ?? 1000.0],
      mythical_enabled: mythicalEnabled,
      mythical_min_interval_hours: [config.mythical_min_interval_hours ?? 2],
      mythical_max_interval_hours: [config.mythical_max_interval_hours ?? 8],
      mythical_window_duration_minutes: [config.mythical_window_duration_minutes ?? 5],
      mythical_donation_amount: [config.mythical_donation_amount ?? 2000.0]
    };
  }, [config, integrations, daConnected]);
  
  useEffect(() => {
    if (initialFormData && isInitialLoad) {
      setFormData(initialFormData);
      setIsInitialLoad(false);
    }
  }, [initialFormData, isInitialLoad]);

  // ✅ Синхронизируем только donation_enabled с подключением DonationAlerts
  // mythical_enabled доступен всегда (активация только при онлайн стриме)
  useEffect(() => {
    if (!donationalertsConnected) {
      setFormData(prev => {
        // Обновляем только donation_enabled, mythical_enabled НЕ трогаем
        if (prev.donation_enabled) {
          return { 
            ...prev, 
            donation_enabled: false
            // ✅ mythical_enabled НЕ отключаем - настройки доступны всегда
          };
        }
        return prev;
      });
    }
  }, [donationalertsConnected]);

  // ✅ Автоматически включаем donation drops после успешного подключения DonationAlerts
  useEffect(() => {
    const handleDonationAlertsConnected = (event) => {
      if (event.detail?.success && donationalertsConnected && !formData.donation_enabled) {
        logger.log('✅ [DONATION] Auto-enabling donation drops after DonationAlerts connection');
        setFormData(prev => ({ ...prev, donation_enabled: true }));
        // Автосохранение сработает через useEffect
      }
    };

    window.addEventListener('donationalerts_connected', handleDonationAlertsConnected);
    return () => window.removeEventListener('donationalerts_connected', handleDonationAlertsConnected);
  }, [donationalertsConnected, formData.donation_enabled]);

  // 🚀 FIX: Вычисляем актуальное значение для тогла
  // Если DonationAlerts не подключен, тогл всегда должен показывать false
  // ✅ НАСТРОЙКИ МИФИЧЕСКОГО DROPS ДОСТУПНЫ ВСЕГДА
  // Активация происходит только когда стрим онлайн, но настройки доступны всегда
  const mythicalEnabledDisplay = formData.mythical_enabled;
  const donationEnabledDisplay = donationalertsConnected ? formData.donation_enabled : false;

  // ✅ Скрываем компонент до загрузки данных (предотвращаем мерцание)
  if (isLoading || isInitialLoad || !config) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // React Query: мутация для сохранения настроек (общие настройки, без platform)
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      return await botService.put(`/api/drops/config/${channelName}`, payload);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['drops-config', channelName] });
      const previousConfig = queryClient.getQueryData(['drops-config', channelName]);
      queryClient.setQueryData(['drops-config', channelName], (old) => ({
        ...old,
        ...payload,
      }));
      return { previousConfig };
    },
    onError: (err, payload, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(['drops-config', channelName], context.previousConfig);
      }
      toast.error('Ошибка сохранения настроек');
      logger.error('Error saving donation config:', err);
    },
    onSuccess: (response, payload) => {
      // ✅ Убрали toast и savedSuccessfully - автосохранение работает тихо
      
      // 🔄 СИНХРОНИЗАЦИЯ: Отправляем событие для синхронизации с QuickActionsBar
      if (payload.donation_enabled !== undefined) {
        window.dispatchEvent(new CustomEvent('drops-config-changed', {
          detail: { 
            donation_enabled: payload.donation_enabled,
            channel: channelName
          }
        }));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['drops-config', channelName] });
    },
  });
  
  // ✅ Автосохранение с дебаунсом
  const autoSave = (payload) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      // Валидация мифического лутбокса
      if (payload.mythical_enabled) {
        const minInterval = payload.mythical_min_interval_hours ?? formData.mythical_min_interval_hours[0];
        const maxInterval = payload.mythical_max_interval_hours ?? formData.mythical_max_interval_hours[0];
        if (minInterval >= maxInterval) {
          toast.error('Минимальный интервал должен быть меньше максимального');
          return;
        }
      }
      saveMutation.mutate(payload);
    }, 1000); // Дебаунс 1 секунда
  };
  
  // ✅ Автосохранение при изменении полей
  useEffect(() => {
    if (!isInitialLoad && config) {
      const payload = {
        donation_enabled: formData.donation_enabled,
        donation_amount_common: formData.donation_amount_common[0],
        donation_amount_rare: formData.donation_amount_rare[0],
        donation_amount_epic: formData.donation_amount_epic[0],
        donation_amount_legendary: formData.donation_amount_legendary[0],
        mythical_enabled: formData.mythical_enabled,
        mythical_min_interval_hours: formData.mythical_min_interval_hours[0],
        mythical_max_interval_hours: formData.mythical_max_interval_hours[0],
        mythical_window_duration_minutes: formData.mythical_window_duration_minutes[0],
        mythical_donation_amount: formData.mythical_donation_amount[0]
      };
      autoSave(payload);
    }
  }, [
    formData.donation_amount_common,
    formData.donation_amount_rare,
    formData.donation_amount_epic,
    formData.donation_amount_legendary,
    formData.mythical_min_interval_hours,
    formData.mythical_max_interval_hours,
    formData.mythical_window_duration_minutes,
    formData.mythical_donation_amount,
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
                  Для работы donation drops необходимо сначала настроить содержимое сундуков на вкладке "Награды".
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

      {/* Настройки донатов - компактно */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Настройка сундуков</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Включить donation drops</Label>
              <div title={!donationalertsConnected ? "Нажмите чтобы подключить DonationAlerts" : ""}>
              <Switch
                checked={donationEnabledDisplay}
                onCheckedChange={async (checked) => {
                  if (checked) {
                    // Проверяем интеграцию с DonationAlerts
                    if (!donationalertsConnected) {
                      // Автоматически включаем интеграцию DonationAlerts
                      toast.info('Подключаем интеграцию DonationAlerts...', {
                        description: 'Вы будете перенаправлены на страницу авторизации'
                      });
                      const connected = await daConnect();
                      
                      if (!connected) {
                        toast.error('Не удалось подключить интеграцию DonationAlerts');
                        return;
                      }
                      
                      // Если подключение успешно, daConnect() перенаправит на OAuth
                      // После возврата с OAuth интеграция будет подключена
                      return;
                    }
                  }
                  // Update local state immediately
                  setFormData({...formData, donation_enabled: checked});
                  // ✅ Автосохранение с дебаунсом
                  const payload = {
                    donation_enabled: checked,
                    donation_amount_common: formData.donation_amount_common[0],
                    donation_amount_rare: formData.donation_amount_rare[0],
                    donation_amount_epic: formData.donation_amount_epic[0],
                    donation_amount_legendary: formData.donation_amount_legendary[0],
                    mythical_enabled: formData.mythical_enabled,
                    mythical_min_interval_hours: formData.mythical_min_interval_hours[0],
                    mythical_max_interval_hours: formData.mythical_max_interval_hours[0],
                    mythical_window_duration_minutes: formData.mythical_window_duration_minutes[0],
                    mythical_donation_amount: formData.mythical_donation_amount[0]
                  };
                  autoSave(payload);
                }}
              />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DonationGrid formData={formData} setFormData={setFormData} />
        </CardContent>
      </Card>

          {/* Мифический lootbox - компактно */}
          <Card className="border-2 border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-purple-600/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-pink-400">
                  <img src={MythycClosed} alt="Мифический" className="w-10 h-10" />
                  <Sparkles className="w-5 h-5" />
                  Мифический drops
                </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-pink-300">Включить mythyc drops</Label>
              <div title="Настройки мифического drops доступны всегда. Активация происходит только когда стрим онлайн.">
              <Switch
                checked={mythicalEnabledDisplay}
                onCheckedChange={async (checked) => {
                  // ✅ НАСТРОЙКИ МИФИЧЕСКОГО DROPS ДОСТУПНЫ ВСЕГДА
                  // Можно включать/выключать независимо от DonationAlerts
                  // Активация (появление сундука) происходит только когда стрим онлайн
                  // Update local state immediately
                  setFormData({...formData, mythical_enabled: checked});
                  // ✅ Автосохранение с дебаунсом
                  const payload = {
                    donation_enabled: formData.donation_enabled,
                    donation_amount_common: formData.donation_amount_common[0],
                    donation_amount_rare: formData.donation_amount_rare[0],
                    donation_amount_epic: formData.donation_amount_epic[0],
                    donation_amount_legendary: formData.donation_amount_legendary[0],
                    mythical_enabled: checked,
                    mythical_min_interval_hours: formData.mythical_min_interval_hours[0],
                    mythical_max_interval_hours: formData.mythical_max_interval_hours[0],
                    mythical_window_duration_minutes: formData.mythical_window_duration_minutes[0],
                    mythical_donation_amount: formData.mythical_donation_amount[0]
                  };
                  autoSave(payload);
                }}
              />
              </div>
            </div>
          </div>
        </CardHeader>
        {mythicalEnabledDisplay && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Мин. интервал (ч)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_min_interval_hours}
                    onValueChange={(value) => {
                      setFormData({...formData, mythical_min_interval_hours: value});
                    }}
                    min={0}
                    max={24}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={formData.mythical_min_interval_hours[0]}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(24, parseInt(e.target.value) || 0));
                      setFormData({...formData, mythical_min_interval_hours: [value]});
                    }}
                    className="w-16 text-center"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Макс. интервал (ч)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_max_interval_hours}
                    onValueChange={(value) => {
                      setFormData({...formData, mythical_max_interval_hours: value});
                    }}
                    min={0}
                    max={24}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={formData.mythical_max_interval_hours[0]}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(24, parseInt(e.target.value) || 0));
                      setFormData({...formData, mythical_max_interval_hours: [value]});
                    }}
                    className="w-16 text-center"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Длительность окна (м)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_window_duration_minutes}
                    onValueChange={(value) => {
                      setFormData({...formData, mythical_window_duration_minutes: value});
                    }}
                    min={1}
                    max={60}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.mythical_window_duration_minutes[0]}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
                      setFormData({...formData, mythical_window_duration_minutes: [value]});
                    }}
                    className="w-16 text-center"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Мин. сумма (₽)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={formData.mythical_donation_amount}
                    onValueChange={(value) => {
                      setFormData({...formData, mythical_donation_amount: value});
                    }}
                    min={500}
                    max={10000}
                    step={100}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="500"
                    max="10000"
                    step="100"
                    value={formData.mythical_donation_amount[0]}
                    onChange={(e) => {
                      const value = Math.max(500, Math.min(10000, parseInt(e.target.value) || 500));
                      setFormData({...formData, mythical_donation_amount: [value]});
                    }}
                    className="w-20 text-center"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* История донатов */}
      <DonationHistory user={user} platform={platform} channelName={channelName} />

      {/* ✅ Убрали кнопку "Сохранить" - автосохранение работает автоматически */}
    </div>
  );
};

export default DonationSettings;
