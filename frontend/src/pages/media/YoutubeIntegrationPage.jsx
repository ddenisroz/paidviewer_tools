import React, { useState, useEffect, useRef } from 'react';
import { Play, SkipForward, Volume2, Plus, X, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';
import YouTube from 'react-youtube';
import api from '../../services/api';
import { useChat } from '../../context/ChatContext'; // Импортируем, чтобы получить доступ к WebSocket

const YoutubeIntegrationPage = () => {
    const [queue, setQueue] = useState([]);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const playerRef = useRef(null);
    const { lastJsonMessage } = useChat(); // Получаем последнее сообщение из WebSocket

    const loadQueue = async () => {
        try {
            const { data } = await api.get('/api/youtube/queue');
            setQueue(data.queue || []);
            setCurrentVideo(data.current_video || null);
            setIsPlaying(data.is_playing || false);
        } catch (error) {
            toast.error('Ошибка загрузки очереди видео.');
            console.error('Error loading YouTube queue:', error);
        }
    };

    useEffect(() => {
        loadQueue();
    }, []);

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
            await api.post('/api/youtube/queue/clear');
            toast.success("Очередь очищена.");
            loadQueue();
        } catch (error) {
            toast.error("Не удалось очистить очередь.");
            console.error("Error clearing queue:", error);
        }
    };
    
    return (
        <div className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 bg-black z-50 flex items-center justify-center' : 'container mx-auto p-6 space-y-6'}`}>
            <div className={`w-full h-full ${isTheaterMode ? 'p-4' : ''}`}>
                <Card className={`transition-all duration-300 w-full h-full ${isTheaterMode ? 'bg-black border-none' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className={isTheaterMode ? 'text-white' : ''}>Плеер YouTube</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsTheaterMode(!isTheaterMode)}>
                            {isTheaterMode ? <Minimize className="h-6 w-6 text-white" /> : <Maximize className="h-6 w-6" />}
                        </Button>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
                        <div className="lg:col-span-2 h-full">
                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden h-full">
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
                        </div>

                        <div className="lg:col-span-1 flex flex-col h-full">
                             <div className="flex justify-between items-center mb-4">
                                <Button onClick={handleNextVideo}>
                                    <SkipForward className="h-4 w-4 mr-2" />
                                    Следующее
                                </Button>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="destructive">
                                            <X className="h-4 w-4 mr-2" />
                                            Очистить очередь
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
                                            <Button variant="outline">Отмена</Button>
                                            <Button variant="destructive" onClick={handleClearQueue}>Очистить</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <Card className="flex-1">
                                <CardHeader>
                                    <CardTitle>Очередь ({queue.length})</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 h-[calc(100%-80px)] overflow-y-auto">
                                    {queue.length > 0 ? (
                                        <div className="p-4 space-y-3">
                                            {queue.map((video) => (
                                                <div key={video.id} className="flex gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                                                    <img src={video.thumbnail} alt={video.title} className="w-24 h-16 object-cover rounded"/>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                        <p className="text-xs text-muted-foreground">от {video.requested_by}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground p-4">
                                            <p>Очередь пуста</p>
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
