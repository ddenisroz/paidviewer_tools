// src/hooks/useQuickActionsLogic.ts
import { useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useDropsConfig, useDropsRewards, useUpdateDropsConfig } from '../queries/drops/dropsQueries';
import { queryKeys } from '../queries/queryKeys';
import { useToggleTts, useTtsStatus } from '../queries/tts/ttsQueries';
import { getQueryCache, setQueryCache } from '../utils/queryPersist';

import type { DropsConfig } from '../types/drops';

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
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    const { isConnected: daConnected } = useDonationAlerts();
    
    const [isToggling, setIsToggling] = useState(false);
    const [optimisticStreakState, setOptimisticStreakState] = useState<OptimisticStreakState | null>(null);
    
    const channelName = useMemo(() => {
        return integrations.twitch?.username || integrations.vk?.username || user?.twitch_username || user?.vk_username || user?.username || '';
    }, [integrations.twitch?.username, integrations.vk?.username, user?.twitch_username, user?.vk_username, user?.username]);
    
    const platform = useMemo(() => {
        return integrations.twitch?.enabled ? 'twitch' : (integrations.vk?.enabled ? 'vk' : 'twitch');
    }, [integrations.twitch?.enabled, integrations.vk?.enabled]);
    
    const isDropsEnabled = useMemo(() => {
        return integrations.twitch?.enabled || integrations.vk?.enabled || (isGuest && user?.platform);
    }, [integrations.twitch?.enabled, integrations.vk?.enabled, isGuest, user?.platform]);
    
    const isDonationAlertsConnected = useMemo(() => {
        return integrations?.donationalerts?.enabled || daConnected || false;
    }, [integrations?.donationalerts?.enabled, daConnected]);
    
    useEffect(() => {
        setOptimisticStreakState(null);
    }, [channelName]);

    const { data: ttsStatusResponse } = useTtsStatus(null, {
        enabled: !!isAuthenticated,
        refetchInterval: 30000,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['tts-status']) || undefined,
    });
    
    useEffect(() => {
        if (ttsStatusResponse?.data) {
            setQueryCache(['tts-status'], ttsStatusResponse.data);
        }
    }, [ttsStatusResponse]);

    const ttsStatusData = ttsStatusResponse?.data;

    const toggleTtsMutation = useToggleTts({
        onSuccess: (response, enabled) => {
            if (response?.data) {
                setQueryCache(['tts-status'], response.data);
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled } 
            }));
        },
    });

    const ttsState = useMemo(() => {
        const statusData = ttsStatusData as TtsStatusData | undefined;
        if (!statusData) return false;
        const enabled = statusData.enabled || false;
        const engineType = statusData.engine_type || 'gtts';
        const basicEnabled = enabled && engineType === 'gtts';
        const aiEnabled = enabled && (engineType === 'cloud' || engineType === 'local');
        return basicEnabled || aiEnabled;
    }, [ttsStatusData]);

    const { data: dropsConfigData } = useDropsConfig(channelName, {
        enabled: !!isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 30000,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['drops-config', channelName]),
    });

    const { data: rewardsData } = useDropsRewards(channelName, {
        enabled: !!isAuthenticated && isDropsEnabled && !!channelName,
        refetchInterval: 30000,
        staleTime: 60000,
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

    const twitchStreakEnabled = optimisticStreakState?.twitch !== undefined 
        ? optimisticStreakState.twitch 
        : (dropsConfigData?.streak_enabled_twitch || false);
    const vkStreakEnabled = optimisticStreakState?.vk !== undefined
        ? optimisticStreakState.vk
        : (dropsConfigData?.streak_enabled_vk || false);
    const streakEnabled = twitchStreakEnabled || vkStreakEnabled;
    
    useEffect(() => {
        if (optimisticStreakState && dropsConfigData) {
            const twitchMatches = optimisticStreakState.twitch !== undefined 
                ? optimisticStreakState.twitch === (dropsConfigData.streak_enabled_twitch || false)
                : true;
            const vkMatches = optimisticStreakState.vk !== undefined
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
        integrations
    };
};
