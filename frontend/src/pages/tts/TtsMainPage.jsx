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
import { Loader, Link, Copy, Radio, Plus, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { generateObsUrl } from '../../services/microservices';
import { PageLoader } from '@/components/ui/loader';
import { useLoadingState } from '../../hooks/useLoadingState';
import { TtsSettingsSkeleton, ListSkeleton } from '@/components/ui/skeleton';
import TtsErrorCard from '../../components/TtsErrorCard';
import { toast } from 'sonner';
import { TwitchIcon, VKIcon } from '../../components/PlatformIcons';
import { useIntegrations } from '../../context/IntegrationsContext';
import api from '../../services/api';

const TtsMainPageContent = () => {
    const { ttsEnabled, toggleTts, isWhitelisted, engineStatus, isToggling, initializeTts, setNotificationHandler, syncWithHealthContext } = useTts();
    const { isHealthy, isChecking, checkTtsHealth } = useTtsHealth();
    const { isAuthenticated, user } = useAuth();
    const { integrations } = useIntegrations();
    const [listeningMode, setListeningMode] = useState('website'); // 'website' или 'obs'
    const [obsUrl, setObsUrl] = useState('');
    const [platformSettings, setPlatformSettings] = useState({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });
    const [platformLoading, setPlatformLoading] = useState(false);
    
    // Состояния для двухуровневой системы TTS (сервер - источник истины)
    const [basicTtsEnabled, setBasicTtsEnabled] = useState(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState(false);
    const [isLoadingStates, setIsLoadingStates] = useState(true);
    
    // Настройки звука (сервер - источник истины)
    const [audioSettings, setAudioSettings] = useState({
        websiteVolume: 50, // Громкость на сайте
        obsVolume: 50 // Громкость в OBS
    });
    
    // Дополнительные настройки TTS (сервер - источник истины)
    const [ttsSettings, setTtsSettings] = useState({
        enable7TV: true, // Включить озвучку 7TV смайлов
        enableTwitch: true, // Включить озвучку Twitch смайлов
    });
    
    // Состояние для фильтрации слов
    const [wordFilter, setWordFilter] = useState({
        words: [], // Список заблокированных слов
        newWord: '', // Новое слово для добавления
        platform: 'all', // Платформа для фильтрации
        loading: false // Состояние загрузки
    });
    
    // Состояние для сворачивания/разворачивания списка слов
    const [isWordListExpanded, setIsWordListExpanded] = useState(false);
    
    
    // Загрузка фильтра слов из API и статуса TTS - только при первом монтировании
    useEffect(() => {
        const loadAllSettings = async () => {
            setIsLoadingStates(true);
            try {
                await Promise.all([
                    loadWordFilter(),
                    loadTTSSettings(),
                    loadDualTTSStatus()
                ]);
            } finally {
                setIsLoadingStates(false);
            }
        };
        loadAllSettings();
    }, []); // Пустой массив зависимостей - только при монтировании
    
    const loadWordFilter = async () => {
        try {
            setWordFilter(prev => ({ ...prev, loading: true }));
            const response = await fetch('http://localhost:8000/api/tts/filtered-words', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                setWordFilter(prev => ({ ...prev, words: data.words || [] }));
            } else {
                console.error('Failed to load word filter:', response.status, response.statusText);
                toast.error('Ошибка загрузки фильтра слов');
            }
        } catch (error) {
            console.error('Error loading word filter:', error);
        } finally {
            setWordFilter(prev => ({ ...prev, loading: false }));
        }
    };
    
    // Убираем прелоадер при переключении вкладок - только при обновлении страницы
    // const showLoader = useLoadingState(isChecking);
    
    // Функции для работы с фильтром слов
    const addWordToFilter = async () => {
        if (!wordFilter.newWord.trim()) {
            toast.error('Введите слово для добавления');
            return;
        }
        
        // Проверяем на дубликаты
        const wordExists = wordFilter.words.some(wordObj => 
            wordObj.word.toLowerCase() === wordFilter.newWord.trim().toLowerCase()
        );
        
        if (wordExists) {
            toast.error('Это слово уже добавлено в фильтр');
            return;
        }
        
        try {
            setWordFilter(prev => ({ ...prev, loading: true }));
            
            const response = await fetch('http://localhost:8000/api/tts/filtered-words', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    word: wordFilter.newWord.trim(),
                    platform: wordFilter.platform
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                // toast.success(data.message); // Убираем лишнее уведомление
                
                // Обновляем локальное состояние
                const newWord = {
                    id: Date.now(), // Временный ID
                    word: wordFilter.newWord.trim(),
                    platform: wordFilter.platform,
                    created_at: new Date().toISOString()
                };
                
                setWordFilter(prev => ({
                    ...prev,
                    words: [...prev.words, newWord],
                    newWord: ''
                }));
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail || 'Ошибка добавления слова');
            }
        } catch (error) {
            console.error('Error adding word to filter:', error);
            toast.error('Ошибка добавления слова');
        } finally {
            setWordFilter(prev => ({ ...prev, loading: false }));
        }
    };
    
    const removeWordFromFilter = async (wordId) => {
        try {
            setWordFilter(prev => ({ ...prev, loading: true }));
            
            const response = await fetch(`http://localhost:8000/api/tts/filtered-words/${wordId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                // toast.success(data.message); // Убираем лишнее уведомление
                
                // Обновляем локальное состояние
                setWordFilter(prev => ({
                    ...prev,
                    words: prev.words.filter(word => word.id !== wordId)
                }));
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail || 'Ошибка удаления слова');
            }
        } catch (error) {
            console.error('Error removing word from filter:', error);
            toast.error('Ошибка удаления слова');
        } finally {
            setWordFilter(prev => ({ ...prev, loading: false }));
        }
    };
    
    // Загрузка настроек TTS (голосов)
    const loadTTSSettings = async () => {
        if (!isAuthenticated) return;
        
        try {
            const response = await api.get('/api/tts/settings');
            const data = response.data;
            
            const newSettings = {
                enable7TV: data.enable7TV,
                enableTwitch: data.enableTwitch,
            };
            setTtsSettings(newSettings);
            // Кэшируем в localStorage только ПОСЛЕ успешной загрузки с сервера
            localStorage.setItem('ttsSettings', JSON.stringify(newSettings));
        } catch (error) {
            console.error('Error loading TTS settings:', error);
            // При ошибке загружаем из localStorage как fallback
            const cachedSettings = localStorage.getItem('ttsSettings');
            if (cachedSettings) {
                const parsed = JSON.parse(cachedSettings);
                setTtsSettings(parsed);
                // 📦 Fallback to cached TTS settings:', parsed);
            }
        }
    };

    // Сохранение настроек TTS (голосов)
    const saveTTSSettings = async (newSettings) => {
        if (!isAuthenticated) return;
        
        try {
            const response = await api.post('/api/tts/settings', newSettings);
            
            if (response.status === 200) {
                // Кэшируем в localStorage только ПОСЛЕ успешного сохранения на сервере
                localStorage.setItem('ttsSettings', JSON.stringify(newSettings));
            } else {
                console.error('Failed to save TTS settings');
            }
        } catch (error) {
            console.error('Error saving TTS settings:', error);
        }
    };

    // Загрузка настроек платформ
    const loadPlatformSettings = async () => {
        if (!isAuthenticated) return;
        
        try {
            setPlatformLoading(true);
            // Используем новый endpoint для настроек платформ
            const response = await api.get('/api/tts/platform-settings');
            const data = response.data;
            // Убеждаемся, что enabled_platforms всегда массив
            setPlatformSettings({
                enabled_platforms: data.enabled_platforms || ['twitch', 'vk'],
                global_enabled: data.global_enabled !== undefined ? data.global_enabled : true
            });
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
            
            await api.post('/api/tts/platform-settings', newSettings);
            setPlatformSettings(newSettings);
            // toast.success('Настройки платформ обновлены'); // Убираем лишнее уведомление
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
            // toast.success('Ссылка для OBS успешно создана!'); // Убираем лишнее уведомление
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
            // toast.success('Ссылка для OBS перегенерирована!'); // Убираем лишнее уведомление
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
                const response = await api.get('/api/tts/settings');
                // Используем настройки из response.data
                setTtsSettings(response.data);
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
            if (isAuthenticated) {
                // Для авторизованных пользователей: сохраняем через объединенный endpoint
                await api.post('/api/tts/settings', {
                    websiteVolume: newSettings.websiteVolume,
                    obsVolume: newSettings.obsVolume,
                    listening_mode: listeningMode
                });
                
                // Кэшируем в localStorage только ПОСЛЕ успешного сохранения на сервере
                localStorage.setItem('audioSettings', JSON.stringify(newSettings));
            } else {
                // Для гостей: только localStorage (OBS недоступен в гостевом режиме)
                localStorage.setItem('audioSettings', JSON.stringify(newSettings));
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
                await api.post('/api/tts/settings', newSettings);
            } else {
                localStorage.setItem('tts_settings', JSON.stringify(newSettings));
            }
            setTtsSettings(newSettings);
            // toast.success('Настройки TTS сохранены'); // Убираем лишнее уведомление
        } catch (error) {
            console.error('Failed to save TTS settings:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };
    
    // Состояние для отслеживания несохраненных изменений
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    
    // Обработка изменения громкости (сохранение при отпускании ползунка)
    const handleVolumeChange = (volumeType, value) => {
        const newSettings = {
            ...audioSettings,
            [volumeType]: value
        };
        setAudioSettings(newSettings);
        setHasUnsavedChanges(true);
        
        // Сохраняем сразу, так как вызывается только при отпускании ползунка
        saveAudioSettings(newSettings);
        setHasUnsavedChanges(false);
    };
    
    // Сохранение при размонтировании компонента
    useEffect(() => {
        return () => {
            if (hasUnsavedChanges) {
                // Принудительно сохраняем при размонтировании
                saveAudioSettings(audioSettings);
            }
        };
    }, [hasUnsavedChanges, audioSettings]);
    
    // Функция для копирования в буфер обмена
    const copyToClipboard = () => {
        navigator.clipboard.writeText(obsUrl);
        // toast.success('Ссылка скопирована в буфер обмена!'); // Убираем лишнее уведомление
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
            }
        } catch (error) {
            console.error('Failed to check bot status:', error);
            // Не показываем ошибку для 401 (это нормально для гостей)
            if (error.response?.status !== 401) {
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

    // Загрузка настроек громкости с backend (сервер - источник истины)
    const loadVolumeFromBackend = async () => {
        try {
            if (!isAuthenticated) return;
            
            // Загружаем все настройки TTS (включая громкость) из объединенного endpoint
            const response = await api.get('/api/tts/settings');
            const data = response.data;
            
            // Синхронизируем режим прослушивания с backend
            setListeningMode(data.listening_mode || 'website');
            
            // Обновляем настройки громкости
            const newSettings = {
                websiteVolume: data.websiteVolume || 50,
                obsVolume: data.obsVolume || 50
            };
            setAudioSettings(newSettings);
            // Кэшируем в localStorage только ПОСЛЕ успешной загрузки с сервера
            localStorage.setItem('audioSettings', JSON.stringify(newSettings));
            
        } catch (error) {
            console.error('Failed to load volume from backend:', error);
            // При ошибке загружаем из localStorage как fallback
            const cachedSettings = localStorage.getItem('audioSettings');
            if (cachedSettings) {
                const parsed = JSON.parse(cachedSettings);
                setAudioSettings(parsed);
                // 📦 Fallback to cached audio settings:', parsed);
            }
        }
    };
    

    // Синхронизируем с TtsHealthContext при изменении isHealthy
    useEffect(() => {
        syncWithHealthContext(isHealthy);
    }, [isHealthy, syncWithHealthContext]);
    
    // Регистрируем функцию уведомлений в TtsContext
    useEffect(() => {
        setNotificationHandler((message, type = 'error') => {
            if (type === 'error') {
                toast.error(message);
            } else {
                toast.success(message);
            }
        });
    }, [setNotificationHandler]);

    // Синхронизация aiTtsEnabled с ttsEnabled (из TtsContext)
    useEffect(() => {
        setAiTtsEnabled(ttsEnabled);
    }, [ttsEnabled]);
    
    // Автоматический fallback: если F5 падает во время работы ИИ озвучки
    useEffect(() => {
        if (aiTtsEnabled && !isHealthy) {
            // F5 упал, но базовая озвучка остается активной
            setAiTtsEnabled(false);
            toast.warning('F5-TTS недоступен. Переключено на базовую озвучку.');
        }
    }, [isHealthy, aiTtsEnabled]);

    // Загрузка статуса обоих типов TTS
    const loadDualTTSStatus = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/tts/dual-status', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                setBasicTtsEnabled(data.basic_tts_enabled || false);
                setAiTtsEnabled(data.ai_tts_enabled || false);
                // Кэшируем в localStorage только ПОСЛЕ успешной загрузки с сервера
                localStorage.setItem('basicTtsEnabled', JSON.stringify(data.basic_tts_enabled || false));
                localStorage.setItem('aiTtsEnabled', JSON.stringify(data.ai_tts_enabled || false));
                // Dual TTS status loaded:', data);
            }
        } catch (error) {
            console.error('Error loading dual TTS status:', error);
            // При ошибке загружаем из localStorage как fallback
            const cachedBasic = localStorage.getItem('basicTtsEnabled');
            const cachedAi = localStorage.getItem('aiTtsEnabled');
            if (cachedBasic) {
                setBasicTtsEnabled(JSON.parse(cachedBasic));
            }
            if (cachedAi) {
                setAiTtsEnabled(JSON.parse(cachedAi));
            }
            // 📦 Fallback to cached TTS status');
        }
    };

    // Управление базовой TTS (gTTS)
    const handleBasicTtsToggle = async (checked) => {
        try {
            const response = await fetch('http://localhost:8000/api/tts/basic/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ enabled: checked })
            });
            
            if (response.ok) {
                const data = await response.json();
                setBasicTtsEnabled(checked);
                // Кэшируем в localStorage только ПОСЛЕ успешного сохранения на сервере
                localStorage.setItem('basicTtsEnabled', JSON.stringify(checked));
                // toast.success(checked ? 'Базовая TTS включена' : 'Базовая TTS отключена'); // Убираем лишнее уведомление
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail || 'Ошибка переключения базовой TTS');
            }
        } catch (error) {
            console.error('Error toggling basic TTS:', error);
            toast.error('Ошибка переключения базовой TTS');
        }
    };

    // Управление AI TTS (F5-TTS)
    const handleAiTtsToggle = async (checked) => {
        try {
            const response = await fetch('http://localhost:8000/api/tts/ai/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ enabled: checked })
            });
            
            if (response.ok) {
                const data = await response.json();
                setAiTtsEnabled(checked);
                // Кэшируем в localStorage только ПОСЛЕ успешного сохранения на сервере
                localStorage.setItem('aiTtsEnabled', JSON.stringify(checked));
                // toast.success(checked ? 'AI TTS (F5-TTS) включена' : 'AI TTS (F5-TTS) отключена'); // Убираем лишнее уведомление
            } else {
                const errorData = await response.json();
                if (errorData.detail && errorData.detail.includes('whitelist')) {
                    toast.error('Канал не добавлен в whitelist для AI TTS');
                } else {
                    toast.error(errorData.detail || 'Ошибка переключения AI TTS');
                }
            }
        } catch (error) {
            console.error('Error toggling AI TTS:', error);
            toast.error('Ошибка переключения AI TTS');
        }
    };

    // Проверяем whitelist статус для гостей только при необходимости
    // (убрали автоматическую проверку при загрузке)

    const handleToggle = useCallback(async (event) => {
        
        if (engineStatus.error) {
            toast.error(engineStatus.error);
            return;
        }
        
        // Переключаем TTS (whitelist проверка происходит внутри toggleTts)
        try {
            await toggleTts(event);
        } catch (error) {
            console.error('TtsMainPage: Error in toggleTts:', error);
            toast.error('Произошла ошибка при переключении TTS');
        }
    }, [engineStatus.error, toggleTts, ttsEnabled]);

    // Показываем прелоадер пока загружаются состояния
    if (isLoadingStates) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-6 text-foreground">Озвучка сообщений</h1>
                        <p className="text-slate-400 mt-1">Настройте озвучку чата и управляйте голосами.</p>
                    </div>
                </div>
                <PageLoader message="Загрузка настроек TTS..." />
            </div>
        );
    }

    // Для недоступного ИИ TTS показываем баннер, но не блокируем базовую озвучку

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold mb-6 text-foreground">Озвучка сообщений</h1>
            
            {/* Баннер предупреждения когда F5 ИИ TTS недоступен */}
            {!isHealthy && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-yellow-500 rounded-full flex-shrink-0 mt-0.5"></div>
                        <div className="flex-1">
                            <h3 className="text-md font-semibold text-yellow-400 mb-1">
                                TTS ИИ озвучка недоступна
                            </h3>
                            <p className="text-yellow-300/80 text-sm mb-2">
                                Сервис ИИ озвучки F5-TTS временно недоступен. Вы можете использовать базовую озвучку ниже.
                            </p>
                            <p className="text-slate-400 text-xs">
                                Система автоматически обновит статус при восстановлении сервиса.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Основной контент с озвучкой */}
        <div className="relative">
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
            
            
            <Card>
                <CardHeader>
                    <CardTitle>Управление озвучкой</CardTitle>
                    <CardDescription>
                        {!isAuthenticated && !isConnected && <span className="text-yellow-500">Сначала подключите бота к каналу.</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                            <div className="space-y-6">
                                {/* Базовая озвучка - доступна всегда */}
                                <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <Switch
                                                checked={basicTtsEnabled}
                                                onCheckedChange={handleBasicTtsToggle}
                                                disabled={(!isAuthenticated && !isConnected) || isToggling}
                                            />
                                            <span className="text-sm font-medium">
                                                Базовая озвучка чата
                                            </span>
                                            {isToggling && (
                                                <Loader className="h-4 w-4 animate-spin text-primary" />
                                            )}
                                            
                                            {/* Статус */}
                                            <div className="flex items-center space-x-2">
                                                <div 
                                                    className={`w-2 h-2 rounded-full ${
                                                        basicTtsEnabled ? 'bg-green-500' : 'bg-gray-500'
                                                    }`}
                                                />
                                                <span className={`text-sm font-medium ${
                                                    basicTtsEnabled ? 'text-green-400' : 'text-gray-400'
                                                }`}>
                                                    {basicTtsEnabled ? 'Включено' : 'Выключено'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-11">
                                            Простая озвучка сообщений. Доступна всем, не требует подтверждения.
                                        </p>
                                    </div>
                                </div>

                                {/* ИИ озвучка F5-TTS - требует подтверждения */}
                                <div className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                                    isHealthy 
                                        ? 'bg-purple-500/10 border border-purple-500/30' 
                                        : 'bg-gray-800/50 border border-gray-700/50 opacity-60'
                                }`}>
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <Switch
                                                checked={aiTtsEnabled}
                                                onCheckedChange={handleAiTtsToggle}
                                                disabled={!isHealthy || (!isAuthenticated && !isConnected) || !engineStatus.loaded || isToggling}
                                            />
                                            <span className={`text-sm font-medium ${
                                                isHealthy ? '' : 'text-gray-500'
                                            }`}>
                                                ИИ озвучка F5-TTS
                                            </span>
                                            {isToggling && (
                                                <Loader className="h-4 w-4 animate-spin text-primary" />
                                            )}
                                            
                                            {/* Статус */}
                                            <div className="flex items-center space-x-2">
                                                <div 
                                                    className={`w-2 h-2 rounded-full ${
                                                        aiTtsEnabled && ttsEnabled ? 'bg-green-500' : 'bg-gray-500'
                                                    }`}
                                                />
                                                <span className={`text-sm font-medium ${
                                                    aiTtsEnabled && ttsEnabled ? 'text-green-400' : 'text-gray-400'
                                                }`}>
                                                    {aiTtsEnabled && ttsEnabled ? 'Включено' : 'Выключено'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className={`text-xs ml-11 ${
                                            isHealthy ? 'text-muted-foreground' : 'text-gray-600'
                                        }`}>
                                            Продвинутая ИИ озвучка с настраиваемыми голосами. Требует подтверждения (whitelist).
                                            {!isHealthy && ' Сервис временно недоступен.'}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Способ озвучки с URL справа */}
                                {isAuthenticated && (
                                    <div className="mt-4 mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-400">Способ озвучки:</span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        setListeningMode('website');
                                                        const newSettings = {
                                                            ...audioSettings,
                                                            websiteVolume: audioSettings.websiteVolume
                                                        };
                                                        setAudioSettings(newSettings);
                                                        saveAudioSettings(newSettings);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                        listeningMode === 'website' 
                                                            ? 'bg-purple-600 text-white shadow-md' 
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                >
                                                    Сайт
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        setListeningMode('obs');
                                                        const newSettings = {
                                                            ...audioSettings,
                                                            obsVolume: audioSettings.obsVolume
                                                        };
                                                        setAudioSettings(newSettings);
                                                        saveAudioSettings(newSettings);
                                                        
                                                        if (!obsUrl) {
                                                            await handleGenerateObsUrl();
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                        listeningMode === 'obs' 
                                                            ? 'bg-purple-600 text-white shadow-md' 
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                >
                                                    OBS
                                                </button>
                                            </div>
                                            
                                            {/* URL для OBS - справа от кнопок */}
                                            {listeningMode === 'obs' && (
                                                <div className="ml-4 flex items-center gap-2 text-xs">
                                                    <span className="text-gray-400">URL:</span>
                                                    {obsUrl ? (
                                                        <>
                                                            <button
                                                                onClick={copyToClipboard}
                                                                className="text-blue-400 hover:text-blue-300 underline truncate max-w-48"
                                                                title={obsUrl}
                                                            >
                                                                {obsUrl.length > 25 ? `${obsUrl.substring(0, 25)}...` : obsUrl}
                                                            </button>
                                                            <button
                                                                onClick={handleRegenerateObsUrl}
                                                                className="bg-orange-600 hover:bg-orange-700 text-white px-1.5 py-0.5 rounded text-xs"
                                                            >
                                                                ↻
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={handleGenerateObsUrl}
                                                            className="text-purple-400 hover:text-purple-300"
                                                        >
                                                            Сгенерировать
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
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
                                                    checked={integrations.twitch?.enabled && platformSettings.enabled_platforms?.includes('twitch')}
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
                                                    checked={integrations.vk?.enabled && platformSettings.enabled_platforms?.includes('vk')}
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
                                    Громкость
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
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        // Мгновенное обновление UI без сохранения
                                        const newSettings = {
                                            ...audioSettings,
                                            [listeningMode === 'website' ? 'websiteVolume' : 'obsVolume']: value
                                        };
                                        setAudioSettings(newSettings);
                                    }}
                                    onMouseUp={(e) => handleVolumeChange(
                                        listeningMode === 'website' ? 'websiteVolume' : 'obsVolume', 
                                        parseInt(e.target.value)
                                    )}
                                    onTouchEnd={(e) => handleVolumeChange(
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
                                    saveTTSSettings(newSettings);
                                }}
                            />
                        </div>
                        
                        {/* Twitch смайлы */}
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="enableTwitch" className="text-sm font-medium">
                                    Озвучивать Twitch смайлы
                                </Label>
                            </div>
                            <Switch
                                id="enableTwitch"
                                checked={ttsSettings.enableTwitch}
                                onCheckedChange={(checked) => {
                                    const newSettings = { ...ttsSettings, enableTwitch: checked };
                                    setTtsSettings(newSettings);
                                    saveTTSSettings(newSettings);
                                }}
                            />
                        </div>
                        
                        
                        {/* Фильтрация слов - компактная версия */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="word-filter" className="text-sm font-medium">
                                    Фильтрация слов
                                </Label>
                                <span className="text-xs text-gray-400">Слов: {wordFilter.words.length}</span>
                            </div>
                            
                            {/* Индикатор загрузки */}
                            {wordFilter.loading && (
                                <div className="text-xs text-blue-400">
                                    Загрузка...
                                </div>
                            )}
                            
                            {/* Компактная форма */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Добавить слово"
                                        className="text-sm h-8"
                                        value={wordFilter.newWord}
                                        onChange={(e) => setWordFilter(prev => ({ ...prev, newWord: e.target.value }))}
                                        onKeyPress={(e) => e.key === 'Enter' && addWordToFilter()}
                                    />
                                </div>
                                <div className="w-32">
                                    <select 
                                        className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 h-8"
                                        value={wordFilter.platform}
                                        onChange={(e) => setWordFilter(prev => ({ ...prev, platform: e.target.value }))}
                                    >
                                        <option value="all">Все</option>
                                        <option value="twitch">Twitch</option>
                                        <option value="vk">VK</option>
                                    </select>
                                </div>
                                <Button 
                                    size="sm" 
                                    className="px-3 h-8"
                                    onClick={addWordToFilter}
                                    disabled={!wordFilter.newWord.trim() || wordFilter.loading}
                                >
                                    {wordFilter.loading ? (
                                        <Loader className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Plus className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                            
                            {/* Список заблокированных слов - компактный с возможностью раскрытия */}
                            {wordFilter.loading ? (
                                <div className="space-y-2 bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                    <div className="text-xs text-gray-400 mb-2">Заблокированные слова:</div>
                                    <ListSkeleton count={3} className="space-y-1" />
                                </div>
                            ) : wordFilter.words.length > 0 && (
                                <div className="space-y-2 bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-gray-400">
                                            Заблокированные слова:
                                            {!isWordListExpanded && wordFilter.words.length > 5 && (
                                                <span className="ml-1 text-gray-500">
                                                    (показано 5 из {wordFilter.words.length})
                                                </span>
                                            )}
                                        </div>
                                        {wordFilter.words.length > 5 && (
                                            <button
                                                onClick={() => setIsWordListExpanded(!isWordListExpanded)}
                                                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                            >
                                                {isWordListExpanded ? (
                                                    <>
                                                        Свернуть
                                                        <ChevronUp className="h-3 w-3" />
                                                    </>
                                                ) : (
                                                    <>
                                                        Показать все
                                                        <ChevronDown className="h-3 w-3" />
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(isWordListExpanded ? wordFilter.words : wordFilter.words.slice(0, 5)).map((wordObj, index) => (
                                            <div 
                                                key={wordObj.id || index}
                                                className="flex items-center gap-1 bg-gray-900 px-2 py-1 rounded border border-gray-700 text-xs group hover:border-gray-600 transition-colors"
                                            >
                                                <span className="text-white">{wordObj.word}</span>
                                                <span className="text-gray-500">({wordObj.platform})</span>
                                                <button
                                                    onClick={() => removeWordFromFilter(wordObj.id)}
                                                    className="text-red-500 hover:text-red-400 ml-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    disabled={wordFilter.loading}
                                                    title="Удалить"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                    </div>
                </CardContent>
            </Card>
            
        </div>
        </div>
    );
};

export default TtsMainPageContent;
