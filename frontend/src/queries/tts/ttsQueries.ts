/**
 * TTS Queries - централизованные React Query queries для TTS
 */
import {
    QueryClient,
    useMutation,
    UseMutationOptions,
    useQuery,
    useQueryClient,
    UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { STORAGE_KEYS } from '@/constants';
import { ttsService } from '@/services/api/services/ttsService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type {
    ApiResponse,
    BlockedUser,
    FilteredWord,
    LocalTtsConfig,
    TtsSettings,
    TtsStatus,
    TtsVoice,
} from '../../types';
import type { AxiosError } from 'axios';

const isWrappedResponse = <T>(value: unknown): value is ApiResponse<T> =>
    Boolean(value) && typeof value === 'object' && 'success' in (value as Record<string, unknown>);

const patchExactApiCache = <T extends object>(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    patch: Partial<T>
): void => {
    queryClient.setQueryData(queryKey, (old: ApiResponse<T> | T | undefined) => {
        if (isWrappedResponse<T>(old)) {
            return {
                ...old,
                success: true,
                data: {
                    ...((old.data || {}) as T),
                    ...patch,
                },
            };
        }

        return {
            success: true,
            data: {
                ...((old || {}) as T),
                ...patch,
            },
        } as ApiResponse<T>;
    });
};

const mergeSettingsResponse = (
    current: ApiResponse<TtsSettings> | TtsSettings | undefined,
    response: ApiResponse<TtsSettings> | TtsSettings | undefined,
    submitted: Partial<TtsSettings>
): ApiResponse<TtsSettings> => {
    const currentData = isWrappedResponse<TtsSettings>(current)
        ? current.data || ({} as TtsSettings)
        : ((current || {}) as TtsSettings);
    const responseData = isWrappedResponse<TtsSettings>(response)
        ? response.data
        : response && typeof response === 'object' && !('success' in response)
          ? (response as TtsSettings)
          : undefined;
    const responseVersion =
        response && typeof response === 'object' && 'version' in response
            ? Number((response as { version?: number }).version)
            : undefined;

    return {
        success: true,
        ...(isWrappedResponse<TtsSettings>(response) ? response : {}),
        data: {
            ...currentData,
            ...submitted,
            ...(responseData || {}),
            ...(Number.isFinite(responseVersion) ? { version: responseVersion } : {}),
        },
    };
};

const patchStatusCaches = (queryClient: QueryClient, patch: Partial<TtsStatus>): void => {
    queryClient.setQueriesData(
        { queryKey: ['tts', 'status'] },
        (old: ApiResponse<TtsStatus> | TtsStatus | undefined) => {
            if (!old) {
                return {
                    success: true,
                    data: patch as TtsStatus,
                } as ApiResponse<TtsStatus>;
            }

            if (isWrappedResponse<TtsStatus>(old)) {
                return {
                    ...old,
                    success: true,
                    data: {
                        ...((old.data || {}) as TtsStatus),
                        ...patch,
                    },
                };
            }

            return {
                ...(old as TtsStatus),
                ...patch,
            };
        }
    );
};

const patchLocalTtsConfigCache = (queryClient: QueryClient, provider: 'f5', patch: Partial<LocalTtsConfig>): void => {
    queryClient.setQueryData(queryKeys.tts.localTtsConfig(provider), (old: LocalTtsConfig | null | undefined) => ({
        ...(old || { provider }),
        ...patch,
        provider,
        data: {
            ...(old?.data || {}),
            ...(patch.configured !== undefined ? { configured: patch.configured } : {}),
            ...(patch.healthy !== undefined ? { healthy: patch.healthy } : {}),
        },
    }));
};

const normalizeLocalTtsConfigPayload = (
    response: ApiResponse<LocalTtsConfig> | LocalTtsConfig | null | undefined
): LocalTtsConfig | null => {
    if (!response) {
        return null;
    }

    const wrappedResponse = response as ApiResponse<LocalTtsConfig> & {
        config?: LocalTtsConfig;
        use_local?: boolean;
        provider?: 'f5';
    };
    const mergedConfig = wrappedResponse.config || wrappedResponse.data || response;
    if (!mergedConfig) {
        return null;
    }

    return {
        ...(wrappedResponse || {}),
        ...(mergedConfig || {}),
        provider: ((mergedConfig as LocalTtsConfig).provider || wrappedResponse.provider || 'f5') as 'f5',
    } as LocalTtsConfig;
};

