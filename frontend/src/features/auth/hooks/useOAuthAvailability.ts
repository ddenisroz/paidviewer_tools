import { useEffect, useState } from 'react';

import { platformService } from '@/services/api/services/platformService';
import { logger } from '@/shared/utils/prodLogger';

import type { ApiResponse, PlatformConfigResponse } from '@/types';

export type OAuthPlatform = 'twitch' | 'vk';
export type OAuthAvailability = Record<OAuthPlatform, boolean>;

const EMPTY_OAUTH_AVAILABILITY: OAuthAvailability = {
    twitch: false,
    vk: false,
};

const getOAuthAvailability = (
    payload: ApiResponse<PlatformConfigResponse> | PlatformConfigResponse
): OAuthAvailability => {
    const platforms =
        (payload as PlatformConfigResponse).platforms ||
        (payload as ApiResponse<PlatformConfigResponse>).data?.platforms ||
        [];

    return {
        twitch: platforms.some((platform) => platform.name === 'twitch' && platform.supportsOAuth),
        vk: platforms.some((platform) => platform.name === 'vk' && platform.supportsOAuth),
    };
};

export const useOAuthAvailability = (): OAuthAvailability | null => {
    const [oauthAvailability, setOAuthAvailability] = useState<OAuthAvailability | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadOAuthAvailability = async (): Promise<void> => {
            try {
                const response = await platformService.getPlatformConfigs();
                const availability = getOAuthAvailability(
                    response.data as ApiResponse<PlatformConfigResponse> | PlatformConfigResponse
                );
                if (isMounted) {
                    setOAuthAvailability(availability);
                }
            } catch (error) {
                logger.error('[LOGIN] Error loading OAuth platform config:', error);
                if (isMounted) {
                    setOAuthAvailability(EMPTY_OAUTH_AVAILABILITY);
                }
            }
        };

        loadOAuthAvailability();
        return () => {
            isMounted = false;
        };
    }, []);

    return oauthAvailability;
};
