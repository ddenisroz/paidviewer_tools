// src/pages/tts/TtsMainPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTts } from '../../context/TtsContext';
import { useTtsHealth } from '../../context/TtsHealthContext';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { generateObsUrl, botService, ttsService } from '../../services/microservices';
import PageWrapper from '../../components/PageWrapper';
import { getTtsWebSocketUrl } from '../../utils/urlUtils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TwitchIcon, VKIcon } from '../../components/PlatformIcons';
import TtsFilterManager from '../../components/tts/TtsFilterManager';
import TtsChannelPointsMode from '../../components/tts/TtsChannelPointsMode';
import { ttsLogger } from '../../utils/logger';
import { logger } from '../../utils/prodLogger';

const TtsMainPageContent = () => {
    const { ttsEnabled, isWhitelisted, initializeTts } = useTts();
    const { isHealthy, isChecking } = useTtsHealth();
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    
    const [basicTtsEnabled, setBasicTtsEnabled] = useState(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState(false);
    const [ttsTriggerMode, setTtsTriggerMode] = useState('all_messages');
    const [ttsEngine, setTtsEngine] = useState('cloud');
    const [listeningMode, setListeningMode] = useState('website');
    const [obsUrl, setObsUrl] = useState('');
    const [localVolume, setLocalVolume] = useState(50);
    
    // Collapsible states
    const [isAudioExpanded, setIsAudioExpanded] = useState(true);
    const [isAdditionalExpanded, setIsAdditionalExpanded] = useState(true);
    
    const [platformSettings, setPlatformSettings] = useState({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });
    
    const [ttsSettings, setTtsSettings] = useState({
        enable7TV: true,
        enableTwitch: true,
        filterReplies: false,
        filterMentions: false,
        version: 1,
    });
    
    const [localTtsConfig, setLocalTtsConfig] = useState(null);
    const [isSavingMode, setIsSavingMode] = useState(false);
    const [isRegeneratingUrl, setIsRegeneratingUrl] = useState(false);
    
    // Debounce refs
    const volumeDebounceRef = useRef(null);
    const settingsDebounceRef = useRef(null);
    
    const queryClient = useQueryClient();
    const isTwitchConnected = integrations.twitch?.enabled || (isGuest && user?.platform === 'twitch');
    const isVkConnected = integrations.vk?.enabled || (isGuest && user?.platform === 'vk');
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
    const canUseF5TTS = hasLocalSetup || isWhitelisted === true;
    const isAnyTtsEnabled = basicTtsEnabled || aiTtsEnabled;

    // Mutations
    const toggleBasicTtsMutation = useMutation({
        mutationFn: async (enabled) => {
            return enabled ? await botService.post('/api/tts/enable') : await botService.post('/api/tts/disable');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            logger.log('Basic TTS state saved');
        }
    });

    const savePlatformSettingsMutation = useMutation({
        mutationFn: async (data) => await ttsService.post('/save-settings', data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tts-settings'] })
    });

    const saveAudioSettingsMutation = useMutation({
        mutationFn: async (data) => await botService.post('/api/tts/audio-settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-audio-settings'] });
            logger.log('Audio settings saved');
        },
        onError: (error) => {
            logger.error('Error saving audio settings:', error);
            toast.error('Ошибка сохранения громкости');
        }
    });

    const saveTtsSettingsMutation = useMutation({
        mutationFn: async (data) => await botService.post('/api/tts/settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-settings'] });
            logger.log('TTS settings saved');
        },
        onError: (error) => {
            logger.error('Error saving TTS settings:', error);
            if (error.response?.status === 409) {
                toast.warning('Настройки были обновлены. Перезагружаю...');
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ['tts-settings'] }), 1500);
            } else {
                toast.error('Ошибка сохранения настроек');
            }
        }
    });

    const saveListeningModeMutation = useMutation({
        mutationFn: async (mode) => await botService.post('/api/tts/listening-mode', { listeningMode: mode }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            logger.log('Listening mode saved');
        }
    });

    const switchEngineMutation = useMutation({
        mutationFn: async ({ engine_type }) => await botService.post('/api/tts/engine', { engine_type }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tts-status'] })
    });

    // Load TTS status
    const { data: ttsStatusData } = useQuery({
        queryKey: ['tts-status'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/status');
            return response.data;
        },
        enabled: isAuthenticated,
        refetchInterval: 30000,
    });

    // Load TTS settings
    const { data: ttsSettingsData } = useQuery({
        queryKey: ['tts-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/settings');
            return response.data;
        },
        enabled: isAuthenticated,
    });

    useEffect(() => {
        if (ttsStatusData) {
            const basicEnabled = ttsStatusData.basic_tts_enabled || false;
            const aiEnabled = ttsStatusData.ai_tts_enabled || false;
            
            setBasicTtsEnabled(basicEnabled);
            setAiTtsEnabled(aiEnabled);
            
            if (ttsStatusData.tts_engine) setTtsEngine(ttsStatusData.tts_engine);
            if (ttsStatusData.listening_mode) setListeningMode(ttsStatusData.listening_mode);
            if (ttsStatusData.platform_settings) setPlatformSettings(ttsStatusData.platform_settings);
            if (ttsStatusData.audio_settings?.website_volume) setLocalVolume(ttsStatusData.audio_settings.website_volume);
        }
    }, [ttsStatusData]);

    useEffect(() => {
        if (ttsSettingsData) {
            setTtsSettings(prev => ({
                ...prev,
                enable7TV: ttsSettingsData.enable7TV ?? prev.enable7TV,
                enableTwitch: ttsSettingsData.enableTwitch ?? prev.enableTwitch,
                filterReplies: ttsSettingsData.filterReplies ?? prev.filterReplies,
                filterMentions: ttsSettingsData.filterMentions ?? prev.filterMentions,
                version: ttsSettingsData.version ?? prev.version,
            }));
        }
    }, [ttsSettingsData]);

    // Load TTS trigger mode from backend
    useEffect(() => {
        if (isAuthenticated) {
            botService.get('/api/tts/mode-settings')
                .then(res => {
                    if (res.data?.tts_mode) {
                        setTtsTriggerMode(res.data.tts_mode);
                    }
                })
                .catch(err => logger.error('Error loading TTS mode:', err));
        }
    }, [isAuthenticated]);

    // Generate OBS URL
    useEffect(() => {
        if (listeningMode === 'obs' && isAuthenticated && user?.id) {
            generateObsUrl()
                .then(response => {
                    const token = response.data?.obs_token;
                    if (token) setObsUrl(getTtsWebSocketUrl(token));
                })
                .catch(err => logger.error('Error generating OBS URL:', err));
        }
    }, [listeningMode, isAuthenticated, user?.id]);

    useEffect(() => {
        initializeTts();
    }, []);

    // Handlers
    const handleGlobalTtsToggle = () => {
        const newState = !isAnyTtsEnabled;
        
        if (newState) {
            setBasicTtsEnabled(true);
            toggleBasicTtsMutation.mutate(true);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
        } else {
            setBasicTtsEnabled(false);
            setAiTtsEnabled(false);
            toggleBasicTtsMutation.mutate(false);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: false } }));
        }
    };

    const handleTtsModeChange = async (mode) => {
        if (isSavingMode) return;
        
        setIsSavingMode(true);
        try {
            const response = await botService.post('/api/tts/mode-settings', { tts_mode: mode });
            setTtsTriggerMode(mode);
            toast.success(response.data?.message || 'Режим изменён');
        } catch (error) {
            logger.error('Error changing TTS mode:', error);
            toast.error('Ошибка изменения режима');
        } finally {
            setIsSavingMode(false);
        }
    };

    const handleBasicTtsToggle = () => {
        const newValue = !basicTtsEnabled;
        
        if (newValue) {
            setBasicTtsEnabled(true);
            setAiTtsEnabled(false);
            toggleBasicTtsMutation.mutate(true);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
        } else {
            setBasicTtsEnabled(false);
            toggleBasicTtsMutation.mutate(false);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: false } }));
        }
    };

    const handleAiTtsToggle = () => {
        if (!canUseF5TTS || !isHealthy) {
            toast.error('F5-TTS недоступен');
            return;
        }
        
        const newValue = !aiTtsEnabled;
        
        if (newValue) {
            switchEngineMutation.mutate({ engine_type: ttsEngine === 'local' ? 'local' : 'cloud' }, {
                onSuccess: () => {
                    setAiTtsEnabled(true);
                    setBasicTtsEnabled(true);
                    toast.success('F5-TTS включён');
                    window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
                }
            });
        } else {
            switchEngineMutation.mutate({ engine_type: 'gtts' }, {
                onSuccess: () => {
                    setAiTtsEnabled(false);
                    toast.success('Переключено на Google TTS');
                }
            });
        }
    };

    const handleEngineChange = (engine) => {
        setTtsEngine(engine);
        if (aiTtsEnabled) {
            switchEngineMutation.mutate({ engine_type: engine });
        }
    };

    const handleListeningModeChange = (mode) => {
        setListeningMode(mode);
        saveListeningModeMutation.mutate(mode);
    };

    const handleVolumeChange = useCallback((value) => {
        setLocalVolume(value);
        
        // Debounce save (1000ms)
        if (volumeDebounceRef.current) {
            clearTimeout(volumeDebounceRef.current);
        }
        
        volumeDebounceRef.current = setTimeout(() => {
            saveAudioSettingsMutation.mutate({ website_volume: value });
        }, 1000);
    }, [saveAudioSettingsMutation]);

    const handleTtsSettingChange = useCallback((key, value) => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettings(newSettings);
        
        // Debounce save (500ms)
        if (settingsDebounceRef.current) {
            clearTimeout(settingsDebounceRef.current);
        }
        
        settingsDebounceRef.current = setTimeout(() => {
            saveTtsSettingsMutation.mutate(newSettings);
        }, 500);
    }, [ttsSettings, saveTtsSettingsMutation]);

    const handlePlatformToggle = useCallback((platform) => {
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

    const handleRegenerateObsUrl = async () => {
        setIsRegeneratingUrl(true);
        try {
            const response = await generateObsUrl();
            const token = response.data?.obs_token;
            if (token) {
                setObsUrl(getTtsWebSocketUrl(token));
                toast.success('URL обновлён');
            }
        } catch (error) {
            logger.error('Error regenerating OBS URL:', error);
            toast.error('Ошибка обновления URL');
        } finally {
            setIsRegeneratingUrl(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Text to Speech">
                <div className="text-center text-gray-400">
                    Войдите, чтобы настроить TTS
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Text to Speech">
            <div className="space-y-4 max-w-5xl mx-auto">
                {/* Main TTS Toggle */}
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
                    />
                </div>

                {isAnyTtsEnabled && (
                    <>
                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left Column: Main Controls */}
                            <Card className="border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold text-white">Управление</CardTitle>
                                        {/* Health Status Indicator */}
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
                                <CardContent className="space-y-4">
                                    {/* Trigger Mode */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Режим включения</label>
                                        <TtsChannelPointsMode
                                            ttsMode={ttsTriggerMode}
                                            onModeChange={handleTtsModeChange}
                                            isSaving={isSavingMode}
                                        />
                                    </div>

                                    {/* TTS Engine */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Алгоритм озвучки</label>
                                        <div className="space-y-2">
                                            <div
                                                onClick={handleBasicTtsToggle}
                                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                                                    basicTtsEnabled && !aiTtsEnabled
                                                        ? 'bg-green-600/20 border-2 border-green-500'
                                                        : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/30'
                                                }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Google TTS</div>
                                                    <div className="text-xs text-gray-400">Быстрый, стабильный</div>
                                                </div>
                                                <Switch
                                                    checked={basicTtsEnabled && !aiTtsEnabled}
                                                    onCheckedChange={handleBasicTtsToggle}
                                                    className="data-[state=checked]:bg-green-600"
                                                />
                                            </div>
                                            <div
                                                onClick={handleAiTtsToggle}
                                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                                                    !isHealthy || !canUseF5TTS
                                                        ? 'opacity-40 cursor-not-allowed bg-gray-800/20'
                                                        : aiTtsEnabled
                                                            ? 'bg-purple-600/20 border-2 border-purple-500'
                                                            : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-700/30'
                                                }`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-white">F5-TTS (AI)</div>
                                                    <div className="text-xs text-gray-400">
                                                        {!isHealthy ? 'Сервис недоступен' : !canUseF5TTS ? 'Требуется whitelist' : 'Качественная озвучка'}
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={aiTtsEnabled}
                                                    onCheckedChange={handleAiTtsToggle}
                                                    disabled={!isHealthy || !canUseF5TTS}
                                                    className="data-[state=checked]:bg-purple-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Engine Type */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Движок</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleEngineChange('cloud')}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                                                    ttsEngine === 'cloud'
                                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50'
                                                }`}
                                            >
                                                Cloud
                                            </button>
                                            <button
                                                onClick={() => handleEngineChange('local')}
                                                disabled={!hasLocalSetup}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                                                    !hasLocalSetup
                                                        ? 'opacity-40 cursor-not-allowed bg-gray-800/30 text-gray-600'
                                                        : ttsEngine === 'local'
                                                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50'
                                                }`}
                                            >
                                                Local
                                            </button>
                                        </div>
                                    </div>

                                    {/* Output Mode */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2">Вывод звука</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleListeningModeChange('website')}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                                                    listeningMode === 'website'
                                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50'
                                                }`}
                                            >
                                                Сайт
                                            </button>
                                            <button
                                                onClick={() => handleListeningModeChange('obs')}
                                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                                                    listeningMode === 'obs'
                                                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50'
                                                }`}
                                            >
                                                OBS
                                            </button>
                                        </div>
                                        <div className="mt-3 p-3 rounded-lg border bg-gray-800/30 border-gray-700/50 min-h-[88px]">
                                            {listeningMode === 'obs' ? (
                                                <>
                                                    <div className="text-xs text-gray-400 mb-2">OBS Browser Source URL:</div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={obsUrl}
                                                            readOnly
                                                            className="flex-1 bg-gray-900/50 border border-gray-700/50 text-gray-300 text-xs px-3 py-2 rounded focus:outline-none focus:border-purple-500"
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(obsUrl);
                                                                toast.success('Скопировано');
                                                            }}
                                                            className="px-3 text-xs border-green-600/50 text-green-300 hover:bg-green-600/20"
                                                        >
                                                            Copy
                                                        </Button>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleRegenerateObsUrl}
                                                        disabled={isRegeneratingUrl}
                                                        className="w-full mt-2 text-xs border-purple-600/50 text-purple-300 hover:bg-purple-600/20"
                                                    >
                                                        <RefreshCw className={`w-3 h-3 mr-1 ${isRegeneratingUrl ? 'animate-spin' : ''}`} />
                                                        Обновить токен
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="text-xs text-gray-500">Выбран вывод на сайт</div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Right Column: Audio & Additional Settings */}
                            <div className="space-y-4">
                                {/* Audio Settings */}
                                {listeningMode === 'website' && (
                                    <Card className="border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
                                        <CardHeader 
                                            className="pb-3 cursor-pointer hover:bg-gray-800/20 transition-colors"
                                            onClick={() => setIsAudioExpanded(!isAudioExpanded)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base font-bold text-white">Аудио</CardTitle>
                                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isAudioExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </CardHeader>
                                        {isAudioExpanded && (
                                            <CardContent>
                                                <div>
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
                                            </CardContent>
                                        )}
                                    </Card>
                                )}

                                {/* Additional Settings */}
                                <Card className="border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
                                    <CardHeader 
                                        className="pb-3 cursor-pointer hover:bg-gray-800/20 transition-colors"
                                        onClick={() => setIsAdditionalExpanded(!isAdditionalExpanded)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base font-bold text-white">Дополнительно</CardTitle>
                                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isAdditionalExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </CardHeader>
                                    {isAdditionalExpanded && (
                                        <CardContent className="space-y-4">
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

                                            {/* Platforms */}
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
                                    )}
                                </Card>
                            </div>
                        </div>

                        {/* Filters */}
                        <TtsFilterManager
                            ttsSettings={ttsSettings}
                            setTtsSettings={setTtsSettings}
                        />
                    </>
                )}
            </div>
        </PageWrapper>
    );
};

export default TtsMainPageContent;
