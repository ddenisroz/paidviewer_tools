// src/pages/tts/TtsMainPage_new.jsx
import React, { useContext, useEffect, useState, useCallback } from 'react';
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
import cacheManager, { CACHE_CONFIG } from '../../utils/cacheManager';

const TtsMainPageContent = () => {
    const { ttsEnabled, toggleTts, isWhitelisted, engineStatus, isToggling, initializeTts, setNotificationHandler, syncWithHealthContext } = useTts();
    const { isHealthy, isChecking, lastCheck, checkTtsHealth } = useTtsHealth();
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    
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
    
    // Функция для сохранения настроек звука
    const saveAudioSettings = async (newSettings) => {
        try {
            ttsLogger.api('POST', '/api/tts/audio-settings', newSettings);
            setIsSaving(true);
            setSaveStatus('Сохранение...');
            
            // Сохраняем на сервер через bot service
            const response = await botService.post('/api/tts/audio-settings', newSettings);
            ttsLogger.apiResponse(200, '/api/tts/audio-settings', response.data);
            
            setSaveStatus('Сохранено');
            ttsLogger.success('Audio settings saved successfully');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (error) {
            ttsLogger.error('Error saving audio settings:', error);
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                setSaveStatus('Ошибка сохранения');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                setSaveStatus('TTS сервис недоступен');
                setTimeout(() => setSaveStatus(''), 3000);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Функция для сохранения настроек TTS
    const saveTtsSettings = async (newSettings) => {
        try {
            ttsLogger.api('POST', '/api/tts/settings', newSettings);
            setIsSaving(true);
            setSaveStatus('Сохранение...');
            
            // Сохраняем базовые настройки TTS через bot service
            const response = await botService.post('/api/tts/settings', newSettings);
            ttsLogger.apiResponse(200, '/api/tts/settings', response.data);
            
            setSaveStatus('Сохранено');
            ttsLogger.success('TTS settings saved successfully');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (error) {
            ttsLogger.error('Error saving TTS settings:', error);
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                setSaveStatus('Ошибка сохранения');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                setSaveStatus('TTS сервис недоступен');
                setTimeout(() => setSaveStatus(''), 3000);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Проверка подключения (гость всегда "подключен" к своему каналу)
    // Для авторизованных пользователей TTS всегда доступен, даже без интеграций
    const isConnected = isGuest || isAuthenticated || integrations.twitch?.connected || integrations.vk?.connected;
    
    // Логируем статус подключения
    useEffect(() => {
        ttsLogger.debug('TTS Connection status:', { isGuest, isAuthenticated, integrations, isConnected });
    }, [isGuest, isAuthenticated, integrations, isConnected]);

    // Загрузка настроек с сервера при инициализации
    useEffect(() => {
        const loadSettings = async () => {
            if (!isAuthenticated) {
                ttsLogger.debug('Skipping settings load - not authenticated');
                setEngineLoading(false);
                return;
            }
            
            ttsLogger.info('Loading TTS settings from server...');
            setEngineLoading(true);
            try {
                // 🚀 ОПТИМИЗАЦИЯ: Parallel API calls с кэшированием
                const [ttsStatusResponse, audioResponse, ttsResponse, platformResponse] = await Promise.all([
                    // Кэшируем TTS статус (engine type) для быстрой загрузки
                    cacheManager.getOrFetch(CACHE_CONFIG.TTS_STATUS, async () => {
                        const response = await botService.get('/api/tts/status');
                        return response;
                    }),
                    botService.get('/api/tts/audio-settings'),
                    botService.get('/api/tts/settings'),
                    botService.get('/api/tts/platform-settings')
                ]);
                
                // Обрабатываем настройки звука
                if (audioResponse.data) {
                    const audioData = {
                        websiteVolume: audioResponse.data.websiteVolume || 50
                    };
                    setAudioSettings(audioData);
                    ttsLogger.success('Audio settings loaded:', audioData);
                }
                
                // Обрабатываем настройки TTS
                if (ttsResponse.data) {
                    const ttsData = {
                        enable7TV: ttsResponse.data.enable7TV ?? true,
                        enableTwitch: ttsResponse.data.enableTwitch ?? true,
                        enableLexiconFilter: ttsResponse.data.enableLexiconFilter ?? true,
                        enableCustomLexicon: ttsResponse.data.enableCustomLexicon ?? false,
                        filterReplies: ttsResponse.data.filterReplies ?? false,
                        filterMentions: ttsResponse.data.filterMentions ?? false
                    };
                    setTtsSettings(ttsData);
                    ttsLogger.success('TTS settings loaded:', ttsData);
                }
                
                // Обрабатываем настройки платформ
                if (platformResponse.data) {
                    const platformData = {
                        enabled_platforms: platformResponse.data.enabled_platforms || ['twitch', 'vk'],
                        global_enabled: platformResponse.data.global_enabled ?? true
                    };
                    setPlatformSettings(platformData);
                    ttsLogger.success('Platform settings loaded:', platformData);
                }
                
                // Обрабатываем состояние TTS (было в отдельном useEffect)
                if (ttsStatusResponse.data) {
                    const isTtsEnabled = ttsStatusResponse.data.enabled || false;
                    const engineType = ttsStatusResponse.data.engine_type || 'gtts';
                    
                    setBasicTtsEnabled(isTtsEnabled);
                    // Если пользователь не в whitelist, но пытается использовать F5-TTS - переключаем на облачный
                    if (engineType === 'local' && !isWhitelisted) {
                        ttsLogger.warning('User not in whitelist but F5-TTS enabled, switching to cloud');
                        setTtsEngine('cloud');
                        setAiTtsEnabled(false);
                        // Автоматически переключаем на облачный
                        botService.post('/api/tts/engine', { engine_type: 'cloud' }).catch(err => ttsLogger.error('Error switching to cloud:', err));
                    } else {
                        setAiTtsEnabled(isTtsEnabled && isHealthy && isWhitelisted);
                        setTtsEngine(engineType === 'local' && isWhitelisted ? 'local' : 'cloud');
                    }
                    
                    ttsLogger.info('TTS engine loaded:', engineType);
                }
                
                // Режим прослушивания
                if (user?.tts_listening_mode) {
                    setListeningMode(user.tts_listening_mode);
                }
            } catch (error) {
                ttsLogger.error('Error loading settings:', error);
                // При ошибке загрузки с сервера используем значения по умолчанию
            } finally {
                setEngineLoading(false);
            }
        };

        loadSettings();
    }, [isAuthenticated, isHealthy, user?.tts_listening_mode]);

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
    const handlePlatformToggle = useCallback(async (platform) => {
        try {
            setPlatformLoading(true);
            
            // 🐛 FIX: Вычисляем newEnabledPlatforms ОДИН РАЗ, чтобы избежать race condition
            const newEnabledPlatforms = platformSettings.enabled_platforms.includes(platform)
                ? platformSettings.enabled_platforms.filter(p => p !== platform)
                : [...platformSettings.enabled_platforms, platform];
            
            // Обновляем локальное состояние
            setPlatformSettings(prev => ({
                ...prev,
                enabled_platforms: newEnabledPlatforms
            }));
            
            // Сохраняем на сервер (используем ТОТ ЖЕ массив)
            await botService.post('/api/tts/platform-settings', {
                enabled_platforms: newEnabledPlatforms
            });
            
            // 🔄 Отправляем событие для синхронизации с другими компонентами
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: newEnabledPlatforms }
            }));
            
            // Молча обновляем - не спамим уведомлениями
            logger.log(`Platform ${platform} toggled successfully`);
        } catch (error) {
            logger.error('Error toggling platform:', error);
            toast.error('Не удалось переключить платформу');
        } finally {
            setPlatformLoading(false);
        }
    }, [platformSettings.enabled_platforms]);

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

    // Загрузка локальной конфигурации TTS
    useEffect(() => {
        const loadLocalTtsConfig = async () => {
            try {
                const response = await botService.get('/api/tts/local-config');
                if (response.data) {
                    setLocalTtsConfig(response.data);
                    ttsLogger.success('Local TTS config loaded:', response.data);
                } else {
                    setLocalTtsConfig(null);
                    ttsLogger.debug('No local TTS config found.');
                }
            } catch (error) {
                ttsLogger.error('Error loading local TTS config:', error);
                setLocalTtsConfig(null);
            }
        };

        if (isAuthenticated) {
            loadLocalTtsConfig();
        }
    }, [isAuthenticated]);


    // Функция для сохранения состояния базовой TTS
    const saveBasicTtsState = async (enabled) => {
        try {
            if (enabled) {
                await botService.post('/api/tts/enable');
            } else {
                await botService.post('/api/tts/disable');
            }
            logger.log('Basic TTS state saved:', enabled);
        } catch (error) {
            logger.error('Error saving basic TTS state:', error);
            // apiClient.js уже показывает toast при ошибках
        }
    };

    // Функция для сохранения состояния ИИ TTS
    const saveAiTtsState = async (enabled) => {
        try {
            const engine = enabled ? 'local' : 'cloud';
            await botService.post('/api/tts/engine', { engine_type: engine });
            logger.log('AI TTS state saved:', enabled);
        } catch (error) {
            logger.error('Error saving AI TTS state:', error);
            // apiClient.js уже показывает toast при ошибках
        }
    };

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
        setAiTtsEnabled(enabled);
        saveAiTtsState(enabled);
    };

    // Обработчик для изменения режима прослушивания
    const handleListeningModeChange = async (mode) => {
        setListeningMode(mode);
        try {
            await botService.post('/api/tts/listening-mode', { listeningMode: mode });
            logger.log('Listening mode saved:', mode);
        } catch (error) {
            logger.error('Error saving listening mode:', error);
            // apiClient.js уже показывает toast при ошибках
        }
    };

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
        <PageWrapper 
            title="Озвучка сообщений"
        >
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
                
                {/* Статус здоровья TTS */}
                <HealthStatus 
                    isHealthy={isHealthy} 
                    isChecking={isChecking} 
                    checkTtsHealth={checkTtsHealth}
                    isWhitelisted={isWhitelisted}
                />
                
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
                    {engineLoading ? (
                        <div className="flex gap-3">
                            {/* Skeleton для облачного движка */}
                            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-gray-700 bg-gray-700/20">
                                <div className="w-4 h-4 rounded-full bg-gray-600 animate-pulse"></div>
                                <div className="h-4 w-16 bg-gray-600 rounded animate-pulse"></div>
                            </div>
                            {/* Skeleton для локального движка */}
                            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-gray-700 bg-gray-700/20">
                                <div className="w-4 h-4 rounded-full bg-gray-600 animate-pulse"></div>
                                <div className="h-4 w-16 bg-gray-600 rounded animate-pulse"></div>
                            </div>
                        </div>
                    ) : (
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
                            <div className="text-sm font-medium">☁️ Облачный</div>
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
                    )}
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
        </PageWrapper>
    );
};

export default TtsMainPageContent;
