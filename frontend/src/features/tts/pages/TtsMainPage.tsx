import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Play, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useTts } from '@/context/TtsContext';
import TtsChannelPointsMode from '@/features/tts/components/TtsChannelPointsMode';
import TtsFilterManager from '@/features/tts/components/TtsFilterManager';
import { STORAGE_KEYS } from '@/constants';
import { queryKeys } from '@/queries/queryKeys';
import {
    useRegenerateTtsObsUrl,
    useSaveTtsAudioSettings,
    useSaveTtsModeSettings,
    useSaveTtsPlatformSettings,
    useSaveTtsSettings,
    useSetTtsEngine,
    useSetTtsListeningMode,
    useToggleTts,
    useTtsAudioSettings,
    useTtsModeSettings,
    useTtsPlatformSettings,
    useTtsSettings,
    useTtsStatus
} from '@/queries/tts/ttsQueries';
import { ttsService } from '@/services/api/services/ttsService';
import PageWrapper from '@/shared/components/PageWrapper';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { logger } from '@/shared/utils/prodLogger';
import { getQueryCache } from '@/shared/utils/queryPersist';
import { getTtsWebSocketUrl } from '@/shared/utils/urlUtils';
import { toast } from '@/utils/toastManager';

import type { ApiResponse } from '@/types';
import type { AxiosError } from 'axios';

interface PlatformSettings {
    enabled_platforms: ('twitch' | 'vk')[];
    global_enabled: boolean;
}

interface TtsSettingsState {
    enable7TV: boolean;
    enableTwitch: boolean;
    filterReplies: boolean;
    filterMentions: boolean;
    version: number;
}

interface TtsStatusData {
    enabled?: boolean;
    engine_type?: 'cloud' | 'local' | 'gtts' | 'gcloud';
}

interface TtsSettingsData {
    enable7TV?: boolean;
    enableTwitch?: boolean;
    filterReplies?: boolean;
    filterMentions?: boolean;
    version?: number;
    listeningMode?: 'website' | 'obs';
    gcloudVoices?: string[];
    gcloud_voices?: string[];
}

interface GcloudVoice {
    name: string;
    languageCodes?: string[];
    ssmlGender?: string;
    naturalSampleRateHertz?: number;
}

interface AudioSettingsData {
    websiteVolume?: number;
}

interface PlatformSettingsData {
    enabled_platforms?: ('twitch' | 'vk')[];
    global_enabled?: boolean;
}

interface ModeSettingsData {
    tts_mode?: 'all_messages' | 'channel_points';
}

interface ObsTokenResponse {
    obs_token?: string;
}

interface TtsModeResponse {
    message?: string;
}

