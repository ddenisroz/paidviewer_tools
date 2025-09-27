import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, X, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import api from '../services/api';
import { useToast } from '@/components/ui/toast';

const GlobalPlayer = () => {
    const [currentVideo, setCurrentVideo] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(50);
    const [isMuted, setIsMuted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const { toast } = useToast();

    // Загружаем текущее видео из очереди
    const loadCurrentVideo = async () => {
        try {
            const response = await api.get('/api/youtube/queue');
            const queueData = response.data;
            
            if (queueData.current_video && queueData.current_video.video_id) {
                setCurrentVideo(queueData.current_video);
                setIsVisible(true);
            } else {
                setCurrentVideo(null);
                setIsVisible(false);
            }
        } catch (error) {
            console.error('Error loading current video:', error);
            
            // Не показываем ошибки для rate limiting и CORS
            if (error.response?.status === 429 || error.code === 'ERR_NETWORK') {
                return;
            }
        }
    };

    // Загружаем видео при монтировании и по событиям
    useEffect(() => {
        loadCurrentVideo();
        
        // Обработчик YouTube событий
        const handleYoutubeEvent = (event) => {
            const { event: eventType, data } = event.detail;
            console.log('GlobalPlayer YouTube event received:', eventType, data);
            
            if (eventType === 'queue_updated') {
                // Обновляем текущее видео при изменении очереди
                loadCurrentVideo();
            }
        };
        
        // Подписываемся на YouTube события
        window.addEventListener('youtubeEvent', handleYoutubeEvent);
        
        // Убираем polling - теперь обновляем только по событиям
        // const interval = setInterval(loadCurrentVideo, 30000);
        // return () => clearInterval(interval);
        
        return () => {
            window.removeEventListener('youtubeEvent', handleYoutubeEvent);
        };
    }, []);

    // Обработка воспроизведения/паузы (заглушка для UI)
    const togglePlayPause = () => {
        setIsPlaying(!isPlaying);
        toast({
            title: isPlaying ? "Пауза" : "Воспроизведение",
            description: isPlaying ? "Видео поставлено на паузу" : "Видео воспроизводится"
        });
    };

    // Обработка громкости (заглушка для UI)
    const handleVolumeChange = (value) => {
        const newVolume = value[0];
        setVolume(newVolume);
        setIsMuted(false);
    };

    // Обработка отключения звука (заглушка для UI)
    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    // Переход к следующему видео
    const nextVideo = async () => {
        try {
            await api.post('/api/youtube/next');
            toast({
                title: "Следующее видео",
                description: "Переход к следующему видео в очереди"
            });
            // Перезагружаем текущее видео
            setTimeout(loadCurrentVideo, 1000);
        } catch (error) {
            console.error('Error skipping to next video:', error);
            toast({
                title: "Ошибка",
                description: "Не удалось перейти к следующему видео",
                variant: "destructive"
            });
        }
    };

    // Закрытие плеера
    const closePlayer = () => {
        setIsVisible(false);
        setCurrentVideo(null);
        setIsPlaying(false);
    };

    // Если нет видео, показываем заглушку
    if (!currentVideo) {
        return (
            <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-center gap-3">
                        <Music className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-300 text-sm">Нет очереди заказов YouTube</span>
                    </div>
                </div>
            </div>
        );
    }

    // Если плеер скрыт, не отображаем
    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 w-1/2 bg-black/20 backdrop-blur-sm border-t border-r border-white/10 z-50">
            <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    {/* Информация о видео */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gray-800 rounded-md overflow-hidden flex-shrink-0">
                            {currentVideo.thumbnail_url && (
                                <img 
                                    src={currentVideo.thumbnail_url} 
                                    alt={currentVideo.title}
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                        <div className="min-w-0 flex-1 bg-black/20 rounded-md px-2 py-1">
                            <h3 className="text-white font-medium text-sm truncate">
                                {currentVideo.title}
                            </h3>
                            <p className="text-gray-300 text-xs truncate">
                                {currentVideo.channel_title}
                            </p>
                        </div>
                    </div>

                    {/* Элементы управления */}
                    <div className="flex items-center gap-2">
                        {/* Кнопка воспроизведения/паузы */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={togglePlayPause}
                            className="text-white bg-black/30 hover:bg-black/50 border border-white/20"
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>

                        {/* Регулятор громкости */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleMute}
                                className="text-white bg-black/30 hover:bg-black/50 border border-white/20 p-1"
                            >
                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </Button>
                            <div className="w-16">
                                <Slider
                                    value={[isMuted ? 0 : volume]}
                                    onValueChange={handleVolumeChange}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Кнопка следующего видео */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={nextVideo}
                            className="text-white bg-black/30 hover:bg-black/50 border border-white/20"
                        >
                            <SkipForward className="w-4 h-4" />
                        </Button>

                        {/* Кнопка закрытия */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={closePlayer}
                            className="text-white bg-black/30 hover:bg-black/50 border border-white/20"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalPlayer;
