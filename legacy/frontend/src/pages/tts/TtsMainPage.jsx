// src/pages/tts/TtsMainPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { RefreshCw, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import { TwitchIcon, VKIcon } from '../../components/PlatformIcons';
import TtsFilterManager from '../../components/tts/TtsFilterManager';
import TtsChannelPointsMode from '../../components/tts/TtsChannelPointsMode';
import { ttsLogger } from '../../utils/logger';
import { logger } from '../../utils/prodLogger';
import { getQueryCache, setQueryCache } from '../../utils/queryPersist';

const TtsMainPageContent = () => {
    const navigate = useNavigate();
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
    
    // No collapsible states - always expanded except Filters
    
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
    // 🔒 Проверка наличия интеграций: гость ИЛИ есть хотя бы одна интеграция
    const hasAnyIntegration = isGuest || isTwitchConnected || isVkConnected;
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
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
        mutationFn: async (data) => await botService.post('/api/tts/platform-settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-platform-settings'] });
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            logger.log('Platform settings saved');
        },
        onError: (error) => {
            logger.error('Error saving platform settings:', error);
            toast.error('Ошибка сохранения платформ');
        }
    });

    const saveAudioSettingsMutation = useMutation({
        mutationFn: async (data) => await botService.post('/api/tts/audio-settings', { websiteVolume: data.websiteVolume }),
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
            queryClient.invalidateQueries({ queryKey: ['tts-settings'] });
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            logger.log('Listening mode saved');
        }
    });

    const switchEngineMutation = useMutation({
        mutationFn: async ({ engine_type }) => await botService.post('/api/tts/engine', { engine_type }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tts-status'] })
    });

    // Load TTS status
    const { data: ttsStatusData, isLoading: isLoadingTtsStatus } = useQuery({
        queryKey: ['tts-status'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/status');
            const data = response.data;
            // 🚀 ANTI-FLASH: Сохраняем в кэш
            setQueryCache(['tts-status'], data);
            return data;
        },
        enabled: isAuthenticated,
        refetchInterval: 30000,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        initialData: () => getQueryCache(['tts-status']), // 🚀 ANTI-FLASH: Загружаем из кэша
    });
    
    // F5-TTS доступен если: есть локальная настройка ИЛИ пользователь в whitelist (не null/undefined)
    // ✅ Проверяем загрузку: если данные еще загружаются, считаем что F5-TTS недоступен
    const isF5TTSDataLoading = isLoadingTtsStatus || isWhitelisted === null || isChecking;
    const canUseF5TTS = !isF5TTSDataLoading && (hasLocalSetup || (isWhitelisted !== null && isWhitelisted !== false));

    // Load TTS settings
    const { data: ttsSettingsData } = useQuery({
        queryKey: ['tts-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/settings');
            const data = response.data;
            setQueryCache(['tts-settings'], data);
            return data;
        },
        enabled: isAuthenticated,
        initialData: () => getQueryCache(['tts-settings']),
    });

    // Load audio settings
    const { data: audioSettingsData } = useQuery({
        queryKey: ['tts-audio-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/audio-settings');
            const data = response.data;
            setQueryCache(['tts-audio-settings'], data);
            return data;
        },
        enabled: isAuthenticated,
        initialData: () => getQueryCache(['tts-audio-settings']),
    });

    // Load platform settings
    const { data: platformSettingsData } = useQuery({
        queryKey: ['tts-platform-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/platform-settings');
            const data = response.data;
            setQueryCache(['tts-platform-settings'], data);
            return data;
        },
        enabled: isAuthenticated,
        initialData: () => getQueryCache(['tts-platform-settings']),
    });

    // Load TTS mode settings
    const { data: modeSettingsData } = useQuery({
        queryKey: ['tts-mode-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/mode-settings');
            const data = response.data;
            setQueryCache(['tts-mode-settings'], data);
            return data;
        },
        enabled: isAuthenticated,
        initialData: () => getQueryCache(['tts-mode-settings']),
    });

    // Проверяем, загружены ли все данные (или есть в кэше)
    const isDataLoaded = React.useMemo(() => {
        return ttsStatusData !== undefined || getQueryCache(['tts-status']) !== null;
    }, [ttsStatusData]);

    // Update state from TTS status
    useEffect(() => {
        if (ttsStatusData) {
            const enabled = ttsStatusData.enabled || false;
            const engineType = ttsStatusData.engine_type || 'gtts';
            
            // Determine basic and AI TTS states based on enabled and engine_type
            const basicEnabled = enabled && engineType === 'gtts';
            const aiEnabled = enabled && (engineType === 'cloud' || engineType === 'local');
            
            // Update states - use functional updates to avoid dependency issues
            setBasicTtsEnabled(prev => prev !== basicEnabled ? basicEnabled : prev);
            setAiTtsEnabled(prev => prev !== aiEnabled ? aiEnabled : prev);
            
            // Update engine type (cloud or local)
            if (engineType === 'local' || engineType === 'cloud') {
                setTtsEngine(prev => prev !== engineType ? engineType : prev);
            } else {
                setTtsEngine(prev => prev !== 'cloud' ? 'cloud' : prev);
            }
        }
    }, [ttsStatusData]);

    // Update state from TTS settings
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
            
            // Update listening mode from settings
            if (ttsSettingsData.listeningMode) {
                setListeningMode(prev => prev !== ttsSettingsData.listeningMode ? ttsSettingsData.listeningMode : prev);
            }
        }
    }, [ttsSettingsData]);

    // Update state from audio settings
    useEffect(() => {
        if (audioSettingsData?.websiteVolume !== undefined) {
            setLocalVolume(prev => prev !== audioSettingsData.websiteVolume ? audioSettingsData.websiteVolume : prev);
        }
    }, [audioSettingsData]);

    // Update state from platform settings
    useEffect(() => {
        if (platformSettingsData?.enabled_platforms) {
            setPlatformSettings(prev => {
                const newPlatforms = platformSettingsData.enabled_platforms || [];
                const currentPlatforms = prev.enabled_platforms || [];
                if (JSON.stringify(currentPlatforms) !== JSON.stringify(newPlatforms)) {
                    return {
                        ...prev,
                        enabled_platforms: newPlatforms,
                        global_enabled: platformSettingsData.global_enabled ?? prev.global_enabled
                    };
                }
                return prev;
            });
        }
    }, [platformSettingsData]);

    // Update state from mode settings
    useEffect(() => {
        if (modeSettingsData?.tts_mode) {
            setTtsTriggerMode(prev => prev !== modeSettingsData.tts_mode ? modeSettingsData.tts_mode : prev);
        }
    }, [modeSettingsData]);

    // Generate OBS URL
    useEffect(() => {
        if (listeningMode === 'obs' && isAuthenticated && user?.id) {
            generateObsUrl()
                .then(response => {
                    const token = response.data?.obs_token;
                    if (token) {
                        const url = getTtsWebSocketUrl(token);
                        setObsUrl(url);
                        logger.log('OBS URL generated:', url);
                    }
                })
                .catch(err => {
                    logger.error('Error generating OBS URL:', err);
                    toast.error('Ошибка генерации OBS URL');
                });
        } else if (listeningMode === 'website') {
            setObsUrl('');
        }
    }, [listeningMode, isAuthenticated, user?.id]);

    // TTS инициализация происходит автоматически в TtsContext, не нужно вызывать здесь

    // Handlers
    const handleGlobalTtsToggle = async () => {
        // 🔒 Проверка наличия интеграций - не позволяем включать TTS без интеграций
        if (!isGuest && !isTwitchConnected && !isVkConnected) {
            toast.error('Для использования TTS необходимо подключить хотя бы одну платформу');
            return;
        }
        
        const newState = !isAnyTtsEnabled;
        
        // Optimistically update UI
        if (newState) {
            setBasicTtsEnabled(true);
        } else {
            setBasicTtsEnabled(false);
            setAiTtsEnabled(false);
        }
        
        // Make API call
        try {
            if (newState) {
                await botService.post('/api/tts/enable');
            } else {
                await botService.post('/api/tts/disable');
            }
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: newState } }));
        } catch (error) {
            // Rollback on error
            if (newState) {
                setBasicTtsEnabled(false);
            } else {
                setBasicTtsEnabled(true);
            }
            logger.error('Error toggling TTS:', error);
            toast.error('Ошибка переключения озвучки');
        }
    };

    const handleTtsModeChange = async (mode) => {
        if (isSavingMode) return;
        
        setIsSavingMode(true);
        try {
            const response = await botService.post('/api/tts/mode-settings', { tts_mode: mode });
            setTtsTriggerMode(mode);
            queryClient.invalidateQueries({ queryKey: ['tts-mode-settings'] });
            toast.success(response.data?.message || 'Режим изменён');
        } catch (error) {
            logger.error('Error changing TTS mode:', error);
            toast.error('Ошибка изменения режима');
        } finally {
            setIsSavingMode(false);
        }
    };

    const handleBasicTtsToggle = async () => {
        const newValue = !basicTtsEnabled;
        
        try {
            // Optimistically update UI
            if (newValue) {
                setBasicTtsEnabled(true);
                setAiTtsEnabled(false);
            } else {
                setBasicTtsEnabled(false);
            }
            
            // Make API call
            if (newValue) {
                await botService.post('/api/tts/enable');
                // Переключаем на Google TTS если был F5-TTS
                if (aiTtsEnabled) {
                    await switchEngineMutation.mutateAsync({ engine_type: 'gtts' });
                    setAiTtsEnabled(false);
                }
            } else {
                await botService.post('/api/tts/disable');
            }
            
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: newValue } }));
            toast.success(newValue ? 'Google TTS включён' : 'TTS отключён');
        } catch (error) {
            // Rollback on error
            setBasicTtsEnabled(!newValue);
            logger.error('Error toggling basic TTS:', error);
            toast.error('Ошибка переключения TTS');
        }
    };

    const handleAiTtsToggle = async () => {
        if (!canUseF5TTS || !isHealthy) {
            toast.error('F5-TTS недоступен');
            return;
        }
        
        const newValue = !aiTtsEnabled;
        
        try {
            // Сначала включаем TTS, если он выключен
            if (newValue && !isAnyTtsEnabled) {
                await botService.post('/api/tts/enable');
                setBasicTtsEnabled(true);
            }
            
            // Затем переключаем движок
            const engineType = newValue ? (ttsEngine === 'local' ? 'local' : 'cloud') : 'gtts';
            await switchEngineMutation.mutateAsync({ engine_type: engineType });
            
            if (newValue) {
                setAiTtsEnabled(true);
                setBasicTtsEnabled(true);
                toast.success('F5-TTS включён');
                window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: true } }));
            } else {
                setAiTtsEnabled(false);
                toast.success('Переключено на Google TTS');
            }
            
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
        } catch (error) {
            logger.error('Error toggling AI TTS:', error);
            toast.error('Ошибка переключения F5-TTS');
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
        
        // Debounce save (300ms for faster response)
        if (volumeDebounceRef.current) {
            clearTimeout(volumeDebounceRef.current);
        }
        
        volumeDebounceRef.current = setTimeout(() => {
            saveAudioSettingsMutation.mutate({ websiteVolume: value });
        }, 300);
    }, [saveAudioSettingsMutation]);

    const handleTtsSettingChange = useCallback((key, value) => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettings(newSettings);
        
        // Debounce save (200ms for faster response)
        if (settingsDebounceRef.current) {
            clearTimeout(settingsDebounceRef.current);
        }
        
        settingsDebounceRef.current = setTimeout(() => {
            saveTtsSettingsMutation.mutate(newSettings);
        }, 200);
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
            // Используем специальный endpoint для перегенерации
            const response = await botService.post('/api/tts/regenerate-obs-url');
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
        } catch (error) {
            logger.error('Error regenerating OBS URL:', error);
            toast.error('Ошибка обновления URL');
        } finally {
            setIsRegeneratingUrl(false);
        }
    };

    // 🔒 ПЕРВООЧЕРЕДНАЯ ПРОВЕРКА: Авторизация
    // Если пользователь не авторизован - показываем сообщение с предложением войти
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

    // 🔒 Проверка наличия интеграций - ДО загрузки данных
    // Если нет интеграций и не гость - показываем сообщение сразу
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
                        disabled={!isDataLoaded || (!isGuest && !isTwitchConnected && !isVkConnected)} // 🔒 Отключаем если нет интеграций
                    />
                </div>

                {isAnyTtsEnabled && (
                    <>
                        {/* Settings Grid - EQUAL HEIGHT */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left Column: Main Controls */}
                            <Card className="border-gray-700/50 bg-gray-900/50 backdrop-blur-sm flex flex-col">
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
                                <CardContent className="space-y-4 flex-1 flex flex-col">
                                    {/* Trigger Mode */}
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

                                    {/* TTS Engine */}
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

                                    {/* Engine Type */}
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

                                    {/* Output Mode */}
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
                                        
                                        {/* Settings based on mode - centered vertically */}
                                        <div className="flex-1 flex items-center justify-center pt-4 border-t border-gray-700/30">
                                            {listeningMode === 'website' ? (
                                                /* Volume slider for Website mode */
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
                                                /* OBS Browser Source URL for OBS mode */
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

                            {/* Right Column: Rewards & Additional Settings */}
                            <div className="space-y-4 flex flex-col">
                                {/* Rewards Creation */}
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

                                {/* Additional Settings */}
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
