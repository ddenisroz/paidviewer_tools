import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipForward, Volume2, VolumeX, Plus, X, Maximize, Minimize, Monitor, Trash2, RefreshCw, Settings, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { toast } from 'sonner';
import YouTube from 'react-youtube';
import { usePlayer } from '../../context/PlayerContext';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { youtubeService } from '../../services/api/services/youtubeService';
import { logger } from '../../utils/prodLogger';
import PageWrapper from '../../components/PageWrapper';

const YoutubeIntegrationPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const {
        currentVideo,
        isPlaying,
        volume,
        isMuted,
        isTheaterMode,
        queue,
        togglePlayPause,
        setVolume,
        toggleMute,
        nextVideo,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        setPlayerRef,
        setIsTheaterMode,
        loadQueue
    } = usePlayer();
    
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [playbackMode, setPlaybackMode] = useState('browser'); // browser или obs
    const [youtubeObsUrl, setYoutubeObsUrl] = useState('');
    const [isObsUrlVisible, setIsObsUrlVisible] = useState(false);
    const { lastJsonMessage } = useChat();
    
    // Пагинация больше не нужна - очередь теперь на всю высоту
    // const [currentPage, setCurrentPage] = useState(1);
    // const itemsPerPage = 5;
    // const totalPages = Math.ceil(queue.length / itemsPerPage);
    // const paginatedQueue = queue.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Обработчик готовности плеера с установкой ссылки
    const handlePlayerReadyWithRef = (event) => {
        setPlayerRef(event.target);
        handlePlayerReady(event);
    };

    // ✅ ОПТИМИЗАЦИЯ: Мемоизируем функцию для стабильности зависимостей
    const loadYoutubeSettings = useCallback(async () => {
        try {
            const response = await youtubeService.getSettings();
            setPlaybackMode(response.data.playback_mode || 'browser');
            setVolume([response.data.volume_level || 100]); // По умолчанию 100% для синхронизации
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    }, []);

    // Сохранение настроек YouTube
    const saveYoutubeSettings = async (newPlaybackMode, newVolume) => {
        try {
            await youtubeService.saveSettings({
                playback_mode: newPlaybackMode,
                volume_level: newVolume
            });
            toast.success('Настройки YouTube сохранены');
        } catch (error) {
            logger.error('Error saving YouTube settings:', error);
            toast.error('Ошибка сохранения настроек YouTube');
        }
    };

    // Генерация URL для YouTube OBS
    const generateYoutubeObsUrl = async () => {
        try {
            const response = await youtubeService.generateObsUrl();
            const url = response.data.youtube_obs_url;
            setYoutubeObsUrl(url);
            setIsObsUrlVisible(true);
            
            // Показываем URL пользователю и предлагаем скопировать
            toast.success('OBS URL сгенерирован!', {
                description: 'URL скопирован в буфер обмена',
                action: {
                    label: 'Скопировать',
                    onClick: () => {
                        navigator.clipboard.writeText(url);
                        toast.success('URL скопирован!');
                    }
                }
            });
            
            // Автоматически копируем в буфер обмена
            navigator.clipboard.writeText(url);
            
            return url;
        } catch (error) {
            logger.error('Error generating YouTube OBS URL:', error);
            toast.error('Ошибка создания YouTube OBS URL');
            return null;
        }
    };

    // Перегенерация URL для YouTube OBS
    const regenerateYoutubeObsUrl = async () => {
        try {
            const response = await api.post('/api/youtube/regenerate-obs-url');
            const url = response.data.youtube_obs_url;
            setYoutubeObsUrl(url);
            setIsObsUrlVisible(true);
            
            toast.success('OBS URL перегенерирован!', {
                description: 'Новый URL скопирован в буфер обмена'
            });
            
            // Автоматически копируем в буфер обмена
            navigator.clipboard.writeText(url);
            
            return url;
        } catch (error) {
            logger.error('Error regenerating YouTube OBS URL:', error);
            toast.error('Ошибка перегенерации YouTube OBS URL');
            return null;
        }
    };

    // Скрытие URL
    const hideObsUrl = () => {
        setIsObsUrlVisible(false);
        toast.success('OBS URL скрыт');
    };

    // ✅ ОПТИМИЗАЦИЯ: Мемоизируем функцию для стабильности зависимостей
    const loadExistingObsUrl = useCallback(async () => {
        try {
            const response = await api.get('/api/tts/obs-url');
            if (response.data.obs_token) {
                const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
                const url = `${frontendUrl}/youtube-obs/${response.data.obs_token}`;
                setYoutubeObsUrl(url);
                setIsObsUrlVisible(false); // По умолчанию скрыт
            }
        } catch (error) {
            logger.error('Error loading existing OBS URL:', error);
        }
    }, []);

    useEffect(() => {
        loadYoutubeSettings();
        loadExistingObsUrl();
    }, [loadYoutubeSettings, loadExistingObsUrl]); // ✅ Добавляем функции в зависимости

    // Обработчик клавиши Esc для выхода из полноэкранного режима
    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape' && isTheaterMode) {
                setIsTheaterMode(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [isTheaterMode]);

    // Обновляем очередь при получении сообщения по WebSocket
    useEffect(() => {
        if (lastJsonMessage) {
            if (lastJsonMessage.type === 'youtube_queue_update') {
                // Received youtube_queue_update from WebSocket, reloading queue
                // Молча обновляем - не спамим уведомлениями
                logger.log('📺 [YouTube] Queue updated via WebSocket');
            }
        }
    }, [lastJsonMessage]);

    const handleClearQueue = async () => {
        try {
            await api.post('/api/youtube/clear');
            toast.success("Очередь очищена.");
            setIsClearDialogOpen(false); // Закрываем диалог
            loadQueue();
        } catch (error) {
            if (error.response?.status === 429) {
                toast.error("Слишком много запросов. Попробуйте через несколько секунд.");
            } else if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS')) {
                toast.error("Ошибка сети. Проверьте подключение к серверу.");
            } else {
                toast.error("Не удалось очистить очередь.");
            }
            logger.error("Error clearing queue:", error);
        }
    };

    const handleVolumeChange = (value) => {
        const newVolume = value[0];
        setVolume(newVolume);
    };
    
    // Обработчик клика на пустое место в полноэкранном режиме
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && isTheaterMode) {
            setIsTheaterMode(false);
        }
    };

    // 🔒 ПЕРВООЧЕРЕДНАЯ ПРОВЕРКА: Авторизация
    // Если пользователь не авторизован - показываем сообщение с предложением войти
    if (!isAuthenticated) {
        return (
            <PageWrapper title="YouTube заказы">
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
                                Для использования YouTube заказов необходимо войти в систему и подключить хотя бы одну платформу (Twitch или VK Live)
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

    return (
        <div 
            className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 bg-black z-50 p-2' : 'container mx-auto px-4 py-6 max-w-6xl h-[calc(100vh-8rem)]'}`}
            onClick={handleBackdropClick}
            style={isTheaterMode ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 } : {}}
        >
            {/* Обычный режим - две отдельные карточки */}
            {!isTheaterMode ? (
                <div className="flex flex-col gap-4 h-full">
                    {/* Карточка 1: Плеер и управление */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex gap-4">
                                {/* Плеер слева (оптимальный размер) */}
                                <div className="w-[360px] flex-shrink-0">
                                    {playbackMode === 'browser' ? (
                                        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                                            {currentVideo ? (
                                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                                    <div className="text-center px-4">
                                                        <p className="text-muted-foreground text-xs mb-1">Видео воспроизводится в глобальном плеере</p>
                                                        <p className="text-xs text-muted-foreground/70">Управление доступно в мини-плеере внизу страницы</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                                    <p className="text-muted-foreground text-xs">Нет видео для воспроизведения.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-purple-500 aspect-video">
                                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-3">
                                                <div className="text-3xl mb-1">📹</div>
                                                <h3 className="text-sm font-medium text-purple-300 mb-1">Режим OBS Studio</h3>
                                                <p className="text-gray-300 text-xs">
                                                    Видео воспроизводятся в OBS Studio
                                                </p>
                                                {currentVideo && (
                                                    <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded mt-1 max-w-full truncate">
                                                        <strong>Играет:</strong> {currentVideo.title}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Панель управления справа */}
                                <div className="flex-1 space-y-3">
                                    {/* Группа 1: Воспроизведение и громкость */}
                                    <div className="bg-muted/30 rounded-lg p-3">
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={togglePlayPause} disabled={!currentVideo} className="h-10 w-10 p-0" title={isPlaying ? "Пауза" : "Воспроизвести"}>
                                                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={nextVideo} disabled={!currentVideo} className="h-10 w-10 p-0" title="Пропустить">
                                                <SkipForward className="h-5 w-5" />
                                            </Button>
                                            <div className="h-6 w-px bg-border mx-2" />
                                            <Button variant="ghost" size="sm" onClick={toggleMute} className="h-10 w-10 p-0" title={isMuted ? "Включить звук" : "Выключить звук"}>
                                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                            </Button>
                                            <div className="flex-1 flex items-center gap-2 mx-2">
                                                <Slider value={[volume]} onValueChange={handleVolumeChange} max={100} step={1} className="flex-1" />
                                                <span className="text-xs text-muted-foreground w-12 text-right">{volume}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Группа 2: Действия - крупные кнопки */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Очистить очередь */}
                                        <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="h-12 w-full" title="Очистить очередь">
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Очистить
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Подтверждение</DialogTitle>
                                                    <DialogDescription>Вы уверены, что хотите полностью очистить очередь?</DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>Отмена</Button>
                                                    <Button variant="destructive" onClick={handleClearQueue}>Очистить</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        {/* OBS Integration - Popover с управлением */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="h-12 w-full" title="OBS интеграция">
                                                    <Monitor className="h-4 w-4 mr-2" />
                                                    OBS
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-96" align="end">
                                                <div className="space-y-3">
                                                    <h4 className="font-semibold text-sm">OBS Browser Source</h4>
                                                    
                                                    {!youtubeObsUrl ? (
                                                        <Button 
                                                            onClick={generateYoutubeObsUrl} 
                                                            className="w-full"
                                                            variant="default"
                                                        >
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            Сгенерировать URL
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <div className="space-y-2">
                                                                <p className="text-xs text-muted-foreground">URL для OBS:</p>
                                                                <div className="bg-muted rounded p-2">
                                                                    <p className="text-xs font-mono break-all">{youtubeObsUrl}</p>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(youtubeObsUrl);
                                                                            toast.success('URL скопирован!');
                                                                        }}
                                                                        className="flex-1"
                                                                    >
                                                                        Копировать
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={regenerateYoutubeObsUrl}
                                                                        className="flex-1"
                                                                        title="Перегенерировать URL"
                                                                    >
                                                                        <RefreshCw className="h-3 w-3 mr-1" />
                                                                        Обновить
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        {/* Fullscreen */}
                                        <Button 
                                            variant="outline" 
                                            className="h-12 w-full col-span-2" 
                                            onClick={() => {
                                                const newTheaterMode = !isTheaterMode;
                                                setIsTheaterMode(newTheaterMode);
                                                window.dispatchEvent(new CustomEvent('youtube_event', {
                                                    detail: { event: 'theater_mode_changed', data: { isTheaterMode: newTheaterMode } }
                                                }));
                                            }} 
                                            title="Полноэкранный режим"
                                        >
                                            {isTheaterMode ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                                            {isTheaterMode ? 'Выйти из полного экрана' : 'Полноэкранный режим'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Карточка 2: Очередь */}
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3">
                            <CardTitle>Очередь ({queue.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto">
                            {currentVideo && (
                                <div className="p-4 border-b bg-muted/20">
                                    <p className="text-xs text-muted-foreground mb-2">Сейчас играет:</p>
                                    <div className="flex gap-3 p-2 rounded-lg">
                                        <img src={currentVideo.thumbnail_url} alt={currentVideo.title} className="w-20 h-12 object-cover rounded"/>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm line-clamp-2">{currentVideo.title}</h4>
                                            <p className="text-xs text-muted-foreground">от {currentVideo.requester_name || currentVideo.user_id || 'Unknown'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {queue.length > 0 ? (
                                <div className="p-4 space-y-3">
                                    {queue.map((video, index) => {
                                        return (
                                            <div key={video.id} className="flex gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                                                <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                                                    {index + 1}
                                                </div>
                                                <img src={video.thumbnail_url} alt={video.title} className="w-20 h-12 object-cover rounded"/>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                    <p className="text-xs text-muted-foreground">заказал: {video.requester_name || video.user_id || 'Unknown'}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground p-4">
                                    <div className="text-4xl mb-4">🎵</div>
                                    <p className="font-medium text-base mb-2">Очередь пуста</p>
                                    <p className="text-sm text-muted-foreground">
                                        Очередь пуста. Зрители могут добавлять видео командой !sr
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                /* Fullscreen mode layout */
                <Card className="transition-all duration-300 w-full bg-black border-none h-full">
                    <CardContent className="grid grid-cols-5 gap-6 h-full p-6">
                        <div className="col-span-4 space-y-4">
                            {/* Кнопка выхода из театрального режима */}
                            <div className="flex justify-end">
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                        setIsTheaterMode(false);
                                        window.dispatchEvent(new CustomEvent('youtube_event', {
                                            detail: { event: 'theater_mode_changed', data: { isTheaterMode: false } }
                                        }));
                                    }}
                                >
                                    <Minimize className="h-4 w-4 mr-2" />
                                    Выйти из полного экрана
                                </Button>
                            </div>
                            {/* Fullscreen player content */}
                            <div className="aspect-video bg-black rounded-lg"></div>
                        </div>

                        <div className="col-span-1 h-full">
                            <Card className="flex-1 flex flex-col h-full">
                                <CardHeader className="pb-3">
                                    <CardTitle>Очередь ({queue.length})</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 overflow-y-auto">
                                    {currentVideo && (
                                        <div className="p-4 border-b bg-muted/20">
                                            <p className="text-xs text-muted-foreground mb-2">Сейчас играет:</p>
                                            <div className="flex gap-3 p-2 rounded-lg">
                                                <img src={currentVideo.thumbnail_url} alt={currentVideo.title} className="w-20 h-12 object-cover rounded"/>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm line-clamp-2">{currentVideo.title}</h4>
                                                    <p className="text-xs text-muted-foreground">от {currentVideo.requester_name || currentVideo.user_id || 'Unknown'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {queue.length > 0 ? (
                                        <div className="p-4 space-y-3">
                                            {queue.map((video, index) => {
                                                return (
                                                    <div key={video.id} className="flex gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                                                        <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                                                            {index + 1}
                                                        </div>
                                                        <img src={video.thumbnail_url} alt={video.title} className="w-20 h-12 object-cover rounded"/>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                            <p className="text-xs text-muted-foreground">заказал: {video.requester_name || video.user_id || 'Unknown'}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground p-4">
                                            <div className="text-4xl mb-4">🎵</div>
                                            <p className="font-medium text-base mb-2">Очередь пуста</p>
                                            <p className="text-sm text-muted-foreground">
                                                Очередь пуста. Зрители могут добавлять видео командой !sr
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default YoutubeIntegrationPage;

