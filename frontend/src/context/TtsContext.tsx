import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* eslint-disable react-refresh/only-export-components */
import { keepPreviousData } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

import { STORAGE_KEYS } from '@/constants';
import { useGlobalVoices, useToggleTts, useTtsStatus } from '@/queries/tts/ttsQueries';
import { ttsService } from '@/services/api/services/ttsService';
import { useToast } from '@/shared/components/ui/toast';
import { useButtonPosition } from '@/shared/hooks/useButtonPosition';
import { logger } from '@/shared/utils/prodLogger';

import { AuthContext } from './AuthContext';

import type { TtsVoice } from '@/types/tts';

interface EngineStatus {
    loaded: boolean;
    error: string | null;
}

interface TtsContextValue {
    ttsEnabled: boolean;
    isWhitelisted: boolean | null;
    setIsWhitelisted: (value: boolean | null) => void;
    voices: TtsVoice[];
    engineStatus: EngineStatus;
    isInitialized: boolean;
    isToggling: boolean;
    toggleTts: (event?: unknown) => Promise<void>;
    loadVoices: () => Promise<void>;
    initializeTts: () => Promise<void>;
    setNotificationHandler: (callback: ((message: string, type?: string) => void) | null) => void;
    checkTtsStatus: () => Promise<void>;
    checkTtsHealth: (
        provider?: 'f5' | 'gcloud',
        mode?: 'cloud' | 'local'
    ) => Promise<{ isHealthy: boolean; isChecking: boolean }>;
    isCheckingHealth: boolean;
}

const TtsContext = createContext<TtsContextValue | undefined>(undefined);

export const useTts = (): TtsContextValue => {
    const context = useContext(TtsContext);
    if (!context) {
        throw new Error('useTts must be used within TtsProvider');
    }
    return context;
};

interface TtsProviderProps {
    children: React.ReactNode;
}

