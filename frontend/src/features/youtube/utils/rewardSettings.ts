import type { YoutubeSettings } from '@/types/youtube';

export interface YoutubeRewardState {
    requestsRewardTwitchEnabled: boolean;
    requestsRewardVkEnabled: boolean;
    requestsRewardTwitchId: string;
    requestsRewardVkId: string;
}

const normalizeOptionalString = (value: string | null | undefined): string => value?.trim() || '';

export const resolveYoutubeRewardState = (settings: YoutubeSettings): YoutubeRewardState => {
    const legacyPlatform = settings.requests_reward_platform === 'vk' ? 'vk' : 'twitch';
    const legacyEnabled = settings.requests_reward_enabled ?? false;
    const legacyId = normalizeOptionalString(settings.requests_reward_id);

    const requestsRewardTwitchEnabled =
        settings.requests_reward_twitch_enabled ?? (legacyEnabled && legacyPlatform === 'twitch');
    const requestsRewardVkEnabled = settings.requests_reward_vk_enabled ?? (legacyEnabled && legacyPlatform === 'vk');
    const requestsRewardTwitchId =
        normalizeOptionalString(settings.requests_reward_twitch_id) || (legacyPlatform === 'twitch' ? legacyId : '');
    const requestsRewardVkId =
        normalizeOptionalString(settings.requests_reward_vk_id) || (legacyPlatform === 'vk' ? legacyId : '');

    return {
        requestsRewardTwitchEnabled,
        requestsRewardVkEnabled,
        requestsRewardTwitchId,
        requestsRewardVkId,
    };
};

export const buildYoutubeRewardPayload = (
    rewardState: YoutubeRewardState
): Pick<
    YoutubeSettings,
    | 'requests_reward_enabled'
    | 'requests_reward_id'
    | 'requests_reward_platform'
    | 'requests_reward_twitch_enabled'
    | 'requests_reward_twitch_id'
    | 'requests_reward_vk_enabled'
    | 'requests_reward_vk_id'
> => {
    const requestsRewardPlatform =
        rewardState.requestsRewardVkEnabled && !rewardState.requestsRewardTwitchEnabled ? 'vk' : 'twitch';
    const requestsRewardId =
        requestsRewardPlatform === 'vk'
            ? normalizeOptionalString(rewardState.requestsRewardVkId)
            : normalizeOptionalString(rewardState.requestsRewardTwitchId);

    return {
        requests_reward_enabled: rewardState.requestsRewardTwitchEnabled || rewardState.requestsRewardVkEnabled,
        requests_reward_id: requestsRewardId || null,
        requests_reward_platform: requestsRewardPlatform,
        requests_reward_twitch_enabled: rewardState.requestsRewardTwitchEnabled,
        requests_reward_twitch_id: normalizeOptionalString(rewardState.requestsRewardTwitchId) || null,
        requests_reward_vk_enabled: rewardState.requestsRewardVkEnabled,
        requests_reward_vk_id: normalizeOptionalString(rewardState.requestsRewardVkId) || null,
    };
};
