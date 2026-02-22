import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Play, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { STORAGE_KEYS } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useTts } from '@/context/TtsContext';
import TtsChannelPointsMode from '@/features/tts/components/TtsChannelPointsMode';
import TtsFilterManager from '@/features/tts/components/TtsFilterManager';
import { queryKeys } from '@/queries/queryKeys';
import {
    useRegenerateTtsObsUrl,
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
    gcloudMood?: 'neutral' | 'sad' | 'happy';
    gcloud_mood?: 'neutral' | 'sad' | 'happy';
}

interface GcloudVoice {
    name: string;
    languageCodes?: string[];
    ssmlGender?: string;
    naturalSampleRateHertz?: number;
    modelName?: string;
    model_name?: string;
}

interface ParsedGcloudVoiceMeta {
    modelFamily: string;
    genderLabel: string;
}

type GcloudMood = 'neutral' | 'sad' | 'happy';

const GCLOUD_MOOD_OPTIONS: Array<{ value: GcloudMood; label: string }> = [
    { value: 'neutral', label: 'Нейтральная' },
    { value: 'sad', label: 'Грустная' },
    { value: 'happy', label: 'Веселая' },
];

const normalizeGcloudMood = (value?: string): GcloudMood => {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized === 'sad') return 'sad';
    if (normalized === 'happy') return 'happy';
    return 'neutral';
};

const getGcloudVoiceModelKey = (voice?: GcloudVoice): string => {
    const explicitModel = (voice?.modelName || voice?.model_name || '').trim();
    if (explicitModel) return explicitModel.toLowerCase();
    return (voice?.name || '').toLowerCase();
};

const parseGcloudVoiceModelFamily = (voice?: GcloudVoice): string => {
    const key = getGcloudVoiceModelKey(voice);
    if (!key) return 'Unknown';

    if (key.includes('chirp3-hd')) return 'Chirp 3 HD';
    if (key.includes('gemini')) return 'Gemini TTS';
    if (key.includes('chirp')) return 'Chirp';
    if (key.includes('neural2')) return 'Neural2';
    if (key.includes('wavenet')) return 'WaveNet';
    if (key.includes('studio')) return 'Studio';
    if (key.includes('journey')) return 'Journey';
    if (key.includes('standard')) return 'Standard';

    const voiceName = (voice?.name || '').trim();
    return voiceName || 'Unknown';
};

const getGcloudVoiceQualityRank = (voice?: GcloudVoice): number => {
    const key = getGcloudVoiceModelKey(voice);
    if (key.includes('gemini')) return 0;
    if (key.includes('chirp3-hd')) return 1;
    if (key.includes('neural2')) return 2;
    if (key.includes('wavenet')) return 3;
    if (key.includes('studio')) return 4;
    if (key.includes('journey')) return 5;
    if (key.includes('standard')) return 9;
    return 6;
};

const sortGcloudVoicesByQuality = (voices: GcloudVoice[]): GcloudVoice[] => {
    return [...voices].sort((a, b) => {
        const rankDiff = getGcloudVoiceQualityRank(a) - getGcloudVoiceQualityRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.name || '').localeCompare(b.name || '');
    });
};

const getPreferredDefaultVoiceNames = (voices: GcloudVoice[]): string[] => {
    const preferred = voices
        .filter((voice) => getGcloudVoiceQualityRank(voice) <= 3)
        .map((voice) => voice.name)
        .filter(Boolean);

    if (preferred.length > 0) return preferred;
    return voices.map((voice) => voice.name).filter(Boolean);
};

const parseGcloudVoiceGender = (gender?: string): string => {
    const value = (gender || 'NEUTRAL').toUpperCase();
    if (value === 'MALE') return 'мужской';
    if (value === 'FEMALE') return 'женский';
    return 'нейтральный';
};

const getGcloudVoiceDisplayName = (voiceName?: string): string => {
    const raw = (voiceName || '').trim();
    if (!raw) return 'Unknown';

    const matchedSpeaker = raw.match(/^[a-z]{2}-[A-Z]{2}-(?:Gemini|Chirp3-HD)-([A-Za-z0-9_]+)$/);
    if (matchedSpeaker?.[1]) return matchedSpeaker[1];

    const parts = raw.split('-').filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];

    return raw;
};