const TtsMainPageContent: React.FC = () => {
    const navigate = useNavigate();
    const { ttsEnabled: _ttsEnabled, isWhitelisted, initializeTts: _initializeTts, engineStatus, isCheckingHealth } = useTts();
    const isHealthy = engineStatus.loaded;
    const isChecking = isCheckingHealth;
    const { isAuthenticated, user } = useAuth();
    const { integrations } = useIntegrations();

    const [basicTtsEnabled, setBasicTtsEnabled] = useState<boolean>(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState<boolean>(false);
    const [gcloudTtsEnabled, setGcloudTtsEnabled] = useState<boolean>(false);
    const [ttsTriggerMode, setTtsTriggerMode] = useState<'all_messages' | 'channel_points'>('all_messages');
    const [ttsEngine, setTtsEngine] = useState<'cloud' | 'local' | 'gtts' | 'gcloud'>('cloud');
    const [f5Mode, setF5Mode] = useState<'cloud' | 'local'>('cloud');
    const [listeningMode, setListeningMode] = useState<'website' | 'obs'>('website');
    const [obsUrl, setObsUrl] = useState<string>('');
    const [showObsUrl, setShowObsUrl] = useState<boolean>(false);
    const [localVolume, setLocalVolume] = useState<number>(50);
    const [gcloudVoices, setGcloudVoices] = useState<GcloudVoice[]>([]);
    const [selectedGcloudVoices, setSelectedGcloudVoices] = useState<string[]>([]);
    const [isLoadingGcloudVoices, setIsLoadingGcloudVoices] = useState<boolean>(false);
    const [isSavingGcloudVoices, setIsSavingGcloudVoices] = useState<boolean>(false);
    const [previewingGcloudVoice, setPreviewingGcloudVoice] = useState<string | null>(null);

    const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });

    const [ttsSettings, setTtsSettings] = useState<TtsSettingsState>({
        enable7TV: true,
        enableTwitch: true,
        filterReplies: false,
        filterMentions: false,
        version: 1,
    });

    const { data: ttsStatus } = useTtsStatus();

    // Синхронизация состояния TTS с бэкендом при загрузке
    useEffect(() => {
        const statusData = ttsStatus?.data;
        if (statusData?.enabled !== undefined) {
            const engineType = statusData.engine_type || 'gtts';
            const isF5 = engineType === 'cloud' || engineType === 'local';
            const isGcloud = engineType === 'gcloud';
            setBasicTtsEnabled(statusData.enabled && engineType === 'gtts');
            setAiTtsEnabled(statusData.enabled && isF5);
            setGcloudTtsEnabled(statusData.enabled && isGcloud);

            if (statusData.engine_type) {
                setTtsEngine(statusData.engine_type as 'cloud' | 'local' | 'gtts' | 'gcloud');
                if (isF5) {
                    setF5Mode(statusData.engine_type as 'cloud' | 'local');
                }
            }
        }
    }, [ttsStatus]);

    const [_localTtsConfig, _setLocalTtsConfig] = useState<unknown>(null);
    const [isSavingMode, setIsSavingMode] = useState<boolean>(false);
    const [isRegeneratingUrl, setIsRegeneratingUrl] = useState<boolean>(false);

    const volumeDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const settingsDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const gcloudSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const gcloudPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
    const gcloudSelectionInitializedRef = useRef<boolean>(false);
    const gcloudVoicesRequestStartedRef = useRef<boolean>(false);

    const queryClient = useQueryClient();
    const isTwitchConnected = integrations.twitch?.enabled;
    const isVkConnected = integrations.vk?.enabled;
    const _hasAnyIntegration = isTwitchConnected || isVkConnected;
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
    const isAnyTtsEnabled = basicTtsEnabled || aiTtsEnabled || gcloudTtsEnabled;
    const f5EngineLabel = f5Mode === 'local' ? 'Локально' : 'Облачно';

    const toggleTtsMutation = useToggleTts({
        onSuccess: () => {
            logger.log('TTS state saved');
        },
    });

    const savePlatformSettingsMutation = useSaveTtsPlatformSettings({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
            logger.log('Platform settings saved');
        },
        onError: (error: unknown) => {
            logger.error('Error saving platform settings:', error);
        }
    });

    const saveAudioSettingsMutation = useSaveTtsAudioSettings({
        onSuccess: () => {
            logger.log('Audio settings saved');
        },
        onError: (error: unknown) => {
            logger.error('Error saving audio settings:', error);
        }
    });

    const saveTtsSettingsMutation = useSaveTtsSettings({
        onSuccess: () => {
            logger.log('TTS settings saved');
        },
        onError: (error: unknown) => {
            const axiosError = error as AxiosError<{ detail?: string }>;
            logger.error('Error saving TTS settings:', error);
            if (axiosError.response?.status === 409) {
                toast.warning('Настройки были изменены. Обновление...');
                setTimeout(() => queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() }), 1500);
            }
        }
    });

    const saveTtsModeSettingsMutation = useSaveTtsModeSettings({
        onSuccess: () => {
            logger.log('TTS mode settings saved');
        },
        onError: (error: unknown) => {
            logger.error('Error saving TTS mode settings:', error);
        }
    });

    const saveListeningModeMutation = useSetTtsListeningMode({
        onSuccess: () => {
            logger.log('Listening mode saved');
        },
    });

    const switchEngineMutation = useSetTtsEngine({
        onSuccess: () => {
            logger.log('Engine switched');
        },
    });

    const { data: ttsStatusResponse, isLoading: isLoadingTtsStatus } = useTtsStatus(null, {
        enabled: !!isAuthenticated,
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(queryKeys.tts.status(null) as any) || undefined
    });
    const ttsStatusData = ttsStatusResponse?.data;

    // Only show loading if we don't have health data yet
    const isF5TTSDataLoading = isChecking;
    const canUseF5TTS = hasLocalSetup || isWhitelisted === true;

    const { data: ttsSettingsResponse } = useTtsSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-settings']) || undefined
    });
    const ttsSettingsData = ttsSettingsResponse?.data;

    const { data: audioSettingsResponse } = useTtsAudioSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-audio-settings']) || undefined
    });
    const audioSettingsData = audioSettingsResponse?.data;

    const { data: platformSettingsResponse } = useTtsPlatformSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-platform-settings']) || undefined
    });
    const platformSettingsData = platformSettingsResponse?.data;

    const { data: modeSettingsResponse } = useTtsModeSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-mode-settings']) || undefined
    });
    const modeSettingsData = modeSettingsResponse?.data;

    const _isDataLoaded = useMemo(() => {
        const hasStatus = ttsStatusData !== undefined || getQueryCache(['tts-status']) !== null;
        const hasSettings = ttsSettingsData !== undefined || getQueryCache(['tts-settings']) !== null;
        const hasAudio = audioSettingsData !== undefined || getQueryCache(['tts-audio-settings']) !== null;
        return hasStatus && hasSettings && hasAudio;
    }, [ttsStatusData, ttsSettingsData, audioSettingsData]);

    useEffect(() => {
        if (ttsStatusData) {
            const statusData = ttsStatusData as TtsStatusData;
            const enabled = statusData.enabled || false;
            const engineType = statusData.engine_type || 'gtts';

            const basicEnabled = enabled && engineType === 'gtts';
            const aiEnabled = enabled && (engineType === 'cloud' || engineType === 'local');
            const gcloudEnabled = enabled && engineType === 'gcloud';

            setBasicTtsEnabled(prev => prev !== basicEnabled ? basicEnabled : prev);
            setAiTtsEnabled(prev => prev !== aiEnabled ? aiEnabled : prev);
            setGcloudTtsEnabled(prev => prev !== gcloudEnabled ? gcloudEnabled : prev);

            if (engineType === 'local' || engineType === 'cloud' || engineType === 'gcloud') {
                setTtsEngine(prev => prev !== engineType ? engineType : prev);
                if (engineType === 'local' || engineType === 'cloud') {
                    setF5Mode(engineType);
                }
            } else {
                setTtsEngine(prev => prev !== 'cloud' ? 'cloud' : prev);
            }
        }
    }, [ttsStatusData]);

    // [OK] Обновление: слушаем событие tts-status-changed для синхронизации с QuickActionsBar
    // [REMOVED] Redundant event listener. State updates are handled by TtsContext.
    // useEffect(() => {
    //     const handleTtsStatusChange = (event: CustomEvent<{ enabled: boolean }>) => {
    //         logger.log('[REFRESH] TtsMainPage: Received tts-status-changed event:', event.detail);
    //         queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
    //     };
    //     window.addEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
    //     return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
    // }, [queryClient]);

    useEffect(() => {
        if (ttsSettingsData) {
            const settingsData = ttsSettingsData as TtsSettingsData;
            setTtsSettings(prev => ({
                ...prev,
                enable7TV: settingsData.enable7TV ?? prev.enable7TV,
                enableTwitch: settingsData.enableTwitch ?? prev.enableTwitch,
                filterReplies: settingsData.filterReplies ?? prev.filterReplies,
                filterMentions: settingsData.filterMentions ?? prev.filterMentions,
                version: settingsData.version ?? prev.version,
            }));

            if (settingsData.listeningMode) {
                setListeningMode(prev => prev !== settingsData.listeningMode ? settingsData.listeningMode! : prev);
            }

            const gcloudSelection = Array.isArray(settingsData.gcloudVoices)
                ? settingsData.gcloudVoices
                : Array.isArray(settingsData.gcloud_voices)
                    ? settingsData.gcloud_voices
                    : null;

            if (gcloudSelection) {
                setSelectedGcloudVoices(gcloudSelection);
                gcloudSelectionInitializedRef.current = gcloudSelection.length > 0;
            }
        }
    }, [ttsSettingsData]);

    useEffect(() => {
        const audioData = audioSettingsData as AudioSettingsData | undefined;
        if (audioData?.websiteVolume !== undefined) {
            setLocalVolume(prev => prev !== audioData.websiteVolume ? audioData.websiteVolume! : prev);
        }
    }, [audioSettingsData]);

    useEffect(() => {
        if (!(gcloudTtsEnabled || ttsEngine === 'gcloud')) {
            gcloudVoicesRequestStartedRef.current = false;
        }
    }, [gcloudTtsEnabled, ttsEngine]);

    useEffect(() => {
        const shouldLoadVoices = gcloudTtsEnabled || ttsEngine === 'gcloud';
        if (
            !shouldLoadVoices
            || isLoadingGcloudVoices
            || gcloudVoices.length > 0
            || gcloudVoicesRequestStartedRef.current
        ) {
            return;
        }

        gcloudVoicesRequestStartedRef.current = true;
        setIsLoadingGcloudVoices(true);
        ttsService.getGcloudVoices('ru-RU')
            .then((response) => {
                const payload = response.data as { voices?: GcloudVoice[]; data?: { voices?: GcloudVoice[] } };
                const voices = payload?.data?.voices || payload?.voices || [];
                setGcloudVoices(voices);

                if (!gcloudSelectionInitializedRef.current && selectedGcloudVoices.length === 0 && voices.length > 0) {
                    const allVoices = voices.map((voice) => voice.name).filter(Boolean);
                    if (allVoices.length > 0) {
                        setSelectedGcloudVoices(allVoices);
                        gcloudSelectionInitializedRef.current = true;
                        ttsService.saveGcloudVoices(allVoices).catch(() => {
                            toast.error('Не удалось сохранить голоса Google Cloud');
                        });
                    }
                }
            })
            .catch((error: unknown) => {
                logger.error('Error loading Google Cloud voices:', error);
                toast.error('Не удалось загрузить голоса Google Cloud');
            })
            .finally(() => {
                setIsLoadingGcloudVoices(false);
            });
    }, [gcloudTtsEnabled, ttsEngine, gcloudVoices.length, isLoadingGcloudVoices, selectedGcloudVoices.length]);

    useEffect(() => {
        const platformData = platformSettingsData as PlatformSettingsData | undefined;
        if (platformData?.enabled_platforms) {
            setPlatformSettings(prev => {
                const newPlatforms = platformData.enabled_platforms || [];
                const currentPlatforms = prev.enabled_platforms || [];
                if (JSON.stringify(currentPlatforms) !== JSON.stringify(newPlatforms)) {
                    return {
                        ...prev,
                        enabled_platforms: newPlatforms as ('twitch' | 'vk')[],
                        global_enabled: platformData.global_enabled ?? prev.global_enabled
                    };
                }
                return prev;
            });
        }
    }, [platformSettingsData]);

    useEffect(() => {
        const handleTtsSettingsChanged = (event: CustomEvent<{ enabledPlatforms?: ('twitch' | 'vk')[] }>): void => {
            const enabledPlatforms = Array.isArray(event.detail?.enabledPlatforms) ? event.detail.enabledPlatforms : [];
            setPlatformSettings(prev => {
                const next = {
                    ...prev,
                    enabled_platforms: enabledPlatforms as ('twitch' | 'vk')[]
                };
                queryClient.setQueryData(queryKeys.tts.platformSettings(), { success: true, data: next });
                return next;
            });
        };

        window.addEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
        return () => window.removeEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
    }, [queryClient]);

    useEffect(() => {
        const modeData = modeSettingsData as ModeSettingsData | undefined;
        if (modeData?.tts_mode) {
            setTtsTriggerMode(prev => prev !== modeData.tts_mode ? modeData.tts_mode! : prev);
        }
    }, [modeSettingsData]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const normalizedMode = listeningMode === 'obs' ? 'obs' : 'website';
        const currentMode = window.localStorage.getItem(STORAGE_KEYS.TTS_LISTENING_MODE);
        if (currentMode !== normalizedMode) {
            window.localStorage.setItem(STORAGE_KEYS.TTS_LISTENING_MODE, normalizedMode);
            window.dispatchEvent(new CustomEvent('tts-listening-mode-changed', {
                detail: { mode: normalizedMode }
            }));
        }
    }, [listeningMode]);

    useEffect(() => {
        if (listeningMode === 'obs' && isAuthenticated && user?.id) {
            ttsService.generateObsUrl()
                .then(response => {
                    const obsResponse = response.data as ApiResponse<ObsTokenResponse>;
                    const token = obsResponse?.data?.obs_token || (obsResponse as unknown as ObsTokenResponse)?.obs_token;
                    if (token) {
                        const url = getTtsWebSocketUrl(token);
                        setObsUrl(url);
                        logger.log('OBS URL generated:', url);
                    }
                })
                .catch((err: unknown) => {
                    logger.error('Error generating OBS URL:', err);
                    toast.error('Ошибка генерации OBS URL');
                });
        } else if (listeningMode === 'website') {
            setObsUrl('');
        }
    }, [listeningMode, isAuthenticated, user?.id]);

    const handleGlobalTtsToggle = (): void => {
        if (!isTwitchConnected && !isVkConnected) {
            toast.error('Для использования TTS необходимо подключить хотя бы одну платформу');
            return;
        }

        const newState = !isAnyTtsEnabled;

        // [OK] Оптимистичное обновление UI
        if (newState) {
            setBasicTtsEnabled(true);
        } else {
            setBasicTtsEnabled(false);
            setAiTtsEnabled(false);
        }

        toggleTtsMutation.mutate(newState, {
            onSuccess: () => {
                // [OK] Инвалидируем кэш для получения актуального статуса
                queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: newState } }));
            },
            onError: (error: unknown) => {
                // Откатываем оптимистичное обновление при ошибке
                if (newState) {
                    setBasicTtsEnabled(false);
                } else {
                    setBasicTtsEnabled(true);
                }
                logger.error('Error toggling TTS:', error);
                toast.error('Ошибка переключения TTS');
            },
        });
    };

    const handleTtsModeChange = (mode: 'all_messages' | 'channel_points'): void => {
        if (isSavingMode || saveTtsModeSettingsMutation.isPending) return;

        setIsSavingMode(true);
        saveTtsModeSettingsMutation.mutate({ tts_mode: mode }, {
            onSuccess: (response) => {
                setTtsTriggerMode(mode);
                const responseData = response?.data as TtsModeResponse | undefined;
                if (responseData?.message) {
                    toast.success(responseData.message);
                }
            },
            onError: (error: unknown) => {
                logger.error('Error changing TTS mode:', error);
            },
            onSettled: () => {
                setIsSavingMode(false);
            },
        });
    };

    const handleBasicTtsToggle = (): void => {
        const newValue = !basicTtsEnabled;

        // [OK] Оптимистичное обновление UI
        if (newValue) {
            setBasicTtsEnabled(true);
            setAiTtsEnabled(false);
            setGcloudTtsEnabled(false);
        } else {
            setBasicTtsEnabled(false);
        }

        if (!newValue && (aiTtsEnabled || gcloudTtsEnabled)) {
            const nextEngine = gcloudTtsEnabled ? 'gcloud' : f5Mode;
            switchEngineMutation.mutate(nextEngine, {
                onSuccess: () => {
                    setTtsEngine(nextEngine);
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                    window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                    toast.success('Переключено на альтернативный движок');
                },
                onError: (error: unknown) => {
                    setBasicTtsEnabled(true);
                    logger.error('Error switching engine:', error);
                    toast.error('Ошибка переключения движка');
                },
            });
            return;
        }

        toggleTtsMutation.mutate(newValue, {
            onSuccess: () => {
                // [OK] Инвалидируем кэш для получения актуального статуса
                queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });

                if (newValue && (aiTtsEnabled || gcloudTtsEnabled)) {
                    switchEngineMutation.mutate('gtts', {
                        onSuccess: () => {
                            setAiTtsEnabled(false);
                            setGcloudTtsEnabled(false);
                        },
                    });
                } else {
                    window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: newValue } }));
                    toast.success(newValue ? 'Google TTS включен' : 'TTS выключен');
                }
            },
            onError: (error: unknown) => {
                // Откатываем оптимистичное обновление при ошибке
                setBasicTtsEnabled(!newValue);
                logger.error('Error toggling basic TTS:', error);
                toast.error('Ошибка переключения TTS');
            },
        });
    };

    const handleAiTtsToggle = (): void => {
        if (!canUseF5TTS || !isHealthy) {
            toast.error('F5-TTS недоступен');
            return;
        }

        const newValue = !aiTtsEnabled;

        // [OK] Оптимистичное обновление UI
        if (newValue) {
            setAiTtsEnabled(true);
            setBasicTtsEnabled(true);
            setGcloudTtsEnabled(false);
        } else {
            setAiTtsEnabled(false);
        }

        if (newValue && !isAnyTtsEnabled) {
            toggleTtsMutation.mutate(true, {
                onSuccess: () => {
                    // [OK] Инвалидируем кэш для получения актуального статуса
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                    setBasicTtsEnabled(true);
                    const engineType = f5Mode;
                    switchEngineMutation.mutate(engineType, {
                        onSuccess: () => {
                            setTtsEngine(engineType);
                            toast.success('F5-TTS включен');
                            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                        },
                        onError: (error: unknown) => {
                            setAiTtsEnabled(false);
                            logger.error('Error switching engine:', error);
                            toast.error('Ошибка переключения движка');
                        },
                    });
                },
                onError: (error: unknown) => {
                    setAiTtsEnabled(false);
                    logger.error('Error enabling TTS:', error);
                    toast.error('Ошибка включения TTS');
                },
            });
        } else {
            const engineType = newValue ? f5Mode : 'gtts';
            switchEngineMutation.mutate(engineType, {
                onSuccess: () => {
                    // [OK] Инвалидируем кэш для получения актуального статуса
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });

                    if (newValue) {
                        setTtsEngine(engineType);
                        toast.success('F5-TTS включен');
                        window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                    } else {
                        setTtsEngine('gtts');
                        toast.success('Переключено на Google TTS');
                    }
                },
                onError: (error: unknown) => {
                    // Откатываем оптимистичное обновление при ошибке
                    setAiTtsEnabled(!newValue);
                    logger.error('Error switching engine:', error);
                    toast.error('Ошибка переключения движка');
                },
            });
        }
    };

    const handleGcloudTtsToggle = (): void => {
        const newValue = !gcloudTtsEnabled;

        if (newValue) {
            setGcloudTtsEnabled(true);
            setAiTtsEnabled(false);
            setBasicTtsEnabled(false);
            setTtsEngine('gcloud');
        } else {
            setGcloudTtsEnabled(false);
            setBasicTtsEnabled(true);
            setTtsEngine('gtts');
        }

        if (newValue && !isAnyTtsEnabled) {
            toggleTtsMutation.mutate(true, {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                    switchEngineMutation.mutate('gcloud', {
                        onSuccess: () => {
                            toast.success('Google Cloud TTS включен');
                            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                        },
                        onError: (error: unknown) => {
                            setGcloudTtsEnabled(false);
                            logger.error('Error switching engine:', error);
                            toast.error('Ошибка переключения движка');
                        },
                    });
                },
                onError: (error: unknown) => {
                    setGcloudTtsEnabled(false);
                    logger.error('Error enabling TTS:', error);
                    toast.error('Ошибка включения TTS');
                },
            });
        } else {
            const engineType = newValue ? 'gcloud' : 'gtts';
            switchEngineMutation.mutate(engineType, {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                    if (newValue) {
                        toast.success('Google Cloud TTS включен');
                        window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                    } else {
                        toast.success('Переключено на Google TTS');
                    }
                },
                onError: (error: unknown) => {
                    setGcloudTtsEnabled(!newValue);
                    logger.error('Error switching engine:', error);
                    toast.error('Ошибка переключения движка');
                },
            });
        }
    };

    const handleF5ModeChange = (mode: 'cloud' | 'local'): void => {
        if (mode === f5Mode) return;
        if (mode === 'local' && !hasLocalSetup) {
            toast.error('Сначала настройте локальный F5-TTS во вкладке "Локальный TTS"');
            return;
        }
        if (mode === 'cloud' && isWhitelisted !== true) {
            toast.error('Доступ к F5 Cloud отсутствует');
            return;
        }

        setF5Mode(mode);
        if (!aiTtsEnabled) {
            return;
        }

        switchEngineMutation.mutate(mode, {
            onSuccess: () => {
                setTtsEngine(mode);
                queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                toast.success(mode === 'local' ? 'F5-TTS: локальный режим' : 'F5-TTS: облачный режим');
            },
            onError: (error: unknown) => {
                logger.error('Error switching F5 mode:', error);
                toast.error('Ошибка переключения режима F5');
            },
        });
    };

    const handleListeningModeChange = (mode: 'website' | 'obs'): void => {
        setListeningMode(mode);
        saveListeningModeMutation.mutate(mode);
    };

    const handleVolumeChange = useCallback((value: number): void => {
        setLocalVolume(value);

        if (volumeDebounceRef.current) {
            clearTimeout(volumeDebounceRef.current);
        }

        volumeDebounceRef.current = setTimeout(() => {
            saveAudioSettingsMutation.mutate({ websiteVolume: value });
        }, 300);
    }, [saveAudioSettingsMutation]);

    const persistGcloudVoices = useCallback((voices: string[]): void => {
        if (gcloudSaveDebounceRef.current) {
            clearTimeout(gcloudSaveDebounceRef.current);
        }

        const uniqueVoices = Array.from(new Set(voices)).filter(Boolean);

        gcloudSaveDebounceRef.current = setTimeout(() => {
            setIsSavingGcloudVoices(true);
            ttsService.saveGcloudVoices(uniqueVoices)
                .then(() => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
                })
                .catch((error: unknown) => {
                    logger.error('Error saving Google Cloud voices:', error);
                    toast.error('Не удалось сохранить голоса Google Cloud');
                })
                .finally(() => {
                    setIsSavingGcloudVoices(false);
                });
        }, 250);
    }, [queryClient]);

    const handleGcloudVoiceToggle = useCallback((voiceName: string, checked: boolean): void => {
        setSelectedGcloudVoices(prev => {
            const next = checked
                ? Array.from(new Set([...prev, voiceName]))
                : prev.filter(name => name !== voiceName);

            if (next.length === 0) {
                toast.error('Нужно выбрать хотя бы один голос');
                return prev;
            }

            persistGcloudVoices(next);
            return next;
        });
    }, [persistGcloudVoices]);

    const handleGcloudPreview = useCallback(async (voiceName: string): Promise<void> => {
        if (previewingGcloudVoice === voiceName) return;

        setPreviewingGcloudVoice(voiceName);
        try {
            if (gcloudPreviewAudioRef.current) {
                gcloudPreviewAudioRef.current.pause();
                gcloudPreviewAudioRef.current.currentTime = 0;
            }

            const response = await ttsService.previewGcloudVoice({
                voice_name: voiceName,
                text: 'Привет! Это тестовый голос Google Cloud.'
            });
            const payload = response.data as { audio_url?: string; data?: { audio_url?: string } };
            const audioUrl = payload?.data?.audio_url || payload?.audio_url;

            if (!audioUrl) {
                toast.error('Не удалось получить аудио для предпрослушки');
                setPreviewingGcloudVoice(null);
                return;
            }

            const audio = new Audio(audioUrl);
            gcloudPreviewAudioRef.current = audio;
            audio.volume = Math.min(1, Math.max(0, localVolume / 100));

            audio.onended = () => {
                setPreviewingGcloudVoice(null);
            };
            audio.onerror = () => {
                setPreviewingGcloudVoice(null);
                toast.error('Ошибка воспроизведения предпрослушки');
            };

            await audio.play();
        } catch (error: unknown) {
            logger.error('Error previewing Google Cloud voice:', error);
            toast.error('Не удалось воспроизвести голос');
            setPreviewingGcloudVoice(null);
        }
    }, [previewingGcloudVoice, localVolume]);

    const handleTtsSettingChange = useCallback((key: keyof TtsSettingsState, value: boolean | number): void => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettings(newSettings);

        if (settingsDebounceRef.current) {
            clearTimeout(settingsDebounceRef.current);
        }

        settingsDebounceRef.current = setTimeout(() => {
            // Updated to use camelCase matching backend Pydantic model
            const ttsSettingsPayload = {
                enable7TV: newSettings.enable7TV,
                enableTwitch: newSettings.enableTwitch,
                filterReplies: newSettings.filterReplies,
                filterMentions: newSettings.filterMentions,
                version: newSettings.version
            };
            saveTtsSettingsMutation.mutate(ttsSettingsPayload);
        }, 200);
    }, [ttsSettings, saveTtsSettingsMutation]);

    const handlePlatformToggle = useCallback((platform: 'twitch' | 'vk'): void => {
        const isConnected = platform === 'twitch' ? isTwitchConnected : isVkConnected;
        if (!isConnected) {
            toast.error(`Сначала подключите интеграцию с ${platform === 'twitch' ? 'Twitch' : 'VK Live'}`);
            return;
        }

        const currentPlatforms = platformSettings.enabled_platforms || [];
        const newEnabledPlatforms = currentPlatforms.includes(platform)
            ? currentPlatforms.filter(p => p !== platform)
            : [...currentPlatforms, platform];

        setPlatformSettings(prev => ({ ...prev, enabled_platforms: newEnabledPlatforms }));

        savePlatformSettingsMutation.mutate({ enabled_platforms: newEnabledPlatforms }, {
            onSuccess: () => {
                window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                    detail: { enabledPlatforms: newEnabledPlatforms }
                }));
            },
            onError: () => setPlatformSettings(prev => ({ ...prev, enabled_platforms: currentPlatforms }))
        });
    }, [platformSettings.enabled_platforms, savePlatformSettingsMutation]);

    const regenerateObsUrlMutation = useRegenerateTtsObsUrl({
        onSuccess: (response) => {
            const responseData = response?.data as ObsTokenResponse | undefined;
            const token = responseData?.obs_token;
            if (token) {
                const url = getTtsWebSocketUrl(token);
                setObsUrl(url);
                toast.success('Токен обновлен, URL скопирован в буфер обмена');
                navigator.clipboard.writeText(url);
                logger.log('OBS URL regenerated:', url);
            } else {
                toast.error('Токен не получен');
            }
        },
        onError: (error: unknown) => {
            logger.error('Error regenerating OBS URL:', error);
        },
    });

    const handleRegenerateObsUrl = (): void => {
        if (regenerateObsUrlMutation.isPending) return;
        setIsRegeneratingUrl(true);
        regenerateObsUrlMutation.mutate(undefined, {
            onSettled: () => {
                setIsRegeneratingUrl(false);
            },
        });
    };

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Text to Speech">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Требуется авторизация
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для использования TTS необходимо войти в систему и подключить хотя бы одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Войти в систему
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    if (!isTwitchConnected && !isVkConnected) {
        return (
            <PageWrapper title="Text to Speech">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Нет подключенных платформ
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для использования TTS необходимо подключить хотя бы одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard/settings')}
                            className="gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Перейти к настройкам
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Text to Speech">
            <div className="space-y-4 max-w-5xl mx-auto">
                {/* Главный переключатель TTS */}
                <div className="flex items-center justify-between p-4 rounded-xl card-glass cursor-pointer" onClick={handleGlobalTtsToggle}>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isAnyTtsEnabled ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'}`} />
                        <div>
                            <div className="text-sm font-bold text-foreground">Озвучка сообщений</div>
                            <div className="text-xs text-muted-foreground">
                                {isAnyTtsEnabled ? 'Включена' : 'Выключена'}
                            </div>
                        </div>
                    </div>
                    <Switch
                        checked={isAnyTtsEnabled}
                        onCheckedChange={handleGlobalTtsToggle}
                        className="data-[state=checked]:bg-green-600 pointer-events-none"
                        disabled={false}
                    />
                </div>

                {isAnyTtsEnabled && (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Настройки голоса */}
                            <Card className="card-glass flex flex-col">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold">Озвучка</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 flex-1 flex flex-col">
                                    {/* Режим триггера */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Режим триггера</label>
                                        <TtsChannelPointsMode
                                            ttsMode={ttsTriggerMode}
                                            onModeChange={handleTtsModeChange}
                                            isSaving={isSavingMode}
                                            showModeSelector={true}
                                            showRewards={true}
                                        />
                                    </div>

                                    {/* Базовая озвучка */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Базовая озвучка</label>
                                        <div className="space-y-2">
                                            <div
                                                onClick={handleBasicTtsToggle}
                                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${basicTtsEnabled && !aiTtsEnabled && !gcloudTtsEnabled
                                                    ? 'bg-purple-600/15 border border-gray-700/50'
                                                    : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/50'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Google TTS</div>
                                                    <div className="text-xs text-gray-400">Базовый, бесплатно</div>
                                                </div>
                                                <Switch
                                                    checked={basicTtsEnabled && !aiTtsEnabled && !gcloudTtsEnabled}
                                                    onCheckedChange={handleBasicTtsToggle}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="data-[state=checked]:bg-purple-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Advanced озвучка */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-xs font-semibold text-gray-400">Advanced озвучка</label>
                                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                                {isF5TTSDataLoading ? (
                                                    <>
                                                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                                        Проверка F5...
                                                    </>
                                                ) : isHealthy ? (
                                                    <>
                                                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                                                        F5 доступен
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle className="w-3 h-3 text-yellow-400" />
                                                        F5 недоступен
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div
                                                onClick={(!isHealthy || !canUseF5TTS || isF5TTSDataLoading) ? undefined : handleAiTtsToggle}
                                                className={`group flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${(!isHealthy || !canUseF5TTS || isF5TTSDataLoading)
                                                    ? 'opacity-50 cursor-not-allowed bg-gray-800/20 border border-gray-700/30'
                                                    : aiTtsEnabled
                                                        ? 'cursor-pointer bg-purple-600/15 border border-gray-700/50'
                                                        : 'cursor-pointer bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/50'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                                                        F5 TTS
                                                        {isF5TTSDataLoading && (
                                                            <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {isF5TTSDataLoading
                                                            ? 'Проверка статуса...'
                                                            : !isHealthy
                                                                ? 'F5 сервис недоступен'
                                                                : !canUseF5TTS
                                                                    ? 'Требуется whitelist'
                                                                    : f5EngineLabel}
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={aiTtsEnabled}
                                                    onCheckedChange={handleAiTtsToggle}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={!isHealthy || !canUseF5TTS || isF5TTSDataLoading}
                                                    className="data-[state=checked]:bg-purple-600"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between px-2">
                                                <span className="text-[11px] text-gray-500">Режим F5</span>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleF5ModeChange('cloud')}
                                                        disabled={isWhitelisted !== true}
                                                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 ${f5Mode === 'cloud'
                                                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                                                            : 'bg-gray-800/60 text-gray-400 border border-gray-700/50 hover:bg-gray-700/60'
                                                            } ${(isWhitelisted !== true) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        Облако
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleF5ModeChange('local')}
                                                        disabled={!hasLocalSetup}
                                                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 ${f5Mode === 'local'
                                                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                                                            : 'bg-gray-800/60 text-gray-400 border border-gray-700/50 hover:bg-gray-700/60'
                                                            } ${(!hasLocalSetup) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        Локально
                                                    </button>
                                                </div>
                                            </div>
                                            <div
                                                onClick={handleGcloudTtsToggle}
                                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${gcloudTtsEnabled
                                                    ? 'bg-purple-600/15 border border-gray-700/50'
                                                    : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/50'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Google Cloud TTS</div>
                                                    <div className="text-xs text-gray-400">Качественный, облачный</div>
                                                </div>
                                                <Switch
                                                    checked={gcloudTtsEnabled}
                                                    onCheckedChange={handleGcloudTtsToggle}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="data-[state=checked]:bg-purple-600"
                                                />
                                            </div>
                                            {(gcloudTtsEnabled || ttsEngine === 'gcloud') && (
                                                <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-200">Голоса Google Cloud</div>
                                                            <div className="text-[10px] text-gray-500">Случайный голос из выбранных</div>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {isSavingGcloudVoices ? 'Сохранение...' : `${selectedGcloudVoices.length}/${gcloudVoices.length || 0}`}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 space-y-2 max-h-40 overflow-auto pr-1">
                                                        {isLoadingGcloudVoices ? (
                                                            <div className="text-xs text-gray-500">Загрузка голосов...</div>
                                                        ) : gcloudVoices.length === 0 ? (
                                                            <div className="text-xs text-gray-500">Голоса недоступны. Проверьте ключ Google Cloud.</div>
                                                        ) : (
                                                            gcloudVoices.map((voice) => {
                                                                const isSelected = selectedGcloudVoices.includes(voice.name);
                                                                return (
                                                                    <div
                                                                        key={voice.name}
                                                                        className="flex items-center justify-between rounded-md border border-gray-700/40 bg-gray-800/40 px-2 py-1.5"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <Checkbox
                                                                                checked={isSelected}
                                                                                onCheckedChange={(val) => handleGcloudVoiceToggle(voice.name, Boolean(val))}
                                                                            />
                                                                            <div className="flex flex-col">
                                                                                <span className="text-xs text-gray-200">{voice.name}</span>
                                                                                <span className="text-[10px] text-gray-500">
                                                                                    {(voice.ssmlGender || 'NEUTRAL').toLowerCase()}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleGcloudPreview(voice.name)}
                                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-700/60 bg-gray-900/40 text-gray-300 hover:bg-gray-800/60 hover:text-white"
                                                                        >
                                                                            {previewingGcloudVoice === voice.name ? (
                                                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <Play className="h-3.5 w-3.5" />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Режим прослушивания (Website/OBS) */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex-col flex h-[140px] justify-between">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-400 mb-2">Режим вывода звука</label>
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    <button
                                                        onClick={() => handleListeningModeChange('website')}
                                                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${listeningMode === 'website'
                                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 border border-gray-700/50'
                                                            }`}
                                                    >
                                                        Браузер
                                                    </button>
                                                    <button
                                                        onClick={() => handleListeningModeChange('obs')}
                                                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${listeningMode === 'obs'
                                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 border border-gray-700/50'
                                                            }`}
                                                    >
                                                        OBS
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Громкость в браузере */}
                                            {listeningMode === 'website' && (
                                                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-medium text-gray-300">Громкость браузера</span>
                                                        <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{localVolume}%</span>
                                                    </div>
                                                    <Slider
                                                        value={[localVolume]}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        onValueChange={(val) => handleVolumeChange(val[0])}
                                                        className="w-full"
                                                    />
                                                </div>
                                            )}

                                            {/* Настроить OBS */}
                                            {listeningMode === 'obs' && (
                                                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30 flex flex-col gap-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-medium text-gray-300">OBS URL</span>
                                                        <button
                                                            onClick={handleRegenerateObsUrl}
                                                            className="text-[10px] text-red-400 hover:underline"
                                                            disabled={isRegeneratingUrl}
                                                        >
                                                            {isRegeneratingUrl ? 'Обновление...' : 'Сбросить токен'}
                                                        </button>
                                                    </div>

                                                    <div
                                                        className="relative group cursor-pointer"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(obsUrl);
                                                            toast.success('Скопировано');
                                                        }}
                                                    >
                                                        <div className="w-full bg-black/40 border border-gray-700/50 rounded px-2 py-1.5 text-[10px] font-mono text-gray-400 truncate pr-8 select-all">
                                                            {obsUrl || 'Генерация URL...'}
                                                        </div>
                                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 bg-gray-800/80 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Copy
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex flex-col gap-4">
                                {/* Платформы */}
                                <Card className="card-glass">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold text-foreground">Источники озвучки</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-3">
                                        {(['twitch', 'vk'] as const).map(platform => {
                                            const isConnected = platform === 'twitch' ? isTwitchConnected : isVkConnected;
                                            const isActive = platformSettings.enabled_platforms?.includes(platform);
                                            const shouldGlow = isActive && isConnected;

                                            // Determine status text and color
                                            let statusText = 'Отключено';
                                            let statusColor = 'text-gray-500';

                                            if (!isConnected) {
                                                statusText = 'Не подключено';
                                                statusColor = 'text-red-400';
                                            } else if (isActive) {
                                                statusText = 'Активно';
                                                statusColor = 'text-green-400';
                                            }

                                            return (
                                                <div
                                                    key={platform}
                                                    onClick={() => handlePlatformToggle(platform)}
                                                    className={`
                                                    cursor-pointer relative overflow-hidden rounded-xl border transition-all duration-300
                                                    ${shouldGlow
                                                            ? platform === 'twitch'
                                                                ? 'bg-purple-900/40 border-purple-500/50 hover:bg-purple-900/60'
                                                                : 'bg-rose-900/40 border-rose-500/50 hover:bg-rose-900/60'
                                                            : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50'
                                                        }
                                                `}
                                                >
                                                    <div className="p-4 flex flex-col items-center gap-3">
                                                        <div className={`
                                                        w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110
                                                        ${shouldGlow
                                                                ? platform === 'twitch' ? 'bg-purple-500 text-white' : 'bg-rose-500 text-white'
                                                                : 'bg-gray-700 text-gray-400'
                                                            }
                                                    `}>
                                                            {platform === 'twitch' ? <TwitchIcon className="w-5 h-5" /> : <VKIcon className="w-5 h-5" />}
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-sm font-semibold text-white capitalize">{platform}</div>
                                                            <div className={`text-xs ${statusColor}`}>
                                                                {statusText}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </CardContent>
                                </Card>

                                {/* Фильтры озвучки */}
                                <Card className="card-glass flex-1">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold text-foreground">Фильтры озвучки</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {/* 7TV Emotes */}
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                                            <span className="text-sm font-medium text-gray-200">7TV смайлы</span>
                                            <Switch
                                                checked={ttsSettings.enable7TV}
                                                onCheckedChange={(val) => handleTtsSettingChange('enable7TV', val)}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </div>

                                        {/* Twitch Emotes */}
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                                            <span className="text-sm font-medium text-gray-200">Twitch смайлы</span>
                                            <Switch
                                                checked={ttsSettings.enableTwitch}
                                                onCheckedChange={(val) => handleTtsSettingChange('enableTwitch', val)}
                                                className="data-[state=checked]:bg-purple-600"
                                            />
                                        </div>

                                        {/* Filter Mentions */}
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                                            <span className="text-sm font-medium text-gray-200">Озвучивать «@»</span>
                                            <Switch
                                                checked={!ttsSettings.filterMentions}
                                                onCheckedChange={(val) => handleTtsSettingChange('filterMentions', !val)}
                                                className="data-[state=checked]:bg-purple-600"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>


                        {/* Фильтры (Moved to bottom full-width) */}
                        <div className="w-full">
                            <TtsFilterManager className="w-full" />
                        </div>
                    </>
                )}
            </div>
        </PageWrapper >
    );
};

// Экспортируем обертку компонента
const TtsMainPage = () => <TtsMainPageContent />;
export default TtsMainPage;
