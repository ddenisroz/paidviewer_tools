import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '@/queries/queryKeys';
import { dropsService } from '@/services/api/services/dropsService';
import { logger } from '@/shared/utils/prodLogger';

import type { DropsConfig } from '@/features/drops/types';
import type { ApiResponse } from '@/types/api';

/**
 * Хук для работы с конфигурацией drops
 * @deprecated Используйте useDropsConfig и useUpdateDropsConfig из queries/drops/dropsQueries
 * Оставлен для обратной совместимости с компонентами, использующими isInitialLoad и saveMutation
 */
export const useDropsConfig = (channelName: string | null | undefined) => {
    const queryClient = useQueryClient();
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const { data: config, isLoading } = useQuery<DropsConfig | null>({
        queryKey: queryKeys.drops.config(channelName),
        queryFn: async () => {
            if (!channelName) return null;
            const response = await dropsService.getConfig(channelName);
            const apiResponse = response.data as ApiResponse<DropsConfig>;
            return apiResponse?.success && apiResponse?.data ? apiResponse.data : null;
        },
        enabled: !!channelName,
        staleTime: 30000,
    });

    const saveMutation = useMutation({
        mutationFn: async (payload: Partial<DropsConfig>) => {
            if (!channelName) throw new Error('Channel name is required');
            return await dropsService.updateConfig(channelName, payload);
        },
        onMutate: async (payload: Partial<DropsConfig>) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.drops.config(channelName) });
            const previousConfig = queryClient.getQueryData<DropsConfig>(queryKeys.drops.config(channelName));
            queryClient.setQueryData(
                queryKeys.drops.config(channelName),
                (old: DropsConfig | undefined) =>
                    ({
                        ...old,
                        ...payload,
                    }) as DropsConfig
            );
            return { previousConfig };
        },
        onError: (err: Error, payload: Partial<DropsConfig>, context: { previousConfig?: DropsConfig } | undefined) => {
            if (context?.previousConfig) {
                queryClient.setQueryData(queryKeys.drops.config(channelName), context.previousConfig);
            }
            toast.error('Ошибка сохранения настроек');
            logger.error('Error saving drops config:', err);
        },
        onSuccess: (response, payload: Partial<DropsConfig>) => {
            // [OK] ОБНОВЛЕНИЕ КЭША: Обновляем кэш данными с сервера для надежности
            const apiResponse = response.data as ApiResponse<DropsConfig>;
            if (apiResponse?.success && apiResponse?.data) {
                queryClient.setQueryData(queryKeys.drops.config(channelName), apiResponse.data);
            }

            // [OK] СИНХРОНИЗАЦИЯ: Отправляем события для синхронизации с другими компонентами
            // [OK] ИСПРАВЛЕНИЕ: Добавляем source для предотвращения циклических обновлений
            if (payload.donation_enabled !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('drops-config-changed', {
                        detail: {
                            donation_enabled: payload.donation_enabled,
                            channel: channelName,
                            source: 'useDropsConfig',
                        },
                    })
                );
            }
            if (payload.streak_enabled_twitch !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('drops-config-changed', {
                        detail: {
                            streak_enabled: payload.streak_enabled_twitch,
                            channel: channelName,
                            platform: 'twitch',
                            source: 'useDropsConfig',
                        },
                    })
                );
            }
            if (payload.streak_enabled_vk !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('drops-config-changed', {
                        detail: {
                            streak_enabled: payload.streak_enabled_vk,
                            channel: channelName,
                            platform: 'vk',
                            source: 'useDropsConfig',
                        },
                    })
                );
            }
        },
        // [OK] УБРАНО: onSettled с invalidateQueries - не нужен, так как данные уже обновлены в onSuccess
        // Это предотвращает race condition и некорректное отображение статуса
    });

    return {
        config,
        isLoading,
        isInitialLoad,
        setIsInitialLoad,
        saveMutation,
    };
};