const getGcloudVoiceMeta = (voice: GcloudVoice): ParsedGcloudVoiceMeta => ({
    modelFamily: parseGcloudVoiceModelFamily(voice),
    genderLabel: parseGcloudVoiceGender(voice.ssmlGender),
});

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
    const {
        ttsEnabled: _ttsEnabled,
        isWhitelisted,
        initializeTts: _initializeTts,
        isCheckingHealth,
        checkTtsHealth,
    } = useTts();
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
    const [localVolume, setLocalVolume] = useState<number>(50);
    const [gcloudVoices, setGcloudVoices] = useState<GcloudVoice[]>([]);
    const [selectedGcloudVoices, setSelectedGcloudVoices] = useState<string[]>([]);
    const [isLoadingGcloudVoices, setIsLoadingGcloudVoices] = useState<boolean>(false);
    const [isSavingGcloudVoices, setIsSavingGcloudVoices] = useState<boolean>(false);
    const [previewingGcloudVoice, setPreviewingGcloudVoice] = useState<string | null>(null);
    const [gcloudLoadHint, setGcloudLoadHint] = useState<string>('');
    const [gcloudMood, setGcloudMood] = useState<GcloudMood>('neutral');

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

    const [_localTtsConfig, _setLocalTtsConfig] = useState<unknown>(null);
    const [isSavingMode, setIsSavingMode] = useState<boolean>(false);
    const [isRegeneratingUrl, setIsRegeneratingUrl] = useState<boolean>(false);

    const settingsDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const gcloudSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const gcloudPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
    const gcloudSelectionInitializedRef = useRef<boolean>(false);
    const gcloudVoicesRequestStartedRef = useRef<boolean>(false);
    const lastGcloudPreviewAtRef = useRef<number>(0);

    const queryClient = useQueryClient();
    const isTwitchConnected = integrations.twitch?.enabled;
    const isVkConnected = integrations.vk?.enabled;
    const _hasAnyIntegration = isTwitchConnected || isVkConnected;
    const hasLocalSetupFromStorage = localStorage.getItem('tts_has_local_setup') === 'true';
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
    const isEngineActionPending = toggleTtsMutation.isPending || switchEngineMutation.isPending;

    const { data: ttsStatusResponse } = useTtsStatus(null, {
        enabled: !!isAuthenticated,
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(queryKeys.tts.status(null)) || undefined
    });
    const ttsStatusData = ttsStatusResponse?.data;
    const hasLocalSetup =
        typeof (ttsStatusData as { has_local_setup?: boolean } | undefined)?.has_local_setup === 'boolean'
            ? Boolean((ttsStatusData as { has_local_setup?: boolean }).has_local_setup)
            : hasLocalSetupFromStorage;

    // Only show loading if we don't have health data yet
    const isF5TTSDataLoading = isChecking;
    const canUseF5Cloud = isWhitelisted === true;
    const canUseF5Local = hasLocalSetup;
    const canUseF5TTS = canUseF5Cloud || canUseF5Local;
    const canToggleF5TTS = !isF5TTSDataLoading && canUseF5TTS;

    const getF5UnavailableReason = useCallback((): string => {
        if (isF5TTSDataLoading) return 'Проверка статуса F5...';
        if (!canUseF5Cloud && !canUseF5Local) return 'Нет доступа к F5 Cloud и не настроен локальный сервер';
        if (!canUseF5Cloud && canUseF5Local) return 'F5 Cloud недоступен, но можно использовать локальный сервер';
        if (canUseF5Cloud && !canUseF5Local) return 'Локальный сервер не настроен';
        return '';
    }, [isF5TTSDataLoading, canUseF5Cloud, canUseF5Local]);

    const gcloudVoiceMetaMap = useMemo(() => {
        const map = new Map<string, ParsedGcloudVoiceMeta>();
        for (const voice of gcloudVoices) {
            if (!voice.name) continue;
            map.set(voice.name, getGcloudVoiceMeta(voice));
        }
        return map;
    }, [gcloudVoices]);

    const { data: ttsSettingsResponse } = useTtsSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(['tts-settings']) || undefined
    });
    const ttsSettingsData = ttsSettingsResponse?.data;

    const { data: audioSettingsResponse } = useTtsAudioSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(['tts-audio-settings']) || undefined
    });
    const audioSettingsData = audioSettingsResponse?.data;

    const { data: platformSettingsResponse } = useTtsPlatformSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(['tts-platform-settings']) || undefined
    });
    const platformSettingsData = platformSettingsResponse?.data;

    const { data: modeSettingsResponse } = useTtsModeSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
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
                const nextListeningMode = settingsData.listeningMode;
                setListeningMode(prev => prev !== nextListeningMode ? nextListeningMode : prev);
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

            const resolvedMood = normalizeGcloudMood(
                settingsData.gcloudMood || settingsData.gcloud_mood
            );
            setGcloudMood((prev) => (prev !== resolvedMood ? resolvedMood : prev));
        }
    }, [ttsSettingsData]);

    useEffect(() => {
        const audioData = audioSettingsData as AudioSettingsData | undefined;
        if (audioData?.websiteVolume !== undefined) {
            const nextWebsiteVolume = audioData.websiteVolume;
            setLocalVolume(prev => prev !== nextWebsiteVolume ? nextWebsiteVolume : prev);
        }
    }, [audioSettingsData]);

    useEffect(() => {
        if (!(gcloudTtsEnabled || ttsEngine === 'gcloud')) {
            gcloudVoicesRequestStartedRef.current = false;
            setGcloudLoadHint('');
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
                const payload = response.data as {
                    voices?: GcloudVoice[];
                    available?: boolean;
                    error?: string;
                    hint?: string;
                    data?: {
                        voices?: GcloudVoice[];
                        available?: boolean;
                        error?: string;
                        hint?: string;
                    };
                };
                const voices = payload?.data?.voices || payload?.voices || [];
                const sortedVoices = sortGcloudVoicesByQuality(voices);
                const available = payload?.data?.available ?? payload?.available ?? sortedVoices.length > 0;
                const loadHint = payload?.data?.hint || payload?.hint || payload?.data?.error || payload?.error || '';
                setGcloudVoices(sortedVoices);
                setGcloudLoadHint(available ? '' : loadHint || 'Голоса недоступны. Проверьте ключ и ограничения Google API.');

                if (!gcloudSelectionInitializedRef.current && selectedGcloudVoices.length === 0 && sortedVoices.length > 0) {
                    const initialVoices = getPreferredDefaultVoiceNames(sortedVoices);
                    if (initialVoices.length > 0) {
                        setSelectedGcloudVoices(initialVoices);
                        gcloudSelectionInitializedRef.current = true;
                        ttsService.saveGcloudVoices(initialVoices).catch(() => {
                            toast.error('Не удалось сохранить голоса Google Cloud');
                        });
                    }
                }
            })
            .catch((error: unknown) => {
                logger.error('Error loading Google Cloud voices:', error);
                setGcloudLoadHint('Не удалось загрузить голоса Google Cloud. Проверьте ключ и сетевую доступность API.');
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
            const nextTtsMode = modeData.tts_mode;
            setTtsTriggerMode(prev => prev !== nextTtsMode ? nextTtsMode : prev);
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
        if (isEngineActionPending) {
            return;
        }
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
        if (isEngineActionPending) {
            return;
        }
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

    const resolveAvailableF5Mode = useCallback((preferredMode: 'cloud' | 'local'): 'cloud' | 'local' | null => {
        if (preferredMode === 'cloud' && canUseF5Cloud) {
            return 'cloud';
        }
        if (preferredMode === 'local' && canUseF5Local) {
            return 'local';
        }
        if (canUseF5Cloud) {
            return 'cloud';
        }
        if (canUseF5Local) {
            return 'local';
        }
        return null;
    }, [canUseF5Cloud, canUseF5Local]);

    const ensureF5CloudIsHealthy = useCallback(async (): Promise<boolean> => {
        const health = await checkTtsHealth();
        if (!health.isHealthy) {
            toast.error('F5 Cloud сейчас недоступен');
            return false;
        }
        return true;
    }, [checkTtsHealth]);

    useEffect(() => {
        if (!aiTtsEnabled) {
            return;
        }
        const resolvedMode = resolveAvailableF5Mode(f5Mode);
        if (resolvedMode && resolvedMode !== f5Mode) {
            setF5Mode(resolvedMode);
        }
    }, [aiTtsEnabled, f5Mode, resolveAvailableF5Mode]);

    const handleAiTtsToggle = async (): Promise<void> => {
        if (isEngineActionPending) {
            return;
        }
        if (!canToggleF5TTS) {
            toast.error(getF5UnavailableReason() || 'F5-TTS недоступен');
            return;
        }

        const newValue = !aiTtsEnabled;
        const engineType = resolveAvailableF5Mode(f5Mode);

        if (newValue && !engineType) {
            toast.error(getF5UnavailableReason() || 'F5-TTS недоступен');
            return;
        }

        let resolvedEngineType = engineType;
        if (newValue && resolvedEngineType === 'cloud') {
            const cloudHealthy = await ensureF5CloudIsHealthy();
            if (!cloudHealthy) {
                if (canUseF5Local) {
                    resolvedEngineType = 'local';
                    setF5Mode('local');
                    toast.warning('F5 Cloud недоступен, переключено на локальный режим');
                } else {
                    return;
                }
            }
        }

        if (newValue && resolvedEngineType && resolvedEngineType !== f5Mode) {
            setF5Mode(resolvedEngineType);
        }

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
                    switchEngineMutation.mutate(resolvedEngineType as 'cloud' | 'local', {
                        onSuccess: () => {
                            setTtsEngine(resolvedEngineType as 'cloud' | 'local');
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
            const nextEngineType: 'cloud' | 'local' | 'gtts' = newValue
                ? (resolvedEngineType as 'cloud' | 'local')
                : 'gtts';
            switchEngineMutation.mutate(nextEngineType, {
                onSuccess: () => {
                    // [OK] Инвалидируем кэш для получения актуального статуса
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });

                    if (newValue) {
                        setTtsEngine(nextEngineType);
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
        if (isEngineActionPending) {
            return;
        }
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

    const handleF5ModeChange = async (mode: 'cloud' | 'local'): Promise<void> => {
        if (isEngineActionPending) {
            return;
        }
        if (mode === f5Mode) return;
        if (mode === 'local' && !canUseF5Local) {
            toast.error('Сначала настройте локальный F5-TTS во вкладке "Локальный TTS"');
            return;
        }
        if (mode === 'cloud' && !canUseF5Cloud) {
            toast.error('Доступ к F5 Cloud отсутствует');
            return;
        }

        if (mode === 'cloud' && aiTtsEnabled) {
            const cloudHealthy = await ensureF5CloudIsHealthy();
            if (!cloudHealthy) {
                return;
            }
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

    const openPlayerTab = useCallback((): void => {
        if (typeof window === 'undefined') return;

        const playerUrl = `${window.location.origin}/tts-player`;
        const playerWindow = window.open(playerUrl, 'tts-player-tab');
        if (!playerWindow) {
            toast.error('Разрешите pop-up для открытия TTS Player');
            return;
        }
        playerWindow.focus();
    }, []);

    const handleListeningModeChange = (mode: 'website' | 'obs'): void => {
        setListeningMode(mode);
        saveListeningModeMutation.mutate(mode);
    };

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

    const handleGcloudMoodChange = useCallback((nextMood: GcloudMood): void => {
        if (nextMood === gcloudMood || saveTtsSettingsMutation.isPending) return;

        const previousMood = gcloudMood;
        setGcloudMood(nextMood);

        saveTtsSettingsMutation.mutate(
            { gcloudMood: nextMood },
            {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
                },
                onError: () => {
                    setGcloudMood(previousMood);
                    toast.error('Не удалось сохранить настроение озвучки');
                },
            },
        );
    }, [gcloudMood, queryClient, saveTtsSettingsMutation]);

    const handleGcloudPreview = useCallback(async (voiceName: string): Promise<void> => {
        if (previewingGcloudVoice === voiceName) return;
        const now = Date.now();
        if (now - lastGcloudPreviewAtRef.current < 1500) {
            toast.warning('Слишком часто. Подождите чуть-чуть перед следующим тестом.');
            return;
        }
        lastGcloudPreviewAtRef.current = now;

        setPreviewingGcloudVoice(voiceName);
        try {
            if (gcloudPreviewAudioRef.current) {
                gcloudPreviewAudioRef.current.pause();
                gcloudPreviewAudioRef.current.currentTime = 0;
            }

            const selectedVoice = gcloudVoices.find((voice) => voice.name === voiceName);
            const selectedModelName = selectedVoice?.modelName || selectedVoice?.model_name;
            const geminiModelName = (selectedModelName || '').toLowerCase().includes('gemini')
                ? selectedModelName
                : undefined;
            const response = await ttsService.previewGcloudVoice({
                voice_name: voiceName,
                text: 'Привет! Это тестовый голос Google Cloud.',
                mood: gcloudMood,
                model_name: geminiModelName,
            });
            const payload = response.data as {
                audio_url?: string;
                voice?: string;
                requested_model?: string;
                fallback_used?: boolean;
                data?: {
                    audio_url?: string;
                    voice?: string;
                    requested_model?: string;
                    fallback_used?: boolean;
                };
            };
            const audioUrl = payload?.data?.audio_url || payload?.audio_url;
            const fallbackUsed = Boolean(payload?.data?.fallback_used ?? payload?.fallback_used);
            const usedVoice = payload?.data?.voice || payload?.voice || voiceName;
            const requestedModel = payload?.data?.requested_model || payload?.requested_model;

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
            if (fallbackUsed) {
                toast.warning(`Gemini недоступен для этого запроса. Использован fallback голос: ${usedVoice}`);
            } else if (requestedModel) {
                logger.log('Google Cloud preview model:', requestedModel);
            }
        } catch (error: unknown) {
            logger.error('Error previewing Google Cloud voice:', error);
            const axiosError = error as AxiosError<{
                detail?: { error?: string; hint?: string } | string;
            }>;
            const detail = axiosError.response?.data?.detail;
            const detailText = typeof detail === 'string'
                ? detail
                : detail?.hint || detail?.error;
            toast.error(detailText || 'Не удалось воспроизвести голос');
            setPreviewingGcloudVoice(null);
        }
    }, [previewingGcloudVoice, localVolume, gcloudMood, gcloudVoices]);

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
        }, 450);
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
    }, [isTwitchConnected, isVkConnected, platformSettings.enabled_platforms, savePlatformSettingsMutation]);

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
            <div className="space-y-4 w-full">
                {/* Главный переключатель TTS */}
                <div
                    className={`flex items-center justify-between p-4 rounded-xl card-glass ${isEngineActionPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={isEngineActionPending ? undefined : handleGlobalTtsToggle}
                >
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
                        disabled={isEngineActionPending}
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
                                    <div>
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
                                                onClick={isEngineActionPending ? undefined : handleBasicTtsToggle}
                                                className={`group flex min-h-[72px] items-center justify-between p-3 rounded-lg transition-all duration-200 ${isEngineActionPending
                                                    ? 'opacity-60 cursor-not-allowed bg-gray-800/20 border border-gray-700/30'
                                                    : basicTtsEnabled && !aiTtsEnabled && !gcloudTtsEnabled
                                                    ? 'bg-emerald-600/15 border border-emerald-500/40'
                                                    : 'cursor-pointer bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/50'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Google TTS</div>
                                                </div>
                                                <Switch
                                                    checked={basicTtsEnabled && !aiTtsEnabled && !gcloudTtsEnabled}
                                                    onCheckedChange={handleBasicTtsToggle}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={isEngineActionPending}
                                                    className="data-[state=checked]:bg-green-600"
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
                                                ) : canUseF5TTS ? (
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
                                                onClick={isEngineActionPending ? undefined : handleGcloudTtsToggle}
                                                className={`group flex min-h-[72px] items-center justify-between p-3 rounded-lg transition-all duration-200 ${isEngineActionPending
                                                    ? 'opacity-60 cursor-not-allowed bg-gray-800/20 border border-gray-700/30'
                                                    : gcloudTtsEnabled
                                                    ? 'bg-emerald-600/15 border border-emerald-500/40'
                                                    : 'cursor-pointer bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/50'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Google Cloud TTS</div>
                                                </div>
                                                <Switch
                                                    checked={gcloudTtsEnabled}
                                                    onCheckedChange={handleGcloudTtsToggle}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={isEngineActionPending}
                                                    className="data-[state=checked]:bg-green-600"
                                                />
                                            </div>
                                            {(gcloudTtsEnabled || ttsEngine === 'gcloud') && (
                                                <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-[10px] text-gray-500">Случайный голос из выбранных</div>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {isSavingGcloudVoices ? 'Сохранение...' : `${selectedGcloudVoices.length}/${gcloudVoices.length || 0}`}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 space-y-1">
                                                        <div className="block text-[10px] text-gray-400">
                                                            Настроение озвучки
                                                        </div>
                                                        <div className="inline-flex overflow-hidden rounded-md border border-gray-700/60 bg-gray-900/60">
                                                            {GCLOUD_MOOD_OPTIONS.map((option) => (
                                                                <button
                                                                    key={option.value}
                                                                    type="button"
                                                                    onClick={() => handleGcloudMoodChange(option.value)}
                                                                    className={`h-7 px-2 text-[10px] transition-colors ${gcloudMood === option.value
                                                                        ? 'bg-emerald-600/30 text-emerald-200'
                                                                        : 'text-gray-300 hover:bg-gray-800/70'
                                                                        }`}
                                                                >
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 space-y-2 max-h-40 overflow-auto pr-1">
                                                        {isLoadingGcloudVoices ? (
                                                            <div className="text-xs text-gray-500">Загрузка голосов...</div>
                                                        ) : gcloudVoices.length === 0 ? (
                                                            <div className="text-xs text-amber-300/90">{gcloudLoadHint || 'Голоса недоступны. Проверьте ключ Google Cloud.'}</div>
                                                        ) : (
                                                            gcloudVoices.map((voice) => {
                                                                const isSelected = selectedGcloudVoices.includes(voice.name);
                                                                const voiceMeta = gcloudVoiceMetaMap.get(voice.name) || getGcloudVoiceMeta(voice);
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
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-xs text-gray-200" title={voice.name}>{getGcloudVoiceDisplayName(voice.name)}</span>
                                                                                <div className="flex flex-wrap items-center gap-1">
                                                                                    <span className="rounded border border-gray-700/50 bg-gray-900/60 px-1.5 py-0.5 text-[10px] text-gray-300">
                                                                                        Модель: {voiceMeta.modelFamily}
                                                                                    </span>
                                                                                    <span className="rounded border border-gray-700/50 bg-gray-900/60 px-1.5 py-0.5 text-[10px] text-gray-300">
                                                                                        Пол: {voiceMeta.genderLabel}
                                                                                    </span>
                                                                                </div>
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
                                            <div
                                                onClick={!canToggleF5TTS || isEngineActionPending ? undefined : handleAiTtsToggle}
                                                className={`group flex min-h-[72px] items-center justify-between p-3 rounded-lg transition-all duration-200 ${(!canToggleF5TTS || isEngineActionPending)
                                                    ? 'opacity-50 cursor-not-allowed bg-gray-800/20 border border-gray-700/30'
                                                    : aiTtsEnabled
                                                        ? 'cursor-pointer bg-emerald-600/15 border border-emerald-500/40'
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
                                                            : !canToggleF5TTS
                                                                ? getF5UnavailableReason()
                                                                : f5EngineLabel}
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={aiTtsEnabled}
                                                    onCheckedChange={handleAiTtsToggle}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={!canToggleF5TTS || isEngineActionPending}
                                                    className="data-[state=checked]:bg-green-600"
                                                />
                                            </div>
                                            {aiTtsEnabled && (
                                                <div className="space-y-1 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-gray-500">Метод F5</span>
                                                        <select
                                                            value={f5Mode}
                                                            onChange={(event) => handleF5ModeChange(event.target.value as 'cloud' | 'local')}
                                                            disabled={isEngineActionPending}
                                                            className="h-8 min-w-[140px] rounded-md border border-gray-700/60 bg-gray-900/60 px-2 text-[11px] text-gray-200 focus:border-emerald-500/70 focus:outline-none"
                                                        >
                                                            <option value="cloud" disabled={!canUseF5Cloud}>
                                                                {canUseF5Cloud ? 'Облако' : 'Облако (недоступно)'}
                                                            </option>
                                                            <option value="local" disabled={!canUseF5Local}>
                                                                {canUseF5Local ? 'Локально' : 'Локально (недоступно)'}
                                                            </option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Режим прослушивания (Website/OBS) */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-400 mb-2">Режим вывода звука</label>
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    <button
                                                        onClick={() => handleListeningModeChange('website')}
                                                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all duration-200 ${listeningMode === 'website'
                                                            ? 'border-green-500 bg-green-500/25 text-white'
                                                            : 'border-gray-700 bg-transparent text-gray-400 hover:border-green-500/50'
                                                            }`}
                                                    >
                                                        Браузер
                                                    </button>
                                                    <button
                                                        onClick={() => handleListeningModeChange('obs')}
                                                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all duration-200 ${listeningMode === 'obs'
                                                            ? 'border-green-500 bg-green-500/25 text-white'
                                                            : 'border-gray-700 bg-transparent text-gray-400 hover:border-green-500/50'
                                                            }`}
                                                    >
                                                        OBS
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Website mode: управление только через отдельный TTS Player */}
                                            {listeningMode === 'website' && (
                                                <div>
                                                    <Button
                                                        onClick={openPlayerTab}
                                                        className="h-9 w-full border border-blue-700 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
                                                    >
                                                        Открыть TTS Player
                                                    </Button>
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
                                                    cursor-pointer relative overflow-hidden rounded-xl border bg-transparent transition-all duration-300
                                                    ${platform === 'twitch'
                                                            ? 'border-purple-500/35 hover:border-purple-400/70'
                                                            : 'border-rose-500/35 hover:border-rose-400/70'
                                                        }
                                                `}
                                                >
                                                    <div className="p-4 flex flex-col items-center gap-3">
                                                        <div className={`
                                                        w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110
                                                        ${shouldGlow
                                                                ? platform === 'twitch' ? 'bg-purple-500/20 text-purple-300' : 'bg-rose-500/20 text-rose-300'
                                                                : 'bg-transparent text-gray-400'
                                                            }
                                                    `}>
                                                            {platform === 'twitch' ? <TwitchIcon className="w-5 h-5" /> : <VKIcon className="w-5 h-5" />}
                                                        </div>
                                                        <div className="text-center">
                                                            <div className={`text-sm font-semibold capitalize ${platform === 'twitch' ? 'text-purple-300' : 'text-rose-300'}`}>{platform}</div>
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
                                        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-transparent p-3 transition-colors hover:border-sky-500/35 hover:bg-sky-500/5">
                                            <span className="text-sm font-medium text-gray-200">7TV смайлы</span>
                                            <Switch
                                                checked={ttsSettings.enable7TV}
                                                onCheckedChange={(val) => handleTtsSettingChange('enable7TV', val)}
                                                className="data-[state=checked]:bg-green-600"
                                            />
                                        </div>

                                        {/* Twitch Emotes */}
                                        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-transparent p-3 transition-colors hover:border-sky-500/35 hover:bg-sky-500/5">
                                            <span className="text-sm font-medium text-gray-200">Twitch смайлы</span>
                                            <Switch
                                                checked={ttsSettings.enableTwitch}
                                                onCheckedChange={(val) => handleTtsSettingChange('enableTwitch', val)}
                                                className="data-[state=checked]:bg-green-600"
                                            />
                                        </div>

                                        {/* Filter Mentions */}
                                        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-transparent p-3 transition-colors hover:border-sky-500/35 hover:bg-sky-500/5">
                                            <span className="text-sm font-medium text-gray-200">Озвучивать «@»</span>
                                            <Switch
                                                checked={!ttsSettings.filterMentions}
                                                onCheckedChange={(val) => handleTtsSettingChange('filterMentions', !val)}
                                                className="data-[state=checked]:bg-green-600"
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
