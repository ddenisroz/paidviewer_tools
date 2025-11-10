/**
 * Auth Queries - централизованные React Query queries для Auth
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { authService } from '../../services/api/services/authService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

/**
 * Получить статус аутентификации
 */
export const useAuthStatus = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.auth.user(),
    queryFn: async () => {
      const response = await authService.getAuthStatus();
      return response.data;
    },
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Не повторяем запрос при 401/403 (пользователь не авторизован)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
};

/**
 * Выйти из системы
 */
export const useLogout = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Очищаем весь кэш при выходе
      queryClient.clear();
      // Очищаем localStorage
      localStorage.removeItem('cached_user');
      if (!options.onSuccess) {
        toast.success('Вы вышли из системы');
      }
    },
    onError: (error) => {
      logger.error('Error logging out:', error);
      if (!options.onError) {
        toast.error('Ошибка выхода из системы');
      }
    },
    ...options,
  });
};

