// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Clapperboard, Power, PowerOff, BarChart3, Edit3, Tag, Save, RefreshCw, CheckCircle, XCircle, Search, MessageSquare, Check } from 'lucide-react';
import { useIntegrations } from '../hooks/useIntegrations';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { twitchApi } from '../services/twitchApi';
import { vkApi } from '../services/vkApi';
import { ttsApi } from '../services/api';
import { toast } from 'sonner';
import { Loader, LoaderWithText, CardLoader } from '@/components/ui/loader';

// SVG иконки платформ
const TwitchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.714v5.143H11.57zm4.714 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
    </svg>
);

const VKIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48" fill="currentColor">
        <path d="M0 23.04C0 12.1788 0 6.74826 3.37413 3.37413C6.74826 0 12.1788 0 23.04 0H24.96C35.8212 0 41.2517 0 44.6259 3.37413C48 6.74826 48 12.1788 48 23.04V24.96C48 35.8212 48 41.2517 44.6259 44.6259C41.2517 48 35.8212 48 24.96 48H23.04C12.1788 48 6.74826 48 3.37413 44.6259C0 41.2517 0 35.8212 0 24.96V23.04Z" fill="#0077FF"/>
        <path d="M25.54 34.5801C14.6 34.5801 8.3601 27.0801 8.1001 14.2601H13.5801C13.7601 23.5601 17.8201 27.4601 21.0601 28.4601V14.2601H26.1601V22.1401C29.3401 21.7801 32.6601 18.1401 33.7801 14.2601H38.8801C38.0601 19.1201 34.4601 22.7601 31.8201 24.4201C34.4601 25.8801 38.4601 29.1801 40.1001 34.5801H34.4601C33.2201 30.9401 30.2601 28.0601 26.1601 27.6201V34.5801H25.54Z" fill="white"/>
    </svg>
);

const FeatureCard = ({ title, icon, path, enabled = false }) => {
    const navigate = useNavigate();
    return (
        <Card 
            onClick={() => enabled && navigate(path)}
            className={`w-52 h-48 flex flex-col text-center p-4 border-2 border-border/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                enabled 
                    ? 'cursor-pointer hover:bg-muted/80 hover:border-primary/60 bg-card/80' 
                    : 'cursor-not-allowed bg-muted/30 opacity-50 grayscale'
            }`}
        >
            <div className="flex flex-col h-full">
                {/* Иконка прибита к верху */}
                <div className="flex justify-center pt-2 pb-2">
                    {icon}
                </div>
                
                {/* Заголовок */}
                <CardTitle className="text-base font-medium leading-tight mb-4">{title}</CardTitle>
                
                {/* Кнопка перехода */}
                <div className="mt-auto">
                    <Button
                        size="sm"
                        variant={enabled ? "default" : "secondary"}
                        disabled={!enabled}
                        className="w-full text-xs"
                    >
                        Перейти
                    </Button>
                </div>
            </div>
        </Card>
    );
};

