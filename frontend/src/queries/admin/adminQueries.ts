/**
 * Admin Queries - централизованные React Query queries для Admin
 */
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { API_BASE_URL } from '@/constants';
import { adminService } from '@/services/api/services/adminService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type { ApiResponse } from '../../types';
import type { AxiosError } from 'axios';

export interface BotTokenStatus {
  success: boolean;
  configured: boolean;
  bot_login?: string;
  bot_user_id?: string;
  expires_at?: string;
  days_left?: number;
  needs_refresh?: boolean;
  has_refresh_token?: boolean;
  message?: string;
}

/**
 * Получить список администраторов
 */
export const useAdminList = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: queryKeys.admin.list(),
    queryFn: () => unwrapResponse(adminService.getAdminList()),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    ...options,
  });
};

/**
 * Получить статус токена бота
 */
export const useBotTokenStatusQuery = () => {
  return useQuery<BotTokenStatus | null>({
    queryKey: ['admin', 'bot-token-status'],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/bot/token-status`, {
          credentials: 'include',
        });

        if (response.ok) {
          return await response.json();
        } else if (response.status === 403) {
          return null;
        }
        throw new Error('Failed to fetch bot token status');
      } catch (error) {
        logger.error('Error fetching bot token status:', error);
        throw error;
      }
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
};

/**
 * Обновить токен бота
 */
export const useRefreshBotTokenMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message?: string }, Error>({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/bot/refresh-token`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка обновления токена');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bot-token-status'] });
      toast.success(data.message || 'Токен бота обновлен');
    },
    onError: (error) => {
      logger.error('Error refreshing token:', error);
      toast.error(error.message || 'Ошибка обновления токена');
    },
  });
};
