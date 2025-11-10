/**
 * Admin Queries - централизованные React Query queries для Admin
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { adminService } from '../../services/api/services/adminService';
import { logger } from '../../utils/prodLogger';

/**
 * Получить список администраторов
 */
export const useAdminList = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.admin.list(),
    queryFn: () => adminService.getAdminList(),
    staleTime: 5 * 60 * 1000, // 5 минут - список админов редко меняется
    gcTime: 30 * 60 * 1000, // 30 минут
    retry: 1,
    onError: (error) => {
      logger.error('Error fetching admin list:', error);
    },
    ...options,
  });
};

