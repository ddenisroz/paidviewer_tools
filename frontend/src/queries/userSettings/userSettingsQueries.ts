/**
 * User Settings Queries - централизованные React Query queries для User Settings
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { userSettingsService } from '@/services/api/services/userSettingsService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';

import type { ApiResponse } from '../../types';
import type { AxiosError } from 'axios';

// User settings type
interface UserSettings {
    [key: string]: unknown;
}

/**
 * Получить настройки пользователя
 */
export const useUserSettings = (options?: Omit<UseQueryOptions<UserSettings, AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery<UserSettings, AxiosError>({
        queryKey: queryKeys.userSettings.settings(),
        queryFn: async () => {
            const response = await userSettingsService.getUserSettings();
            const data = response.data as ApiResponse<UserSettings>;
            return (data?.data || data) as UserSettings;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
        ...options,
    });
};

/**
 * Сохранить настройки пользователя
 */
export const useSaveUserSettings = (
    options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, { previousSettings?: UserSettings }>
) => {
    const queryClient = useQueryClient();

    return useMutation<ApiResponse, AxiosError, Record<string, unknown>, { previousSettings?: UserSettings }>({
        mutationFn: async (settings: Record<string, unknown>) => {
            const response = await userSettingsService.saveUserSettings(settings);
            return response.data;
        },
        onMutate: async (newSettings: Record<string, unknown>) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.userSettings.settings() });
            const previousSettings = queryClient.getQueryData<UserSettings>(queryKeys.userSettings.settings());

            queryClient.setQueryData<UserSettings>(queryKeys.userSettings.settings(), (old) => ({
                ...old,
                ...newSettings,
            }));

            return { previousSettings };
        },
        onSuccess: (response) => {
            const data = response as ApiResponse<UserSettings>;
            const settings = data?.data || response;
            queryClient.setQueryData(queryKeys.userSettings.settings(), settings);
            if (!options?.onSuccess) {
                toast.success('Настройки сохранены');
            }
        },
        onError: (error: AxiosError, _newSettings, context) => {
            if (context?.previousSettings) {
                queryClient.setQueryData(queryKeys.userSettings.settings(), context.previousSettings);
            }
            logger.error('Error saving user settings:', error);
            if (!options?.onError) {
                const errorData = error.response?.data as Record<string, unknown> | undefined;
                const errorMessage = (errorData?.detail ||
                    errorData?.message ||
                    'Не удалось сохранить настройки') as string;
                toast.error(errorMessage);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.userSettings.settings() });
        },
        ...options,
    });
};