const setLocalTtsConfigCache = (
    queryClient: QueryClient,
    provider: 'f5',
    response: ApiResponse<LocalTtsConfig> | LocalTtsConfig | null | undefined
): void => {
    const normalized = normalizeLocalTtsConfigPayload(response);
    if (!normalized) {
        return;
    }
    queryClient.setQueryData(queryKeys.tts.localTtsConfig(provider), normalized);
};

const engineSettingsPatch = (engineType: string): Partial<TtsSettings> => {
    switch (engineType) {
        case 'gcloud':
            return {
                engine: 'gcloud',
                advancedProvider: 'gcloud',
                advanced_provider: 'gcloud',
                f5Mode: 'cloud',
                f5_mode: 'cloud',
                useLocalTTS: false,
                use_local_tts: false,
            };
        case 'f5_local':
            return {
                engine: 'f5tts',
                advancedProvider: 'f5',
                advanced_provider: 'f5',
                f5Mode: 'local',
                f5_mode: 'local',
                useLocalTTS: true,
                use_local_tts: true,
            };
        default:
            return {
                engine: 'f5tts',
                advancedProvider: 'f5',
                advanced_provider: 'f5',
                f5Mode: 'cloud',
                f5_mode: 'cloud',
                useLocalTTS: false,
                use_local_tts: false,
            };
    }
};

/**
 * Получить статус TTS
 */
export const useTtsStatus = (
    channelName: string | null = null,
    options?: Omit<UseQueryOptions<ApiResponse<TtsStatus>, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: queryKeys.tts.status(channelName),
        queryFn: async () => {
            const response = await unwrapResponse(ttsService.getStatus(channelName));
            const data = response as ApiResponse<TtsStatus> | TtsStatus;
            if (data && typeof (data as TtsStatus).enabled === 'boolean' && !(data as ApiResponse<TtsStatus>).success) {
                return { success: true, data: data as TtsStatus };
            }
            return data as ApiResponse<TtsStatus>;
        },
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        ...options,
    });
};

/**
 * Получить настройки TTS
 */
export const useTtsSettings = (
    options?: Omit<UseQueryOptions<ApiResponse<TtsSettings>, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: queryKeys.tts.settings(),
        queryFn: () => unwrapResponse(ttsService.getSettings()),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        ...options,
    });
};

/**
 * Сохранить настройки TTS
 */
export const useSaveTtsSettings = (
    options?: UseMutationOptions<ApiResponse<TtsSettings>, AxiosError, Partial<TtsSettings>, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (settings: Partial<TtsSettings>) => unwrapResponse(ttsService.saveSettings(settings)),
        onMutate: async (newSettings: Partial<TtsSettings>, context) => {
            // Execute user onMutate if exists
            if (options?.onMutate) {
                await options.onMutate(newSettings, context);
            }

            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.tts.settings() });

            // Snapshot previous value
            const previousSettings = queryClient.getQueryData(queryKeys.tts.settings());

            // Optimistically update
            queryClient.setQueryData(queryKeys.tts.settings(), (old: ApiResponse<TtsSettings> | undefined) => ({
                ...old,
                success: true,
                data: {
                    ...(old?.data || ({} as TtsSettings)),
                    ...newSettings,
                },
            }));

            // Return context for rollback
            return { previousSettings };
        },
        onSuccess: (response, variables, onMutateResult, context) => {
            if (response?.success) {
                queryClient.setQueryData(
                    queryKeys.tts.settings(),
                    (old: ApiResponse<TtsSettings> | TtsSettings | undefined) =>
                        mergeSettingsResponse(old, response, variables)
                );
            }
            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            }
        },
        onError: (error, newSettings, onMutateResult, context) => {
            // Rollback on error
            const typedContext = onMutateResult as { previousSettings?: ApiResponse<TtsSettings> } | undefined;
            if (typedContext?.previousSettings) {
                queryClient.setQueryData(queryKeys.tts.settings(), typedContext.previousSettings);
            }
            logger.error('Error saving TTS settings:', error);
            if (options?.onError) {
                options.onError(error, newSettings, onMutateResult, context);
            } else {
                toast.error('Ошибка сохранения настроек TTS');
            }
        },
        onSettled: (data, error, variables, onMutateResult, context) => {
            if (options?.onSettled) {
                options.onSettled(data, error, variables, onMutateResult, context);
            }
        },
    });
};

