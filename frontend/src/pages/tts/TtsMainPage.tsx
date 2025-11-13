import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTts } from '../../context/TtsContext';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { getTtsWebSocketUrl } from '../../utils/urlUtils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import { TwitchIcon, VKIcon } from '../../components/PlatformIcons';
import TtsFilterManager from '../../components/tts/TtsFilterManager';
import TtsChannelPointsMode from '../../components/tts/TtsChannelPointsMode';
import { logger } from '../../utils/prodLogger';
import { getQueryCache, setQueryCache } from '../../utils/queryPersist';
import { 
    useTtsStatus, 
    useTtsSettings, 
    useTtsAudioSettings, 
    useTtsPlatformSettings, 
    useTtsModeSettings,
    useToggleTts,
    useSaveTtsSettings,
    useSaveTtsAudioSettings,
    useSaveTtsPlatformSettings,
    useSaveTtsModeSettings,
    useSetTtsListeningMode,
    useSetTtsEngine,
    useRegenerateTtsObsUrl
} from '../../queries/tts/ttsQueries';
import { queryKeys } from '../../queries/queryKeys';
import PageWrapper from '../../components/PageWrapper';
import { ttsService } from '../../services/api/services/ttsService';

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

const TtsMainPageContent: React.FC = () => {
    const navigate = useNavigate();
    const { ttsEnabled, isWhitelisted, initializeTts, engineStatus, isCheckingHealth } = useTts();
    const isHealthy = engineStatus.loaded;
    const isChecking = isCheckingHealth;
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    
    const [basicTtsEnabled, setBasicTtsEnabled] = useState<boolean>(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState<boolean>(false);
    const [ttsTriggerMode, setTtsTriggerMode] = useState<'all_messages' | 'channel_points'>('all_messages');
    const [ttsEngine, setTtsEngine] = useState<'cloud' | 'local' | 'gtts'>('cloud');
    const [listeningMode, setListeningMode] = useState<'website' | 'obs'>('website');
    const [obsUrl, setObsUrl] = useState<string>('');
    const [localVolume, setLocalVolume] = useState<number>(50);
    
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
    
    const [localTtsConfig, setLocalTtsConfig] = useState<any>(null);
    const [isSavingMode, setIsSavingMode] = useState<boolean>(false);
    const [isRegeneratingUrl, setIsRegeneratingUrl] = useState<boolean>(false);
    
    const volumeDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const settingsDebounceRef = useRef<NodeJS.Timeout | null>(null);
    
    const queryClient = useQueryClient();
    const isTwitchConnected = integrations.twitch?.enabled || (isGuest && user?.platform === 'twitch');
    const isVkConnected = integrations.vk?.enabled || (isGuest && user?.platform === 'vk');
    const hasAnyIntegration = isGuest || isTwitchConnected || isVkConnected;
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
    const isAnyTtsEnabled = basicTtsEnabled || aiTtsEnabled;

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
        onError: (error: any) => {
            logger.error('Error saving platform settings:', error);
        }
    });

    const saveAudioSettingsMutation = useSaveTtsAudioSettings({
        onSuccess: () => {
            logger.log('Audio settings saved');
        },
        onError: (error: any) => {
            logger.error('Error saving audio settings:', error);
        }
    });

    const saveTtsSettingsMutation = useSaveTtsSettings({
        onSuccess: () => {
            logger.log('TTS settings saved');
        },
        onError: (error: any) => {
            logger.error('Error saving TTS settings:', error);
            if (error.response?.status === 409) {
                toast.warning('Настройки были обновлены. Перезагружаю...');
                setTimeout(() => queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() }), 1500);
            }
        }
    });

    const saveTtsModeSettingsMutation = useSaveTtsModeSettings({
        onSuccess: () => {
            logger.log('TTS mode settings saved');
        },
        onError: (error: any) => {
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
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['tts-status'])
    });
    const ttsStatusData = ttsStatusResponse?.data;
    
    const isF5TTSDataLoading = isLoadingTtsStatus || isWhitelisted === null || isChecking;
    const canUseF5TTS = !isF5TTSDataLoading && (hasLocalSetup || (isWhitelisted !== null && isWhitelisted !== false));

    const { data: ttsSettingsResponse } = useTtsSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-settings'])
    });
    const ttsSettingsData = ttsSettingsResponse?.data;

    const { data: audioSettingsResponse } = useTtsAudioSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-audio-settings'])
    });
    const audioSettingsData = audioSettingsResponse?.data;

    const { data: platformSettingsResponse } = useTtsPlatformSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-platform-settings'])
    });
    const platformSettingsData = platformSettingsResponse?.data;

    const { data: modeSettingsResponse } = useTtsModeSettings({
        enabled: !!isAuthenticated,
        initialData: () => getQueryCache(['tts-mode-settings'])
    });
    const modeSettingsData = modeSettingsResponse?.data;

    const isDataLoaded = useMemo(() => {
        const hasStatus = ttsStatusData !== undefined || getQueryCache(['tts-status']) !== null;
        const hasSettings = ttsSettingsData !== undefined || getQueryCache(['tts-settings']) !== null;
        const hasAudio = audioSettingsData !== undefined || getQueryCache(['tts-audio-settings']) !== null;
        return hasStatus && hasSettings && hasAudio;
    }, [ttsStatusData, ttsSettingsData, audioSettingsData]);

    useEffect(() => {
        if (ttsStatusData) {
            const enabled = ttsStatusData.enabled || false;
            const engineType = (ttsStatusData as any).engine_type || 'gtts';
            
            const basicEnabled = enabled && engineType === 'gtts';
            const aiEnabled = enabled && (engineType === 'cloud' || engineType === 'local');
            
            setBasicTtsEnabled(prev => prev !== basicEnabled ? basicEnabled : prev);
            setAiTtsEnabled(prev => prev !== aiEnabled ? aiEnabled : prev);
            
            if (engineType === 'local' || engineType === 'cloud') {
                setTtsEngine(prev => prev !== engineType ? engineType : prev);
            } else {
                setTtsEngine(prev => prev !== 'cloud' ? 'cloud' : prev);
            }
        }
    }, [ttsStatusData]);

    useEffect(() => {
        if (ttsSettingsData) {
            setTtsSettings(prev => ({
                ...prev,
                enable7TV: (ttsSettingsData as any).enable7TV ?? prev.enable7TV,
                enableTwitch: (ttsSettingsData as any).enableTwitch ?? prev.enableTwitch,
                filterReplies: (ttsSettingsData as any).filterReplies ?? prev.filterReplies,
                filterMentions: (ttsSettingsData as any).filterMentions ?? prev.filterMentions,
                version: (ttsSettingsData as any).version ?? prev.version,
            }));
            
            if ((ttsSettingsData as any).listeningMode) {
                setListeningMode(prev => prev !== (ttsSettingsData as any).listeningMode ? (ttsSettingsData as any).listeningMode : prev);
            }
        }
    }, [ttsSettingsData]);

    useEffect(() => {
        if (audioSettingsData?.websiteVolume !== undefined) {
            setLocalVolume(prev => prev !== audioSettingsData.websiteVolume ? audioSettingsData.websiteVolume : prev);
        }
    }, [audioSettingsData]);

    useEffect(() => {
        if (platformSettingsData?.enabled_platforms) {
            setPlatformSettings(prev => {
                const newPlatforms = platformSettingsData.enabled_platforms || [];
                const currentPlatforms = prev.enabled_platforms || [];
                if (JSON.stringify(currentPlatforms) !== JSON.stringify(newPlatforms)) {
                    return {
                        ...prev,
                        enabled_platforms: newPlatforms as ('twitch' | 'vk')[],
                        global_enabled: platformSettingsData.global_enabled ?? prev.global_enabled
                    };
                }
                return prev;
            });
        }
    }, [platformSettingsData]);

    useEffect(() => {
        if (modeSettingsData?.tts_mode) {
            setTtsTriggerMode(prev => prev !== modeSettingsData.tts_mode ? modeSettingsData.tts_mode : prev);
        }
    }, [modeSettingsData]);

    useEffect(() => {
        if (listeningMode === 'obs' && isAuthenticated && user?.id) {
            ttsService.generateObsUrl()
                .then(response => {
                    const token = (response.data as any)?.obs_token;
                    if (token) {
                        const url = getTtsWebSocketUrl(token);
                        setObsUrl(url);
                        logger.log('OBS URL generated:', url);
                    }
                })
                .catch((err: any) => {
                    logger.error('Error generating OBS URL:', err);
                    toast.error('Ошибка генерации OBS URL');
                });
        } else if (listeningMode === 'website') {
            setObsUrl('');
        }
    }, [listeningMode, isAuthenticated, user?.id]);

    const handleGlobalTtsToggle = (): void => {
        if (!isGuest && !isTwitchConnected && !isVkConnected) {
            toast.error('Для использования TTS необходимо подключить хотя бы одну платформу');
            return;
        }
        
        const newState = !isAnyTtsEnabled;
        
        if (newState) {
            setBasicTtsEnabled(true);
        } else {
            setBasicTtsEnabled(false);
            setAiTtsEnabled(false);
        }
        
        toggleTtsMutation.mutate(newState, {
            onSuccess: () => {
                window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: newState } }));
            },
            onError: (error: any) => {
                if (newState) {
                    setBasicTtsEnabled(false);
                } else {
                    setBasicTtsEnabled(true);
                }
                logger.error('Error toggling TTS:', error);
            },
        });
    };

    const handleTtsModeChange = (mode: 'all_messages' | 'channel_points'): void => {
        if (isSavingMode || saveTtsModeSettingsMutation.isPending) return;
        
        setIsSavingMode(true);
        saveTtsModeSettingsMutation.mutate({ tts_mode: mode }, {
            onSuccess: (response: any) => {
                setTtsTriggerMode(mode);
                if (response.data?.message) {
                    toast.success(response.data.message);
                }
            },
            onError: (error: any) => {
                logger.error('Error changing TTS mode:', error);
            },
            onSettled: () => {
                setIsSavingMode(false);
            },
        });
    };

    const handleBasicTtsToggle = (): void => {
        const newValue = !basicTtsEnabled;
        
        if (newValue) {
            setBasicTtsEnabled(true);
            setAiTtsEnabled(false);
        } else {
            setBasicTtsEnabled(false);
        }
        
        toggleTtsMutation.mutate(newValue, {
            onSuccess: () => {
                if (newValue && aiTtsEnabled) {
                    switchEngineMutation.mutate('gtts', {
                        onSuccess: () => {
                            setAiTtsEnabled(false);
                        },
                    });
                } else {
                    window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: newValue } }));
                    toast.success(newValue ? 'Google TTS включён' : 'TTS отключён');
                }
            },
            onError: (error: any) => {
                setBasicTtsEnabled(!newValue);
                logger.error('Error toggling basic TTS:', error);
            },
        });
    };

    const handleAiTtsToggle = (): void => {
        if (!canUseF5TTS || !isHealthy) {
            toast.error('F5-TTS недоступен');
            return;
        }
        
        const newValue = !aiTtsEnabled;
        
        if (newValue) {
            setAiTtsEnabled(true);
            setBasicTtsEnabled(true);
        } else {
            setAiTtsEnabled(false);
        }
        
        if (newValue && !isAnyTtsEnabled) {
            toggleTtsMutation.mutate(true, {
                onSuccess: () => {
                    setBasicTtsEnabled(true);
                    const engineType = ttsEngine === 'local' ? 'local' : 'cloud';
                    switchEngineMutation.mutate(engineType, {
                        onSuccess: () => {
                            toast.success('F5-TTS включён');
                            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                        },
                        onError: (error: any) => {
                            setAiTtsEnabled(false);
                            logger.error('Error switching engine:', error);
                        },
                    });
                },
                onError: (error: any) => {
                    setAiTtsEnabled(false);
                    logger.error('Error enabling TTS:', error);
                },
            });
        } else {
            const engineType = newValue ? (ttsEngine === 'local' ? 'local' : 'cloud') : 'gtts';
            switchEngineMutation.mutate(engineType, {
                onSuccess: () => {
                    if (newValue) {
                        toast.success('F5-TTS включён');
                        window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                    } else {
                        toast.success('Переключено на Google TTS');
                    }
                },
                onError: (error: any) => {
                    setAiTtsEnabled(!newValue);
                    logger.error('Error switching engine:', error);
                },
            });
        }
    };

    const handleEngineChange = (engine: 'cloud' | 'local'): void => {
        setTtsEngine(engine);
        if (aiTtsEnabled) {
            switchEngineMutation.mutate(engine);
        }
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

    const handleTtsSettingChange = useCallback((key: keyof TtsSettingsState, value: boolean | number): void => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettings(newSettings);
        
        if (settingsDebounceRef.current) {
            clearTimeout(settingsDebounceRef.current);
        }
        
        settingsDebounceRef.current = setTimeout(() => {
            // Преобразуем TtsSettingsState в Partial<TtsSettings>
            const ttsSettingsPayload = {
                enable_7tv: newSettings.enable7TV,
                enable_twitch: newSettings.enableTwitch,
                filter_replies: newSettings.filterReplies,
                filter_mentions: newSettings.filterMentions,
                version: newSettings.version
            };
            saveTtsSettingsMutation.mutate(ttsSettingsPayload);
        }, 200);
    }, [ttsSettings, saveTtsSettingsMutation]);

    const handlePlatformToggle = useCallback((platform: 'twitch' | 'vk'): void => {
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
        onSuccess: (response: any) => {
            const token = response.data?.obs_token;
            if (token) {
                const url = getTtsWebSocketUrl(token);
                setObsUrl(url);
                toast.success('Токен обновлён, URL скопирован в буфер обмена');
                navigator.clipboard.writeText(url);
                logger.log('OBS URL regenerated:', url);
            } else {
                toast.error('Токен не получен');
            }
        },
        onError: (error: any) => {
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

    if (!isGuest && !isTwitchConnected && !isVkConnected) {
        return (
            <PageWrapper title="Text to Speech">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Нет подключенных интеграций
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
                            Перейти в настройки
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Text to Speech">
            <div className="space-y-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-900/80 to-gray-800/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isAnyTtsEnabled ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'}`} />
                        <div>
                            <div className="text-sm font-bold text-white">Озвучка сообщений</div>
                            <div className="text-xs text-gray-400">
                                {isAnyTtsEnabled ? 'Активна' : 'Отключена'}
                            </div>
                        </div>
                    </div>
                    <Switch
                        checked={isAnyTtsEnabled}
                        onCheckedChange={handleGlobalTtsToggle}
                        className="data-[state=checked]:bg-green-600"
                        disabled={!isDataLoaded || (!isGuest && !isTwitchConnected && !isVkConnected)}
                    />
                </div>

                {isAnyTtsEnabled && (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card className="border-gray-700/50 bg-gray-900/50 backdrop-blur-sm flex flex-col">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold text-white">Управление</CardTitle>
                                        <div className="flex items-center gap-2">
                                            {isChecking ? (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                                    Проверка...
                                                </div>
                                            ) : isHealthy ? (
                                                <div className="flex items-center gap-1.5 text-xs text-green-400">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    F5-TTS доступен
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    F5-TTS недоступен
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 flex-1 flex flex-col">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Режим включения</label>
                                        <TtsChannelPointsMode
                                            ttsMode={ttsTriggerMode}
                                            onModeChange={handleTtsModeChange}
                                            isSaving={isSavingMode}
                                            showModeSelector={true}
                                            showRewards={false}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Алгоритм озвучки</label>
                                        <div className="space-y-2">
                                            <div
                                                onClick={handleBasicTtsToggle}
                                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                                    basicTtsEnabled && !aiTtsEnabled
                                                        ? 'bg-purple-600/15 border border-gray-700/50'
                                                        : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/50'
                                                }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Google TTS</div>
                                                    <div className="text-xs text-gray-400">Быстрый, стабильный</div>
                                                </div>
                                                <Switch
                                                    checked={basicTtsEnabled && !aiTtsEnabled}
                                                    onCheckedChange={handleBasicTtsToggle}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="data-[state=checked]:bg-purple-600"
                                                />
                                            </div>
                                            <div
                                                onClick={!isHealthy || !canUseF5TTS || isF5TTSDataLoading ? undefined : handleAiTtsToggle}
                                                className={`group flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                                                    !isHealthy || !canUseF5TTS || isF5TTSDataLoading
                                                        ? 'opacity-50 cursor-not-allowed bg-gray-800/20 border border-gray-700/30'
                                                        : aiTtsEnabled
                                                            ? 'cursor-pointer bg-purple-600/15 border border-gray-700/50'
                                                            : 'cursor-pointer bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/50'
                                                }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                                                        F5-TTS (AI)
                                                        {isF5TTSDataLoading && (
                                                            <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {isF5TTSDataLoading 
                                                            ? 'Загрузка данных...' 
                                                            : !isHealthy 
                                                                ? 'Сервис недоступен' 
                                                                : !canUseF5TTS 
                                                                    ? 'Требуется whitelist' 
                                                                    : 'Качественная озвучка'}
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
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Движок</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleEngineChange('cloud')}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                    ttsEngine === 'cloud'
                                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 border border-gray-700/50'
                                                }`}
                                            >
                                                Cloud
                                            </button>
                                            <button
                                                onClick={() => handleEngineChange('local')}
                                                disabled={!hasLocalSetup}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                    !hasLocalSetup
                                                        ? 'opacity-40 cursor-not-allowed bg-gray-800/30 text-gray-600'
                                                        : ttsEngine === 'local'
                                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 border border-gray-700/50'
                                                }`}
                                            >
                                                Local
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col">
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Вывод звука</label>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <button
                                                onClick={() => handleListeningModeChange('website')}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                    listeningMode === 'website'
                                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 border border-gray-700/50'
                                                }`}
                                            >
                                                Сайт
                                            </button>
                                            <button
                                                onClick={() => handleListeningModeChange('obs')}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                    listeningMode === 'obs'
                                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/60 border border-gray-700/50'
                                                }`}
                                            >
                                                OBS
                                            </button>
                                        </div>
                                        
                                        <div className="flex-1 flex items-center justify-center pt-4 border-t border-gray-700/30">
                                            {listeningMode === 'website' ? (
                                                <div className="w-full">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <label className="text-xs font-semibold text-gray-400">Громкость</label>
                                                        <span className="text-sm font-bold text-purple-300 bg-purple-600/20 px-3 py-1 rounded-lg">
                                                            {localVolume}%
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        value={[localVolume]}
                                                        onValueChange={(val) => handleVolumeChange(val[0])}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        className="w-full"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-full space-y-2">
                                                    <label className="text-xs text-gray-400 block font-semibold">OBS Browser Source:</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={obsUrl || 'Загрузка...'}
                                                            readOnly
                                                            className="flex-1 bg-gray-900/50 border border-gray-700/50 text-gray-300 text-xs px-3 py-2 rounded focus:outline-none focus:border-purple-500"
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                if (obsUrl) {
                                                                    navigator.clipboard.writeText(obsUrl);
                                                                    toast.success('Скопировано');
                                                                }
                                                            }}
                                                            disabled={!obsUrl}
                                                            className="px-3 text-xs border-purple-600/50 text-purple-300 hover:bg-purple-600/20 disabled:opacity-50"
                                                        >
                                                            Copy
                                                        </Button>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleRegenerateObsUrl}
                                                        disabled={isRegeneratingUrl}
                                                        className="w-full text-xs border-purple-600/50 text-purple-300 hover:bg-purple-600/20"
                                                    >
                                                        <RefreshCw className={`w-3 h-3 mr-1 ${isRegeneratingUrl ? 'animate-spin' : ''}`} />
                                                        Обновить токен
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-4 flex flex-col">
                                <Card className={`border-gray-700/50 bg-gray-900/50 backdrop-blur-sm transition-all ${ttsTriggerMode === 'all_messages' ? 'opacity-50' : ''}`}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold text-white">Озвучка за баллы</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[160px] flex items-center p-0">
                                        {ttsTriggerMode === 'channel_points' ? (
                                            <div className="w-full px-6">
                                                <TtsChannelPointsMode
                                                    ttsMode={ttsTriggerMode}
                                                    onModeChange={handleTtsModeChange}
                                                    isSaving={isSavingMode}
                                                    showModeSelector={false}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full text-center px-6">
                                                <p className="text-sm text-gray-400">Выберите режим "За баллы канала" для настройки наград</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-gray-700/50 bg-gray-900/50 backdrop-blur-sm flex-1 flex flex-col">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold text-white">Дополнительно</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 flex-1">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-2">Смайлы</label>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700/50">
                                                    <span className="text-xs text-gray-300 font-medium">7TV</span>
                                                    <Switch
                                                        checked={ttsSettings.enable7TV}
                                                        onCheckedChange={(checked) => handleTtsSettingChange('enable7TV', checked)}
                                                        className="scale-90 data-[state=checked]:bg-purple-600"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700/50">
                                                    <span className="text-xs text-gray-300 font-medium">Twitch</span>
                                                    <Switch
                                                        checked={ttsSettings.enableTwitch}
                                                        onCheckedChange={(checked) => handleTtsSettingChange('enableTwitch', checked)}
                                                        className="scale-90 data-[state=checked]:bg-purple-600"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-2">Фильтры</label>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700/50">
                                                    <span className="text-xs text-gray-300 font-medium">Пропускать ответы</span>
                                                    <Switch
                                                        checked={ttsSettings.filterReplies}
                                                        onCheckedChange={(checked) => handleTtsSettingChange('filterReplies', checked)}
                                                        className="scale-90 data-[state=checked]:bg-purple-600"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700/50">
                                                    <span className="text-xs text-gray-300 font-medium">Пропускать упоминания</span>
                                                    <Switch
                                                        checked={ttsSettings.filterMentions}
                                                        onCheckedChange={(checked) => handleTtsSettingChange('filterMentions', checked)}
                                                        className="scale-90 data-[state=checked]:bg-purple-600"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {(isTwitchConnected || isVkConnected) && (
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-400 mb-2">Платформы</label>
                                                <div className="space-y-2">
                                                    {isTwitchConnected && (
                                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700/50">
                                                            <div className="flex items-center gap-2">
                                                                <TwitchIcon className="w-4 h-4 text-purple-400" />
                                                                <span className="text-xs text-gray-300 font-medium">Twitch</span>
                                                            </div>
                                                            <Switch
                                                                checked={platformSettings.enabled_platforms?.includes('twitch')}
                                                                onCheckedChange={() => handlePlatformToggle('twitch')}
                                                                className="scale-90 data-[state=checked]:bg-purple-600"
                                                            />
                                                        </div>
                                                    )}
                                                    {isVkConnected && (
                                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700/50">
                                                            <div className="flex items-center gap-2">
                                                                <VKIcon className="w-4 h-4 text-blue-400" />
                                                                <span className="text-xs text-gray-300 font-medium">VK</span>
                                                            </div>
                                                            <Switch
                                                                checked={platformSettings.enabled_platforms?.includes('vk')}
                                                                onCheckedChange={() => handlePlatformToggle('vk')}
                                                                className="scale-90 data-[state=checked]:bg-purple-600"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <TtsFilterManager />
                    </>
                )}
            </div>
        </PageWrapper>
    );
};

export default TtsMainPageContent;

