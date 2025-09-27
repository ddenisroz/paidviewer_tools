import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, Plus, X, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from 'sonner';
import YouTube from 'react-youtube';
import api from '../../services/api';
import { useChat } from '../../context/ChatContext';

const YoutubeIntegrationPage = () => {
    const [queue, setQueue] = useState([]);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [volume, setVolume] = useState([50]);
    const [isMuted, setIsMuted] = useState(false);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [playbackMode, setPlaybackMode] = useState('browser'); // browser или obs
    const [youtubeObsUrl, setYoutubeObsUrl] = useState('');
    const [isObsUrlVisible, setIsObsUrlVisible] = useState(false);
    const playerRef = useRef(null);
    const { lastJsonMessage } = useChat();

    const loadQueue = async () => {
        try {
            const { data } = await api.get('/api/youtube/queue');
            console.log('YouTube queue data:', data); // Debug log
            
            setQueue(data.queue || []);
            setCurrentVideo(data.current_video || null);
            setIsPlaying(data.is_playing || false);
        } catch (error) {
            console.error('Error loading YouTube queue:', error);
            
            // Не показываем toast для 429 ошибок (rate limiting)
            if (error.response?.status === 429) {
                console.log('Rate limited, will retry later');
                return;
            }
            
            // Не показываем toast для CORS ошибок
            if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS')) {
                console.log('Network/CORS error, will retry later');
                return;
            }
            
            toast.error('Ошибка загрузки очереди видео.');
        }
    };

    // Загрузка настроек YouTube
    const loadYoutubeSettings = async () => {
        try {
            const response = await api.get('/api/tts/youtube-settings');
            setPlaybackMode(response.data.playback_mode || 'browser');
            setVolume([response.data.volume_level || 50]);
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
                const url = `http://localhost:5173/youtube-obs/${response.data.obs_token}`;
                setYoutubeObsUrl(url);
                setIsObsUrlVisible(false); // По умолчанию скрыт
            }
        } catch (error) {
            console.error('Error loading existing OBS URL:', error);
        }
    };

    useEffect(() => {
        loadQueue();
        loadYoutubeSettings();
        loadExistingObsUrl();
        
        // Обработчик YouTube событий
        const handleYoutubeEvent = (event) => {
            const { event: eventType, data } = event.detail;
            console.log('YouTube event received:', eventType, data);
            
            if (eventType === 'queue_updated') {
                // Обновляем очередь при изменении
                loadQueue();
            }
        };
        
        // Подписываемся на YouTube события
        window.addEventListener('youtubeEvent', handleYoutubeEvent);
        
        // Убираем polling - теперь обновляем только по событиям
        // const interval = setInterval(loadQueue, 30000);
        // return () => clearInterval(interval);
        
        return () => {
            window.removeEventListener('youtubeEvent', handleYoutubeEvent);
        };
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
                console.log("Received youtube_queue_update from WebSocket, reloading queue...");
                toast.info("Очередь видео обновлена!");
                loadQueue();
            }
        }
    }, [lastJsonMessage, loadQueue]);

    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            controls: 1,
        },
    };

    const handleVideoEnd = async () => {
        await handleNextVideo();
    };

    const handleNextVideo = async () => {
        try {
            const { data } = await api.post('/api/youtube/player/next');
            if (data.success) {
                toast.success("Следующее видео!");
                loadQueue();
            } else {
                toast.info("Очередь пуста.");
                setCurrentVideo(null);
                setQueue([]);
            }
        } catch (error) {
            toast.error("Не удалось переключить видео.");
            console.error('Error skipping video:', error);
        }
    };

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

    const handlePlayPause = () => {
        if (playerRef.current && playerRef.current.internalPlayer) {
            if (isPlaying) {
                playerRef.current.internalPlayer.pauseVideo();
            } else {
                playerRef.current.internalPlayer.playVideo();
            }
        }
    };

    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
        if (playerRef.current && playerRef.current.internalPlayer) {
            playerRef.current.internalPlayer.setVolume(newVolume[0]);
        }
    };

    const handleMuteToggle = () => {
        setIsMuted(!isMuted);
        if (playerRef.current && playerRef.current.internalPlayer) {
            if (isMuted) {
                playerRef.current.internalPlayer.unMute();
            } else {
                playerRef.current.internalPlayer.mute();
            }
        }
    };
    
    // Обработчик клика на пустое место в полноэкранном режиме
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && isTheaterMode) {
            setIsTheaterMode(false);
        }
    };

    return (
        <div 
            className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 bg-black z-50 p-2' : 'space-y-6'}`}
            onClick={handleBackdropClick}
        >
            <div className={`w-full h-full ${isTheaterMode ? '' : ''}`}>
                <Card className={`transition-all duration-300 w-full ${isTheaterMode ? 'bg-black border-none h-full' : ''}`}>
                    <CardContent className={`grid gap-6 p-6 ${isTheaterMode ? 'grid-cols-5 h-full' : 'grid-cols-1 lg:grid-cols-5 min-h-[600px]'}`}>
                        <div className={`space-y-4 ${isTheaterMode ? 'col-span-4' : 'lg:col-span-3'}`}>
                            {/* Плеер (только для режима сайта) */}
                            {playbackMode === 'browser' ? (
                                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                    {currentVideo ? (
                                        <YouTube
                                            videoId={currentVideo.video_id}
                                            opts={opts}
                                            onEnd={handleVideoEnd}
                                            onPlay={() => setIsPlaying(true)}
                                            onPause={() => setIsPlaying(false)}
                                            ref={playerRef}
                                            className="w-full h-full"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-muted">
                                            <p className="text-muted-foreground">Нет видео для воспроизведения.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-purple-500">
                                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                                        <div className="text-6xl mb-4">📹</div>
                                        <h3 className="text-xl font-medium text-purple-300 mb-2">Режим OBS Studio</h3>
                                        <p className="text-gray-300 mb-4">
                                            Видео воспроизводятся в OBS Studio.<br/>
                                            Управление происходит через кнопки ниже.
                                        </p>
                                        {currentVideo && (
                                            <div className="text-sm text-gray-400 bg-gray-700 p-3 rounded-lg">
                                                <strong>Сейчас играет:</strong> {currentVideo.title}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Элементы управления */}
                            <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handlePlayPause}
                                        disabled={!currentVideo}
                                    >
                                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleNextVideo}
                                    >
                                        <SkipForward className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Регулятор громкости */}
                                <div className="flex items-center gap-3 min-w-[200px]">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleMuteToggle}
                                    >
                                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                    </Button>
                                    <Slider
                                        value={volume}
                                        onValueChange={handleVolumeChange}
                                        max={100}
                                        step={1}
                                        className="w-32"
                                    />
                                    <span className="text-sm text-muted-foreground w-10 text-right">{volume[0]}%</span>
                                </div>

                                {/* Очистить очередь */}
                                <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <X className="h-4 w-4 mr-2" />
                                            Очистить
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Подтверждение</DialogTitle>
                                            <DialogDescription>
                                                Вы уверены, что хотите полностью очистить очередь? Это действие необратимо.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>Отмена</Button>
                                            <Button variant="destructive" onClick={handleClearQueue}>Очистить</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            
                            {/* Кнопки управления */}
                            <div className="flex justify-between items-center mt-4">
                                <div className="flex items-center gap-2">
                                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                        playbackMode === 'browser' 
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                    }`}>
                                        {playbackMode === 'browser' ? '🌐 Сайт' : '📹 OBS Studio'}
                                    </div>
                                    {!youtubeObsUrl ? (
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={generateYoutubeObsUrl}
                                        >
                                            🔗 OBS URL
                                        </Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={isObsUrlVisible ? hideObsUrl : () => setIsObsUrlVisible(true)}
                                            >
                                                {isObsUrlVisible ? '👁️ Скрыть' : '👁️ Показать'}
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={regenerateYoutubeObsUrl}
                                            >
                                                🔄 Перегенерировать
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setIsTheaterMode(!isTheaterMode)}>
                                    {isTheaterMode ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                                    {isTheaterMode ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
                                </Button>
                            </div>
                            
                            {/* OBS URL (если сгенерирован и видим) */}
                            {youtubeObsUrl && isObsUrlVisible && (
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 mt-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-400 mb-1">OBS Browser Source URL:</p>
                                            <p className="text-xs text-gray-300 font-mono break-all">{youtubeObsUrl}</p>
                                        </div>
                                        <div className="flex gap-2">
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
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={hideObsUrl}
                                                className="flex-shrink-0"
                                            >
                                                👁️ Скрыть
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={`flex flex-col h-full ${isTheaterMode ? 'col-span-1' : 'lg:col-span-2'}`}>
                            <Card className="flex-1">
                                <CardHeader>
                                    <CardTitle>Очередь ({queue.length})</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 h-[calc(100%-80px)] overflow-y-auto">
                                    {currentVideo && (
                                        <div className="p-4 border-b bg-muted/20">
                                            <p className="text-xs text-muted-foreground mb-2">Сейчас играет:</p>
                                            <div className="flex gap-3 p-2 rounded-lg">
                                                <img src={currentVideo.thumbnail_url} alt={currentVideo.title} className="w-20 h-12 object-cover rounded"/>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm line-clamp-2">{currentVideo.title}</h4>
                                                    <p className="text-xs text-muted-foreground">от {currentVideo.user_id}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {queue.length > 0 ? (
                                        <div className="p-4 space-y-3">
                                            {queue.map((video, index) => (
                                                <div key={video.id} className="flex gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                                                    <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                                                        {index + 1}
                                                    </div>
                                                    <img src={video.thumbnail_url} alt={video.title} className="w-20 h-12 object-cover rounded"/>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                        <p className="text-xs text-muted-foreground">от {video.user_id}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground p-4">
                                            <p>Очередь пуста</p>
                                            <p className="text-xs mt-2">Используйте команду !sr в чате для добавления видео</p>
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