/**
 * Получить аудио настройки TTS
 */
export const useTtsAudioSettings = (
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: queryKeys.tts.audioSettings(),
        queryFn: () => unwrapResponse(ttsService.getAudioSettings()),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        ...options,
    });
};

/**
 * Сохранить аудио настройки TTS
 */
export const useSaveTtsAudioSettings = (
    options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (settings: Record<string, unknown>) => unwrapResponse(ttsService.saveAudioSettings(settings)),
        onSuccess: (response, variables, onMutateResult, context) => {
            if (response?.success) {
                queryClient.setQueryData(queryKeys.tts.audioSettings(), response);
            }

            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            } else {
                toast.success('Аудио настройки TTS сохранены');
            }
        },
        onError: (error, variables, onMutateResult, context) => {
            logger.error('Error saving TTS audio settings:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка сохранения аудио настроек TTS');
            }
        },
    });
};

/**
 * Получить настройки платформы TTS
 */
export const useTtsPlatformSettings = (
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: queryKeys.tts.platformSettings(),
        queryFn: () => unwrapResponse(ttsService.getPlatformSettings()),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        ...options,
    });
};

/**
 * Сохранить настройки платформы TTS
 */
export const useSaveTtsPlatformSettings = (
    options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (settings: Record<string, unknown>) => unwrapResponse(ttsService.savePlatformSettings(settings)),
        onMutate: async (newSettings, context) => {
            if (options?.onMutate) {
                await options.onMutate(newSettings, context);
            }

            await queryClient.cancelQueries({ queryKey: queryKeys.tts.platformSettings() });
            const previousSettings = queryClient.getQueryData(queryKeys.tts.platformSettings());

            queryClient.setQueryData(
                queryKeys.tts.platformSettings(),
                (old: ApiResponse<Record<string, unknown>> | undefined) => ({
                    ...old,
                    success: true,
                    data: {
                        ...((old?.data || {}) as Record<string, unknown>),
                        ...newSettings,
                    },
                })
            );

            return { previousSettings };
        },
        onSuccess: (response, variables, onMutateResult, context) => {
            if (response?.success) {
                queryClient.setQueryData(queryKeys.tts.platformSettings(), response);
            }

            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            }
        },
        onError: (error, variables, onMutateResult, context) => {
            const typedContext = onMutateResult as { previousSettings?: ApiResponse } | undefined;
            if (typedContext?.previousSettings) {
                queryClient.setQueryData(queryKeys.tts.platformSettings(), typedContext.previousSettings);
            }
            logger.error('Error saving TTS platform settings:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка сохранения настроек платформы TTS');
            }
        },
    });
};

/**
 * Получить настройки режима TTS
 */
export const useTtsModeSettings = (
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: queryKeys.tts.modeSettings(),
        queryFn: () => unwrapResponse(ttsService.getModeSettings()),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        ...options,
    });
};

/**
 * Сохранить настройки режима TTS
 */
export const useSaveTtsModeSettings = (
    options?: UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (settings: Record<string, unknown>) => unwrapResponse(ttsService.saveModeSettings(settings)),
        onMutate: async (newSettings, context) => {
            if (options?.onMutate) {
                await options.onMutate(newSettings, context);
            }

            await queryClient.cancelQueries({ queryKey: queryKeys.tts.modeSettings() });
            const previousSettings = queryClient.getQueryData(queryKeys.tts.modeSettings());

            queryClient.setQueryData(
                queryKeys.tts.modeSettings(),
                (old: ApiResponse<Record<string, unknown>> | Record<string, unknown> | undefined) => {
                    const oldData = isWrappedResponse<Record<string, unknown>>(old)
                        ? old.data || {}
                        : ((old || {}) as Record<string, unknown>);

                    return {
                        ...(isWrappedResponse<Record<string, unknown>>(old) ? old : {}),
                        success: true,
                        data: {
                            ...oldData,
                            ...newSettings,
                        },
                    };
                }
            );

            return { previousSettings };
        },
        onSuccess: (response, variables, onMutateResult, context) => {
            if (response?.success) {
                queryClient.setQueryData(queryKeys.tts.modeSettings(), response);
            }

            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            }
        },
        onError: (error, variables, onMutateResult, context) => {
            const typedContext = onMutateResult as { previousSettings?: ApiResponse } | undefined;
            if (typedContext?.previousSettings) {
                queryClient.setQueryData(queryKeys.tts.modeSettings(), typedContext.previousSettings);
            }
            logger.error('Error saving TTS mode settings:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка сохранения настроек режима TTS');
            }
        },
    });
};

