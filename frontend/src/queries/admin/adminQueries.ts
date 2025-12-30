/**
 * Admin Queries - централизованные React Query queries для Admin
 */
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

import { adminService } from '../../services/api/services/adminService';
import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type { ApiResponse } from '../../types';
import type { AxiosError } from 'axios';

/**
 * Получить список администраторов
 */
export const useAdminList = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.admin.list(),
    queryFn: () => unwrapResponse(adminService.getAdminList()),
    staleTime: 5 * 60 * 1000, // 5 минут - список админов редко меняется
    gcTime: 30 * 60 * 1000, // 30 минут
    retry: 1,
    ...options,
  });
};

