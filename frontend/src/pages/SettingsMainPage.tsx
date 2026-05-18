import React, { useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import { useDonationAlerts } from '@/context/DonationAlertsContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { getOAuthErrorMessage, getOAuthLinkSuccessMessage } from '@/features/auth/utils/oauthFeedback';
import SettingsAccessCard from '@/pages/settings/components/SettingsAccessCard';
import SettingsDashboard from '@/pages/settings/components/SettingsDashboard';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

const MAIN_PLATFORM_REQUIRED_MESSAGE = 'Сначала подключите хотя бы одну основную платформу: Twitch или VK Live.';

function buildSettingsAuthMessages(searchParams: URLSearchParams): {
    authErrorMessage: string | null;
    authSuccessMessage: string | null;
} {
    return {
        authErrorMessage: getOAuthErrorMessage(searchParams.get('platform'), searchParams.get('auth_error')),
        authSuccessMessage:
            searchParams.get('success') === '1' ? getOAuthLinkSuccessMessage(searchParams.get('auth_link')) : null,
    };
}

function redirectToPlatformAuth(platform: 'twitch' | 'vk'): void {
    const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, `/auth/${platform}/login`);
    if (!safeUrl) {
        logger.error('[SETTINGS] Blocked unsafe platform auth redirect URL', { platform, API_BASE_URL });
        return;
    }

    window.location.href = safeUrl;
}

function createPlatformToggleHandler(
    platform: 'twitch' | 'vk',
    isEnabled: boolean | undefined,
    updateIntegration: (checked: boolean, onClose?: (() => void) | null) => Promise<void> | void
): (checked: boolean) => void {
    return (checked: boolean) => {
        if (checked && !isEnabled) {
            redirectToPlatformAuth(platform);
            return;
        }

        updateIntegration(checked, null);
    };
}

const SettingsMainPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated } = useAuth();
    const { integrations, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const {
        isConnected: daConnected,
        isLoading: daLoading,
        connect: daConnect,
        disconnect: daDisconnect,
    } = useDonationAlerts();
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const searchParams = new URLSearchParams(location.search);
    const { authErrorMessage, authSuccessMessage } = buildSettingsAuthMessages(searchParams);
    const hasMainIntegration = integrations.twitch?.enabled || integrations.vk?.enabled;
    const twitchLabel = integrations.twitch?.username || user?.twitch_username || 'Не подключено';
    const vkLabel = integrations.vk?.username || user?.vk_channel_name || user?.vk_username || 'Не подключено';
    const handleTwitchToggle = createPlatformToggleHandler(
        'twitch',
        integrations.twitch?.enabled,
        updateTwitchIntegration
    );
    const handleVkToggle = createPlatformToggleHandler('vk', integrations.vk?.enabled, updateVkIntegration);

    const handleDonationAlertsToggle = async (checked: boolean): Promise<void> => {
        if (!hasMainIntegration) {
            toast.error(MAIN_PLATFORM_REQUIRED_MESSAGE);
            return;
        }

        if (checked) {
            await daConnect();
            return;
        }

        await daDisconnect();
    };

    if (!isAuthenticated) {
        return <SettingsAccessCard onLogin={() => navigate('/login')} />;
    }

    return (
        <SettingsDashboard
            authErrorMessage={authErrorMessage}
            authSuccessMessage={authSuccessMessage}
            daConnected={daConnected}
            daLoading={daLoading}
            hasMainIntegration={hasMainIntegration}
            onCloseDeleteModal={() => setShowDeleteModal(false)}
            onDonationAlertsToggle={handleDonationAlertsToggle}
            onOpenDeleteModal={() => setShowDeleteModal(true)}
            onTwitchToggle={handleTwitchToggle}
            onVkToggle={handleVkToggle}
            showDeleteModal={showDeleteModal}
            twitchEnabled={integrations.twitch?.enabled || false}
            twitchLabel={twitchLabel}
            userId={user?.id}
            vkEnabled={integrations.vk?.enabled || false}
            vkLabel={vkLabel}
        />
    );
};

export default SettingsMainPage;
