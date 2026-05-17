// src/utils/platformHelpers.ts

interface Integrations {
    twitch?: {
        enabled: boolean;
        username?: string | null;
    };
    vk?: {
        enabled: boolean;
        username?: string | null;
    };
    donationalerts?: {
        enabled: boolean;
        username?: string | null;
    };
}

/**
 * Check if platform is enabled
 */
export function isPlatformEnabled(integrations: Integrations, platform: 'twitch' | 'vk' | 'donationalerts'): boolean {
    return integrations?.[platform]?.enabled || false;
}

/**
 * Check if chat is enabled for platform on home page
 */
export function isChatEnabled(integrations: Integrations, platform: 'twitch' | 'vk', isOnHomePage: boolean): boolean {
    if (!isOnHomePage) return false;
    return isPlatformEnabled(integrations, platform);
}

/**
 * Get primary platform
 */
export function getPrimaryPlatform(integrations: Integrations): 'twitch' | 'vk' {
    return isPlatformEnabled(integrations, 'twitch') ? 'twitch' : 'vk';
}

/**
 * Get channel name from integrations or user
 */
export function getChannelName(
    integrations: Integrations,
    user?: {
        twitch_username?: string;
        vk_username?: string;
        username?: string;
    }
): string {
    return (
        integrations.twitch?.username ||
        integrations.vk?.username ||
        user?.twitch_username ||
        user?.vk_username ||
        user?.username ||
        ''
    );
}

/**
 * Check if drops are enabled
 */
export function areDropsEnabled(integrations: Integrations): boolean {
    return isPlatformEnabled(integrations, 'twitch') || isPlatformEnabled(integrations, 'vk');
}

/**
 * Check if any integrations are enabled
 */
export function hasAnyIntegrations(integrations: Integrations): boolean {
    return isPlatformEnabled(integrations, 'twitch') || isPlatformEnabled(integrations, 'vk');
}

/**
 * Check if integrations just became enabled
 */
export function didIntegrationsEnable(
    integrations: Integrations,
    prevIntegrations: { twitch: boolean; vk: boolean }
): boolean {
    const twitchEnabled = isPlatformEnabled(integrations, 'twitch');
    const vkEnabled = isPlatformEnabled(integrations, 'vk');

    return (twitchEnabled && !prevIntegrations.twitch) || (vkEnabled && !prevIntegrations.vk);
}
