import type { MainIntegrationPlatform } from '@/types';

export type PlatformReleaseStage = 'ga' | 'beta';

export interface PlatformReleaseInfo {
    stage: PlatformReleaseStage;
    badgeLabel: string | null;
    helperText: string | null;
    isStable: boolean;
}

export type PlatformReleaseMap = Record<MainIntegrationPlatform, PlatformReleaseInfo>;

export const PLATFORM_RELEASES: PlatformReleaseMap = {
    twitch: {
        stage: 'ga',
        badgeLabel: null,
        helperText: null,
        isStable: true,
    },
    vk: {
        stage: 'ga',
        badgeLabel: null,
        helperText: null,
        isStable: true,
    },
};

export const getPlatformReleaseInfo = (platform: MainIntegrationPlatform): PlatformReleaseInfo =>
    PLATFORM_RELEASES[platform];