const HomePage = () => {
    const { integrations } = useIntegrations();
    const navigate = useNavigate();
    
    // Состояние для графика зрителей
    const [viewersData, setViewersData] = useState([]);
    const [isLoadingViewers, setIsLoadingViewers] = useState(false);
    const [currentViewers, setCurrentViewers] = useState({ twitch: 0, vk: 0 });
    
    // Состояние для смены названия
    const [streamTitle, setStreamTitle] = useState({ twitch: '', vk: '' });
    const [titleStatus, setTitleStatus] = useState({ twitch: 'idle', vk: 'idle' });
    
    // Состояние для смены категории
    const [streamCategory, setStreamCategory] = useState({ twitch: '', vk: '' });
    const [categories, setCategories] = useState({ twitch: [], vk: [] });
    const [categoryStatus, setCategoryStatus] = useState({ twitch: 'idle', vk: 'idle' });
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [categorySearch, setCategorySearch] = useState({ twitch: '', vk: '' });
    const [showCategoryDropdown, setShowCategoryDropdown] = useState({ twitch: false, vk: false });
    
    // Состояние для TTS
    const [ttsStatus, setTtsStatus] = useState({ loaded: false, ready: false });
    const [ttsProgress, setTtsProgress] = useState({ progress: 0, status: 'not_started', message: '' });
    const [isLoadingTts, setIsLoadingTts] = useState(false);
    
    
    // Загружаем реальные данные при монтировании
    useEffect(() => {
        loadStreamData();
        loadCategories();
        loadViewersData();
    }, []);

    // Обновляем данные при изменении интеграций
    useEffect(() => {
        if (integrations.twitch_enabled || integrations.vk_enabled) {
            loadStreamData();
            loadCategories();
            loadViewersData();
        }
    }, [integrations.twitch_enabled, integrations.vk_enabled]);
    
    
    const loadStreamData = async () => {
        setIsLoadingViewers(true);
        try {
            const [twitchData, vkData] = await Promise.all([
                integrations.twitch_enabled ? twitchApi.getStreamInfo() : Promise.resolve(null),
                integrations.vk_enabled ? vkApi.getStreamInfo() : Promise.resolve(null)
            ]);
            
            if (twitchData) {
                setStreamTitle(prev => ({ ...prev, twitch: twitchData.title || '' }));
                setStreamCategory(prev => ({ ...prev, twitch: twitchData.category_id || '' }));
            }
            
            if (vkData) {
                setStreamTitle(prev => ({ ...prev, vk: vkData.title || '' }));
                setStreamCategory(prev => ({ ...prev, vk: vkData.category_id || '' }));
            }
            
            await loadViewersData();
        } catch (error) {
            console.error('Error loading stream data:', error);
        } finally {
            setIsLoadingViewers(false);
        }
    };
    
    const loadViewersData = async () => {
        try {
            const [twitchViewers, vkViewers] = await Promise.all([
                integrations.twitch_enabled ? twitchApi.getViewerCount() : Promise.resolve(0),
                integrations.vk_enabled ? vkApi.getViewerCount() : Promise.resolve(0)
            ]);
            
            setCurrentViewers({ twitch: twitchViewers, vk: vkViewers });
            
            // Добавляем новые данные в график
            const now = new Date();
            const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            setViewersData(prev => {
                const newData = [...prev, { time: timeString, twitch: twitchViewers, vk: vkViewers }];
                // Оставляем только последние 20 точек
                return newData.slice(-20);
            });
        } catch (error) {
            console.error('Error loading viewers data:', error);
        }
    };
    
    const loadCategories = async (search = '') => {
        setIsLoadingCategories(true);
        try {
            const [twitchCats, vkCats] = await Promise.all([
                integrations.twitch_enabled ? twitchApi.getCategories(search) : Promise.resolve([]),
                integrations.vk_enabled ? vkApi.getCategories(search) : Promise.resolve([])
            ]);
            
            setCategories({ twitch: twitchCats, vk: vkCats });
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setIsLoadingCategories(false);
        }
    };

    const handleCategorySearch = async (platform, value) => {
        setCategorySearch(prev => ({ ...prev, [platform]: value }));
        setShowCategoryDropdown(prev => ({ ...prev, [platform]: true }));
        
        if (value.length > 2) {
            await loadCategories(value);
        } else if (value.length === 0) {
            await loadCategories();
        }
    };
    
    const fetchViewersData = async () => {
        await loadViewersData();
    };

    // Закрываем dropdown при клике вне его
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.category-dropdown')) {
                setShowCategoryDropdown({ twitch: false, vk: false });
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Загружаем статус TTS при монтировании
    useEffect(() => {
        loadTtsStatus();
        
        // Слушаем событие сброса TTS при отключении интеграции
        const handleTtsReset = () => {
            setTtsStatus({ loaded: false, ready: false });
            setTtsProgress({ progress: 0, status: 'not_started', message: '' });
            setIsLoadingTts(false);
        };
        
        window.addEventListener('ttsReset', handleTtsReset);
        return () => window.removeEventListener('ttsReset', handleTtsReset);
    }, []);

    // Обновляем данные при изменении интеграций
    useEffect(() => {
        if (integrations.twitch_enabled || integrations.vk_enabled) {
            loadStreamData();
            loadCategories();
            loadViewersData();
        }
    }, [integrations.twitch_enabled, integrations.vk_enabled]);

    // Функции для работы с TTS
    const loadTtsStatus = async () => {
        try {
            const status = await ttsApi.getStatus();
            setTtsStatus(status);
        } catch (error) {
            // Игнорируем ошибки прерывания запроса
            if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
                return;
            }
            console.error('Error loading TTS status:', error);
            setTtsStatus({ loaded: false, ready: false });
        }
    };

    const loadTtsProgress = async () => {
        try {
            const progress = await ttsApi.getProgress();
            setTtsProgress(progress);
        } catch (error) {
            // Игнорируем ошибки прерывания запроса
            if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
                console.log('TTS progress request aborted, ignoring...');
                return;
            }
            console.error('Error loading TTS progress:', error);
            setTtsProgress({ progress: 0, status: 'error', message: 'Ошибка загрузки прогресса' });
        }
    };

    const startTtsLoading = async () => {
        setIsLoadingTts(true);
        let progressInterval = null;
        
        try {
            const result = await ttsApi.loadEngine();
            toast.info('Загрузка TTS движка началась...');
            
            // Начинаем опрос прогресса
            progressInterval = setInterval(async () => {
                try {
                    const progress = await ttsApi.getProgress();
                    setTtsProgress(progress);
                    
                    // Проверяем статус из полученного прогресса
                    if (progress.status === 'ready' || progress.status === 'error') {
                        clearInterval(progressInterval);
                        setIsLoadingTts(false);
                        if (progress.status === 'ready') {
                            toast.success('TTS движок готов к работе!');
                            await loadTtsStatus();
                        } else {
                            toast.error('Ошибка загрузки TTS движка');
                            setTtsStatus({ loaded: false, ready: false });
                        }
                    }
                } catch (progressError) {
                    // Игнорируем ошибки прерывания запроса
                    if (progressError.code === 'ECONNABORTED' || progressError.message === 'Request aborted') {
                        console.log('TTS progress request aborted, continuing...');
                        return;
                    }
                    console.error('Error loading TTS progress:', progressError);
                    clearInterval(progressInterval);
                    setIsLoadingTts(false);
                    toast.error('Ошибка при отслеживании прогресса TTS');
                    setTtsStatus({ loaded: false, ready: false });
                }
            }, 2000); // Увеличиваем интервал до 2 секунд
            
            // Таймаут на случай, если загрузка зависнет
            setTimeout(() => {
                if (progressInterval) {
                    clearInterval(progressInterval);
                    setIsLoadingTts(false);
                    toast.error('Таймаут загрузки TTS. Попробуйте еще раз.');
                    setTtsStatus({ loaded: false, ready: false });
                }
            }, 300000); // 5 минут
            
        } catch (error) {
            console.error('Error starting TTS loading:', error);
            toast.error('Ошибка запуска загрузки TTS');
            setIsLoadingTts(false);
            setTtsStatus({ loaded: false, ready: false });
        }
    };

    const stopTtsLoading = async () => {
        try {
            // Выгружаем TTS из памяти на сервере
            await ttsApi.unloadEngine();
            toast.info('TTS выгружен из памяти');
        } catch (error) {
            console.error('Error unloading TTS:', error);
            toast.error('Ошибка при выгрузке TTS');
        }
        
        setIsLoadingTts(false);
        setTtsStatus({ loaded: false, ready: false });
        setTtsProgress({ progress: 0, status: 'not_started', message: '' });
    };
    
    
    const updateStreamTitle = async (platform) => {
        setTitleStatus(prev => ({ ...prev, [platform]: 'loading' }));
        try {
            let response;
            if (platform === 'twitch') {
                response = await twitchApi.updateStreamTitle(streamTitle.twitch);
            } else {
                response = await vkApi.updateStreamTitle(streamTitle.vk);
            }
            
            if (response.success) {
                setTitleStatus(prev => ({ ...prev, [platform]: 'success' }));
                toast.success(response.message || 'Название обновлено успешно');
                // Сброс статуса через 2 секунды
                setTimeout(() => setTitleStatus(prev => ({ ...prev, [platform]: 'idle' })), 2000);
            } else {
                setTitleStatus(prev => ({ ...prev, [platform]: 'error' }));
                toast.error(response.message || 'Ошибка обновления');
                setTimeout(() => setTitleStatus(prev => ({ ...prev, [platform]: 'idle' })), 3000);
            }
        } catch (error) {
            setTitleStatus(prev => ({ ...prev, [platform]: 'error' }));
            console.error('Error updating title:', error);
            
            // Обрабатываем разные типы ошибок
            let errorMessage = 'Ошибка обновления названия';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            toast.error(errorMessage);
        }
    };
    
    const updateStreamCategory = async (platform) => {
        setCategoryStatus(prev => ({ ...prev, [platform]: 'loading' }));
        try {
            let response;
            if (platform === 'twitch') {
                response = await twitchApi.updateCategory(streamCategory.twitch);
            } else {
                response = await vkApi.updateCategory(streamCategory.vk);
            }
            
            if (response.success) {
                setCategoryStatus(prev => ({ ...prev, [platform]: 'success' }));
                toast.success(response.message || 'Категория обновлена успешно');
                // Сброс статуса через 2 секунды
                setTimeout(() => setCategoryStatus(prev => ({ ...prev, [platform]: 'idle' })), 2000);
            } else {
                setCategoryStatus(prev => ({ ...prev, [platform]: 'error' }));
                toast.error(response.message || 'Ошибка обновления');
                setTimeout(() => setCategoryStatus(prev => ({ ...prev, [platform]: 'idle' })), 3000);
            }
        } catch (error) {
            setCategoryStatus(prev => ({ ...prev, [platform]: 'error' }));
            console.error('Error updating category:', error);
            
            // Обрабатываем разные типы ошибок
            let errorMessage = 'Ошибка обновления категории';
            
            if (error.response?.data) {
                const data = error.response.data;
                
                // Если это массив ошибок (422 Unprocessable Entity)
                if (Array.isArray(data)) {
                    errorMessage = data.map(err => {
                        if (typeof err === 'string') return err;
                        if (typeof err === 'object' && err !== null) {
                            return err.msg || err.message || 'Ошибка валидации';
                        }
                        return 'Ошибка валидации';
                    }).join(', ');
                }
                // Если это объект с полем message
                else if (data.message) {
                    if (typeof data.message === 'string') {
                        errorMessage = data.message;
                    } else if (Array.isArray(data.message)) {
                        errorMessage = data.message.map(err => {
                            if (typeof err === 'string') return err;
                            if (typeof err === 'object' && err !== null) {
                                return err.msg || err.message || 'Ошибка';
                            }
                            return 'Ошибка';
                        }).join(', ');
                    } else if (typeof data.message === 'object' && data.message !== null) {
                        errorMessage = data.message.msg || data.message.detail || 'Ошибка API';
                    }
                }
                // Если это объект с полем detail
                else if (data.detail) {
                    if (typeof data.detail === 'string') {
                        errorMessage = data.detail;
                    } else if (Array.isArray(data.detail)) {
                        errorMessage = data.detail.map(err => {
                            if (typeof err === 'string') return err;
                            if (typeof err === 'object' && err !== null) {
                                return err.msg || err.message || 'Ошибка';
                            }
                            return 'Ошибка';
                        }).join(', ');
                    }
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            toast.error(errorMessage);
            setTimeout(() => setCategoryStatus(prev => ({ ...prev, [platform]: 'idle' })), 3000);
        }
    };
    
    const getStatusIcon = (status) => {
        switch (status) {
            case 'loading': return <Loader size="sm" className="text-purple-500" />;
            case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
            default: return null;
        }
    };
    
    const getStatusText = (status) => {
        switch (status) {
            case 'loading': return 'Обновление...';
            case 'success': return 'Успешно обновлено';
            case 'error': return 'Ошибка обновления';
            default: return '';
        }
    };
    
    return (
        <div className="space-y-8">
            {/* Основные функции */}
            <div className="flex justify-center gap-4 mb-8">
                <Card 
                    className={`w-52 h-48 flex flex-col text-center p-4 border-2 border-border/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                        (integrations.twitch_enabled || integrations.vk_enabled) && ttsStatus.ready
                            ? 'cursor-pointer hover:bg-muted/80 hover:border-primary/60 bg-card/80' 
                            : 'cursor-not-allowed bg-muted/30 opacity-50 grayscale'
                    }`}
                    onClick={() => (integrations.twitch_enabled || integrations.vk_enabled) && ttsStatus.ready && navigate('/dashboard/tts')}
                >
                    <div className="flex flex-col h-full">
                        {/* Иконка прибита к верху */}
                        <div className="flex justify-center pt-2 pb-2">
                            <Mic className="h-12 w-12" />
                        </div>
                        
                        {/* Заголовок */}
                        <CardTitle className="text-base font-medium leading-tight mb-4">TTS ИИ озвучка</CardTitle>
                        
                        {/* Содержимое карточки */}
                        <div className="flex-1 flex flex-col justify-center">
                            {!ttsStatus.loaded || !ttsStatus.ready ? (
                                <div className="w-full space-y-2">
                                    <Button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (integrations.twitch_enabled || integrations.vk_enabled) {
                                                startTtsLoading();
                                            }
                                        }}
                                        disabled={isLoadingTts || !(integrations.twitch_enabled || integrations.vk_enabled)}
                                        size="sm"
                                        className="w-full"
                                    >
                                        {isLoadingTts ? <Loader size="sm" /> : 
                                         !(integrations.twitch_enabled || integrations.vk_enabled) ? 'Сначала включите интеграцию' : 
                                         'Включить озвучку чата'}
                                    </Button>
                                    <div className="w-full bg-muted rounded-full h-1">
                                        <div 
                                            className="bg-primary h-1 rounded-full transition-all duration-300"
                                            style={{ width: `${ttsProgress.progress || 0}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                        {isLoadingTts ? `Загрузка... ${ttsProgress.progress || 0}%` : 'Готов к загрузке'}
                                    </p>
                                </div>
                            ) : !ttsStatus.ready ? (
                                <div className="w-full space-y-2">
                                    <div className="text-xs text-muted-foreground">{ttsProgress.message}</div>
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div 
                                            className="bg-primary h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${ttsProgress.progress}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {ttsProgress.progress}% • {ttsProgress.message.includes('кэше') ? 'Инициализация' : 'Загрузка моделей'}
                                    </div>
                                    {ttsProgress.status === 'error' && (
                                        <Button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                startTtsLoading();
                                            }}
                                            size="sm"
                                            variant="outline"
                                            className="w-full"
                                        >
                                            Попробовать снова
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-xs text-green-600 font-medium text-center group">
                                    {/* Статус "Работает" - скрывается при наведении */}
                                    <div className="group-hover:hidden">
                                        <div className="flex items-center justify-center space-x-1">
                                            <Check className="w-4 h-4 text-green-500 animate-in zoom-in-50 duration-500" />
                                            <span>Работает</span>
                                        </div>
                                    </div>
                                    
                                    {/* Кнопка отключения - появляется при наведении */}
                                    <div className="hidden group-hover:block">
                                        <Button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                stopTtsLoading();
                                            }}
                                            size="sm"
                                            variant="destructive"
                                            className="w-full text-xs"
                                        >
                                            Отключить
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
                <FeatureCard 
                    title="Медиа интерактивность"
                    icon={<Clapperboard className="h-12 w-12" />}
                    path="/dashboard/media"
                    enabled={integrations.twitch_enabled || integrations.vk_enabled}
                />
                <FeatureCard 
                    title="Анализ и модерация чата"
                    icon={<MessageSquare className="h-12 w-12" />}
                    path="/dashboard/analytics"
                    enabled={integrations.twitch_enabled || integrations.vk_enabled}
                />
            </div>
            
            {/* Основные функции в один ряд */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Онлайн статус */}
                <Card className={`transition-all duration-300 ${
                    integrations.twitch_enabled || integrations.vk_enabled 
                        ? 'border-green-500/50 bg-green-500/5 shadow-lg' 
                        : 'border-muted/30 bg-muted/20 opacity-60'
                }`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className={`h-6 w-6 ${
                                integrations.twitch_enabled || integrations.vk_enabled 
                                    ? 'text-green-500' 
                                    : 'text-muted-foreground'
                            }`} />
                            {currentViewers.twitch > 0 || currentViewers.vk > 0 ? 'Онлайн' : 'Офлайн'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {integrations.twitch_enabled || integrations.vk_enabled ? (
                            <>
                                <div className="h-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={viewersData}>
                                            <Line 
                                                type="monotone" 
                                                dataKey="twitch" 
                                                stroke="#8b5cf6" 
                                                strokeWidth={2}
                                                dot={false}
                                                name="Twitch"
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="vk" 
                                                stroke="#3b82f6" 
                                                strokeWidth={2}
                                                dot={false}
                                                name="VK Live"
                                            />
                                            <Tooltip 
                                                contentStyle={{
                                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: 'white'
                                                }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                            <span className="text-sm">T: {currentViewers.twitch}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                            <span className="text-sm">V: {currentViewers.vk}</span>
                                        </div>
                                    </div>
                                    <Button onClick={fetchViewersData} disabled={isLoadingViewers} size="sm" variant="outline">
                                        {isLoadingViewers ? <Loader size="sm" /> : <RefreshCw className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-center">
                                <div className="space-y-2">
                                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
                                    <p className="text-sm text-muted-foreground">Подключите интеграции для просмотра статистики</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                {/* Смена названия */}
                <Card className={`transition-all duration-300 ${
                    integrations.twitch_enabled || integrations.vk_enabled 
                        ? 'border-blue-500/50 bg-blue-500/5 shadow-lg' 
                        : 'border-muted/30 bg-muted/20 opacity-60'
                }`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Edit3 className={`h-6 w-6 ${
                                integrations.twitch_enabled || integrations.vk_enabled 
                                    ? 'text-blue-500' 
                                    : 'text-muted-foreground'
                            }`} />
                            Смена названия
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {integrations.twitch_enabled || integrations.vk_enabled ? (
                            <>
                                {/* Twitch */}
                                {integrations.twitch_enabled && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                                                <TwitchIcon />
                                            </div>
                                            <span className="text-base font-bold">Twitch</span>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <Input
                                                value={streamTitle.twitch}
                                                onChange={(e) => setStreamTitle(prev => ({ ...prev, twitch: e.target.value }))}
                                                placeholder="Название стрима"
                                                maxLength={140}
                                                className="text-sm h-10"
                                            />
                                            
                                            <div className="flex justify-center">
                                                <Button 
                                                    onClick={() => updateStreamTitle('twitch')} 
                                                    disabled={!streamTitle.twitch.trim() || titleStatus.twitch === 'loading'}
                                                    size="lg"
                                                    className="w-full h-12 text-base font-semibold"
                                                >
                                                    {titleStatus.twitch === 'loading' ? (
                                                        <Loader size="sm" />
                                                    ) : titleStatus.twitch === 'success' ? (
                                                        <div className="flex items-center gap-2">
                                                            <Check className="h-5 w-5 text-green-500" />
                                                            <span>Сохранено!</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Save className="h-5 w-5 mr-2" />
                                                            Сохранить
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            
                                            {getStatusText(titleStatus.twitch) && (
                                                <div className="flex items-center justify-center gap-2">
                                                    {getStatusIcon(titleStatus.twitch)}
                                                    <span className="text-sm">{getStatusText(titleStatus.twitch)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {/* VK Live */}
                                {integrations.vk_enabled && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                                                <VKIcon />
                                            </div>
                                            <span className="text-base font-bold">VK Live</span>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <Input
                                                value={streamTitle.vk}
                                                onChange={(e) => setStreamTitle(prev => ({ ...prev, vk: e.target.value }))}
                                                placeholder="Название стрима"
                                                maxLength={100}
                                                className="text-sm h-10"
                                            />
                                            
                                            <div className="flex justify-center">
                                                <Button 
                                                    onClick={() => updateStreamTitle('vk')} 
                                                    disabled={!streamTitle.vk.trim() || titleStatus.vk === 'loading'}
                                                    size="lg"
                                                    className="w-full h-12 text-base font-semibold"
                                                >
                                                    {titleStatus.vk === 'loading' ? (
                                                        <Loader size="sm" />
                                                    ) : titleStatus.vk === 'success' ? (
                                                        <div className="flex items-center gap-2">
                                                            <Check className="h-5 w-5 text-green-500" />
                                                            <span>Сохранено!</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Save className="h-5 w-5 mr-2" />
                                                            Сохранить
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            
                                            {getStatusText(titleStatus.vk) && (
                                                <div className="flex items-center justify-center gap-2">
                                                    {getStatusIcon(titleStatus.vk)}
                                                    <span className="text-sm">{getStatusText(titleStatus.vk)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-32 flex items-center justify-center text-center">
                                <div className="space-y-2">
                                    <Edit3 className="h-12 w-12 text-muted-foreground mx-auto" />
                                    <p className="text-sm text-muted-foreground">Подключите интеграции для смены названия</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                {/* Смена категории */}
                <Card className={`transition-all duration-300 ${
                    integrations.twitch_enabled || integrations.vk_enabled 
                        ? 'border-purple-500/50 bg-purple-500/5 shadow-lg' 
                        : 'border-muted/30 bg-muted/20 opacity-60'
                }`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Tag className={`h-6 w-6 ${
                                integrations.twitch_enabled || integrations.vk_enabled 
                                    ? 'text-purple-500' 
                                    : 'text-muted-foreground'
                            }`} />
                            Смена категории
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {integrations.twitch_enabled || integrations.vk_enabled ? (
                            <>
                                {/* Twitch */}
                                {integrations.twitch_enabled && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                                                <TwitchIcon />
                                            </div>
                                            <span className="text-base font-bold">Twitch</span>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div className="relative category-dropdown">
                                                <Input
                                                    value={categorySearch.twitch}
                                                    onChange={(e) => handleCategorySearch('twitch', e.target.value)}
                                                    onFocus={() => setShowCategoryDropdown(prev => ({ ...prev, twitch: true }))}
                                                    placeholder="Поиск категории..."
                                                    className="text-sm h-10"
                                                />
                                                {showCategoryDropdown.twitch && categories.twitch.length > 0 && (
                                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                        {categories.twitch.map((category) => (
                                                            <div
                                                                key={category.id}
                                                                onClick={() => {
                                                                    setStreamCategory(prev => ({ ...prev, twitch: category.id }));
                                                                    setCategorySearch(prev => ({ ...prev, twitch: category.name }));
                                                                    setShowCategoryDropdown(prev => ({ ...prev, twitch: false }));
                                                                }}
                                                                className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer"
                                                            >
                                                                <span className="text-sm">{category.name}</span>
                                                                <Badge variant="secondary" className="ml-2 text-xs">
                                                                    {category.viewers?.toLocaleString() || 0}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex justify-center">
                                                <Button 
                                                    onClick={() => updateStreamCategory('twitch')} 
                                                    disabled={!streamCategory.twitch || categoryStatus.twitch === 'loading'}
                                                    size="lg"
                                                    className="w-full h-12 text-base font-semibold"
                                                >
                                                    {categoryStatus.twitch === 'loading' ? (
                                                        <Loader size="sm" />
                                                    ) : categoryStatus.twitch === 'success' ? (
                                                        <div className="flex items-center gap-2">
                                                            <Check className="h-5 w-5 text-green-500" />
                                                            <span>Сохранено!</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Save className="h-5 w-5 mr-2" />
                                                            Сохранить
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            
                                            {getStatusText(categoryStatus.twitch) && (
                                                <div className="flex items-center justify-center gap-2">
                                                    {getStatusIcon(categoryStatus.twitch)}
                                                    <span className="text-sm">{getStatusText(categoryStatus.twitch)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                        
                                {/* VK Live */}
                                {integrations.vk_enabled && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                                                <VKIcon />
                                            </div>
                                            <span className="text-base font-bold">VK Live</span>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <Select 
                                                value={streamCategory.vk} 
                                                onValueChange={(value) => setStreamCategory(prev => ({ ...prev, vk: value }))}
                                            >
                                                <SelectTrigger className="text-sm h-10">
                                                    <SelectValue placeholder="Выберите категорию" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.vk.map((category) => (
                                                        <SelectItem key={category.id} value={category.id}>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="text-sm">{category.name}</span>
                                                                <Badge variant="secondary" className="ml-2 text-xs">
                                                                    {category.viewers?.toLocaleString() || 0}
                                                                </Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            
                                            <div className="flex justify-center">
                                                <Button 
                                                    onClick={() => updateStreamCategory('vk')} 
                                                    disabled={!streamCategory.vk || categoryStatus.vk === 'loading'}
                                                    size="lg"
                                                    className="w-full h-12 text-base font-semibold"
                                                >
                                                    {categoryStatus.vk === 'loading' ? (
                                                        <Loader size="sm" />
                                                    ) : categoryStatus.vk === 'success' ? (
                                                        <div className="flex items-center gap-2">
                                                            <Check className="h-5 w-5 text-green-500" />
                                                            <span>Сохранено!</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Save className="h-5 w-5 mr-2" />
                                                            Сохранить
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            
                                            {getStatusText(categoryStatus.vk) && (
                                                <div className="flex items-center justify-center gap-2">
                                                    {getStatusIcon(categoryStatus.vk)}
                                                    <span className="text-sm">{getStatusText(categoryStatus.vk)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-32 flex items-center justify-center text-center">
                                <div className="space-y-2">
                                    <Tag className="h-12 w-12 text-muted-foreground mx-auto" />
                                    <p className="text-sm text-muted-foreground">Подключите интеграции для смены категории</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
        </div>
    );
};

export default HomePage;
