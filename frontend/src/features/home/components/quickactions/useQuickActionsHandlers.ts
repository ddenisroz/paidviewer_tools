// src/components/quickactions/useQuickActionsHandlers.ts
import { useEffect } from 'react';

import { QueryClient, UseMutationResult } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';

import { queryKeys } from '@/queries/queryKeys';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { ApiResponse } from '@/types/api';
import type { DropsConfig } from '@/types/drops';

interface DropsConfigChangedEvent {
    detail: {
        streak_enabled?: boolean;
        donation_enabled?: boolean;
        channel: string;
        platform?: string;
        source?: string;
    };
}

interface UseQuickActionsHandlersProps {
    channelName: string;
    platform: string;
    isToggling: boolean;
    setIsToggling: (value: boolean) => void;
    isDonationAlertsConnected: boolean;
    donationEnabledRaw: boolean;
    hasRewards: boolean;
    optimisticStreakState: { twitch?: boolean; vk?: boolean } | null;
    setOptimisticStreakState: (value: { twitch?: boolean; vk?: boolean } | null) => void;
    dropsConfigData: DropsConfig | null | undefined;
    rewardsData: unknown[] | undefined;
    updateDropsConfigMutation: UseMutationResult<
        ApiResponse<unknown>,
        AxiosError,
        Partial<DropsConfig>,
        { previousConfig?: DropsConfig }
    >;
    queryClient: QueryClient;
    integrations: {
        twitch?: { enabled: boolean };
        vk?: { enabled: boolean };
    };
}

