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
import TtsChannelPointsMode from '../../components/tts/TtsChannelPointsMode';
import { ttsLogger } from '../../utils/logger';

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
                return;
            }
            
            ttsLogger.info('Loading TTS settings from server...');
            try {
                // 🚀 ОПТИМИЗАЦИЯ: Parallel API calls вместо sequential (было 3 последовательных запроса)
                const [audioResponse, ttsResponse, platformResponse, ttsStatusResponse] = await Promise.all([
                    botService.get('/api/tts/audio-settings'),
                    botService.get('/api/tts/settings'),
                    botService.get('/api/tts/platform-settings'),
                    botService.get('/api/tts/status')
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
                    setAiTtsEnabled(isTtsEnabled && isHealthy);
                    setTtsEngine(engineType === 'local' ? 'local' : 'cloud');
                    
                    ttsLogger.info('TTS engine loaded:', engineType);
                }
                
                // Режим прослушивания
                if (user?.tts_listening_mode) {
                    setListeningMode(user.tts_listening_mode);
                }
            } catch (error) {
                ttsLogger.error('Error loading settings:', error);
                // При ошибке загрузки с сервера используем значения по умолчанию
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
                    console.error('Error generating OBS URL:', error);
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
            
            const platformName = platform === 'twitch' ? 'Twitch' : 'VK';
            const action = newEnabledPlatforms.includes(platform) ? 'включена' : 'отключена';
            toast.success(`${platformName} озвучка ${action}`);
            console.log(`Platform ${platform} toggled successfully`);
        } catch (error) {
            console.error('Error toggling platform:', error);
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
            console.error('Error saving settings:', error);
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
                toast.success('🔊 Базовая озвучка включена');
            } else {
                await botService.post('/api/tts/disable');
                toast.success('🔇 Базовая озвучка отключена');
            }
            console.log('Basic TTS state saved:', enabled);
        } catch (error) {
            console.error('Error saving basic TTS state:', error);
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка сохранения состояния TTS');
            } else {
                toast.error('Сервер недоступен');
            }
        }
    };

    // Функция для сохранения состояния ИИ TTS
    const saveAiTtsState = async (enabled) => {
        try {
            const engine = enabled ? 'local' : 'cloud';
            await botService.post('/api/tts/engine', { engine_type: engine });
            toast.success(`Движок: ${enabled ? '💻 Локальный F5-TTS' : '☁️ Облачный'}`);
            console.log('AI TTS state saved:', enabled);
        } catch (error) {
            console.error('Error saving AI TTS state:', error);
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка переключения движка TTS');
            } else {
                toast.error('Сервер недоступен');
            }
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
            toast.success(`Режим: ${mode === 'website' ? '🌐 Браузер' : '📺 OBS'}`);
            console.log('Listening mode saved:', mode);
        } catch (error) {
            console.error('Error saving listening mode:', error);
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка сохранения режима прослушивания');
            } else {
                toast.error('Сервер недоступен');
            }
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
                toast.success('🔄 OBS URL перегенерирован');
            } else {
                setObsUrl('');
                toast.error('Не удалось получить токен OBS');
            }
        } catch (error) {
            console.error('Error regenerating OBS URL:', error);
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка перегенерации OBS URL');
            } else {
                toast.error('TTS сервис недоступен');
            }
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
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
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
                        <label className={`flex-1 flex items-center gap-2 cursor-pointer px-3 py-2 rounded border transition ${
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
                        
                        <label className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border transition ${
                            !localTtsConfig?.configured 
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
                                    if (localTtsConfig?.configured) {
                                        setTtsEngine(e.target.value);
                                        botService.post('/api/tts/engine', { engine_type: 'local' }).catch(err => ttsLogger.error('Error setting TTS engine:', err));
                                        
                                        // Уведомляем shortcuts на главной странице
                                        window.dispatchEvent(new CustomEvent('ai-tts-changed', { 
                                            detail: { enabled: true } 
                                        }));
                                    }
                                }}
                                className="w-4 h-4"
                                disabled={!localTtsConfig?.configured}
                            />
                            <div className="text-sm font-medium">💻 Локальный</div>
                            {!localTtsConfig?.configured && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded ml-auto">
                                    Не настроен
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
                
                {/* Режим TTS (все сообщения / за баллы) - NEW! */}
                <TtsChannelPointsMode />
                
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
