// src/hooks/useQuickActionsLogic.ts
import { useEffect, useMemo, useState } from 'react';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { useDonationAlerts } from '@/context/DonationAlertsContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useDropsConfig, useDropsRewards, useUpdateDropsConfig } from '@/queries/drops/dropsQueries';
import { queryKeys } from '@/queries/queryKeys';
import { useToggleTts, useTtsStatus } from '@/queries/tts/ttsQueries';
import { getQueryCache, setQueryCache } from '@/shared/utils/queryPersist';

import type { DropsConfig } from '@/types/drops';

interface OptimisticStreakState {
    twitch?: boolean;
    vk?: boolean;
}

interface TtsStatusData {
    enabled?: boolean;
    engine_type?: string;
}

export const useQuickActionsLogic = () => {
    const queryClient = useQueryClient();
    const { isAuthenticated, user } = useAuth();
    const { integrations } = useIntegrations();
    const { isConnected: daConnected } = useDonationAlerts();

    const [isToggling, setIsToggling] = useState(false);
    const [optimisticStreakState, setOptimisticStreakState] = useState<OptimisticStreakState | null>(null);

    const channelName = useMemo(() => {
        return (
            integrations.twitch?.username ||
            integrations.vk?.username ||
            user?.twitch_username ||
            user?.vk_username ||
            user?.username ||
            ''
        );
    }, [
        integrations.twitch?.username,
        integrations.vk?.username,
        user?.twitch_username,
        user?.vk_username,
        user?.username,
    ]);

    const platform = useMemo(() => {
        return integrations.twitch?.enabled ? 'twitch' : integrations.vk?.enabled ? 'vk' : 'twitch';
    }, [integrations.twitch?.enabled, integrations.vk?.enabled]);

    const isDropsEnabled = useMemo(() => {
        return integrations?.twitch?.enabled || integrations?.vk?.enabled;
    }, [integrations?.twitch?.enabled, integrations?.vk?.enabled]);

    const isDonationAlertsConnected = useMemo(() => {
        return integrations?.donationalerts?.enabled || daConnected || false;
    }, [integrations?.donationalerts?.enabled, daConnected]);

    useEffect(() => {
        setOptimisticStreakState(null);
    }, [channelName]);

    const { data: ttsStatusResponse } = useTtsStatus(null, {
        enabled: !!isAuthenticated,
        refetchInterval: 60000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        placeholderData: keepPreviousData,
        initialData: () => {
            // Validate cache structure before using
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cached = getQueryCache(queryKeys.tts.status(null) as any) as any;
            if (cached && typeof cached.enabled === 'boolean') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return { success: true, data: cached } as any;
            }
            // Ignore corrupted cache (e.g. {success: true})
            return undefined;
        },
    });

    // Optimistic local state for immediate UI feedback
    const [optimisticTtsState, setOptimisticTtsState] = useState<boolean | null>(null);

    // Track last known state to preserve during refetches
    const [lastKnownTtsState, setLastKnownTtsState] = useState<boolean | null>(null);

    useEffect(() => {
        if (ttsStatusResponse?.data) {
            const enabled = (ttsStatusResponse.data as TtsStatusData).enabled;
            setQueryCache(queryKeys.tts.status(null), ttsStatusResponse.data);
            // Update last known state
            if (typeof enabled === 'boolean') {
                setLastKnownTtsState(enabled);
            }
            // Reset optimistic state when real data arrives
            setOptimisticTtsState(null);
        }
    }, [ttsStatusResponse]);

    // Sync TTS state when changed from other components (e.g., Shift+T shortcut)
    useEffect(() => {
        const handleExternalTtsChange = (e: Event) => {
            const customEvent = e as CustomEvent<{ enabled: boolean }>;
            // Set optimistic state immediately for external changes too
            setOptimisticTtsState(customEvent.detail.enabled);
            // queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() }); // Redundant, handled by mutation onSuccess
        };
        window.addEventListener('tts-status-changed', handleExternalTtsChange);
        return () => window.removeEventListener('tts-status-changed', handleExternalTtsChange);
    }, [queryClient]);

    const ttsStatusData = ttsStatusResponse?.data;

    const toggleTtsMutation = useToggleTts({
        onMutate: (enabled: boolean) => {
            // Optimistic update - show new state immediately
            setOptimisticTtsState(enabled);
        },
        onSuccess: (_response, enabled) => {
            // Cache the correct structure with correct key
            const correctKey = queryKeys.tts.status(null);
            setQueryCache(correctKey, { enabled, listening_mode: 'website' });

            // Also update React Query cache directly to inform other components (like TtsContext)
            queryClient.setQueryData(correctKey, (old: unknown) => {
                const previous = old && typeof old === 'object' ? (old as { data?: Record<string, unknown> }) : {};

                return {
                    ...previous,
                    success: true,
                    data: { ...(previous.data || {}), enabled },
                };
            });

            queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
            window.dispatchEvent(
                new CustomEvent('tts-status-changed', {
                    detail: { enabled },
                })
            );
        },
        onError: () => {
            // Revert optimistic update on error
            setOptimisticTtsState(null);
        },
    });

    // Use optimistic state if set, otherwise use API state, fallback to last known state
    const ttsState = useMemo(() => {
        if (optimisticTtsState !== null) {
            return optimisticTtsState;
        }
        const statusData = ttsStatusData as TtsStatusData | undefined;
        if (statusData && typeof statusData.enabled === 'boolean') {
            return statusData.enabled;
        }
        // Fallback to last known state during refetches
        if (lastKnownTtsState !== null) {
            return lastKnownTtsState;
        }
        return false;
    }, [optimisticTtsState, ttsStatusData, lastKnownTtsState]);

    const { data: dropsConfigData } = useDropsConfig(channelName, {
        enabled: !!isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 120000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        staleTime: 120000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['drops-config', channelName]),
    });

    const { data: rewardsData } = useDropsRewards(channelName, {
        enabled: !!isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 120000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        staleTime: 120000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['drops-rewards', channelName]) || undefined,
    });

    useEffect(() => {
        if (dropsConfigData) {
            setQueryCache(['drops-config', channelName], dropsConfigData);
        }
    }, [dropsConfigData, channelName]);

    useEffect(() => {
        if (rewardsData && rewardsData.length > 0) {
            setQueryCache(['drops-rewards', channelName], rewardsData);
        }
    }, [rewardsData, channelName]);

    const updateDropsConfigMutation = useUpdateDropsConfig(channelName, {
        onSuccess: (_response) => {
            const typedResponse = _response as { data?: { data?: DropsConfig } } | undefined;
            if (typedResponse?.data?.data) {
                setQueryCache(['drops-config', channelName], typedResponse.data.data);
            }
        },
    });

    const twitchStreakEnabled =
        optimisticStreakState?.twitch !== undefined
            ? optimisticStreakState.twitch
            : dropsConfigData?.streak_enabled_twitch || false;
    const vkStreakEnabled =
        optimisticStreakState?.vk !== undefined
            ? optimisticStreakState.vk
            : dropsConfigData?.streak_enabled_vk || false;
    const streakEnabled = twitchStreakEnabled || vkStreakEnabled;

    useEffect(() => {
        if (optimisticStreakState && dropsConfigData) {
            const twitchMatches =
                optimisticStreakState.twitch !== undefined
                    ? optimisticStreakState.twitch === (dropsConfigData.streak_enabled_twitch || false)
                    : true;
            const vkMatches =
                optimisticStreakState.vk !== undefined
                    ? optimisticStreakState.vk === (dropsConfigData.streak_enabled_vk || false)
                    : true;

            if (twitchMatches && vkMatches) {
                setOptimisticStreakState(null);
            }
        }
    }, [dropsConfigData, optimisticStreakState]);

    const donationEnabledRaw = dropsConfigData?.donation_enabled || false;
    const donationEnabled = donationEnabledRaw && isDonationAlertsConnected;
    const hasRewards = (rewardsData?.length || 0) > 0;

    return {
        isAuthenticated,
        isToggling,
        setIsToggling,
        channelName,
        platform,
        isDropsEnabled,
        isDonationAlertsConnected,
        ttsState,
        streakEnabled,
        donationEnabled,
        donationEnabledRaw,
        hasRewards,
        toggleTtsMutation,
        updateDropsConfigMutation,
        optimisticStreakState,
        setOptimisticStreakState,
        dropsConfigData,
        rewardsData,
        queryClient,
        integrations,
    };
};