/**
 * Включить TTS
 */
export const useEnableTts = (options?: UseMutationOptions<ApiResponse, AxiosError, void, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: () => unwrapResponse(ttsService.enable()),
        onSuccess: (response, variables, onMutateResult, context) => {
            patchStatusCaches(queryClient, { enabled: true });
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.status(null), exact: true, refetchType: 'active' });

            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            } else {
                toast.success('TTS включен');
            }
        },
        onError: (error, variables, onMutateResult, context) => {
            logger.error('Error enabling TTS:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка включения TTS');
            }
        },
    });
};

/**
 * Выключить TTS
 */
export const useDisableTts = (options?: UseMutationOptions<ApiResponse, AxiosError, void, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: () => unwrapResponse(ttsService.disable()),
        onSuccess: (response, variables, onMutateResult, context) => {
            patchStatusCaches(queryClient, { enabled: false });

            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            } else {
                toast.success('TTS выключен');
            }
        },
        onError: (error, variables, onMutateResult, context) => {
            logger.error('Error disabling TTS:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка выключения TTS');
            }
        },
    });
};

/**
 * Получить health статус TTS
 */
export const useTtsHealth = (options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery({
        queryKey: queryKeys.tts.health(),
        queryFn: () => unwrapResponse(ttsService.getHealth()),
        staleTime: 60 * 1000, // 1 минута
        gcTime: 3 * 60 * 1000, // 3 минуты
        refetchInterval: 120 * 1000, // 2 минуты
        retry: false,
        ...options,
    });
};

/**
 * Переключить TTS (включить/выключить)
 */
export const useToggleTts = (options?: UseMutationOptions<ApiResponse, AxiosError, boolean, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (enabled: boolean) => unwrapResponse(enabled ? ttsService.enable() : ttsService.disable()),
        onSuccess: (data, variables, onMutateResult, context) => {
            patchStatusCaches(queryClient, { enabled: variables });
            if (options?.onSuccess) {
                options.onSuccess(data, variables, onMutateResult, context);
            }
        },
        onError: (error, variables, onMutateResult, context) => {
            logger.error('Error toggling TTS:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка переключения TTS');
            }
        },
    });
};

/**
 * Установить режим прослушивания TTS
 */
export const useSetTtsListeningMode = (options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (mode: string) => unwrapResponse(ttsService.setListeningMode({ listeningMode: mode })),
        onSuccess: (_response, mode, onMutateResult, context) => {
            const normalizedMode = mode === 'obs' ? 'obs' : 'website';
            patchExactApiCache<TtsSettings>(queryClient, queryKeys.tts.settings(), { listeningMode: mode });
            patchStatusCaches(queryClient, { listening_mode: normalizedMode as TtsStatus['listening_mode'] });
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(STORAGE_KEYS.TTS_LISTENING_MODE, normalizedMode);
                window.dispatchEvent(
                    new CustomEvent('tts-listening-mode-changed', {
                        detail: { mode: normalizedMode },
                    })
                );
            }
            if (options?.onSuccess) {
                options.onSuccess(_response, mode, onMutateResult, context);
            }
        },
        onError: (error: AxiosError, variables, onMutateResult, context) => {
            logger.error('Error setting listening mode:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка обновления режима прослушивания');
            }
        },
        ...options,
    });
};

/**
 * Установить движок TTS
 */
