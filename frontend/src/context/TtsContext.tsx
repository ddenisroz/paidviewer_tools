import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { keepPreviousData } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';


import { STORAGE_KEYS } from '@/constants';
import { useGlobalVoices, useToggleTts, useTtsHealth, useTtsStatus } from '@/queries/tts/ttsQueries';
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
    checkTtsHealth: () => Promise<{ isHealthy: boolean; isChecking: boolean }>;
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
    const [engineStatus, setEngineStatus] = useState<EngineStatus>({ loaded: false, error: null });
    const [notificationCallback, setNotificationCallback] = useState<((message: string, type?: string) => void) | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [isToggling, setIsToggling] = useState<boolean>(false);



    const ttsRelatedPaths = ['/dashboard/tts', '/tts'];
    const isTtsPage = ttsRelatedPaths.some(path => location.pathname.startsWith(path));
    const ttsStatusInterval = isTtsPage ? 30 * 1000 : 120 * 1000;

    const channelName = null;

    const { data: healthData, isLoading: isCheckingHealth, error: healthError } = useTtsHealth({
        enabled: !!user && isTtsPage,
        refetchInterval: 30 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (healthData) {
            const healthResponse = (healthData?.data || healthData) as { tts_engine_loaded?: boolean };
            const isHealthy = healthResponse?.tts_engine_loaded === true;
            if (isHealthy) {
                setEngineStatus({ loaded: true, error: null });
            } else {
                setEngineStatus({ loaded: false, error: "TTS движок не готов" });
            }
        }
    }, [healthData]);

    useEffect(() => {
        if (healthError) {
            logger.error("TTS Health check failed:", healthError);
            setEngineStatus({ loaded: false, error: "Не удается подключиться к TTS сервису" });
        }
    }, [healthError]);

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
                listening_mode?: 'website' | 'obs';
                listeningMode?: 'website' | 'obs';
            };
            // Validate that we actually have the expected fields
            if (statusResponse && typeof statusResponse.enabled === 'boolean') {
                setTtsEnabled(statusResponse.enabled);
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem('tts_enabled', String(statusResponse.enabled));
                }

                if (typeof statusResponse.is_whitelisted === 'boolean') {
                    setIsWhitelisted(statusResponse.is_whitelisted);
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
                        window.dispatchEvent(new CustomEvent('tts-listening-mode-changed', {
                            detail: { mode: normalizedMode }
                        }));
                    }
                }
            } else {
                logger.warn('[TtsContext] Invalid TTS status data received (ignoring update):', statusResponse);
            }
        }
    }, [statusData]);

    const { data: voicesData } = useGlobalVoices({
        enabled: !!user && engineStatus.loaded,
    });

    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (voicesData) {
            const voicesResponse = (voicesData as { voices?: TtsVoice[] })?.voices || voicesData;
            if (Array.isArray(voicesResponse)) {
                setVoices(voicesResponse);
            } else if (typeof voicesResponse === 'object' && voicesResponse !== null && 'success' in voicesResponse && 'voices' in voicesResponse && Array.isArray((voicesResponse as { voices: TtsVoice[] }).voices)) {
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
            window.dispatchEvent(new CustomEvent('tts-status-changed', {
                detail: { enabled }
            }));
            const message = enabled ? "Озвучка сообщений включена." : "Озвучка сообщений отключена.";
            if (notificationCallback) {
                notificationCallback(message, "success");
            }
        },
        onError: (error: unknown) => {
            logger.error("Failed to toggle TTS status:", error);
            const message = "Не удалось изменить статус озвучки.";
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

    const checkTtsHealth = useCallback(async (): Promise<{ isHealthy: boolean; isChecking: boolean }> => {
        return { isHealthy: engineStatus.loaded, isChecking: isCheckingHealth };
    }, [engineStatus.loaded, isCheckingHealth]);

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

    const toggleTts = useCallback(async (_event: unknown = null): Promise<void> => {
        if (isToggling || toggleTtsMutation.isPending) {
            return;
        }

        // Note: We no longer block on engineStatus or whitelist checks
        // The API will handle validation and return appropriate errors
        // This allows Shift+T shortcut to work without waiting for health checks

        toggleTtsMutation.mutate(!ttsEnabled);
    }, [ttsEnabled, isToggling, toggleTtsMutation]);

    const initializeTts = useCallback(async (): Promise<void> => {
        if (!isInitialized && user) {
            setIsInitialized(true);
        }
    }, [isInitialized, user]);

    const value = useMemo<TtsContextValue>(() => ({
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
    }), [
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
    ]);

    return (
        <TtsContext.Provider value={value}>
            {children}
        </TtsContext.Provider>
    );
};

