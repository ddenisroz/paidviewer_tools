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
    const playerRef = useRef(null);
    const { lastJsonMessage } = useChat();

    const loadQueue = async () => {
        try {
            const { data } = await api.get('/api/youtube/queue');
            setQueue(data.queue || []);
            setCurrentVideo(data.current_video || null);
            setIsPlaying(data.is_playing || false);
        } catch (error) {
            // Не показываем toast для 429 ошибок (rate limiting)
            if (error.response?.status !== 429) {
                toast.error('Ошибка загрузки очереди видео.');
            }
            console.error('Error loading YouTube queue:', error);
        }
    };

    useEffect(() => {
        loadQueue();
        // Обновляем очередь каждые 15 секунд (увеличили интервал для избежания rate limiting)
        const interval = setInterval(loadQueue, 15000);
        return () => clearInterval(interval);
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
                            {/* Кнопка театрального режима */}
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setIsTheaterMode(!isTheaterMode)}>
                                    {isTheaterMode ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                                    {isTheaterMode ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
                                </Button>
                            </div>
                            
                            {/* Плеер */}
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