export const useSetTtsEngine = (options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (engineType: string) => unwrapResponse(ttsService.setEngine({ engine_type: engineType })),
        onSuccess: (_response, engineType, onMutateResult, context) => {
            patchStatusCaches(queryClient, { engine_type: engineType as TtsStatus['engine_type'] });
            patchExactApiCache<TtsSettings>(queryClient, queryKeys.tts.settings(), engineSettingsPatch(engineType));
            if (engineType === 'f5_local') {
                patchStatusCaches(queryClient, { f5_mode: 'local', mode: 'local' });
            } else if (engineType === 'gcloud') {
                patchStatusCaches(queryClient, { f5_mode: 'cloud', mode: 'cloud', advanced_provider: 'gcloud' });
            } else {
                patchStatusCaches(queryClient, { f5_mode: 'cloud', mode: 'cloud', advanced_provider: 'f5' });
            }
            if (options?.onSuccess) {
                options.onSuccess(_response, engineType, onMutateResult, context);
            }
        },
        onError: (error: AxiosError, variables, onMutateResult, context) => {
            logger.error('Error setting TTS engine:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка обновления движка TTS');
            }
        },
        ...options,
    });
};

/**
 * Регенерировать OBS URL для TTS
 */
export const useRegenerateTtsObsUrl = (options?: UseMutationOptions<ApiResponse, AxiosError, void, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => unwrapResponse(ttsService.regenerateObsUrl()),
        onSuccess: (response, variables, onMutateResult, context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.obsUrl() });
            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            }
            return response;
        },
        onError: (error: AxiosError, variables, onMutateResult, context) => {
            logger.error('Error regenerating OBS URL:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка регенерации OBS URL');
            }
        },
        ...options,
    });
};

/**
 * Создать TTS награду для платформы
 */
export const useCreateTtsReward = (
    options?: UseMutationOptions<
        ApiResponse,
        AxiosError,
        { platform: string; title: string; cost: number; cooldown: number },
        unknown
    >
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { platform: string; title: string; cost: number; cooldown: number }) =>
            unwrapResponse(ttsService.createTtsReward(data)),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            if (!options?.onSuccess) {
                toast.success('Награда создана');
            }
            return response;
        },
        onError: (error: AxiosError) => {
            logger.error('Error creating TTS reward:', error);
            if (!options?.onError) {
                toast.error('Ошибка создания награды');
            }
        },
        ...options,
    });
};

/**
 * Привязать существующую TTS награду платформы
 */
export const useAttachTtsReward = (
    options?: UseMutationOptions<ApiResponse, AxiosError, { platform: string; reward_id: string }, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { platform: string; reward_id: string }) => unwrapResponse(ttsService.attachTtsReward(data)),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            if (!options?.onSuccess) {
                toast.success('Награда привязана');
            }
            return response;
        },
        onError: (error: AxiosError) => {
            logger.error('Error attaching TTS reward:', error);
            if (!options?.onError) {
                const errorData = error.response?.data as Record<string, unknown> | undefined;
                const errorMessage = (errorData?.detail || errorData?.message || 'Ошибка привязки награды') as string;
                toast.error(errorMessage);
            }
        },
        ...options,
    });
};

/**
 * Отвязать TTS награду для платформы
 */
export const useDeleteTtsReward = (options?: UseMutationOptions<ApiResponse, AxiosError, string, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (platform: string) => unwrapResponse(ttsService.deleteTtsReward(platform)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            if (!options?.onSuccess) {
                toast.success('Награда отвязана');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error deleting TTS reward:', error);
            if (!options?.onError) {
                toast.error('Ошибка удаления награды');
            }
        },
        ...options,
    });
};

/**
 * Получить конфигурацию локального TTS
 */
export const useLocalTtsConfig = (
    provider: 'f5' = 'f5',
    options?: Omit<UseQueryOptions<LocalTtsConfig | null, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<LocalTtsConfig | null, AxiosError>({
        queryKey: queryKeys.tts.localTtsConfig(provider),
        queryFn: async () => {
            const response = (await unwrapResponse(
                ttsService.getLocalTtsConfig(provider)
            )) as ApiResponse<LocalTtsConfig> & { config?: LocalTtsConfig };
            const mergedConfig = response?.config || response?.data || null;
            if (!mergedConfig && !response) {
                return null;
            }
            return {
                ...(response || {}),
                ...(mergedConfig || {}),
            } as LocalTtsConfig;
        },
        staleTime: 5 * 60 * 1000, // 5 минут
        gcTime: 10 * 60 * 1000, // 10 минут
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false, // Не повторяем запрос при ошибке
        ...options,
    });
};

