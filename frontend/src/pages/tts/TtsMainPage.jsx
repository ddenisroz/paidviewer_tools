// src/pages/tts/TtsMainPage_new.jsx
import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTts } from '../../context/TtsContext';
import { useTtsHealth } from '../../context/TtsHealthContext';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { generateObsUrl, botService, ttsService } from '../../services/microservices';
import TtsErrorCard from '../../components/TtsErrorCard';
import PageWrapper from '../../components/PageWrapper';
import { getTtsWebSocketUrl } from '../../utils/urlUtils';
import { toast } from 'sonner';

// Импорты новых компонентов
import TtsControlPanel from '../../components/tts/TtsControlPanel';
import AudioSettings from '../../components/tts/AudioSettings';
import TtsSettings from '../../components/tts/TtsSettings';
import HealthStatus from '../../components/tts/HealthStatus';
import TtsFilterManager from '../../components/tts/TtsFilterManager';
import { ttsLogger } from '../../utils/logger';
import { logger } from '../../utils/prodLogger';

const TtsMainPageContent = () => {
    const { ttsEnabled, toggleTts, isWhitelisted, setIsWhitelisted, engineStatus, isToggling, initializeTts, setNotificationHandler, syncWithHealthContext } = useTts();
    const { isHealthy, isChecking, lastCheck, checkTtsHealth } = useTtsHealth();
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    
    useEffect(() => {
        ttsLogger.info('TTS Main Page initialized', { 
            ttsEnabled, 
            isWhitelisted, 
            isAuthenticated, 
            isGuest,
            user: user?.id
        });
    }, []);
    
    const [listeningMode, setListeningMode] = useState('website');
    const [obsUrl, setObsUrl] = useState('');
    const [platformSettings, setPlatformSettings] = useState({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });
    const [platformLoading, setPlatformLoading] = useState(false);
    const [engineToggleLoading, setEngineToggleLoading] = useState(false);
    
    const [basicTtsEnabled, setBasicTtsEnabled] = useState(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState(false);
    
    const [audioSettings, setAudioSettings] = useState({
        websiteVolume: 50
    });
    
    const [ttsSettings, setTtsSettings] = useState({
        enable7TV: true,
        enableTwitch: true,
        enableLexiconFilter: true,
        enableCustomLexicon: false,
        filterReplies: false,
        filterMentions: false,
        version: 1,
    });
    
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    
    const [ttsEngine, setTtsEngine] = useState('cloud');
    const [localTtsConfig, setLocalTtsConfig] = useState(null);
    const [engineLoading, setEngineLoading] = useState(true);
    
    const queryClient = useQueryClient();

    const switchEngineMutation = useMutation({
        mutationFn: async ({ engine_type }) => {
            return await botService.post('/api/tts/engine', { engine_type });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            ttsLogger.success('TTS engine switched successfully');
        },
        onError: (error) => {
            ttsLogger.error('Error switching TTS engine:', error);
        },
    });

    const toggleBasicTtsMutation = useMutation({
        mutationFn: async (enabled) => {
            if (enabled) {
                return await botService.post('/api/tts/enable');
            } else {
                return await botService.post('/api/tts/disable');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            logger.log('Basic TTS state saved');
        },
        onError: (error) => {
            logger.error('Error saving basic TTS state:', error);
        },
    });

    const setListeningModeMutation = useMutation({
        mutationFn: async ({ listeningMode }) => {
            return await botService.post('/api/tts/listening-mode', { listeningMode });
        },
        onSuccess: () => {
            ttsLogger.success('Listening mode saved successfully');
        },
        onError: (error) => {
            ttsLogger.error('Error saving listening mode:', error);
        },
    });

    const savePlatformSettingsMutation = useMutation({
        mutationFn: async ({ enabled_platforms }) => {
            return await botService.post('/api/tts/platform-settings', { enabled_platforms });
        },
        onMutate: () => {
            setPlatformLoading(true);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-platform-settings'] });
            logger.log('Platform settings saved successfully');
        },
        onError: (error) => {
            logger.error('Error saving platform settings:', error);
            toast.error('Failed to switch platform');
        },
        onSettled: () => {
            setPlatformLoading(false);
        },
    });

    const saveAudioSettingsMutation = useMutation({
        mutationFn: async (newSettings) => {
            ttsLogger.api('POST', '/api/tts/audio-settings', newSettings);
            const response = await botService.post('/api/tts/audio-settings', newSettings);
            ttsLogger.apiResponse(200, '/api/tts/audio-settings', response.data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-audio-settings'] });
            setSaveStatus('Saved');
            ttsLogger.success('Audio settings saved successfully');
            setTimeout(() => setSaveStatus(''), 2000);
        },
        onError: (error) => {
            ttsLogger.error('Error saving audio settings:', error);
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                setSaveStatus('Save error');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                setSaveStatus('TTS service unavailable');
                setTimeout(() => setSaveStatus(''), 3000);
            }
        },
        onMutate: () => {
            setIsSaving(true);
            setSaveStatus('Saving...');
        },
        onSettled: () => {
            setIsSaving(false);
        },
    });
            
    const saveTtsSettingsMutation = useMutation({
        mutationFn: async (newSettings) => {
            ttsLogger.api('POST', '/api/tts/settings', newSettings);
            const response = await botService.post('/api/tts/settings', newSettings);
            ttsLogger.apiResponse(200, '/api/tts/settings', response.data);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tts-settings'] });
            if (data.version) {
                setTtsSettings(prev => ({...prev, version: data.version}));
            }
            setSaveStatus('Saved');
            ttsLogger.success('TTS settings saved successfully', {version: data.version});
            setTimeout(() => setSaveStatus(''), 2000);
        },
        onError: (error) => {
            ttsLogger.error('Error saving TTS settings:', error);
            
            if (error.response?.status === 409) {
                setSaveStatus('Data updated. Reloading...');
                ttsLogger.warning('Version conflict detected, reloading settings');
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ['tts-settings'] });
                    setSaveStatus('');
                }, 1500);
            } else if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                setSaveStatus('Save error');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                setSaveStatus('TTS service unavailable');
                setTimeout(() => setSaveStatus(''), 3000);
            }
        },
        onMutate: () => {
            setIsSaving(true);
            setSaveStatus('Saving...');
        },
        onSettled: () => {
            setIsSaving(false);
        },
    });

    const saveAudioSettings = useCallback((newSettings) => {
        saveAudioSettingsMutation.mutate(newSettings);
    }, [saveAudioSettingsMutation]);

    const saveTtsSettings = useCallback((newSettings) => {
        saveTtsSettingsMutation.mutate(newSettings);
    }, [saveTtsSettingsMutation]);

    const isConnected = isGuest || isAuthenticated || integrations.twitch?.connected || integrations.vk?.connected;
    
    useEffect(() => {
        ttsLogger.debug('TTS Connection status:', { isGuest, isAuthenticated, integrations, isConnected });
    }, [isGuest, isAuthenticated, integrations, isConnected]);

    const { data: ttsStatusData, isLoading: ttsStatusLoading } = useQuery({
        queryKey: ['tts-status'],
        queryFn: async () => {
            ttsLogger.info('Fetching TTS status from API...');
            const response = await botService.get('/api/tts/status');
            ttsLogger.info('TTS status API response:', response.data);
            return response.data;
        },
        enabled: !!isAuthenticated,
        staleTime: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

    const lastProcessedRef = useRef({
        enabled: null,
        engineType: null,
        isWhitelisted: null,
        hasLocalSetup: null
    });

    useEffect(() => {
        if (ttsStatusData) {
            const isTtsEnabled = ttsStatusData.enabled || false;
            const engineType = ttsStatusData.engine_type || 'cloud';
            const newIsWhitelisted = ttsStatusData.is_whitelisted || false;
            const hasLocalSetup = ttsStatusData.has_local_setup || false;
            
            const lastProcessed = lastProcessedRef.current;
            const hasChanged = 
                lastProcessed.enabled !== isTtsEnabled ||
                lastProcessed.engineType !== engineType ||
                lastProcessed.isWhitelisted !== newIsWhitelisted ||
                lastProcessed.hasLocalSetup !== hasLocalSetup;
            
            if (!hasChanged) {
                return;
            }
            
            ttsLogger.info('TTS status data changed:', {
                enabled: isTtsEnabled,
                engineType,
                isWhitelisted: newIsWhitelisted,
                hasLocalSetup,
                previous: lastProcessed
            });
            
            lastProcessedRef.current = {
                enabled: isTtsEnabled,
                engineType,
                isWhitelisted: newIsWhitelisted,
                hasLocalSetup
            };
                    
            setBasicTtsEnabled(isTtsEnabled);
            
            if (setIsWhitelisted && isWhitelisted !== newIsWhitelisted) {
                ttsLogger.info('Updating isWhitelisted:', newIsWhitelisted, '(was:', isWhitelisted, ')');
                setIsWhitelisted(newIsWhitelisted);
            }
            
            const canUseLocalTTS = hasLocalSetup || newIsWhitelisted;
            
            const isF5TtsEnabled = (engineType === 'local' && canUseLocalTTS) || 
                                   (engineType === 'cloud' && newIsWhitelisted);
            
            setAiTtsEnabled(isF5TtsEnabled);
            
            if (engineType === 'local' && canUseLocalTTS) {
                setTtsEngine('local');
            } else if (engineType === 'cloud' && newIsWhitelisted) {
                setTtsEngine('cloud');
            } else {
                setTtsEngine('cloud');
            }
                    
            ttsLogger.info('TTS engine processed:', engineType, 'isWhitelisted:', newIsWhitelisted, 'canUseLocalTTS:', canUseLocalTTS, 'basicTtsEnabled:', isTtsEnabled, 'aiTtsEnabled:', isF5TtsEnabled);
        }
    }, [ttsStatusData, isHealthy, setIsWhitelisted, isWhitelisted, switchEngineMutation]);

    const { data: audioSettingsData } = useQuery({
        queryKey: ['tts-audio-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/audio-settings');
            return response.data;
        },
        enabled: !!isAuthenticated,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        onSuccess: (data) => {
            if (data) {
                const audioData = {
                    websiteVolume: data.websiteVolume || 50
                };
                setAudioSettings(audioData);
                ttsLogger.success('Audio settings loaded:', audioData);
            }
        },
    });

    const { data: ttsSettingsData } = useQuery({
        queryKey: ['tts-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/settings');
            return response.data;
        },
        enabled: !!isAuthenticated,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        onSuccess: (data) => {
            if (data) {
                const ttsData = {
                    enable7TV: data.enable7TV ?? true,
                    enableTwitch: data.enableTwitch ?? true,
                    enableLexiconFilter: data.enableLexiconFilter ?? true,
                    enableCustomLexicon: data.enableCustomLexicon ?? false,
                    filterReplies: data.filterReplies ?? false,
                    filterMentions: data.filterMentions ?? false,
                    version: data.version ?? 1
                };
                setTtsSettings(ttsData);
                ttsLogger.success('TTS settings loaded:', ttsData);
            }
        },
    });

    const { data: platformSettingsData } = useQuery({
        queryKey: ['tts-platform-settings'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/platform-settings');
            return response.data;
        },
        enabled: !!isAuthenticated,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        onSuccess: (data) => {
            if (data) {
                const platformData = {
                    enabled_platforms: data.enabled_platforms || ['twitch', 'vk'],
                    global_enabled: data.global_enabled ?? true
                };
                setPlatformSettings(platformData);
                ttsLogger.success('Platform settings loaded:', platformData);
            }
        },
    });

    const { data: localTtsConfigData } = useQuery({
        queryKey: ['tts-local-config'],
        queryFn: async () => {
            const response = await botService.get('/api/tts/local-config');
            return response.data || null;
        },
        enabled: !!isAuthenticated,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        onSuccess: (data) => {
            if (data) {
                setLocalTtsConfig(data);
                ttsLogger.success('Local TTS config loaded:', data);
            } else {
                setLocalTtsConfig(null);
                ttsLogger.debug('No local TTS config found.');
            }
        },
        onError: (error) => {
            ttsLogger.error('Error loading local TTS config:', error);
            setLocalTtsConfig(null);
        },
    });

    useEffect(() => {
        setEngineLoading(ttsStatusLoading);
    }, [ttsStatusLoading]);
                
    useEffect(() => {
        if (user?.tts_listening_mode) {
            setListeningMode(user.tts_listening_mode);
        }
    }, [user?.tts_listening_mode]);

    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            ttsLogger.info('TtsMainPage: Received tts-status-changed event', event.detail);
            setBasicTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    useEffect(() => {
        const handleAiTtsChange = (event) => {
            ttsLogger.info('TtsMainPage: Received ai-tts-changed event', event.detail);
            const { enabled, engineType, isWhitelisted } = event.detail;
            
            if (enabled) {
                setTtsEngine(engineType || 'local');
            } else {
                setTtsEngine('gtts');
            }
        };

        window.addEventListener('ai-tts-changed', handleAiTtsChange);
        return () => window.removeEventListener('ai-tts-changed', handleAiTtsChange);
    }, []);

    useEffect(() => {
        const handlePlatformSettingsChange = (event) => {
            const { enabledPlatforms } = event.detail;
            ttsLogger.info('TtsMainPage: Received tts-settings-changed event', enabledPlatforms);
            setPlatformSettings(prev => ({
                ...prev,
                enabled_platforms: enabledPlatforms
            }));
        };

        window.addEventListener('tts-settings-changed', handlePlatformSettingsChange);
        return () => window.removeEventListener('tts-settings-changed', handlePlatformSettingsChange);
    }, []);

    useEffect(() => {
        const generateUrl = async () => {
            if (listeningMode === 'obs' && isAuthenticated && user?.id) {
                try {
                    const response = await generateObsUrl();
                    const token = response.data?.obs_token;
                    if (token) {
                        const obsUrl = getTtsWebSocketUrl(token);
                        setObsUrl(obsUrl);
                    } else {
                        setObsUrl('');
                    }
                } catch (error) {
                    logger.error('Error generating OBS URL:', error);
                    if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                        toast.error('Error generating OBS URL');
                    }
                    setObsUrl('');
                }
            }
        };
        generateUrl();
    }, [listeningMode, isAuthenticated, user?.id]);

    const handlePlatformToggle = useCallback((platform) => {
        const currentPlatforms = platformSettings.enabled_platforms;
        const newEnabledPlatforms = currentPlatforms.includes(platform)
            ? currentPlatforms.filter(p => p !== platform)
            : [...currentPlatforms, platform];
            
        setPlatformSettings(prev => ({
            ...prev,
            enabled_platforms: newEnabledPlatforms
        }));
        
        savePlatformSettingsMutation.mutate(
            { enabled_platforms: newEnabledPlatforms },
            {
                onSuccess: () => {
                    window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                        detail: { enabledPlatforms: newEnabledPlatforms }
                    }));
                    logger.log(`Platform ${platform} toggled successfully`);
                },
                onError: () => {
                    setPlatformSettings(prev => ({
                        ...prev,
                        enabled_platforms: currentPlatforms
                    }));
                }
            }
        );
    }, [platformSettings.enabled_platforms, savePlatformSettingsMutation]);

    const handleSaveSettings = useCallback(async () => {
        try {
            setIsSaving(true);
            setSaveStatus('Saving...');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setSaveStatus('Saved');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (error) {
            logger.error('Error saving settings:', error);
            setSaveStatus('Save error');
        } finally {
            setIsSaving(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated === true) {
            const timeoutId = setTimeout(() => {
                handleSaveSettings();
            }, 1000);
            
            return () => clearTimeout(timeoutId);
        }
    }, [audioSettings, ttsSettings, handleSaveSettings, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated === true) {
            checkTtsHealth();
        }
    }, [isAuthenticated, checkTtsHealth]);

    useEffect(() => {
        initializeTts();
    }, []);

    const saveBasicTtsState = useCallback((enabled) => {
        toggleBasicTtsMutation.mutate(enabled);
    }, [toggleBasicTtsMutation]);

    const saveAiTtsState = useCallback((enabled) => {
        if (!enabled) {
            setEngineToggleLoading(true);
            switchEngineMutation.mutate(
                { engine_type: 'gtts' },
                {
                    onSuccess: () => {
                        toast.success('Switched to Google TTS');
                        logger.log('AI TTS disabled, switched to gtts');
                        
                        window.dispatchEvent(new CustomEvent('ai-tts-changed', { 
                            detail: { 
                                enabled: false,
                                engineType: 'gtts',
                                isWhitelisted: isWhitelisted
                            } 
                        }));
                        
                        queryClient.invalidateQueries({ queryKey: ['tts-status'] });
                    },
                    onError: (error) => {
                        logger.error('Error switching to gtts:', error);
                        toast.error('Engine switch failed');
                        setAiTtsEnabled(true);
                    },
                    onSettled: () => {
                        setEngineToggleLoading(false);
                    }
                }
            );
            return;
        }
        
        setEngineToggleLoading(true);
        const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
        
        const engine = hasLocalSetup ? 'local' : 'cloud';
        
        ttsLogger.info('Enabling F5-TTS with engine:', engine, 'hasLocalSetup:', hasLocalSetup, 'isWhitelisted:', isWhitelisted);
        
        const enableBasicTtsFirst = async () => {
            if (!basicTtsEnabled) {
                try {
                    await botService.post('/api/tts/enable');
                    setBasicTtsEnabled(true);
                    logger.log('Basic TTS enabled as fallback for F5-TTS');
                } catch (error) {
                    logger.error('Failed to enable basic TTS as fallback:', error);
                }
            }
        };
        
        enableBasicTtsFirst().then(() => {
            switchEngineMutation.mutate(
                { engine_type: engine },
                {
                    onSuccess: () => {
                        toast.success(`Engine: ${engine === 'local' ? 'Local F5-TTS' : 'Cloud F5-TTS'}`);
                        logger.log('AI TTS state saved:', enabled, 'engine:', engine);
                        
                        window.dispatchEvent(new CustomEvent('ai-tts-changed', { 
                            detail: { 
                                enabled: true,
                                engineType: engine,
                                isWhitelisted: isWhitelisted
                            } 
                        }));
                        
                        queryClient.invalidateQueries({ queryKey: ['tts-status'] });
                    },
                    onError: (error) => {
                        logger.error('Error saving AI TTS state:', error);
                        const errorMessage = error.response?.data?.detail || 'Engine switch failed';
                        toast.error(errorMessage);
                        setAiTtsEnabled(false);
                    },
                    onSettled: () => {
                        setEngineToggleLoading(false);
                    }
                }
            );
        });
    }, [switchEngineMutation, isWhitelisted, basicTtsEnabled]);

    const handleBasicTtsToggle = (enabled) => {
        if (!enabled) return;
        
        setBasicTtsEnabled(true);
        setAiTtsEnabled(false);
        saveBasicTtsState(true);
        
        ttsLogger.info('Switched to Basic TTS mode');
        toast.success('Mode: Google TTS (Basic)');
        
        window.dispatchEvent(new CustomEvent('tts-status-changed', { 
            detail: { enabled: true, mode: 'basic' } 
        }));
    };

    const handleAiTtsToggle = (enabled) => {
        if (!enabled) return;
        
        if (engineToggleLoading) {
            return;
        }
        
        const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
        const canUseF5TTS = hasLocalSetup || isWhitelisted === true;
        
        ttsLogger.info('F5-TTS toggle attempt:', { 
            enabled, 
            isWhitelisted, 
            hasLocalSetup, 
            canUseF5TTS 
        });
        
        if (!canUseF5TTS && isWhitelisted === false) {
            ttsLogger.warning('F5-TTS blocked: user not whitelisted and no local setup');
            toast.error('F5-TTS requires local setup or whitelist access');
            return;
        }
        
        if (enabled && isWhitelisted === null) {
            ttsLogger.info('F5-TTS whitelist status unknown, allowing toggle - backend will check');
        }
        
        if (enabled) {
            setBasicTtsEnabled(false);
        }
        
        setAiTtsEnabled(enabled);
        saveAiTtsState(enabled);
        
        ttsLogger.info('Switched to AI TTS (F5-TTS) mode');
        toast.success('Mode: F5-TTS with Google TTS fallback');
    };

    const handleListeningModeChange = useCallback((mode) => {
        setListeningMode(mode);
        setListeningModeMutation.mutate(
            { listeningMode: mode },
            {
                onSuccess: () => {
                    logger.log('Listening mode saved:', mode);
                },
                onError: () => {
                    setListeningMode(prev => prev);
                }
            }
        );
    }, [setListeningModeMutation]);

    const handleRegenerateObsUrl = async () => {
        try {
            const response = await generateObsUrl();
            const token = response.data?.obs_token;
            if (token) {
                const obsUrl = getTtsWebSocketUrl(token);
                setObsUrl(obsUrl);
                toast.success('URL updated');
            } else {
                setObsUrl('');
                toast.error('Failed to get token');
            }
        } catch (error) {
            logger.error('Error regenerating OBS URL:', error);
            setObsUrl('');
        }
    };

    return (
        <PageWrapper>
            <div className="space-y-4">
                {/* Style */}
                <style>
                {`
                    .slider::-webkit-slider-thumb {
                        appearance: none;
                        height: 16px;
                        width: 16px;
                        border-radius: 50%;
                        background: #3b82f6;
                        cursor: pointer;
                        border: 2px solid #1f2937;
                    }
                    .slider::-moz-range-thumb {
                        height: 16px;
                        width: 16px;
                        border-radius: 50%;
                        background: #3b82f6;
                        cursor: pointer;
                        border: 2px solid #1f2937;
                    }
                `}
            </style>

                {/* TTS Control Panel */}
                <TtsControlPanel
                    basicTtsEnabled={basicTtsEnabled}
                    setBasicTtsEnabled={handleBasicTtsToggle}
                    aiTtsEnabled={aiTtsEnabled}
                    setAiTtsEnabled={handleAiTtsToggle}
                    isHealthy={isHealthy}
                    isAuthenticated={isAuthenticated}
                    isConnected={isConnected}
                    isWhitelisted={isWhitelisted}
                    engineToggleLoading={engineToggleLoading}
                    listeningMode={listeningMode}
                    setListeningMode={handleListeningModeChange}
                    obsUrl={obsUrl}
                    onRegenerateObsUrl={handleRegenerateObsUrl}
                    platformSettings={platformSettings}
                    integrations={integrations}
                    onPlatformToggle={handlePlatformToggle}
                    user={user}
                    isGuest={isGuest}
                    ttsEngine={ttsEngine}
                    setTtsEngine={setTtsEngine}
                    localTtsConfig={localTtsConfig}
                />
                
                {/* Audio + Additional Settings - 2 columns, compact */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Audio Settings - compact */}
                    <AudioSettings
                        audioSettings={audioSettings}
                        setAudioSettings={setAudioSettings}
                        listeningMode={listeningMode}
                        setListeningMode={handleListeningModeChange}
                        onSaveSettings={saveAudioSettings}
                        obsUrl={obsUrl}
                        onRegenerateObsUrl={handleRegenerateObsUrl}
                    />
                    
                    {/* TTS Settings - compact */}
                    <TtsSettings
                        ttsSettings={ttsSettings}
                        setTtsSettings={setTtsSettings}
                        onSaveSettings={saveTtsSettings}
                    />
                </div>
                
                {/* Filters */}
                <TtsFilterManager />
            </div>
        </PageWrapper>
    );
};

export default TtsMainPageContent;
