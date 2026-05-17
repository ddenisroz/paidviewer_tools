/**
 * Auth Queries - централизованные React Query queries для Auth
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { authService } from '@/services/api/services/authService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';

import type { ApiResponse } from '../../types';
import type { AxiosError } from 'axios';

/**
 * Получить статус аутентификации
 */
export const useAuthStatus = <TData = ApiResponse>(
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError, TData>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<ApiResponse, AxiosError, TData>({
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
            if ((error as AxiosError)?.response?.status === 401 || (error as AxiosError)?.response?.status === 403) {
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
export const useLogout = (options?: UseMutationOptions<void, AxiosError, void>) => {
    const queryClient = useQueryClient();

    return useMutation<void, AxiosError, void>({
        mutationFn: () => authService.logout().then(() => undefined),
        onSuccess: () => {
            // Очищаем весь кэш при выходе
            queryClient.clear();
            // Очищаем localStorage
            localStorage.removeItem('cached_user');
            toast.success('Вы вышли из системы');
        },
        onError: (error) => {
            logger.error('Error logging out:', error);
            toast.error('Ошибка выхода из системы');
        },
        ...options,
    });
};

/**
 * Удалить аккаунт пользователя
 */
export const useDeleteAccount = (options?: UseMutationOptions<void, AxiosError, void>) => {
    const queryClient = useQueryClient();

    return useMutation<void, AxiosError, void>({
        mutationFn: () => authService.deleteAccount().then(() => undefined),
        onSuccess: () => {
            queryClient.clear(); // Очищаем весь кэш при удалении аккаунта
            toast.success('Аккаунт успешно удалён');
            // Перенаправляем на страницу логина через 2 секунды
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        },
        onError: (error) => {
            logger.error('Error deleting account:', error);
            const errorData = error?.response?.data as Record<string, unknown> | undefined;
            toast.error((errorData?.detail as string) || 'Ошибка удаления аккаунта');
        },
        ...options,
    });
};