/**
 * Сохранить конфигурацию локального TTS
 */
export const useSaveLocalTtsConfig = (
    options?: UseMutationOptions<ApiResponse<LocalTtsConfig>, AxiosError, Partial<LocalTtsConfig>, unknown>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (config: Partial<LocalTtsConfig>) => unwrapResponse(ttsService.saveLocalTtsConfig(config)),
        onMutate: async (nextConfig, context) => {
            if (options?.onMutate) {
                await options.onMutate(nextConfig, context);
            }

            const provider = (nextConfig?.provider as 'f5' | undefined) || 'f5';
            await queryClient.cancelQueries({ queryKey: queryKeys.tts.localTtsConfig(provider) });

            const previousConfig = queryClient.getQueryData<LocalTtsConfig | null>(
                queryKeys.tts.localTtsConfig(provider)
            );
            patchLocalTtsConfigCache(queryClient, provider, {
                endpoint_url: nextConfig.endpoint_url,
                use_local: nextConfig.use_local,
                configured: Boolean(nextConfig.endpoint_url || previousConfig?.configured),
                provider,
                has_api_key:
                    nextConfig.api_key !== undefined ? Boolean(nextConfig.api_key) : previousConfig?.has_api_key,
            });

            if (nextConfig.endpoint_url) {
                patchStatusCaches(queryClient, {
                    has_local_setup: true,
                    has_local_setup_f5: true,
                    has_local_endpoint_f5: true,
                });
            }

            return { previousConfig };
        },
        onSuccess: (response, variables, onMutateResult, context) => {
            const provider = (variables?.provider as 'f5' | undefined) || 'f5';
            setLocalTtsConfigCache(queryClient, provider, response);
            const normalized = normalizeLocalTtsConfigPayload(response);
            if (normalized) {
                patchStatusCaches(queryClient, {
                    has_local_setup: Boolean(normalized.configured || normalized.endpoint_url),
                    has_local_setup_f5: Boolean(normalized.configured || normalized.endpoint_url),
                    has_local_endpoint_f5: Boolean(normalized.endpoint_url),
                });
            }
            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            } else {
                toast.success('Настройки локального TTS сохранены');
            }
        },
        onError: (error: AxiosError, variables, onMutateResult, context) => {
            const typedContext = onMutateResult as { previousConfig?: LocalTtsConfig | null } | undefined;
            const provider = (variables?.provider as 'f5' | undefined) || 'f5';
            if (typedContext?.previousConfig) {
                queryClient.setQueryData(queryKeys.tts.localTtsConfig(provider), typedContext.previousConfig);
            }
            logger.error('Error saving local TTS config:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка сохранения настроек локального TTS');
            }
        },
        onSettled: (data, error, variables, onMutateResult, context) => {
            if (options?.onSettled) {
                options.onSettled(data, error, variables, onMutateResult, context);
            }
        },
    });
};

/**
 * Протестировать соединение с локальным TTS сервером
 */
export const useTestLocalTtsConnection = (
    options?: UseMutationOptions<
        ApiResponse,
        AxiosError,
        { endpoint_url: string; api_key?: string; provider?: 'f5'; use_local?: boolean },
        unknown
    >
) => {
    return useMutation({
        ...options,
        mutationFn: (params: { endpoint_url: string; api_key?: string; provider?: 'f5'; use_local?: boolean }) =>
            unwrapResponse(ttsService.testLocalTtsConnection(params)),
        onSuccess: (response, variables, onMutateResult, context) => {
            if (options?.onSuccess) {
                options.onSuccess(response, variables, onMutateResult, context);
            } else {
                const success =
                    (response as { success?: boolean } | undefined)?.success ??
                    (response as { data?: { success?: boolean } } | undefined)?.data?.success;
                if (success) {
                    toast.success('Соединение успешно!');
                } else {
                    toast.error('Не удалось подключиться');
                }
            }
        },
        onError: (error: AxiosError, variables, onMutateResult, context) => {
            logger.error('Error testing local TTS connection:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка подключения к серверу');
            }
        },
    });
};

/**
 * Переключить использование локального TTS
 */
