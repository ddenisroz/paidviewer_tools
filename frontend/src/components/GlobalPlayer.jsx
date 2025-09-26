import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, X, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import api from '../services/api';
import { useToast } from '@/hooks/use-toast';

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
        }
    };

    // Загружаем видео при монтировании и каждые 5 секунд
    useEffect(() => {
        loadCurrentVideo();
        const interval = setInterval(loadCurrentVideo, 5000);
        return () => clearInterval(interval);
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
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-sm border-t border-purple-500/20 z-50">
                <div className="container mx-auto px-4 py-3">
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
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-sm border-t border-purple-500/20 z-50">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Информация о видео */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                            {currentVideo.thumbnail_url && (
                                <img 
                                    src={currentVideo.thumbnail_url} 
                                    alt={currentVideo.title}
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-white font-medium text-sm truncate">
                                {currentVideo.title}
                            </h3>
                            <p className="text-gray-300 text-xs truncate">
                                {currentVideo.channel_title}
                            </p>
                        </div>
                    </div>

                    {/* Элементы управления */}
                    <div className="flex items-center gap-3">
                        {/* Кнопка воспроизведения/паузы */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={togglePlayPause}
                            className="text-white hover:bg-white/10"
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>

                        {/* Регулятор громкости */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleMute}
                                className="text-white hover:bg-white/10 p-1"
                            >
                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </Button>
                            <div className="w-20">
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
                            className="text-white hover:bg-white/10"
                        >
                            <SkipForward className="w-4 h-4" />
                        </Button>

                        {/* Кнопка закрытия */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={closePlayer}
                            className="text-white hover:bg-white/10"
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
