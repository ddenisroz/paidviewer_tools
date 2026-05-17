export type MainIntegrationPlatform = 'twitch' | 'vk';

export interface PlatformCapabilityFlags {
    roles: boolean;
    badges: boolean;
    reply_context: boolean;
    mention_context: boolean;
    moderation_actions: boolean;
    rewards: boolean;
    bot_status: boolean;
    supported_roles: string[];
    moderation_actions_available: string[];
}

export interface PlatformConfig {
    name: string;
    displayName: string;
    supportsOAuth: boolean;
    supportsChat: boolean;
    supportsTts: boolean;
    supportsPoints: boolean;
    supportsCategories: boolean;
    color: string;
    capabilities: PlatformCapabilityFlags;
}

export interface PlatformConfigResponse {
    platforms: PlatformConfig[];
}

export type PlatformCapabilityMap = Record<MainIntegrationPlatform, PlatformCapabilityFlags>;
