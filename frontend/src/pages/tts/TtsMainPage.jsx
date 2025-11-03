// src/pages/tts/TtsMainPage_new.jsx
import React, { useContext, useEffect, useState, useCallback } from 'react';
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
import { usePageAnimation, getAnimationClasses } from '../../hooks/usePageAnimation';

const TtsMainPageContent = () => {
    const { ttsEnabled, toggleTts, isWhitelisted, engineStatus, isToggling, initializeTts, setNotificationHandler, syncWithHealthContext } = useTts();
    const { isHealthy, isChecking, lastCheck, checkTtsHealth } = useTtsHealth();
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    
    // УБРАНО: usePageAnimation - вызывает видимую отрисовку элементов
    // Используем оптимистичный UI - контент виден сразу
    const shouldAnimate = false;
    const contentLoaded = true;
    
    // Логируем инициализацию компонента
    useEffect(() => {
        ttsLogger.info('TTS Main Page initialized', { 
            ttsEnabled, 
            isWhitelisted, 
            isAuthenticated, 
            isGuest,
            user: user?.id
        });
    }, []);
    
    // Состояния
    const [listeningMode, setListeningMode] = useState('website');
    const [obsUrl, setObsUrl] = useState('');
    const [platformSettings, setPlatformSettings] = useState({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });
    const [platformLoading, setPlatformLoading] = useState(false);
    const [engineToggleLoading, setEngineToggleLoading] = useState(false); // Флаг для переключения движка
    
    // Состояния для двухуровневой системы TTS
    const [basicTtsEnabled, setBasicTtsEnabled] = useState(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState(false);
    
    // Громкость - загружаем с сервера
    const [audioSettings, setAudioSettings] = useState({
        websiteVolume: 50
    });
    
    // Дополнительные настройки TTS - загружаем с сервера
    const [ttsSettings, setTtsSettings] = useState({
        enable7TV: true,
        enableTwitch: true,
        enableLexiconFilter: true,
        enableCustomLexicon: false,
        filterReplies: false,
        filterMentions: false,
    });
    
    // Состояния сохранения
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    
    // Выбор движка TTS
    const [ttsEngine, setTtsEngine] = useState('cloud'); // 'cloud' или 'local'
    const [localTtsConfig, setLocalTtsConfig] = useState(null);
    const [engineLoading, setEngineLoading] = useState(true); // Флаг загрузки данных движка
    
    const queryClient = useQueryClient();

    // React Query мутации - объявляем ДО использования в useCallback и useQuery
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
            toast.error('Не удалось переключить платформу');
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
            setSaveStatus('Сохранено');
            ttsLogger.success('Audio settings saved successfully');
            setTimeout(() => setSaveStatus(''), 2000);
        },
        onError: (error) => {
            ttsLogger.error('Error saving audio settings:', error);
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                setSaveStatus('Ошибка сохранения');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                setSaveStatus('TTS сервис недоступен');
                setTimeout(() => setSaveStatus(''), 3000);
            }
        },
        onMutate: () => {
            setIsSaving(true);
            setSaveStatus('Сохранение...');
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tts-settings'] });
            setSaveStatus('Сохранено');
            ttsLogger.success('TTS settings saved successfully');
            setTimeout(() => setSaveStatus(''), 2000);
        },
        onError: (error) => {
            ttsLogger.error('Error saving TTS settings:', error);
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                setSaveStatus('Ошибка сохранения');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                setSaveStatus('TTS сервис недоступен');
                setTimeout(() => setSaveStatus(''), 3000);
            }
        },
        onMutate: () => {
            setIsSaving(true);
            setSaveStatus('Сохранение...');
        },
        onSettled: () => {
            setIsSaving(false);
        },
    });

    // Обёртки для сохранения настроек (используют мутации) - объявляем ПОСЛЕ мутаций
    const saveAudioSettings = useCallback((newSettings) => {
        saveAudioSettingsMutation.mutate(newSettings);
    }, [saveAudioSettingsMutation]);

    const saveTtsSettings = useCallback((newSettings) => {
        saveTtsSettingsMutation.mutate(newSettings);
    }, [saveTtsSettingsMutation]);

    // Проверка подключения (гость всегда "подключен" к своему каналу)
    // Для авторизованных пользователей TTS всегда доступен, даже без интеграций
    const isConnected = isGuest || isAuthenticated || integrations.twitch?.connected || integrations.vk?.connected;
    
    // Логируем статус подключения
    useEffect(() => {
        ttsLogger.debug('TTS Connection status:', { isGuest, isAuthenticated, integrations, isConnected });
    }, [isGuest, isAuthenticated, integrations, isConnected]);

    // React Query: загружаем TTS статус
    const { data: ttsStatusData, isLoading: ttsStatusLoading } = useQuery({
        queryKey: ['tts-status'],
        queryFn: async () => {
                        const response = await botService.get('/api/tts/status');
            return response.data;
        },
        enabled: !!isAuthenticated,
        staleTime: 30 * 1000, // 30 секунд
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        onSuccess: (data) => {
            if (data) {
                const isTtsEnabled = data.enabled || false;
                const engineType = data.engine_type || 'gtts';
                    
                    setBasicTtsEnabled(isTtsEnabled);
                const hasLocalSetup = data.has_local_setup || false;
                    const canUseLocalTTS = hasLocalSetup || isWhitelisted;
                    
                    if (engineType === 'local' && !canUseLocalTTS) {
                        ttsLogger.warning('User trying to use local TTS without setup, switching to cloud');
                        setTtsEngine('cloud');
                        setAiTtsEnabled(false);
                    // Переключаем на облачный через мутацию
                    switchEngineMutation.mutate({ engine_type: 'cloud' });
                    } else {
                        setAiTtsEnabled(isTtsEnabled && isHealthy && canUseLocalTTS);
                        setTtsEngine(engineType === 'local' && canUseLocalTTS ? 'local' : 'cloud');
                    }
                    
                    ttsLogger.info('TTS engine loaded:', engineType);
                }
        },
    });

    // React Query: загружаем настройки звука
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

    // React Query: загружаем настройки TTS
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
                    filterMentions: data.filterMentions ?? false
                };
                setTtsSettings(ttsData);
                ttsLogger.success('TTS settings loaded:', ttsData);
            }
        },
    });

    // React Query: загружаем настройки платформ
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

    // React Query: загружаем локальную конфигурацию TTS
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

    // Комбинированный loading состояние
    useEffect(() => {
        setEngineLoading(ttsStatusLoading);
    }, [ttsStatusLoading]);
                
    // Режим прослушивания из user
    useEffect(() => {
                if (user?.tts_listening_mode) {
                    setListeningMode(user.tts_listening_mode);
                }
    }, [user?.tts_listening_mode]);

    // Слушаем изменения Basic TTS с главной страницы
    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            ttsLogger.info('TtsMainPage: Received tts-status-changed event', event.detail);
            setBasicTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    // Слушаем изменения AI TTS с главной страницы
    useEffect(() => {
        const handleAiTtsChange = (event) => {
            ttsLogger.info('TtsMainPage: Received ai-tts-changed event', event.detail);
            setTtsEngine(event.detail.enabled ? 'local' : 'cloud');
        };

        window.addEventListener('ai-tts-changed', handleAiTtsChange);
        return () => window.removeEventListener('ai-tts-changed', handleAiTtsChange);
    }, []);

    // 🔄 Слушаем изменения platform settings из ChatCard
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

    // Генерация OBS URL
    useEffect(() => {
        const generateUrl = async () => {
            if (listeningMode === 'obs' && isAuthenticated && user?.id) {
                try {
                    const response = await generateObsUrl();
                    const token = response.data?.obs_token;
                    if (token) {
                        // Формируем URL для OBS WebSocket
                        const obsUrl = getTtsWebSocketUrl(token);
                        setObsUrl(obsUrl);
                    } else {
                        setObsUrl('');
                    }
                } catch (error) {
                    logger.error('Error generating OBS URL:', error);
                    if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                        toast.error('Ошибка генерации OBS URL');
                    }
                    setObsUrl('');
                }
            }
        };
        generateUrl();
    }, [listeningMode, isAuthenticated, user?.id]);

    // Обработчики
    const handlePlatformToggle = useCallback((platform) => {
        // Вычисляем newEnabledPlatforms ОДИН РАЗ, чтобы избежать race condition
        const currentPlatforms = platformSettings.enabled_platforms;
        const newEnabledPlatforms = currentPlatforms.includes(platform)
            ? currentPlatforms.filter(p => p !== platform)
            : [...currentPlatforms, platform];
            
        // Optimistic update
            setPlatformSettings(prev => ({
                ...prev,
                enabled_platforms: newEnabledPlatforms
            }));
            
        // Сохраняем через мутацию
        savePlatformSettingsMutation.mutate(
            { enabled_platforms: newEnabledPlatforms },
            {
                onSuccess: () => {
                    // Отправляем событие для синхронизации с другими компонентами
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: newEnabledPlatforms }
            }));
            logger.log(`Platform ${platform} toggled successfully`);
                },
                onError: () => {
                    // Rollback при ошибке - используем сохраненное значение
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
            setSaveStatus('Сохранение...');
            
            // Здесь должна быть логика сохранения настроек
            await new Promise(resolve => setTimeout(resolve, 1000)); // Имитация сохранения
            
            setSaveStatus('Сохранено');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (error) {
            logger.error('Error saving settings:', error);
            setSaveStatus('Ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    }, []);

    // Автосохранение при изменении настроек
    useEffect(() => {
        if (isAuthenticated === true) {
            const timeoutId = setTimeout(() => {
                handleSaveSettings();
            }, 1000);
            
            return () => clearTimeout(timeoutId);
        }
    }, [audioSettings, ttsSettings, handleSaveSettings, isAuthenticated]);

    // Проверка здоровья TTS
    useEffect(() => {
        if (isAuthenticated === true) {
            checkTtsHealth();
        }
    }, [isAuthenticated, checkTtsHealth]);

    // Загруженые статусы при первой загрузке страницы
    useEffect(() => {
        initializeTts();
    }, []);

    // Загрузка локальной конфигурации уже через React Query выше


    // Функция для сохранения состояния базовой TTS
    const saveBasicTtsState = useCallback((enabled) => {
        toggleBasicTtsMutation.mutate(enabled);
    }, [toggleBasicTtsMutation]);

    // Функция для сохранения состояния ИИ TTS
    const saveAiTtsState = useCallback((enabled) => {
            setEngineToggleLoading(true);
            const engine = enabled ? 'local' : 'cloud';
        
        switchEngineMutation.mutate(
            { engine_type: engine },
            {
                onSuccess: () => {
            toast.success(`Движок: ${enabled ? '💻 Локальный F5-TTS' : '☁️ Облачный'}`);
                    logger.log('AI TTS state saved:', enabled);
                },
                onError: (error) => {
            logger.error('Error saving AI TTS state:', error);
            toast.error('Ошибка переключения движка');
            // Откатываем состояние при ошибке
            setAiTtsEnabled(!enabled);
                },
                onSettled: () => {
            setEngineToggleLoading(false);
        }
            }
        );
    }, [switchEngineMutation]);

    // Обработчики для переключения TTS с сохранением
    const handleBasicTtsToggle = (enabled) => {
        setBasicTtsEnabled(enabled);
        saveBasicTtsState(enabled);
        
        // Уведомляем shortcuts на главной странице
        window.dispatchEvent(new CustomEvent('tts-status-changed', { 
            detail: { enabled } 
        }));
    };

    const handleAiTtsToggle = (enabled) => {
        // Предотвращаем спам переключений
        if (engineToggleLoading) {
            return;
        }
        
        // Проверяем возможность использования F5-TTS (локальный setup ИЛИ whitelist)
        const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
        const canUseF5TTS = hasLocalSetup || isWhitelisted;
        
        if (enabled && !canUseF5TTS) {
            toast.error('Для использования F5-TTS настройте локальный TTS (tts_service_simple) или обратитесь к администратору для whitelist.');
            return;
        }
        
        setAiTtsEnabled(enabled);
        saveAiTtsState(enabled);
    };

    // Обработчик для изменения режима прослушивания
    const handleListeningModeChange = useCallback((mode) => {
        setListeningMode(mode);
        setListeningModeMutation.mutate(
            { listeningMode: mode },
            {
                onSuccess: () => {
            logger.log('Listening mode saved:', mode);
                },
                onError: () => {
                    // Откатываем состояние при ошибке
                    setListeningMode(prev => prev);
        }
            }
        );
    }, [setListeningModeMutation]);

    // Функция для перегенерации OBS URL
    const handleRegenerateObsUrl = async () => {
        try {
            const response = await generateObsUrl();
            const token = response.data?.obs_token;
            if (token) {
                // Формируем URL для OBS WebSocket
                const obsUrl = getTtsWebSocketUrl(token);
                setObsUrl(obsUrl);
                toast.success('URL обновлен');
            } else {
                setObsUrl('');
                toast.error('Не удалось получить токен');
            }
        } catch (error) {
            logger.error('Error regenerating OBS URL:', error);
            // apiClient.js уже показывает toast при ошибках
            setObsUrl('');
        }
    };

    // Убираем заглушку TTS - базовая озвучка работает без TTS сервера
    // if (!isHealthy && !isChecking && lastCheck) {
    //     return (
    //         <PageWrapper 
    //             title="Озвучка сообщений"
    //             description="Настройте озвучку чата и управляйте голосами"
    //         >
    //             <TtsErrorCard
    //                 title="TTS сервер недоступен"
    //                 description="В данный момент сервис TTS недоступен. Базовая озвучка продолжает работать."
    //                 suggestion="Попробуйте обновить страницу через несколько минут."
    //             />
    //         </PageWrapper>
    //     );
    // }

    return (
        <PageWrapper>
            <div {...getAnimationClasses(shouldAnimate, contentLoaded, 0)}>
                <div className="relative space-y-6">
                    {/* CSS для слайдера */}
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
                
                {/* Выбор движка TTS - ВСЕГДА показываем */}
                <div className="mb-6 p-5 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-600/5 rounded-2xl border-2 border-blue-500/30">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Выбор движка озвучки</h3>
                        {!localTtsConfig?.configured && (
                            <a 
                                href="/dashboard/tts/local" 
                                className="text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                                Настроить локальный TTS →
                            </a>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <label className={`flex-1 flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                            ttsEngine === 'cloud' 
                                ? 'border-blue-500 bg-blue-500/10 text-blue-400' 
                                : 'border-gray-700 hover:border-blue-500 text-gray-400'
                        }`}>
                            <input 
                                type="radio"
                                name="tts_engine"
                                value="cloud"
                                checked={ttsEngine === 'cloud'}
                                onChange={(e) => {
                                    setTtsEngine(e.target.value);
                                    botService.post('/api/tts/engine', { engine_type: 'cloud' }).catch(err => ttsLogger.error('Error setting TTS engine:', err));
                                    
                                    // Уведомляем shortcuts на главной странице
                                    window.dispatchEvent(new CustomEvent('ai-tts-changed', { 
                                        detail: { enabled: false } 
                                    }));
                                }}
                                className="w-4 h-4"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium">☁️ Облачный</div>
                                {isChecking && (
                                    <div className="text-xs text-blue-400 mt-0.5">⏳ Проверяем...</div>
                                )}
                                {!isChecking && !isHealthy && (
                                    <div className="text-xs text-yellow-400 mt-0.5">⚠️ Сервер недоступен</div>
                                )}
                                {!isChecking && isHealthy && !isWhitelisted && (
                                    <div className="text-xs text-orange-400 mt-0.5">⚠️ Только whitelist</div>
                                )}
                                {!isChecking && isHealthy && isWhitelisted && (
                                    <div className="text-xs text-green-400 mt-0.5">✅ Доступен</div>
                                )}
                            </div>
                        </label>
                        
                        <label className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                            !localTtsConfig?.configured || !isWhitelisted
                                ? 'opacity-40 cursor-not-allowed border-gray-700 text-gray-500'
                                : ttsEngine === 'local'
                                    ? 'border-green-500 bg-green-500/10 text-green-400 cursor-pointer'
                                    : 'border-gray-700 hover:border-green-500 text-gray-400 cursor-pointer'
                        }`}>
                            <input 
                                type="radio"
                                name="tts_engine"
                                value="local"
                                checked={ttsEngine === 'local'}
                                onChange={(e) => {
                                    if (localTtsConfig?.configured && isWhitelisted) {
                                        setTtsEngine(e.target.value);
                                        botService.post('/api/tts/engine', { engine_type: 'local' }).catch(err => {
                                            ttsLogger.error('Error setting TTS engine:', err);
                                            // Откатываем изменение при ошибке
                                            if (err.response?.status === 403) {
                                                toast.error('F5-TTS доступен только для пользователей из whitelist');
                                                setTtsEngine('cloud');
                                            }
                                        });
                                        
                                        // Уведомляем shortcuts на главной странице
                                        window.dispatchEvent(new CustomEvent('ai-tts-changed', { 
                                            detail: { enabled: true } 
                                        }));
                                    }
                                }}
                                className="w-4 h-4"
                                disabled={!localTtsConfig?.configured || !isWhitelisted}
                            />
                            <div className="text-sm font-medium">💻 Локальный</div>
                            {!localTtsConfig?.configured && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded ml-auto">
                                    Не настроен
                                </span>
                            )}
                            {localTtsConfig?.configured && !isWhitelisted && (
                                <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-auto">
                                    Только whitelist
                                </span>
                            )}
                        </label>
                    </div>
                </div>
                
                {/* Основной контент */}
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
                />
                
                {/* Громкость */}
                <AudioSettings
                    audioSettings={audioSettings}
                    setAudioSettings={setAudioSettings}
                    listeningMode={listeningMode}
                    setListeningMode={handleListeningModeChange}
                    onSaveSettings={saveAudioSettings}
                    obsUrl={obsUrl}
                    onRegenerateObsUrl={handleRegenerateObsUrl}
                />
                
                {/* Дополнительные настройки TTS */}
                <TtsSettings
                    ttsSettings={ttsSettings}
                    setTtsSettings={setTtsSettings}
                    onSaveSettings={saveTtsSettings}
                />
                
                {/* Фильтрация TTS */}
                <TtsFilterManager />
                </div>
            </div>
        </PageWrapper>
    );
};

export default TtsMainPageContent;
