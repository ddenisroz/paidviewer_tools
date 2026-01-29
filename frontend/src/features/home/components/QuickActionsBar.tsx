// src/components/QuickActionsBar.tsx
import React from 'react';

import { DollarSign, Volume2, VolumeX, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useQuickActionsLogic } from '@/features/home/hooks/useQuickActionsLogic';
import { Card } from '@/shared/components/ui/card';


import ActionButton from './quickactions/ActionButton';
import { useQuickActionsHandlers } from './quickactions/useQuickActionsHandlers';

const QuickActionsBar: React.FC = () => {
    const navigate = useNavigate();
    const logic = useQuickActionsLogic();

    const handlers = useQuickActionsHandlers({
        channelName: logic.channelName,
        platform: logic.platform,
        isToggling: logic.isToggling,
        setIsToggling: logic.setIsToggling,
        isDonationAlertsConnected: logic.isDonationAlertsConnected,
        donationEnabledRaw: logic.donationEnabledRaw,
        hasRewards: logic.hasRewards,
        optimisticStreakState: logic.optimisticStreakState,
        setOptimisticStreakState: logic.setOptimisticStreakState,
        dropsConfigData: logic.dropsConfigData,
        rewardsData: logic.rewardsData,
        updateDropsConfigMutation: logic.updateDropsConfigMutation,
        queryClient: logic.queryClient,
        integrations: logic.integrations
    });

    const handleTtsToggle = () => {
        if (!logic.isToggling) {
            logic.setIsToggling(true);
            logic.toggleTtsMutation.mutate(!logic.ttsState, {
                onSettled: () => logic.setIsToggling(false)
            });
        }
    };

    // Avoid noisy logs in normal usage

    if (!logic.isAuthenticated) return null;

    return (
        <Card className="card-glass transition-all duration-300">
            <div className="flex items-center justify-center gap-3 px-6 py-4">
                <ActionButton
                    icon={logic.ttsState ? Volume2 : VolumeX}
                    label="TTS чата"
                    isActive={logic.ttsState}
                    onClick={handleTtsToggle}
                />

                {logic.isDropsEnabled && (
                    <ActionButton
                        icon={Zap}
                        label="Стрик drops"
                        isActive={logic.streakEnabled}
                        onClick={handlers.handleStreakToggle}
                    />
                )}

                {logic.isDropsEnabled && (
                    <ActionButton
                        icon={DollarSign}
                        label="Donate drops"
                        isActive={logic.donationEnabled}
                        onClick={handlers.handleDonationToggle}
                    />
                )}
            </div>
        </Card>
    );
};

export default QuickActionsBar;