export const useQuickActionsHandlers = (props: UseQuickActionsHandlersProps) => {
    const navigate = useNavigate();
    const {
        channelName,
        platform,
        isToggling,
        setIsToggling,
        isDonationAlertsConnected,
        donationEnabledRaw,
        hasRewards,
        optimisticStreakState,
        setOptimisticStreakState,
        dropsConfigData,
        rewardsData,
        updateDropsConfigMutation,
        queryClient,
        integrations,
    } = props;

    useEffect(() => {
        let isProcessing = false;

        const handleDropsConfigChange = (event: Event) => {
            const customEvent = event as CustomEvent<DropsConfigChangedEvent['detail']>;
            if (isProcessing) return;

            const { streak_enabled, donation_enabled, channel, platform: eventPlatform, source } = customEvent.detail;
            if (channel === channelName) {
                if (streak_enabled !== undefined && eventPlatform && source === 'useDropsConfig') {
                    const dbPlatformKey = eventPlatform === 'twitch' ? 'streak_enabled_twitch' : 'streak_enabled_vk';
                    const statePlatformKey = eventPlatform === 'twitch' ? 'twitch' : 'vk';

                    isProcessing = true;

                    const currentState = optimisticStreakState;
                    const newState: { twitch?: boolean; vk?: boolean } = currentState ? { ...currentState } : {};
                    newState[statePlatformKey as 'twitch' | 'vk'] = streak_enabled;
                    setOptimisticStreakState(newState);

                    queryClient.setQueryData(queryKeys.drops.config(channelName), (old: DropsConfig | undefined) => {
                        if (!old) return old;
                        return { ...old, [dbPlatformKey]: streak_enabled };
                    });

                    setTimeout(() => {
                        isProcessing = false;
                    }, 100);
                } else if (donation_enabled !== undefined && source === 'useDropsConfig') {
                    isProcessing = true;
                    queryClient.setQueryData(queryKeys.drops.config(channelName), (old: DropsConfig | undefined) => {
                        if (!old) return old;
                        return { ...old, donation_enabled };
                    });
                    setTimeout(() => {
                        isProcessing = false;
                    }, 100);
                }
            }
        };

        window.addEventListener('drops-config-changed', handleDropsConfigChange);
        return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange);
    }, [channelName, queryClient, setOptimisticStreakState, dropsConfigData, optimisticStreakState]);

    const handleStreakToggle = () => {
        if (isToggling || !channelName || updateDropsConfigMutation.isPending) return;

        const currentTwitchStreakEnabled =
            optimisticStreakState?.twitch !== undefined
                ? optimisticStreakState.twitch
                : dropsConfigData?.streak_enabled_twitch || false;
        const currentVkStreakEnabled =
            optimisticStreakState?.vk !== undefined
                ? optimisticStreakState.vk
                : dropsConfigData?.streak_enabled_vk || false;
        const currentAnyStreakEnabled = currentTwitchStreakEnabled || currentVkStreakEnabled;

        const currentRewards = rewardsData || [];
        const currentHasRewards = Array.isArray(currentRewards) && currentRewards.length > 0;

        if (!currentAnyStreakEnabled && !currentHasRewards) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"', {
                description: 'Перейдите в Drops → Награды',
                duration: 4000,
            });
            return;
        }

        setIsToggling(true);

        const newState = !currentAnyStreakEnabled;
        const newTwitchState = integrations.twitch?.enabled ? newState : currentTwitchStreakEnabled;
        const newVkState = integrations.vk?.enabled ? newState : currentVkStreakEnabled;
        const payload = {
            streak_enabled_twitch: newTwitchState,
            streak_enabled_vk: newVkState,
        };

        setOptimisticStreakState({ twitch: newTwitchState, vk: newVkState });

        updateDropsConfigMutation.mutate(payload, {
            onSuccess: () => {
                toast.success(newState ? 'Стрик включен для всех платформ' : 'Стрик отключен для всех платформ');

                if (integrations.twitch?.enabled) {
                    window.dispatchEvent(
                        new CustomEvent('drops-config-changed', {
                            detail: {
                                streak_enabled: newState,
                                channel: channelName,
                                platform: 'twitch',
                                source: 'QuickActionsBar',
                            },
                        })
                    );
                }
                if (integrations.vk?.enabled) {
                    window.dispatchEvent(
                        new CustomEvent('drops-config-changed', {
                            detail: {
                                streak_enabled: newState,
                                channel: channelName,
                                platform: 'vk',
                                source: 'QuickActionsBar',
                            },
                        })
                    );
                }
            },
            onError: (error) => {
                logger.error('Error toggling streak:', error);
                toast.error('Ошибка переключения стрика');

                const previousConfig = queryClient.getQueryData(queryKeys.drops.config(channelName)) as
                    | DropsConfig
                    | undefined;
                if (previousConfig) {
                    setOptimisticStreakState({
                        twitch: previousConfig.streak_enabled_twitch || false,
                        vk: previousConfig.streak_enabled_vk || false,
                    });
                } else {
                    setOptimisticStreakState(null);
                    queryClient.invalidateQueries({ queryKey: queryKeys.drops.config(channelName) });
                }
            },
            onSettled: () => setIsToggling(false),
        });
    };

    const handleDonationToggle = () => {
        if (isToggling || !channelName || updateDropsConfigMutation.isPending) return;

        if (!isDonationAlertsConnected) {
            toast.info('Требуется подключение DonationAlerts', {
                description: 'Перенаправление на страницу настроек...',
                duration: 2000,
            });
            setTimeout(() => navigate('/dashboard/settings'), 300);
            return;
        }

        if (!donationEnabledRaw && !hasRewards) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"', {
                description: 'Перейдите в Drops → Награды',
                duration: 4000,
            });
            return;
        }

        setIsToggling(true);

        const newState = !donationEnabledRaw;
        updateDropsConfigMutation.mutate(
            { donation_enabled: newState },
            {
                onSuccess: () => {
                    toast.success(newState ? 'Донаты включены' : 'Донаты отключены');
                    window.dispatchEvent(
                        new CustomEvent('drops-config-changed', {
                            detail: {
                                donation_enabled: newState,
                                channel: channelName,
                                platform,
                                source: 'QuickActionsBar',
                            },
                        })
                    );
                },
                onError: (error) => {
                    logger.error('Error toggling donation:', error);
                    toast.error('Ошибка переключения донатов');
                },
                onSettled: () => setIsToggling(false),
            }
        );
    };

    return {
        handleStreakToggle,
        handleDonationToggle,
    };
};