export const TtsProvider: React.FC<TtsProviderProps> = ({ children }) => {
    const authContext = useContext(AuthContext);
    if (!authContext) {
        throw new Error('TtsProvider must be used within AuthProvider');
    }
    const { user } = authContext;
    const { addToast: _addToast } = useToast();
    const { getButtonPosition: _getButtonPosition } = useButtonPosition();
    const location = useLocation();
    const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
    const [voices, setVoices] = useState<TtsVoice[]>([]);
    const [engineStatus, setEngineStatus] = useState<EngineStatus>({ loaded: true, error: null });
    const [notificationCallback, setNotificationCallback] = useState<((message: string, type?: string) => void) | null>(
        null
    );
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [isToggling, setIsToggling] = useState<boolean>(false);
    const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
    const [selectedEngineType, setSelectedEngineType] = useState<string | null>(null);

    const ttsRelatedPaths = ['/dashboard/tts', '/tts'];
    const isTtsPage = ttsRelatedPaths.some((path) => location.pathname.startsWith(path));
    const isVoiceManagementPage = location.pathname.startsWith('/dashboard/tts/voices');
    const ttsStatusInterval = isTtsPage ? 30 * 1000 : 120 * 1000;

    const channelName = null;
    const healthProvider: 'f5' | null =
        selectedEngineType === 'cloud' ||
        selectedEngineType === 'local' ||
        selectedEngineType === 'f5_cloud' ||
        selectedEngineType === 'f5_local'
            ? 'f5'
            : null;
    const healthMode: 'cloud' | 'local' | undefined =
        selectedEngineType === 'f5_local' || selectedEngineType === 'local'
            ? 'local'
            : selectedEngineType === 'f5_cloud' || selectedEngineType === 'cloud'
              ? 'cloud'
              : undefined;
    const shouldCheckProviderHealth = !!user && healthProvider !== null;

    const { data: statusData, refetch: refetchStatus } = useTtsStatus(channelName, {
        enabled: !!user,
        refetchInterval: ttsStatusInterval,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });

    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (statusData) {
            const statusResponse = (statusData?.data || statusData) as {
                enabled?: boolean;
                is_whitelisted?: boolean;
                has_local_setup?: boolean;
                engine_type?: string;
                listening_mode?: 'website' | 'obs';
                listeningMode?: 'website' | 'obs';
            };
            // Validate that we actually have the expected fields
            if (statusResponse && typeof statusResponse.enabled === 'boolean') {
                setTtsEnabled(statusResponse.enabled);
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem('tts_enabled', String(statusResponse.enabled));
                    window.dispatchEvent(
                        new CustomEvent('tts-status-changed', {
                            detail: { enabled: statusResponse.enabled },
                        })
                    );
                }

                if (typeof statusResponse.is_whitelisted === 'boolean') {
                    setIsWhitelisted(statusResponse.is_whitelisted);
                }

                const engineType = statusResponse.engine_type ?? null;
                setSelectedEngineType(engineType);
                if (
                    engineType !== 'cloud' &&
                    engineType !== 'local' &&
                    engineType !== 'f5_cloud' &&
                    engineType !== 'f5_local'
                ) {
                    setEngineStatus({ loaded: true, error: null });
                }

                if (statusResponse.has_local_setup) {
                    localStorage.setItem('tts_has_local_setup', 'true');
                } else {
                    localStorage.setItem('tts_has_local_setup', 'false');
                }

                const listeningModeRaw = statusResponse.listening_mode ?? statusResponse.listeningMode;
                if (typeof window !== 'undefined' && listeningModeRaw) {
                    const normalizedMode = listeningModeRaw === 'obs' ? 'obs' : 'website';
                    const currentMode = window.localStorage.getItem(STORAGE_KEYS.TTS_LISTENING_MODE);
                    if (currentMode !== normalizedMode) {
                        window.localStorage.setItem(STORAGE_KEYS.TTS_LISTENING_MODE, normalizedMode);
                        window.dispatchEvent(
                            new CustomEvent('tts-listening-mode-changed', {
                                detail: { mode: normalizedMode },
                            })
                        );
                    }
                }
            } else {
                logger.warn('[TtsContext] Invalid TTS status data received (ignoring update):', statusResponse);
            }
        }
    }, [statusData]);

    const runProviderHealthCheck = useCallback(
        async (
            providerOverride?: 'f5' | 'gcloud',
            modeOverride?: 'cloud' | 'local'
        ): Promise<{ isHealthy: boolean; isChecking: boolean }> => {
            if (isCheckingHealth) {
                return { isHealthy: engineStatus.loaded, isChecking: true };
            }

            const providerToCheck = providerOverride || healthProvider;
            const modeToCheck = modeOverride || healthMode;

            if (!providerToCheck || (!providerOverride && !shouldCheckProviderHealth)) {
                setEngineStatus({ loaded: true, error: null });
                return { isHealthy: true, isChecking: false };
            }

            setIsCheckingHealth(true);
            try {
                const response = await ttsService.getHealth(providerToCheck, modeToCheck);
                const payload = (response.data?.data || response.data) as {
                    healthy?: boolean;
                    tts_engine_loaded?: boolean;
                    status?: string;
                };
                const isHealthy =
                    payload?.healthy === true || payload?.tts_engine_loaded === true || payload?.status === 'healthy';

                if (isHealthy) {
                    setEngineStatus({ loaded: true, error: null });
                } else {
                    const providerLabel = providerToCheck.toUpperCase();
                    setEngineStatus({ loaded: false, error: `${providerLabel} TTS service is unavailable` });
                }

                return { isHealthy, isChecking: false };
            } catch (error) {
                logger.error('TTS Health check failed:', error);
                setEngineStatus({
                    loaded: false,
                    error: providerToCheck === 'gcloud' ? 'Unable to connect to Google Cloud TTS' : 'Unable to connect to F5 TTS service',
                });
                return { isHealthy: false, isChecking: false };
            } finally {
                setIsCheckingHealth(false);
            }
        },
        [isCheckingHealth, engineStatus.loaded, shouldCheckProviderHealth, healthProvider, healthMode]
    );

    const { data: voicesData } = useGlobalVoices({
        enabled: !!user && engineStatus.loaded && isVoiceManagementPage,
        retry: false,
        refetchOnWindowFocus: false,
    });

    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (voicesData) {
            const voicesResponse = (voicesData as { voices?: TtsVoice[] })?.voices || voicesData;
            if (Array.isArray(voicesResponse)) {
                setVoices(voicesResponse);
            } else if (
                typeof voicesResponse === 'object' &&
                voicesResponse !== null &&
                'success' in voicesResponse &&
                'voices' in voicesResponse &&
                Array.isArray((voicesResponse as { voices: TtsVoice[] }).voices)
            ) {
                setVoices((voicesResponse as { voices: TtsVoice[] }).voices);
            }
        }
    }, [voicesData]);

    const toggleTtsMutation = useToggleTts({
        onSuccess: (data: unknown, enabled: boolean) => {
            setTtsEnabled(enabled);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('tts_enabled', String(enabled));
            }
            window.dispatchEvent(
                new CustomEvent('tts-status-changed', {
                    detail: { enabled },
                })
            );
            const message = enabled ? 'Озвучка сообщений включена.' : 'Озвучка сообщений отключена.';
            if (notificationCallback) {
                notificationCallback(message, 'success');
            }
        },
        onError: (error: unknown) => {
            logger.error('Failed to toggle TTS status:', error);
            const message = 'Не удалось изменить статус озвучки.';
            if (notificationCallback) {
                notificationCallback(message);
            }
        },
    });

    const setNotificationHandler = useCallback((callback: ((message: string, type?: string) => void) | null) => {
        if (callback) {
            setNotificationCallback(() => callback);
        }
    }, []);

    useEffect(() => {
        if (!isInitialized && user) {
            setIsInitialized(true);
        }
    }, [isInitialized, user]);

    const checkTtsStatus = useCallback(async (): Promise<void> => {
        if (user) {
            await refetchStatus();
        }
    }, [user, refetchStatus]);

    const checkTtsHealth = useCallback(
        async (
            provider?: 'f5' | 'gcloud',
            mode?: 'cloud' | 'local'
        ): Promise<{ isHealthy: boolean; isChecking: boolean }> => {
            return runProviderHealthCheck(provider, mode);
        },
        [runProviderHealthCheck]
    );

    useEffect(() => {
        const handleTtsStatusChange = (event: CustomEvent<{ enabled: boolean }>) => {
            logger.log('[REFRESH] TtsContext: Received tts-status-changed event:', event.detail);
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
    }, []);

    const loadVoices = useCallback(async (): Promise<void> => {
        // Голоса загружаются автоматически через useGlobalVoices
    }, []);

    useEffect(() => {
        setIsToggling(toggleTtsMutation.isPending);
    }, [toggleTtsMutation.isPending]);

    const toggleTts = useCallback(
        async (_event: unknown = null): Promise<void> => {
            if (isToggling || toggleTtsMutation.isPending || isCheckingHealth) {
                return;
            }

            const nextEnabled = !ttsEnabled;
            if (nextEnabled && shouldCheckProviderHealth) {
                const healthState = await runProviderHealthCheck();
                if (!healthState.isHealthy) {
                    const message = 'Selected TTS provider is unavailable. Enabling TTS was cancelled.';
                    if (notificationCallback) {
                        notificationCallback(message, 'error');
                    }
                    return;
                }
            }

            toggleTtsMutation.mutate(nextEnabled);
        },
        [
            ttsEnabled,
            isToggling,
            toggleTtsMutation,
            isCheckingHealth,
            shouldCheckProviderHealth,
            runProviderHealthCheck,
            notificationCallback,
        ]
    );

    const initializeTts = useCallback(async (): Promise<void> => {
        if (!isInitialized && user) {
            setIsInitialized(true);
        }
    }, [isInitialized, user]);

    const value = useMemo<TtsContextValue>(
        () => ({
            ttsEnabled,
            isWhitelisted,
            setIsWhitelisted,
            voices,
            engineStatus,
            isInitialized,
            isToggling,
            toggleTts,
            loadVoices,
            initializeTts,
            setNotificationHandler,
            checkTtsStatus,
            checkTtsHealth,
            isCheckingHealth,
        }),
        [
            ttsEnabled,
            isWhitelisted,
            voices,
            engineStatus,
            isInitialized,
            isToggling,
            toggleTts,
            loadVoices,
            initializeTts,
            setNotificationHandler,
            checkTtsStatus,
            checkTtsHealth,
            isCheckingHealth,
        ]
    );

    return <TtsContext.Provider value={value}>{children}</TtsContext.Provider>;
};
