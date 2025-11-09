// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Volume2, VolumeX, Zap, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useTts } from '../context/TtsContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { botService } from '../services/microservices';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';
import { getQueryCache, setQueryCache } from '../utils/queryPersist';

const QuickActionsBar = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    const { ttsEnabled } = useTts();
    const { isConnected: daConnected, connect: daConnect } = useDonationAlerts();
    
    const [isToggling, setIsToggling] = useState(false);
    // ✅ ЛОКАЛЬНОЕ СОСТОЯНИЕ: Для мгновенного отображения изменений без задержки
    const [optimisticStreakState, setOptimisticStreakState] = useState(null);
    
    // ✅ СБРОС ОПТИМИСТИЧНОГО СОСТОЯНИЯ: Сбрасываем при смене канала
    useEffect(() => {
        setOptimisticStreakState(null);
    }, [channelName]);

    // Get channel name from integrations
    const channelName = integrations.twitch?.username || integrations.vk?.username || user?.twitch_username || user?.vk_username || user?.username;
    const platform = integrations.twitch?.enabled ? 'twitch' : (integrations.vk?.enabled ? 'vk' : 'twitch');
    const isDropsEnabled = integrations.twitch?.enabled || integrations.vk?.enabled || (isGuest && user?.platform);
    const isDonationAlertsConnected = integrations?.donationalerts?.enabled || daConnected || false;

    // 🔄 СИНХРОНИЗАЦИЯ: Используем React Query для синхронизации с TtsMainPage
    const { data: ttsStatusData } = useQuery({
        queryKey: ['tts-status'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/status');
            const data = response.data;
            setQueryCache(['tts-status'], data);
            return data;
        },
        enabled: isAuthenticated,
        refetchInterval: 30000,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['tts-status']),
    });

    // 🔄 СИНХРОНИЗАЦИЯ: Вычисляем состояние TTS ТОЧНО ТАК ЖЕ как в TtsMainPage
    const ttsState = React.useMemo(() => {
        if (!ttsStatusData) return false;
        const enabled = ttsStatusData.enabled || false;
        const engineType = ttsStatusData.engine_type || 'gtts';
        
        // ТОЧНО ТАКАЯ ЖЕ ЛОГИКА как в TtsMainPage:
        // basicEnabled = enabled && engineType === 'gtts'
        // aiEnabled = enabled && (engineType === 'cloud' || engineType === 'local')
        // isAnyTtsEnabled = basicEnabled || aiEnabled
        const basicEnabled = enabled && engineType === 'gtts';
        const aiEnabled = enabled && (engineType === 'cloud' || engineType === 'local');
        return basicEnabled || aiEnabled;
    }, [ttsStatusData]);

    // 🔄 СИНХРОНИЗАЦИЯ: Используем React Query для синхронизации Drops настроек с DropsMainPage
    // Получаем общий конфиг (без platform параметра)
    const { data: dropsConfigData } = useQuery({
        queryKey: ['drops-config', channelName],
        queryFn: async () => {
            if (!channelName) return null;
            const response = await botService.get(`/api/drops/config/${channelName}`);
            const data = response.data?.success ? response.data.data : null;
            // 🚀 ANTI-FLASH: Сохраняем в кэш
            if (data) {
                setQueryCache(['drops-config', channelName], data);
            }
            return data;
        },
        enabled: isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 30000,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['drops-config', channelName]), // 🚀 ANTI-FLASH: Загружаем из кэша
    });

    // 🔄 СИНХРОНИЗАЦИЯ: Используем React Query для проверки наличия наград
    // ✅ ВАЖНО: Награды ОБЩИЕ для всех платформ, не нужно передавать platform
    const { data: rewardsData } = useQuery({
        queryKey: ['drops-rewards', channelName],
        queryFn: async () => {
            if (!channelName) return [];
            // ✅ Награды общие, platform игнорируется на бэкенде
            const response = await botService.get(`/api/drops/rewards/${channelName}?platform=twitch`);
            const data = response.data?.success ? (response.data.data || []) : [];
            // 🚀 ANTI-FLASH: Сохраняем в кэш
            if (data.length > 0) {
                setQueryCache(['drops-rewards', channelName], data);
            }
            return data;
        },
        enabled: isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 30000,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['drops-rewards', channelName]), // 🚀 ANTI-FLASH: Загружаем из кэша
    });

    // 🔄 СИНХРОНИЗАЦИЯ: Вычисляем состояния Drops из React Query данных
    // Шорткат показывает состояние если хотя бы одна платформа включена
    // ✅ ИСПОЛЬЗУЕМ ОПТИМИСТИЧНОЕ СОСТОЯНИЕ: Если есть локальное состояние - используем его, иначе данные из кэша
    // Важно: проверяем на undefined, а не на falsy, так как false - валидное значение
    const twitchStreakEnabled = optimisticStreakState?.twitch !== undefined 
        ? optimisticStreakState.twitch 
        : (dropsConfigData?.streak_enabled_twitch || false);
    const vkStreakEnabled = optimisticStreakState?.vk !== undefined
        ? optimisticStreakState.vk
        : (dropsConfigData?.streak_enabled_vk || false);
    const streakEnabled = twitchStreakEnabled || vkStreakEnabled;
    
    // ✅ СБРОС ОПТИМИСТИЧНОГО СОСТОЯНИЯ: Сбрасываем когда данные из кэша обновились и совпадают
    useEffect(() => {
        if (optimisticStreakState && dropsConfigData) {
            // Проверяем только те платформы, которые были обновлены в optimisticStreakState
            const twitchMatches = optimisticStreakState.twitch !== undefined 
                ? optimisticStreakState.twitch === (dropsConfigData.streak_enabled_twitch || false)
                : true; // Если не обновляли - считаем совпадающим
            const vkMatches = optimisticStreakState.vk !== undefined
                ? optimisticStreakState.vk === (dropsConfigData.streak_enabled_vk || false)
                : true; // Если не обновляли - считаем совпадающим
            
            // Сбрасываем только если все обновленные платформы совпадают
            if (twitchMatches && vkMatches) {
                setOptimisticStreakState(null);
            }
        }
    }, [dropsConfigData, optimisticStreakState]);
    const donationEnabledRaw = dropsConfigData?.donation_enabled || false;
    // 🚀 FIX: Donate drops активен только если включен И подключен DonationAlerts
    const donationEnabled = donationEnabledRaw && isDonationAlertsConnected;
    const mythicalEnabled = dropsConfigData?.mythical_enabled || false;
    const hasRewards = (rewardsData?.length || 0) > 0;

    // 🔄 СИНХРОНИЗАЦИЯ: Слушаем изменения Drops настроек от DropsMainPage (StreakSettings)
    // ✅ ИСПРАВЛЕНИЕ: Обрабатываем только события от других компонентов, не от себя
    useEffect(() => {
        let isProcessing = false; // Флаг для предотвращения обработки собственных событий
        
        const handleDropsConfigChange = (event) => {
            // ✅ ПРЕДОТВРАЩЕНИЕ ЦИКЛИЧЕСКИХ ОБНОВЛЕНИЙ: Пропускаем если мы сами обрабатываем изменение
            if (isProcessing) return;
            
            const { streak_enabled, donation_enabled, channel, platform: eventPlatform, source } = event.detail;
            if (channel === channelName) {
                // ✅ ОБРАБОТКА ИЗМЕНЕНИЙ ОТ ДРУГИХ КОМПОНЕНТОВ (StreakSettings)
                // Обновляем только если событие пришло от useDropsConfig (из StreakSettings)
                if (streak_enabled !== undefined && eventPlatform && source === 'useDropsConfig') {
                    const dbPlatformKey = eventPlatform === 'twitch' ? 'streak_enabled_twitch' : 'streak_enabled_vk';
                    const statePlatformKey = eventPlatform === 'twitch' ? 'twitch' : 'vk';
                    
                    isProcessing = true;
                    
                    // ✅ ОБНОВЛЯЕМ ЛОКАЛЬНОЕ СОСТОЯНИЕ: Для мгновенного отображения
                    setOptimisticStreakState(prev => {
                        const newState = prev ? { ...prev } : {};
                        newState[statePlatformKey] = streak_enabled;
                        return newState;
                    });
                    
                    // ✅ ОБНОВЛЯЕМ КЭШ: Кэш уже обновлен в useDropsConfig, но обновляем для консистентности
                    queryClient.setQueryData(['drops-config', channelName], (old) => {
                        if (!old) return old;
                        const updated = {
                            ...old,
                            [dbPlatformKey]: streak_enabled
                        };
                        return updated;
                    });
                    
                    // Сбрасываем флаг после небольшой задержки
                    setTimeout(() => {
                        isProcessing = false;
                    }, 100);
                } else if (donation_enabled !== undefined && source === 'useDropsConfig') {
                    isProcessing = true;
                    queryClient.setQueryData(['drops-config', channelName], (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            donation_enabled: donation_enabled
                        };
                    });
                    setTimeout(() => {
                        isProcessing = false;
                    }, 100);
                }
            }
        };

        window.addEventListener('drops-config-changed', handleDropsConfigChange);
        return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange);
    }, [channelName, queryClient]);

    const handleTtsToggle = async () => {
        if (isToggling) return;
        setIsToggling(true);
        
        try {
            const newState = !ttsState;
            if (newState) {
                await botService.post('/api/tts/enable');
                toast.success('Озвучка включена');
            } else {
                await botService.post('/api/tts/disable');
                toast.success('Озвучка отключена');
            }
            
            // 🔄 СИНХРОНИЗАЦИЯ: Инвалидируем React Query кэш для синхронизации с TtsMainPage
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            
            // Отправляем событие для других компонентов
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: newState } 
            }));
        } catch (error) {
            logger.error('Error toggling TTS:', error);
            toast.error('Ошибка переключения озвучки');
        } finally {
            setIsToggling(false);
        }
    };

    const handleStreakToggle = async () => {
        if (isToggling || !channelName) return;
        
        // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем АКТУАЛЬНОЕ состояние с учетом optimisticStreakState
        // Это предотвращает race condition при быстрых кликах
        const currentTwitchStreakEnabled = optimisticStreakState?.twitch !== undefined 
            ? optimisticStreakState.twitch 
            : (dropsConfigData?.streak_enabled_twitch || false);
        const currentVkStreakEnabled = optimisticStreakState?.vk !== undefined
            ? optimisticStreakState.vk
            : (dropsConfigData?.streak_enabled_vk || false);
        const currentAnyStreakEnabled = currentTwitchStreakEnabled || currentVkStreakEnabled;
        
        // ✅ СИНХРОННАЯ ПРОВЕРКА: Проверяем награды ДО включения стрика
        const currentRewards = rewardsData || getQueryCache(['drops-rewards', channelName]) || [];
        const currentHasRewards = currentRewards.length > 0;
        
        // ✅ Проверяем награды только при ВКЛЮЧЕНИИ стрика (не при выключении)
        if (!currentAnyStreakEnabled && !currentHasRewards) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"', {
                description: 'Перейдите в Drops → Награды',
                duration: 4000,
                action: {
                    label: 'Перейти',
                    onClick: () => navigate('/dashboard/drops?tab=rewards')
                }
            });
            return;
        }
        
        setIsToggling(true);
        
        try {
            // ✅ Переключаем обе платформы одновременно синхронно
            // Используем АКТУАЛЬНОЕ состояние для определения нового значения
            const newState = !currentAnyStreakEnabled;
            const newTwitchState = integrations.twitch?.enabled ? newState : currentTwitchStreakEnabled;
            const newVkState = integrations.vk?.enabled ? newState : currentVkStreakEnabled;
            const payload = {
                streak_enabled_twitch: newTwitchState,
                streak_enabled_vk: newVkState
            };
            
            // ✅ ОПТИМИСТИЧНОЕ СОСТОЯНИЕ: Устанавливаем локальное состояние для мгновенного отображения
            setOptimisticStreakState({
                twitch: newTwitchState,
                vk: newVkState
            });
            
            // ✅ ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ КЭША: Обновляем кэш ДО запроса
            queryClient.setQueryData(['drops-config', channelName], (old) => {
                if (!old) return { ...payload };
                return {
                    ...old,
                    ...payload
                };
            });
                
            // Выполняем запрос к серверу
            const response = await botService.put(`/api/drops/config/${channelName}`, payload);
            
            // ✅ ПОСЛЕ УСПЕШНОГО ОТВЕТА: Обновляем кэш данными с сервера
            if (response.data?.success && response.data?.data) {
                queryClient.setQueryData(['drops-config', channelName], response.data.data);
                setQueryCache(['drops-config', channelName], response.data.data);
            }
            
            toast.success(newState ? 'Стрик включен для всех платформ' : 'Стрик отключен для всех платформ');
            
            // ✅ СИНХРОНИЗАЦИЯ: Отправляем события для синхронизации с StreakSettings
            // Используем source='QuickActionsBar' чтобы StreakSettings знал, что изменение пришло от QuickActionsBar
            // StreakSettings должен обновить свое локальное состояние, но не должен отправлять события обратно
            if (integrations.twitch?.enabled) {
                window.dispatchEvent(new CustomEvent('drops-config-changed', {
                    detail: { 
                        streak_enabled: newState, 
                        channel: channelName, 
                        platform: 'twitch',
                        source: 'QuickActionsBar'
                    }
                }));
            }
            if (integrations.vk?.enabled) {
                window.dispatchEvent(new CustomEvent('drops-config-changed', {
                    detail: { 
                        streak_enabled: newState, 
                        channel: channelName, 
                        platform: 'vk',
                        source: 'QuickActionsBar'
                    }
                }));
            }
            
        } catch (error) {
            logger.error('Error toggling streak:', error);
            toast.error('Ошибка переключения стрика');
            
            // ✅ ОТКАТ: Восстанавливаем предыдущее состояние из кэша
            // Получаем предыдущее состояние из React Query кэша
            const previousConfig = queryClient.getQueryData(['drops-config', channelName]);
            if (previousConfig) {
                setOptimisticStreakState({
                    twitch: previousConfig.streak_enabled_twitch || false,
                    vk: previousConfig.streak_enabled_vk || false
                });
            } else {
                // Если кэша нет - сбрасываем и перезагружаем
                setOptimisticStreakState(null);
                queryClient.invalidateQueries({ queryKey: ['drops-config', channelName] });
            }
        } finally {
            setIsToggling(false);
        }
    };

    const handleDonationToggle = async () => {
        if (isToggling || !channelName) return;
        
        // 🚀 FIX: Если DonationAlerts не подключен - перенаправляем на настройки
        // Работает как обычный переключатель: всегда кликабельный, но перенаправляет на подключение
        if (!isDonationAlertsConnected) {
            toast.info('Требуется подключение DonationAlerts', {
                description: 'Перенаправление на страницу настроек...',
                duration: 2000
            });
            // Перенаправляем на страницу настроек для подключения DonationAlerts
            setTimeout(() => {
                navigate('/dashboard/settings');
            }, 300);
            return;
        }
        
        // IMPORTANT: Check if rewards exist before enabling
        // 🚀 FIX: Используем donationEnabledRaw для проверки текущего состояния в БД
        if (!donationEnabledRaw && !hasRewards) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"', {
                description: 'Перейдите в Drops → Награды',
                duration: 4000
            });
            return;
        }
        
        setIsToggling(true);
        
        try {
            // 🚀 FIX: Используем donationEnabledRaw для определения нового состояния
            const newState = !donationEnabledRaw;
            await botService.put(`/api/drops/config/${channelName}?platform=${platform}`, {
                donation_enabled: newState
            });
            toast.success(newState ? 'Донаты включены' : 'Донаты отключены');
            
            // 🔄 СИНХРОНИЗАЦИЯ: Инвалидируем React Query кэш для синхронизации с DropsMainPage
            queryClient.invalidateQueries({ queryKey: ['drops-config', channelName] });
            
            // Dispatch event to sync with DropsMainPage
            window.dispatchEvent(new CustomEvent('drops-config-changed', {
                detail: { donation_enabled: newState, channel: channelName, platform }
            }));
        } catch (error) {
            logger.error('Error toggling donation:', error);
            toast.error('Ошибка переключения донатов');
        } finally {
            setIsToggling(false);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <Card className="border-gray-700">
            <div className="flex items-center justify-center gap-3 px-6 py-4">
                {/* TTS Button */}
                <button
                    onClick={handleTtsToggle}
                    disabled={isToggling}
                    className={`w-[160px] h-11 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        ttsState
                            ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-200 border border-gray-700'
                    }`}
                >
                    {ttsState ? <Volume2 className="w-4 h-4 flex-shrink-0" /> : <VolumeX className="w-4 h-4 flex-shrink-0" />}
                    <span className="whitespace-nowrap">TTS чата</span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                        ttsState 
                            ? 'bg-white/20 text-white' 
                            : 'bg-gray-700 text-gray-400'
                    }`}>
                        {ttsState ? 'ON' : 'OFF'}
                    </span>
                </button>

                {/* Streak Button */}
                {isDropsEnabled && (
                    <button
                        onClick={handleStreakToggle}
                        disabled={isToggling || !channelName}
                        className={`w-[160px] h-11 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                            streakEnabled
                                ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-200 border border-gray-700'
                        }`}
                    >
                        <Zap className="w-4 h-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">Стрик drops</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            streakEnabled 
                                ? 'bg-white/20 text-white' 
                                : 'bg-gray-700 text-gray-400'
                        }`}>
                            {streakEnabled ? 'ON' : 'OFF'}
                        </span>
                    </button>
                )}

                {/* Donation Button */}
                {isDropsEnabled && (
                    <button
                        onClick={handleDonationToggle}
                        disabled={isToggling || !channelName}
                        className={`w-[160px] h-11 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                            // 🚀 FIX: Кнопка всегда кликабельна, но показывает серый стиль если DonationAlerts не подключен
                            !isDonationAlertsConnected
                                ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 border border-gray-700 cursor-pointer'
                                : donationEnabled
                                    ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500'
                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-200 border border-gray-700'
                        }`}
                        title={!isDonationAlertsConnected ? 'Нажмите для подключения DonationAlerts' : ''}
                    >
                        <DollarSign className="w-4 h-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">Donate drops</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            donationEnabled 
                                ? 'bg-white/20 text-white' 
                                : 'bg-gray-700 text-gray-400'
                        }`}>
                            {/* 🚀 FIX: Показываем "OFF" если DonationAlerts не подключен, даже если donationEnabledRaw = true */}
                            {(!isDonationAlertsConnected || !donationEnabled) ? 'OFF' : 'ON'}
                        </span>
                    </button>
                )}
            </div>
        </Card>
    );
};

export default QuickActionsBar;
