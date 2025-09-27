// src/pages/tts/TtsMainPage.jsx
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useTts } from '../../context/TtsContext';
import { useTtsHealth } from '../../context/TtsHealthContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader, Link, Copy, Radio } from 'lucide-react';
import { generateObsUrl } from '../../services/microservices';
import { PageLoader } from '@/components/ui/loader';
import { useLoadingState } from '../../hooks/useLoadingState';
import TtsErrorCard from '../../components/TtsErrorCard';
import { toast } from 'sonner';
import { TwitchIcon, VKIcon } from '../../components/PlatformIcons';
import { ttsService } from '../../services/microservices';
import { useIntegrations } from '../../context/IntegrationsContext';
import api from '../../services/api';

const TtsMainPageContent = () => {
    const { ttsEnabled, toggleTts, isWhitelisted, engineStatus, isToggling, initializeTts, setNotificationHandler, syncWithHealthContext } = useTts();
    const { isHealthy, isChecking } = useTtsHealth();
    const { isAuthenticated, user } = useAuth();
    const { integrations } = useIntegrations();
    const [listeningMode, setListeningMode] = useState('website'); // 'website' или 'obs'
    const [obsUrl, setObsUrl] = useState('');
    const [platformSettings, setPlatformSettings] = useState({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });
    const [platformLoading, setPlatformLoading] = useState(false);
    
    // Настройки звука
    const [audioSettings, setAudioSettings] = useState({
        websiteVolume: 50, // Громкость на сайте
        obsVolume: 50 // Громкость в OBS
    });
    
    // Дополнительные настройки TTS
    const [ttsSettings, setTtsSettings] = useState({
        enable7TV: true, // Включить озвучку 7TV смайлов
        enableProfanity: false, // Озвучивать мат
        profanityLevel: 'medium' // Уровень фильтрации мата: low, medium, high
    });
    
    // Используем хук для управления состоянием загрузки
    const showLoader = useLoadingState(isChecking);
    
    // Загрузка настроек платформ
    const loadPlatformSettings = async () => {
        if (!isAuthenticated) return;
        
        try {
            setPlatformLoading(true);
            const response = await ttsService.get('/api/tts/settings');
            setPlatformSettings(response.data);
        } catch (err) {
            console.error('Error loading platform settings:', err);
            // Используем значения по умолчанию
            setPlatformSettings({
                enabled_platforms: ['twitch', 'vk'],
                global_enabled: true
            });
        } finally {
            setPlatformLoading(false);
        }
    };
    
    // Переключение платформы
    const togglePlatform = async (platform) => {
        if (!isAuthenticated) return;
        
        try {
            const enabledPlatforms = [...platformSettings.enabled_platforms];
            const index = enabledPlatforms.indexOf(platform);
            
            if (index > -1) {
                enabledPlatforms.splice(index, 1);
            } else {
                enabledPlatforms.push(platform);
            }

            const newSettings = {
                ...platformSettings,
                enabled_platforms: enabledPlatforms
            };
            
            await ttsService.put('/api/tts/settings', newSettings);
            setPlatformSettings(newSettings);
            toast.success('Настройки платформ обновлены');
        } catch (err) {
            console.error('Error updating platform settings:', err);
            toast.error('Ошибка обновления настроек платформ');
        }
    };
    
    // Функция для генерации OBS URL
    const handleGenerateObsUrl = async () => {
        try {
            const response = await generateObsUrl();
            const fullUrl = `${window.location.origin}/tts-obs/${response.data.obs_token}`;
            setObsUrl(fullUrl);
            toast.success('Ссылка для OBS успешно создана!');
        } catch (error) {
            toast.error('Не удалось создать ссылку для OBS.');
            console.error('Failed to generate OBS URL:', error);
        }
    };
    
    // Функция для перегенерации OBS URL
    const handleRegenerateObsUrl = async () => {
        try {
            const response = await api.post('/api/tts/regenerate-obs-url');
            const fullUrl = `${window.location.origin}/tts-obs/${response.data.obs_token}`;
            setObsUrl(fullUrl);
            toast.success('Ссылка для OBS перегенерирована!');
        } catch (error) {
            toast.error('Не удалось перегенерировать ссылку для OBS.');
            console.error('Failed to regenerate OBS URL:', error);
        }
    };
    
    // Загрузка существующего OBS URL при инициализации
    const loadExistingObsUrl = async () => {
        if (!isAuthenticated) return;
        
        try {
            const response = await generateObsUrl();
            const fullUrl = `${window.location.origin}/tts-obs/${response.data.obs_token}`;
            setObsUrl(fullUrl);
        } catch (error) {
            console.error('Failed to load existing OBS URL:', error);
        }
    };
    
    // Загрузка настроек звука и TTS
    const loadSettings = async () => {
        try {
            if (isAuthenticated) {
                // Для авторизованных пользователей загружаем из API
                const [audioResponse, ttsResponse] = await Promise.all([
                    ttsService.get('/api/tts/audio-settings'),
                    ttsService.get('/api/tts/settings')
                ]);
                setAudioSettings(audioResponse.data);
                setTtsSettings(ttsResponse.data);
            } else {
                // Для гостей загружаем из localStorage
                const savedAudioSettings = localStorage.getItem('tts_audio_settings');
                const savedTtsSettings = localStorage.getItem('tts_settings');
                if (savedAudioSettings) {
                    setAudioSettings(JSON.parse(savedAudioSettings));
                }
                if (savedTtsSettings) {
                    setTtsSettings(JSON.parse(savedTtsSettings));
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            // Используем значения по умолчанию
        }
    };
    
    // Сохранение настроек звука (на сервере для OBS + локально для быстрого UI)
    const saveAudioSettings = async (newSettings) => {
        try {
            // Определяем активную громкость в зависимости от режима прослушивания
            const activeVolume = listeningMode === 'website' ? newSettings.websiteVolume : newSettings.obsVolume;
            
            if (isAuthenticated) {
                // Для авторизованных пользователей: сохраняем на сервере
                await api.post('/api/tts/volume', {
                    volume_level: activeVolume,
                    listening_mode: listeningMode  // Передаем режим прослушивания
                });
                
                console.log(`Audio settings saved to server: ${activeVolume}% for ${listeningMode} mode`);
                
                // Также сохраняем в localStorage для быстрого доступа UI
                localStorage.setItem('tts_audio_settings', JSON.stringify(newSettings));
            } else {
                // Для гостей: только localStorage (OBS недоступен в гостевом режиме)
                localStorage.setItem('tts_audio_settings', JSON.stringify(newSettings));
                console.log('Audio settings saved locally (guest mode):', newSettings);
            }
            
            setAudioSettings(newSettings);
        } catch (error) {
            console.error('Failed to save audio settings:', error);
            toast.error('Ошибка сохранения настроек звука');
        }
    };
    
    // Сохранение настроек TTS
    const saveTtsSettings = async (newSettings) => {
        try {
            if (isAuthenticated) {
                await ttsService.put('/api/tts/settings', newSettings);
            } else {
                localStorage.setItem('tts_settings', JSON.stringify(newSettings));
            }
            setTtsSettings(newSettings);
            toast.success('Настройки TTS сохранены');
        } catch (error) {
            console.error('Failed to save TTS settings:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };
    
    // Debounce для автоматического сохранения
    const [saveTimeout, setSaveTimeout] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    
    // Обработка изменения громкости с debounce
    const handleVolumeChange = (volumeType, value) => {
        const newSettings = {
            ...audioSettings,
            [volumeType]: value
        };
        setAudioSettings(newSettings);
        setHasUnsavedChanges(true);
        
        // Очищаем предыдущий таймер
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        // Устанавливаем новый таймер для сохранения через 1 секунду
        const timeout = setTimeout(() => {
            saveAudioSettings(newSettings);
            setHasUnsavedChanges(false);
        }, 1000);
        
        setSaveTimeout(timeout);
    };
    
    // Функция для копирования в буфер обмена
    const copyToClipboard = () => {
        navigator.clipboard.writeText(obsUrl);
        toast.success('Ссылка скопирована в буфер обмена!');
    };
    
    // Для гостей используем user.username как название канала
    const channelName = !isAuthenticated && user?.username ? user.username : '';
    // Бот подключен если есть пользователь (гость или авторизованный)
    const isConnected = !!user;
    
    const checkBotStatus = useCallback(async () => {
        try {
            let response;
            if (isAuthenticated) {
                // Для авторизованных пользователей
                response = await api.get('/api/chat/status');
            } else {
                // Для гостей
                response = await api.get(`/api/chat/guest/status?channel_name=${channelName}`);
            }
            
            const connected = response.data.connected;
            
            // НЕ перенаправляем на логин при отключении бота
            // Пользователь может остаться на странице и попробовать переподключиться
            if (!connected) {
                console.log('Bot is not connected, but staying on page');
            }
        } catch (error) {
            console.error('Failed to check bot status:', error);
            // Не показываем ошибку для 401 (это нормально для гостей)
            if (error.response?.status !== 401) {
                console.log('Bot status check failed, but staying on page');
            }
        }
    }, [isAuthenticated, channelName]);
    
    // Периодическая проверка статуса бота (каждые 30 секунд)
    useEffect(() => {
        if (user) {
            const interval = setInterval(checkBotStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [user, checkBotStatus]);


    // Инициализируем TTS только при загрузке этой страницы
    useEffect(() => {
        initializeTts();
    }, [initializeTts]);
    
    // Загружаем настройки платформ для авторизованных пользователей
    useEffect(() => {
        if (isAuthenticated) {
            loadPlatformSettings();
            loadExistingObsUrl();
            loadVolumeFromBackend(); // Загружаем настройки громкости с backend
        }
    }, [isAuthenticated]);

    // Загрузка настроек громкости с backend
    const loadVolumeFromBackend = async () => {
        try {
            if (!isAuthenticated) return;
            
            const response = await api.get('/api/tts/volume');
            const backendVolume = response.data.volume_level;
            const backendListeningMode = response.data.listening_mode || 'website';
            
            // Синхронизируем режим прослушивания с backend
            setListeningMode(backendListeningMode);
            
            // Обновляем настройки громкости для соответствующего режима
            setAudioSettings(prev => ({
                ...prev,
                [backendListeningMode === 'website' ? 'websiteVolume' : 'obsVolume']: backendVolume
            }));
            
            console.log(`Settings loaded from backend: ${backendVolume}% for ${backendListeningMode} mode`);
        } catch (error) {
            console.error('Failed to load volume from backend:', error);
        }
    };
    
    // Cleanup таймера при размонтировании компонента
    useEffect(() => {
        return () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
        };
    }, [saveTimeout]);

    // Синхронизируем с TtsHealthContext при изменении isHealthy
    useEffect(() => {
        console.log('TtsMainPage: Syncing with health context, isHealthy:', isHealthy);
        syncWithHealthContext(isHealthy);
    }, [isHealthy, syncWithHealthContext]);
    
    // Регистрируем функцию уведомлений в TtsContext
    useEffect(() => {
        console.log('TtsMainPage: Registering notification handler');
        setNotificationHandler((message, type = 'error') => {
            if (type === 'error') {
                toast.error(message);
            } else {
                toast.success(message);
            }
        });
    }, [setNotificationHandler]);

    // Проверяем whitelist статус для гостей только при необходимости
    // (убрали автоматическую проверку при загрузке)

    const handleToggle = useCallback(async (event) => {
        console.log('TtsMainPage: handleToggle called');
        console.log('TtsMainPage: engineStatus.error:', engineStatus.error);
        console.log('TtsMainPage: ttsEnabled:', ttsEnabled);
        console.log('TtsMainPage: showNotification function available:', typeof showNotification);
        
        if (engineStatus.error) {
            console.log('TtsMainPage: Showing error notification');
            toast.error(engineStatus.error);
            return;
        }
        
        console.log('TtsMainPage: Calling toggleTts');
        // Переключаем TTS (whitelist проверка происходит внутри toggleTts)
        try {
            await toggleTts(event);
        } catch (error) {
            console.error('TtsMainPage: Error in toggleTts:', error);
            toast.error('Произошла ошибка при переключении TTS');
        }
    }, [engineStatus.error, toggleTts, ttsEnabled]);

    // Показываем прелоадер пока проверяется health
    if (showLoader) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <h1 className="text-3xl font-bold mb-4">Озвучка сообщений</h1>
                <PageLoader message="Проверка состояния TTS сервиса..." />
            </div>
        );
    }

    // Заглушка когда TTS недоступен
    if (!isHealthy) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <h1 className="text-3xl font-bold text-white mb-6">Озвучка сообщений</h1>
                
                <TtsErrorCard
                    title="TTS сервер недоступен"
                    description="В данный момент сервис TTS недоступен. Озвучка сообщений временно отключена."
                    suggestion="Попробуйте обновить страницу через несколько минут."
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 relative">
            <style dangerouslySetInnerHTML={{
                __html: `
                    .slider::-webkit-slider-thumb {
                        appearance: none;
                        height: 20px;
                        width: 20px;
                        border-radius: 50%;
                        background: #ffffff;
                        cursor: pointer;
                        border: 2px solid #374151;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    }
                    
                    .slider::-moz-range-thumb {
                        height: 20px;
                        width: 20px;
                        border-radius: 50%;
                        background: #ffffff;
                        cursor: pointer;
                        border: 2px solid #374151;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    }
                `
            }} />
            <h1 className="text-3xl font-bold mb-4">Озвучка сообщений</h1>
            
            
            <Card>
                <CardHeader>
                    <CardTitle>Управление озвучкой</CardTitle>
                    <CardDescription>
                        {!isAuthenticated && !isConnected && <span className="text-yellow-500">Сначала подключите бота к каналу.</span>}
                        {isWhitelisted === null && isAuthenticated && <span className="text-yellow-500">Проверка whitelist...</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                            <div className="space-y-6">
                                {/* Основное переключение TTS */}
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3">
                            <Switch
                                checked={ttsEnabled}
                                onCheckedChange={(checked) => handleToggle()}
                                disabled={(!isAuthenticated && !isConnected) || !engineStatus.loaded || isToggling}
                            />
                            <span className="text-sm font-medium">
                                {ttsEnabled ? 'Выключить озвучку чата' : 'Включить озвучку чата'}
                            </span>
                            {isToggling && (
                                <Loader className="h-4 w-4 animate-spin text-primary" />
                            )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <div 
                                className={`w-2 h-2 rounded-full ${ttsEnabled ? 'bg-green-500' : 'bg-red-500'} ${ttsEnabled ? 'shadow-green-500/50 shadow-lg' : 'shadow-red-500/50 shadow-lg'}`}
                            />
                            <span className={`text-sm ${ttsEnabled ? 'text-green-500' : 'text-red-500'}`}>
                                {ttsEnabled ? 'Включено' : 'Выключено'}
                            </span>
                        </div>
                                </div>
                                
                                {/* Выбор платформ - только для авторизованных пользователей */}
                                {isAuthenticated && (
                                    <div className="border-t border-gray-700 pt-4">
                                        <h4 className="text-sm font-medium text-gray-300 mb-3">Выбор платформ</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Twitch */}
                                            <div className={`flex items-center justify-between p-3 rounded-lg border ${
                                                integrations.twitch?.enabled 
                                                    ? 'bg-gray-800 border-gray-700' 
                                                    : 'bg-gray-900 border-gray-600 opacity-60'
                                            }`}>
                                                <div className="flex items-center space-x-3">
                                                    <TwitchIcon className={`w-5 h-5 ${
                                                        integrations.twitch?.enabled ? 'text-white' : 'text-gray-500'
                                                    }`} />
                                                    <div>
                                                        <p className={`text-sm font-medium ${
                                                            integrations.twitch?.enabled ? 'text-white' : 'text-gray-500'
                                                        }`}>
                                                            Twitch
                                                            {!integrations.twitch?.enabled && ' (не подключен)'}
                                                        </p>
                                                        <p className={`text-xs ${
                                                            integrations.twitch?.enabled ? 'text-gray-400' : 'text-gray-600'
                                                        }`}>
                                                            Озвучка сообщений из Twitch чата
                                                        </p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={integrations.twitch?.enabled && platformSettings.enabled_platforms.includes('twitch')}
                                                    onCheckedChange={() => togglePlatform('twitch')}
                                                    disabled={platformLoading || !integrations.twitch?.enabled}
                                                />
                                            </div>
                                            
                                            {/* VK Live */}
                                            <div className={`flex items-center justify-between p-3 rounded-lg border ${
                                                integrations.vk?.enabled 
                                                    ? 'bg-gray-800 border-gray-700' 
                                                    : 'bg-gray-900 border-gray-600 opacity-60'
                                            }`}>
                                                <div className="flex items-center space-x-3">
                                                    <VKIcon className={`w-5 h-5 ${
                                                        integrations.vk?.enabled ? 'text-white' : 'text-gray-500'
                                                    }`} />
                                                    <div>
                                                        <p className={`text-sm font-medium ${
                                                            integrations.vk?.enabled ? 'text-white' : 'text-gray-500'
                                                        }`}>
                                                            VK Live
                                                            {!integrations.vk?.enabled && ' (не подключен)'}
                                                        </p>
                                                        <p className={`text-xs ${
                                                            integrations.vk?.enabled ? 'text-gray-400' : 'text-gray-600'
                                                        }`}>
                                                            Озвучка сообщений из VK Live чата
                                                        </p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={integrations.vk?.enabled && platformSettings.enabled_platforms.includes('vk')}
                                                    onCheckedChange={() => togglePlatform('vk')}
                                                    disabled={platformLoading || !integrations.vk?.enabled}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                    </div>
                </CardContent>
            </Card>
            
            
            {/* Способ прослушивания - только для авторизованных пользователей */}
            {isAuthenticated && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Способ прослушивания</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setListeningMode('website');
                                        // Синхронизируем с backend
                                        const newSettings = {
                                            ...audioSettings,
                                            websiteVolume: audioSettings.websiteVolume
                                        };
                                        saveAudioSettings(newSettings);
                                    }}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        listeningMode === 'website' 
                                            ? 'bg-purple-600 text-white border border-purple-500' 
                                            : 'bg-transparent text-gray-300 border border-gray-600 hover:bg-gray-800'
                                    }`}
                                >
                                    Сайт
                                </button>
                                <button
                                    onClick={async () => {
                                        setListeningMode('obs');
                                        // Синхронизируем с backend
                                        const newSettings = {
                                            ...audioSettings,
                                            obsVolume: audioSettings.obsVolume
                                        };
                                        saveAudioSettings(newSettings);
                                        
                                        // Генерируем OBS URL если его еще нет
                                        if (!obsUrl) {
                                            await handleGenerateObsUrl();
                                        }
                                    }}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        listeningMode === 'obs' 
                                            ? 'bg-purple-600 text-white border border-purple-500' 
                                            : 'bg-transparent text-gray-300 border border-gray-600 hover:bg-gray-800'
                                    }`}
                                >
                                    OBS
                                </button>
                            </div>
                            
                            {/* URL для OBS - показываем только когда выбран режим OBS */}
                            {listeningMode === 'obs' && (
                                <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                                    <div className="text-sm font-medium mb-2">URL для OBS Browser Source:</div>
                                    {obsUrl ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={obsUrl}
                                                readOnly
                                                className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-sm font-mono"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={copyToClipboard}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                <Copy className="h-4 w-4 mr-1" />
                                                Копировать
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleRegenerateObsUrl}
                                            >
                                                Обновить
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={handleGenerateObsUrl}
                                            className="bg-purple-600 hover:bg-purple-700"
                                        >
                                            Сгенерировать URL
                                        </Button>
                                    )}
                                    <div className="text-xs text-gray-400 mt-2">
                                        💡 <strong>Инструкция:</strong> Добавьте этот URL как "Browser Source" в OBS Studio. 
                                        Рекомендуемые размеры: 1920x1080.
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {/* Настройки звука */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Настройки звука</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Громкость для выбранного способа прослушивания */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="currentVolume" className="text-sm font-medium">
                                    Громкость для {listeningMode === 'website' ? 'сайта' : 'OBS'}
                                </Label>
                                <span className="text-sm text-gray-400">
                                    {listeningMode === 'website' ? audioSettings.websiteVolume : audioSettings.obsVolume}%
                                </span>
                            </div>
                            <div className="px-3">
                                <input
                                    type="range"
                                    id="currentVolume"
                                    min="0"
                                    max="100"
                                    value={listeningMode === 'website' ? audioSettings.websiteVolume : audioSettings.obsVolume}
                                    onChange={(e) => handleVolumeChange(
                                        listeningMode === 'website' ? 'websiteVolume' : 'obsVolume', 
                                        parseInt(e.target.value)
                                    )}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                    style={{
                                        background: `linear-gradient(to right, ${
                                            listeningMode === 'website' ? '#10b981' : '#f59e0b'
                                        } 0%, ${
                                            listeningMode === 'website' ? '#10b981' : '#f59e0b'
                                        } ${
                                            listeningMode === 'website' ? audioSettings.websiteVolume : audioSettings.obsVolume
                                        }%, #374151 ${
                                            listeningMode === 'website' ? audioSettings.websiteVolume : audioSettings.obsVolume
                                        }%, #374151 100%)`
                                    }}
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                Громкость кастомных голосов настраивается индивидуально для каждого голоса
                            </p>
                        </div>
                        
                        {/* Индикатор состояния сохранения */}
                        <div className="flex justify-start pt-2">
                            <div className="text-sm text-gray-400">
                                {hasUnsavedChanges ? (
                                    <span className="text-yellow-400">• Несохраненные изменения</span>
                                ) : (
                                    <span className="text-green-400">✓ Настройки сохранены</span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Дополнительные настройки */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Дополнительные настройки</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* 7TV смайлы */}
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="enable7TV" className="text-sm font-medium">
                                    Озвучивать 7TV смайлы
                                </Label>
                            </div>
                            <Switch
                                id="enable7TV"
                                checked={ttsSettings.enable7TV}
                                onCheckedChange={(checked) => {
                                    const newSettings = { ...ttsSettings, enable7TV: checked };
                                    setTtsSettings(newSettings);
                                    saveTtsSettings(newSettings);
                                }}
                            />
                        </div>
                        
                        {/* Мат */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="enableProfanity" className="text-sm font-medium">
                                        Озвучивать мат
                                    </Label>
                                </div>
                                <Switch
                                    id="enableProfanity"
                                    checked={ttsSettings.enableProfanity}
                                    onCheckedChange={(checked) => {
                                        const newSettings = { ...ttsSettings, enableProfanity: checked };
                                        setTtsSettings(newSettings);
                                        saveTtsSettings(newSettings);
                                    }}
                                />
                            </div>
                            
                            {ttsSettings.enableProfanity && (
                                <div className="ml-4 space-y-2">
                                    <Label htmlFor="profanityLevel" className="text-xs text-gray-400">
                                        Уровень фильтрации
                                    </Label>
                                    <select
                                        id="profanityLevel"
                                        value={ttsSettings.profanityLevel}
                                        onChange={(e) => {
                                            const newSettings = { ...ttsSettings, profanityLevel: e.target.value };
                                            setTtsSettings(newSettings);
                                            saveTtsSettings(newSettings);
                                        }}
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="low">Низкий (только явный мат)</option>
                                        <option value="medium">Средний (мат + грубости)</option>
                                        <option value="high">Высокий (все нецензурное)</option>
                                    </select>
                            </div>
                        )}
                        </div>
                    </div>
                </CardContent>
            </Card>
            
        </div>
    );
};

export default TtsMainPageContent;