export const useToggleLocalTts = (options?: UseMutationOptions<ApiResponse, AxiosError, 'f5', unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        ...options,
        mutationFn: (provider: 'f5') => unwrapResponse(ttsService.toggleLocalTts(provider)),
        onMutate: async (provider, context) => {
            if (options?.onMutate) {
                await options.onMutate(provider, context);
            }

            await queryClient.cancelQueries({ queryKey: queryKeys.tts.localTtsConfig(provider) });
            const previousConfig = queryClient.getQueryData<LocalTtsConfig | null>(
                queryKeys.tts.localTtsConfig(provider)
            );
            const previousStatus = queryClient.getQueriesData({ queryKey: ['tts', 'status'] });
            const nextUseLocal = !previousConfig?.use_local;

            patchLocalTtsConfigCache(queryClient, provider, { use_local: nextUseLocal, provider });
            patchStatusCaches(queryClient, {
                has_local_setup: true,
                has_local_setup_f5: true,
                has_local_endpoint_f5: true,
                f5_mode: nextUseLocal ? 'local' : 'cloud',
                mode: nextUseLocal ? 'local' : 'cloud',
            });

            return { previousConfig, previousStatus };
        },
        onSuccess: (response, provider, onMutateResult, context) => {
            const responseUseLocal =
                (response as { use_local?: boolean } | undefined)?.use_local ??
                (response as { data?: { use_local?: boolean } } | undefined)?.data?.use_local;
            patchLocalTtsConfigCache(queryClient, provider, {
                use_local: Boolean(responseUseLocal),
                configured: true,
                provider,
            });
            patchStatusCaches(queryClient, {
                has_local_setup: true,
                has_local_setup_f5: true,
                has_local_endpoint_f5: true,
                f5_mode: responseUseLocal ? 'local' : 'cloud',
                mode: responseUseLocal ? 'local' : 'cloud',
            });
            if (options?.onSuccess) {
                options.onSuccess(response, provider, onMutateResult, context);
            } else {
                toast.success(response?.message || 'Self Hosted TTS переключен');
            }
        },
        onError: (error: AxiosError, variables, onMutateResult, context) => {
            const typedContext = onMutateResult as
                | {
                      previousConfig?: LocalTtsConfig | null;
                      previousStatus?: Array<[readonly unknown[], unknown]>;
                  }
                | undefined;
            if (typedContext?.previousConfig) {
                queryClient.setQueryData(queryKeys.tts.localTtsConfig(variables), typedContext.previousConfig);
            }
            typedContext?.previousStatus?.forEach(([queryKey, value]) => {
                queryClient.setQueryData(queryKey, value);
            });
            logger.error('Error toggling local TTS:', error);
            if (options?.onError) {
                options.onError(error, variables, onMutateResult, context);
            } else {
                toast.error('Ошибка переключения локального TTS');
            }
        },
        onSettled: (data, error, provider, onMutateResult, context) => {
            if (options?.onSettled) {
                options.onSettled(data, error, provider, onMutateResult, context);
            }
        },
    });
};

/**
 * Получить статус whitelist для голосов
 */
export const useWhitelistStatus = (
    options?: Omit<UseQueryOptions<ApiResponse, AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery({
        queryKey: queryKeys.tts.whitelistStatus(),
        queryFn: () => unwrapResponse(ttsService.getWhitelistStatus()),
        staleTime: 60 * 1000, // 1 минута
        gcTime: 5 * 60 * 1000, // 5 минут
        retry: false, // Не повторяем запрос при ошибке
        ...options,
    });
};

/**
 * Получить список отфильтрованных слов
 */
export const useFilteredWords = (
    options?: Omit<UseQueryOptions<FilteredWord[], AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<FilteredWord[], AxiosError>({
        queryKey: queryKeys.tts.filteredWords(),
        queryFn: async () => {
            const response = await unwrapResponse(ttsService.getFilteredWords());
            return (response as { data?: FilteredWord[] })?.data || [];
        },
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        ...options,
    });
};

/**
 * Добавить слово в фильтр
 */
