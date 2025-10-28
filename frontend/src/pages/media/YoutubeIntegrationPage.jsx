import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, Plus, X, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from 'sonner';
import YouTube from 'react-youtube';
import { usePlayer } from '../../context/PlayerContext';
import { useChat } from '../../context/ChatContext';
import api from '../../services/api';
import { youtubeLogger as logger } from '../../utils/logger';

const YoutubeIntegrationPage = () => {
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
        setPlayerRef
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

    // Загрузка настроек YouTube
    const loadYoutubeSettings = async () => {
        try {
            const response = await api.get('/api/tts/youtube-settings');
            setPlaybackMode(response.data.playback_mode || 'browser');
            setVolume([response.data.volume_level || 100]); // По умолчанию 100% для синхронизации
        } catch (error) {
            console.error('Error loading YouTube settings:', error);
        }
    };

    // Сохранение настроек YouTube
    const saveYoutubeSettings = async (newPlaybackMode, newVolume) => {
        try {
            await api.post('/api/tts/youtube-settings', {
                playback_mode: newPlaybackMode,
                volume_level: newVolume
            });
            toast.success('Настройки YouTube сохранены');
        } catch (error) {
            console.error('Error saving YouTube settings:', error);
            toast.error('Ошибка сохранения настроек YouTube');
        }
    };

    // Генерация URL для YouTube OBS
    const generateYoutubeObsUrl = async () => {
        try {
            const response = await api.post('/api/youtube/generate-obs-url');
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
            console.error('Error generating YouTube OBS URL:', error);
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
            console.error('Error regenerating YouTube OBS URL:', error);
            toast.error('Ошибка перегенерации YouTube OBS URL');
            return null;
        }
    };

    // Скрытие URL
    const hideObsUrl = () => {
        setIsObsUrlVisible(false);
        toast.success('OBS URL скрыт');
    };

    // Загрузка существующего OBS URL
    const loadExistingObsUrl = async () => {
        try {
            const response = await api.get('/api/tts/obs-url');
            if (response.data.obs_token) {
                const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
                const url = `${frontendUrl}/youtube-obs/${response.data.obs_token}`;
                setYoutubeObsUrl(url);
                setIsObsUrlVisible(false); // По умолчанию скрыт
            }
        } catch (error) {
            console.error('Error loading existing OBS URL:', error);
        }
    };

    useEffect(() => {
        loadYoutubeSettings();
        loadExistingObsUrl();
    }, []);

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
                toast.info("Очередь видео обновлена!");
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
            console.error("Error clearing queue:", error);
        }
    };

    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
    };
    
    // Обработчик клика на пустое место в полноэкранном режиме
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && isTheaterMode) {
            setIsTheaterMode(false);
        }
    };

    return (
        <div 
            className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 bg-black z-50 p-2' : 'container mx-auto px-4 py-6 max-w-6xl h-[calc(100vh-8rem)]'}`}
            onClick={handleBackdropClick}
            style={isTheaterMode ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 } : {}}
        >
            <div className={`w-full h-full ${isTheaterMode ? '' : ''}`}>
                <Card className={`transition-all duration-300 w-full ${isTheaterMode ? 'bg-black border-none h-full' : 'h-full flex flex-col'}`}>
                    <CardContent className={`${isTheaterMode ? 'grid grid-cols-5 gap-6 h-full' : 'flex flex-col gap-4 h-full'} p-6`}>
                        {/* Компактный блок управления (только для обычного режима) */}
                        {!isTheaterMode && (
                            <div className="space-y-3">
                                {/* Информация о текущем видео - КОМПАКТНО */}
                                {playbackMode === 'browser' ? (
                                    <div className="relative bg-black rounded-lg overflow-hidden h-[150px]">
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
                                    <div className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-purple-500 h-[150px]">
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

                            {/* Компактная панель управления */}
                            <div className="flex flex-wrap items-center gap-2 bg-muted/30 rounded-lg p-2">
                                {/* Play/Pause & Skip */}
                                <Button variant="ghost" size="sm" onClick={togglePlayPause} disabled={!currentVideo} className="h-8 w-8 p-0" title={isPlaying ? "Пауза" : "Воспроизвести"}>
                                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={nextVideo} disabled={!currentVideo} className="h-8 w-8 p-0" title="Пропустить">
                                    <SkipForward className="h-4 w-4" />
                                </Button>

                                <div className="h-5 w-px bg-border mx-1" />

                                {/* Громкость */}
                                <Button variant="ghost" size="sm" onClick={toggleMute} className="h-8 w-8 p-0" title={isMuted ? "Включить звук" : "Выключить звук"}>
                                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                </Button>
                                <Slider value={[volume]} onValueChange={handleVolumeChange} max={100} step={1} className="w-16" />
                                <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>

                                <div className="h-5 w-px bg-border mx-1" />

                                {/* Очистить */}
                                <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8" title="Очистить очередь">
                                            <X className="h-4 w-4 mr-1" />
                                            <span className="text-xs">Очистить</span>
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

                                <div className="h-5 w-px bg-border mx-1" />

                                {/* OBS URL */}
                                <Button variant="ghost" size="sm" className="h-8" onClick={() => {
                                    if (!youtubeObsUrl) generateYoutubeObsUrl();
                                    else if (isObsUrlVisible) hideObsUrl();
                                    else setIsObsUrlVisible(true);
                                }} title={!youtubeObsUrl ? "OBS URL" : isObsUrlVisible ? "Скрыть" : "Показать"}>
                                    <span className="text-xs">OBS URL</span>
                                </Button>

                                {/* Fullscreen */}
                                <Button variant="ghost" size="sm" className="h-8" onClick={() => {
                                    const newTheaterMode = !isTheaterMode;
                                    setIsTheaterMode(newTheaterMode);
                                    window.dispatchEvent(new CustomEvent('youtube_event', {
                                        detail: { event: 'theater_mode_changed', data: { isTheaterMode: newTheaterMode } }
                                    }));
                                }} title="Полноэкранный режим">
                                    <Maximize className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Полноэкранный</span>
                                </Button>
                            </div>
                            
                            {/* Кнопка обновления URL (если URL существует) */}
                            {youtubeObsUrl && (
                                <div className="mt-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={regenerateYoutubeObsUrl}
                                        title="Перегенерировать новый OBS URL"
                                    >
                                        🔄 Обновить URL
                                    </Button>
                                </div>
                            )}
                            
                            {/* OBS URL (если сгенерирован и видим) */}
                            {youtubeObsUrl && isObsUrlVisible && (
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 mt-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-400 mb-1">OBS Browser Source URL:</p>
                                            <p className="text-xs text-gray-300 font-mono break-all">{youtubeObsUrl}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                navigator.clipboard.writeText(youtubeObsUrl);
                                                toast.success('URL скопирован!');
                                            }}
                                            className="flex-shrink-0"
                                        >
                                            📋 Копировать
                                        </Button>
                                    </div>
                                </div>
                            )}
                            </div>
                        )}

                        {/* Fullscreen mode layout */}
                        {isTheaterMode && (
                            <div className="col-span-4 space-y-4">
                                {/* Fullscreen player content */}
                                <div className="aspect-video bg-black rounded-lg"></div>
                            </div>
                        )}

                        <div className={`flex flex-col ${isTheaterMode ? 'col-span-1 h-full' : 'w-full flex-1'}`}>
                            <Card className={isTheaterMode ? 'flex-1 flex flex-col' : 'flex-1 flex flex-col h-full'}>
                                <CardHeader className="pb-3">
                                    <CardTitle>Очередь ({queue.length})</CardTitle>
                                </CardHeader>
                                <CardContent className={`p-0 flex-1 overflow-y-auto`}>
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
            </div>
        </div>
    );
};

export default YoutubeIntegrationPage;

