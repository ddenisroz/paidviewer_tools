import { apiClient } from '../client';

import type { ApiResponse, PlatformConfigResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

export const platformService = {
    async getPlatformConfigs(): Promise<AxiosResponse<ApiResponse<PlatformConfigResponse>>> {
        return apiClient.get('/api/platforms/config');
    },
};
