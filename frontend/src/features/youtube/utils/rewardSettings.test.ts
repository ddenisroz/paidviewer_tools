import { describe, expect, it } from 'vitest';

import { buildYoutubeRewardPayload, resolveYoutubeRewardState } from './rewardSettings';

describe('youtube reward settings helpers', () => {
    it('resolves per-platform reward state from legacy-only payloads', () => {
        const rewardState = resolveYoutubeRewardState({
            playback_mode: 'browser',
            volume_level: 100,
            requests_reward_enabled: true,
            requests_reward_platform: 'vk',
            requests_reward_id: 'VK Reward',
        });

        expect(rewardState).toEqual({
            requestsRewardTwitchEnabled: false,
            requestsRewardVkEnabled: true,
            requestsRewardTwitchId: '',
            requestsRewardVkId: 'VK Reward',
        });
    });

    it('builds a compat payload from canonical reward state', () => {
        const payload = buildYoutubeRewardPayload({
            requestsRewardTwitchEnabled: true,
            requestsRewardVkEnabled: false,
            requestsRewardTwitchId: 'tw_reward',
            requestsRewardVkId: 'vk_reward',
        });

        expect(payload).toEqual({
            requests_reward_enabled: true,
            requests_reward_id: 'tw_reward',
            requests_reward_platform: 'twitch',
            requests_reward_twitch_enabled: true,
            requests_reward_twitch_id: 'tw_reward',
            requests_reward_vk_enabled: false,
            requests_reward_vk_id: 'vk_reward',
        });
    });
});
