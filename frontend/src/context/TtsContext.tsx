import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { useToast } from '../components/ui/toast';
import { useButtonPosition } from '../hooks/useButtonPosition';
import { logger } from '../utils/prodLogger';
import { useTtsStatus, useTtsHealth, useToggleTts, useGlobalVoices } from '../queries/tts/ttsQueries';
import { useLocation } from 'react-router-dom';
import type { TtsVoice } from '../types/tts';

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
    toggleTts: (event?: any) => Promise<void>;
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
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();
    const { getButtonPosition } = useButtonPosition();
    const location = useLocation();
    const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
    const [voices, setVoices] = useState<TtsVoice[]>([]);
    const [engineStatus, setEngineStatus] = useState<EngineStatus>({ loaded: false, error: null });
    const [notificationCallback, setNotificationCallback] = useState<((message: string, type?: string) => void) | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [isToggling, setIsToggling] = useState<boolean>(false);
    
    const isGuest = user?.is_guest || user?.id === -1;
    
    const ttsRelatedPaths = ['/dashboard/tts', '/tts'];
    const isTtsPage = ttsRelatedPaths.some(path => location.pathname.startsWith(path));
    
    const channelName = user?.isGuest ? user.username : null;
    
    const { data: healthData, isLoading: isCheckingHealth, error: healthError } = useTtsHealth({
        enabled: !isGuest && isTtsPage,
        refetchInterval: 30 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
    
    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (healthData) {
            const healthResponse = healthData?.data || healthData;
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
        refetchInterval: 30 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
    
    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (statusData) {
            const statusResponse = statusData?.data || statusData;
            if (statusResponse) {
                setTtsEnabled(statusResponse.enabled || false);
                setIsWhitelisted(statusResponse.is_whitelisted || false);
                if (statusResponse.has_local_setup) {
                    localStorage.setItem('tts_has_local_setup', 'true');
                } else {
                    localStorage.setItem('tts_has_local_setup', 'false');
                }
            }
        }
    }, [statusData]);
    
    const { data: voicesData } = useGlobalVoices({
        enabled: !!user && engineStatus.loaded,
    });
    
    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (voicesData) {
            const voicesResponse = (voicesData as any)?.voices || voicesData;
            if (Array.isArray(voicesResponse)) {
                setVoices(voicesResponse);
            } else if (voicesResponse?.success && Array.isArray(voicesResponse.voices)) {
                setVoices(voicesResponse.voices);
            }
        }
    }, [voicesData]);
    
    const toggleTtsMutation = useToggleTts({
        onSuccess: (data: any, enabled: boolean) => {
            setTtsEnabled(enabled);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled } 
            }));
            const message = enabled ? "Озвучка сообщений включена." : "Озвучка сообщений отключена.";
            if (notificationCallback) {
                notificationCallback(message, "success");
            }
        },
        onError: (error: any) => {
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
            logger.log('🔄 TtsContext: Received tts-status-changed event:', event.detail);
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

    const toggleTts = useCallback(async (event: any = null): Promise<void> => {
        if (isToggling || toggleTtsMutation.isPending) {
            return;
        }
        
        if (!engineStatus.loaded) {
            const errorMessage = engineStatus.error || "TTS движок не готов. Попробуйте обновить страницу.";
            if (notificationCallback) {
                notificationCallback(errorMessage);
            }
            return;
        }

        if (!isWhitelisted) {
            const message = "Ваш канал не в белом списке для использования TTS.";
            if (notificationCallback) {
                notificationCallback(message);
            }
            return;
        }

        toggleTtsMutation.mutate(!ttsEnabled);
    }, [engineStatus.loaded, isWhitelisted, ttsEnabled, notificationCallback, isToggling, toggleTtsMutation]);

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

