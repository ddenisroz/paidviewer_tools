// src/pages/tts/TtsMainPage.jsx
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

// Импорты компонентов
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

    const toggleAiTtsMutation = useMutation({
        mutationFn: async (enabled) => {
            if (enabled) {
                return await botService.post('/api/tts/ai/enable');
            } else {
                return await botService.post('/api/tts/ai/disable');
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            logger.log('AI TTS state saved:', data);
        },
        onError: (error) => {
            logger.error('Error saving AI TTS state:', error);
        },
    });

    const savePlatformSettingsMutation = useMutation({
        mutationFn: async (data) => {
            return await ttsService.post('/save-settings', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-settings'] });
        },
        onError: (error) => {
            ttsLogger.error('Error saving platform settings:', error);
        },
    });

    const { data: ttsStatusData, isLoading: isTtsStatusLoading } = useQuery({
        queryKey: ['tts-status'],
        queryFn: async () => {
            try {
                const response = await botService.get('/api/tts/status');
                return response.data;
            } catch (error) {
                ttsLogger.error('Error fetching TTS status:', error);
                return null;
            }
        },
        enabled: isAuthenticated,
        refetchInterval: 30000,
    });

    useEffect(() => {
        if (ttsStatusData) {
            ttsLogger.info('TTS status API response:', ttsStatusData);
            
            setBasicTtsEnabled(ttsStatusData.basic_tts_enabled || false);
            setAiTtsEnabled(ttsStatusData.ai_tts_enabled || false);
            
            if (ttsStatusData.tts_engine) {
                setTtsEngine(ttsStatusData.tts_engine);
            }
            
            if (ttsStatusData.listening_mode) {
                setListeningMode(ttsStatusData.listening_mode);
            }
            
            if (ttsStatusData.platform_settings) {
                setPlatformSettings(ttsStatusData.platform_settings);
            }
            
            if (ttsStatusData.audio_settings?.website_volume) {
                setAudioSettings(prev => ({
                    ...prev,
                    websiteVolume: ttsStatusData.audio_settings.website_volume
                }));
            }
        }
    }, [ttsStatusData]);

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
                        setEngineToggleLoading(false);
                    },
                    onError: () => {
                        toast.error('Failed to switch engine');
                        setEngineToggleLoading(false);
                    }
                }
            );
        } else {
            setEngineToggleLoading(true);
            const targetEngine = ttsEngine === 'cloud' ? 'cloud' : 'local';
            botService.post('/api/tts/ai/enable', { engine: targetEngine })
                .then(() => {
                    logger.log('AI TTS state saved: true engine: ' + targetEngine);
                    setEngineToggleLoading(false);
                    toast.success('F5-TTS enabled');
                })
                .catch((error) => {
                    logger.error('Error enabling AI TTS:', error);
                    toast.error('Failed to enable F5-TTS');
                    setEngineToggleLoading(false);
                });
        }
    }, [ttsEngine, switchEngineMutation]);

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Text to Speech">
                <div className="text-center text-gray-400">
                    Please log in to access TTS settings
                </div>
            </PageWrapper>
        );
    }

    const handleRegenerateObsUrl = async () => {
        try {
            const response = await generateObsUrl();
            const token = response.data?.obs_token;
            if (token) {
                const newUrl = getTtsWebSocketUrl(token);
                setObsUrl(newUrl);
                toast.success('OBS URL regenerated');
            }
        } catch (error) {
            logger.error('Error regenerating OBS URL:', error);
            toast.error('Failed to regenerate OBS URL');
        }
    };

    return (
        <PageWrapper title="Text to Speech">
            <div className="space-y-3">
                {/* TTS Control Panel - Compact Controls */}
                <TtsControlPanel
                    basicTtsEnabled={basicTtsEnabled}
                    setBasicTtsEnabled={saveBasicTtsState}
                    aiTtsEnabled={aiTtsEnabled}
                    setAiTtsEnabled={saveAiTtsState}
                    isHealthy={isHealthy}
                    isAuthenticated={isAuthenticated}
                    isConnected={ttsEnabled}
                    isWhitelisted={isWhitelisted}
                    engineToggleLoading={engineToggleLoading}
                    listeningMode={listeningMode}
                    setListeningMode={setListeningMode}
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

                {/* Audio Settings & Additional Settings - Side by side */}
                {(basicTtsEnabled || aiTtsEnabled) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <AudioSettings
                            audioSettings={audioSettings}
                            setAudioSettings={setAudioSettings}
                            listeningMode={listeningMode}
                            onSaveSettings={handleSaveSettings}
                        />
                        <TtsSettings
                            ttsSettings={ttsSettings}
                            setTtsSettings={setTtsSettings}
                        />
                    </div>
                )}

                {/* Filters - Collapsible */}
                {(basicTtsEnabled || aiTtsEnabled) && (
                    <TtsFilterManager
                        ttsSettings={ttsSettings}
                        setTtsSettings={setTtsSettings}
                    />
                )}

                {/* Health Status */}
                <HealthStatus />
            </div>
        </PageWrapper>
    );
};

export default TtsMainPageContent;
