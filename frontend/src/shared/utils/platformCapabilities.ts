import type { MainIntegrationPlatform, PlatformCapabilityFlags, PlatformCapabilityMap, PlatformConfig } from '@/types';

const emptyCapabilities = (): PlatformCapabilityFlags => ({
    roles: false,
    badges: false,
    reply_context: false,
    mention_context: false,
    moderation_actions: false,
    rewards: false,
    bot_status: false,
    supported_roles: [],
    moderation_actions_available: [],
});

export const DEFAULT_PLATFORM_CAPABILITIES: PlatformCapabilityMap = {
    twitch: {
        roles: true,
        badges: true,
        reply_context: true,
        mention_context: true,
        moderation_actions: true,
        rewards: true,
        bot_status: true,
        supported_roles: ['owner', 'moderator', 'vip', 'subscriber', 'viewer'],
        moderation_actions_available: ['timeout', 'ban', 'mod', 'vip'],
    },
    vk: {
        roles: true,
        badges: true,
        reply_context: true,
        mention_context: true,
        moderation_actions: false,
        rewards: true,
        bot_status: true,
        supported_roles: ['owner', 'moderator', 'viewer'],
        moderation_actions_available: [],
    },
};

export const buildPlatformCapabilityMap = (platforms: PlatformConfig[] | undefined): PlatformCapabilityMap => {
    const next: PlatformCapabilityMap = {
        twitch: { ...DEFAULT_PLATFORM_CAPABILITIES.twitch },
        vk: { ...DEFAULT_PLATFORM_CAPABILITIES.vk },
    };

    for (const platform of platforms || []) {
        const platformName = platform.name as MainIntegrationPlatform;
        if (!(platformName in next)) {
            continue;
        }

        next[platformName] = {
            ...emptyCapabilities(),
            ...next[platformName],
            ...(platform.capabilities || {}),
            supported_roles: Array.isArray(platform.capabilities?.supported_roles)
                ? platform.capabilities.supported_roles
                : next[platformName].supported_roles,
            moderation_actions_available: Array.isArray(platform.capabilities?.moderation_actions_available)
                ? platform.capabilities.moderation_actions_available
                : next[platformName].moderation_actions_available,
        };
    }

    return next;
};