export const useAddFilteredWord = (
    options?: UseMutationOptions<
        ApiResponse<FilteredWord>,
        AxiosError,
        { word: string; channel_name?: string },
        unknown
    >
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { word: string; channel_name?: string }) => unwrapResponse(ttsService.addFilteredWord(data)),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
            if (!options?.onSuccess) {
                toast.success('Слово добавлено в фильтр');
            }
            return response;
        },
        onError: (error: AxiosError) => {
            logger.error('Error adding filtered word:', error);
            if (!options?.onError) {
                toast.error('Ошибка добавления слова в фильтр');
            }
        },
        ...options,
    });
};

/**
 * Удалить слово из фильтра
 */
export const useDeleteFilteredWord = (options?: UseMutationOptions<ApiResponse, AxiosError, number, unknown>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (wordId: number) => unwrapResponse(ttsService.deleteFilteredWord(wordId)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
            if (!options?.onSuccess) {
                toast.success('Слово удалено из фильтра');
            }
        },
        onError: (error: AxiosError) => {
            logger.error('Error deleting filtered word:', error);
            if (!options?.onError) {
                toast.error('Ошибка удаления слова из фильтра');
            }
        },
        ...options,
    });
};

/**
 * Получить список заблокированных пользователей
 */
export const useBlockedUsers = (options?: Omit<UseQueryOptions<BlockedUser[], AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery<BlockedUser[], AxiosError>({
        queryKey: queryKeys.tts.blockedUsers(),
        queryFn: async () => {
            const response = await unwrapResponse(ttsService.getBlockedUsers());
            if (Array.isArray(response)) {
                return response as BlockedUser[];
            }
            const nestedData = (response as { data?: BlockedUser[] | { blocked_users?: BlockedUser[] } })?.data;
            if (Array.isArray(nestedData)) {
                return nestedData;
            }
            if (nestedData && Array.isArray((nestedData as { blocked_users?: BlockedUser[] }).blocked_users)) {
                return (nestedData as { blocked_users?: BlockedUser[] }).blocked_users || [];
            }
            return [];
        },
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        ...options,
    });
};

/**
 * Заблокировать пользователя
 */
export const useBlockUser = (
    options?: UseMutationOptions<
        ApiResponse<BlockedUser>,
        AxiosError,
        { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string; reason?: string },
        unknown
    >
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: {
            username: string;
            platform: 'twitch' | 'vk' | 'youtube';
            channel_name?: string;
            reason?: string;
        }) => unwrapResponse(ttsService.blockUser(data)),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
            if (!options?.onSuccess) {
                toast.success('Пользователь заблокирован');
            }
            return response;
        },
        onError: (error: AxiosError) => {
            logger.error('Error blocking user:', error);
            if (!options?.onError) {
                const message =
                    (error.response?.data as { detail?: string; message?: string } | undefined)?.detail ||
                    (error.response?.data as { detail?: string; message?: string } | undefined)?.message ||
                    'Ошибка блокировки пользователя';
                toast.error(message);
            }
        },
        ...options,
    });
};

/**
 * Разблокировать пользователя
 */
export const useUnblockUser = (
    options?: UseMutationOptions<
        ApiResponse,
        AxiosError,
        { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string },
        unknown
    >
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { username: string; platform: 'twitch' | 'vk' | 'youtube'; channel_name?: string }) =>
            unwrapResponse(ttsService.unblockUser(data)),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
            if (!options?.onSuccess) {
                toast.success('Пользователь разблокирован');
            }
            return response;
        },
        onError: (error: AxiosError) => {
            logger.error('Error unblocking user:', error);
            if (!options?.onError) {
                const message =
                    (error.response?.data as { detail?: string; message?: string } | undefined)?.detail ||
                    (error.response?.data as { detail?: string; message?: string } | undefined)?.message ||
                    'Ошибка разблокировки пользователя';
                toast.error(message);
            }
        },
        ...options,
    });
};

/**
 * Получить глобальные голоса TTS
 */
export const useGlobalVoices = (options?: Omit<UseQueryOptions<TtsVoice[], AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery<TtsVoice[], AxiosError>({
        queryKey: queryKeys.tts.voices.global(),
        queryFn: async () => {
            const response = await unwrapResponse(ttsService.getGlobalVoices());
            return response?.data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 минут - голоса редко меняются
        gcTime: 30 * 60 * 1000, // 30 минут
        retry: 1,
        ...options,
    });
};
