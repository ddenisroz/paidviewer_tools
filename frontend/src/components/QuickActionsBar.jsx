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
            return response.data?.success ? response.data.data : null;
        },
        enabled: isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 30000,
        staleTime: 60000,
    });

    // 🔄 СИНХРОНИЗАЦИЯ: Используем React Query для проверки наличия наград
    const { data: rewardsData } = useQuery({
        queryKey: ['drops-rewards', channelName, platform],
        queryFn: async () => {
            if (!channelName) return [];
            const response = await botService.get(`/api/drops/rewards/${channelName}?platform=${platform}`);
            return response.data?.success ? (response.data.data || []) : [];
        },
        enabled: isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 30000,
        staleTime: 60000,
    });

    // 🔄 СИНХРОНИЗАЦИЯ: Вычисляем состояния Drops из React Query данных
    // Шорткат показывает состояние если хотя бы одна платформа включена
    const twitchStreakEnabled = dropsConfigData?.streak_enabled_twitch || false;
    const vkStreakEnabled = dropsConfigData?.streak_enabled_vk || false;
    const streakEnabled = twitchStreakEnabled || vkStreakEnabled;
    const donationEnabledRaw = dropsConfigData?.donation_enabled || false;
    // 🚀 FIX: Donate drops активен только если включен И подключен DonationAlerts
    const donationEnabled = donationEnabledRaw && isDonationAlertsConnected;
    const mythicalEnabled = dropsConfigData?.mythical_enabled || false;
    const hasRewards = (rewardsData?.length || 0) > 0;

    // 🔄 СИНХРОНИЗАЦИЯ: Слушаем изменения Drops настроек от DropsMainPage
    useEffect(() => {
        const handleDropsConfigChange = (event) => {
            const { streak_enabled, donation_enabled, channel, platform: eventPlatform } = event.detail;
            if (channel === channelName) {
                // Инвалидируем кэш для обновления данных (общий конфиг)
                queryClient.invalidateQueries({ queryKey: ['drops-config', channelName] });
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
        
        // IMPORTANT: Check if rewards exist before enabling streak
        const twitchStreakEnabled = dropsConfigData?.streak_enabled_twitch || false;
        const vkStreakEnabled = dropsConfigData?.streak_enabled_vk || false;
        const anyStreakEnabled = twitchStreakEnabled || vkStreakEnabled;
        
        if (!anyStreakEnabled && !hasRewards) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"', {
                description: 'Перейдите в Drops → Награды',
                duration: 4000
            });
            return;
        }
        
        setIsToggling(true);
        
        try {
            // Переключаем обе платформы одновременно
            const newState = !anyStreakEnabled;
            const payload = {
                streak_enabled_twitch: integrations.twitch?.enabled ? newState : (dropsConfigData?.streak_enabled_twitch || false),
                streak_enabled_vk: integrations.vk?.enabled ? newState : (dropsConfigData?.streak_enabled_vk || false)
            };
                
            await botService.put(`/api/drops/config/${channelName}`, payload);
            toast.success(newState ? 'Стрик включен для всех платформ' : 'Стрик отключен для всех платформ');
            
            // 🔄 СИНХРОНИЗАЦИЯ: Инвалидируем React Query кэш для синхронизации с DropsMainPage
            queryClient.invalidateQueries({ queryKey: ['drops-config', channelName] });
            
            // Dispatch events для обеих платформ
            if (integrations.twitch?.enabled) {
                window.dispatchEvent(new CustomEvent('drops-config-changed', {
                    detail: { streak_enabled: newState, channel: channelName, platform: 'twitch' }
                }));
            }
            if (integrations.vk?.enabled) {
                window.dispatchEvent(new CustomEvent('drops-config-changed', {
                    detail: { streak_enabled: newState, channel: channelName, platform: 'vk' }
                }));
            }
        } catch (error) {
            logger.error('Error toggling streak:', error);
            toast.error('Ошибка переключения стрика');
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
