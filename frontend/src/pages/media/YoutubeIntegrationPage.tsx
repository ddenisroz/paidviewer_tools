import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipForward, Volume2, VolumeX, Maximize, Minimize, Monitor, Trash2, RefreshCw, Settings, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { toast } from 'sonner';
import { usePlayer } from '../../context/PlayerContext';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { youtubeService } from '../../services/api/services/youtubeService';
import { logger } from '../../utils/prodLogger';
import PageWrapper from '../../components/PageWrapper';
import type { YoutubeVideo } from '../../types/youtube';

type PlaybackMode = 'browser' | 'obs';

const YoutubeIntegrationPage: React.FC = () => {
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
        setPlayerRef,
        setIsTheaterMode,
        loadQueue
    } = usePlayer();
    
    const [isClearDialogOpen, setIsClearDialogOpen] = useState<boolean>(false);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('browser');
    const [youtubeObsUrl, setYoutubeObsUrl] = useState<string>('');
    const { lastJsonMessage } = useChat();
    
    const handlePlayerReadyWithRef = (event: any): void => {
        setPlayerRef(event.target);
        handlePlayerReady(event);
    };

    const loadYoutubeSettings = useCallback(async (): Promise<void> => {
        try {
            const response = await youtubeService.getSettings();
            setPlaybackMode((response.data as any).playback_mode || 'browser');
            setVolume((response.data as any).volume_level || 100);
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    }, [setVolume]);

    const saveYoutubeSettings = async (newPlaybackMode: PlaybackMode, newVolume: number): Promise<void> => {
        try {
            await youtubeService.saveSettings({
                volume_level: newVolume
            } as any);
            toast.success('Настройки YouTube сохранены');
        } catch (error) {
            logger.error('Error saving YouTube settings:', error);
            toast.error('Ошибка сохранения настроек YouTube');
        }
    };

    const generateYoutubeObsUrl = async (): Promise<string | null> => {
        try {
            const response = await youtubeService.generateObsUrl();
            const url = (response.data as any).youtube_obs_url;
            setYoutubeObsUrl(url);
            
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
            
            navigator.clipboard.writeText(url);
            return url;
        } catch (error) {
            logger.error('Error generating YouTube OBS URL:', error);
            toast.error('Ошибка создания YouTube OBS URL');
            return null;
        }
    };

    const regenerateYoutubeObsUrl = async (): Promise<string | null> => {
        try {
            const response = await youtubeService.regenerateObsUrl();
            const url = (response.data as any).youtube_obs_url;
            setYoutubeObsUrl(url);
            
            toast.success('OBS URL перегенерирован!', {
                description: 'Новый URL скопирован в буфер обмена'
            });
            
            navigator.clipboard.writeText(url);
            return url;
        } catch (error) {
            logger.error('Error regenerating YouTube OBS URL:', error);
            toast.error('Ошибка перегенерации YouTube OBS URL');
            return null;
        }
    };

    const loadExistingObsUrl = useCallback(async (): Promise<void> => {
        try {
            const response = await youtubeService.getObsUrl();
            if ((response.data as any).obs_token) {
                const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
                const url = `${frontendUrl}/youtube-obs/${(response.data as any).obs_token}`;
                setYoutubeObsUrl(url);
            }
        } catch (error) {
            logger.error('Error loading existing OBS URL:', error);
        }
    }, []);

    useEffect(() => {
        loadYoutubeSettings();
        loadExistingObsUrl();
    }, [loadYoutubeSettings, loadExistingObsUrl]);

    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape' && isTheaterMode) {
                setIsTheaterMode(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [isTheaterMode, setIsTheaterMode]);

    useEffect(() => {
        if (lastJsonMessage && (lastJsonMessage as any).type === 'youtube_queue_update') {
            logger.log('📺 [YouTube] Queue updated via WebSocket');
        }
    }, [lastJsonMessage]);

    const handleClearQueue = async (): Promise<void> => {
        try {
            await youtubeService.clearQueue();
            toast.success("Очередь очищена.");
            setIsClearDialogOpen(false);
            loadQueue();
        } catch (error: any) {
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

    const handleVolumeChange = (value: number[]): void => {
        const newVolume = value[0];
        setVolume(newVolume);
    };
    
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (e.target === e.currentTarget && isTheaterMode) {
            setIsTheaterMode(false);
        }
    };

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
            {!isTheaterMode ? (
                <div className="flex flex-col gap-4 h-full">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex gap-4">
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

                                <div className="flex-1 space-y-3">
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

                                    <div className="grid grid-cols-2 gap-2">
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

                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3">
                            <CardTitle>Очередь ({queue.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto">
                            {currentVideo && (
                                <div className="p-4 border-b bg-muted/20">
                                    <p className="text-xs text-muted-foreground mb-2">Сейчас играет:</p>
                                    <div className="flex gap-3 p-2 rounded-lg">
                                        <img src={currentVideo.thumbnail} alt={currentVideo.title} className="w-20 h-12 object-cover rounded"/>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm line-clamp-2">{currentVideo.title}</h4>
                                            <p className="text-xs text-muted-foreground">от {(currentVideo as any).requester_name || (currentVideo as any).user_id || 'Unknown'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {queue.length > 0 ? (
                                <div className="p-4 space-y-3">
                                    {queue.map((video: YoutubeVideo, index: number) => {
                                        return (
                                            <div key={video.id} className="flex gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                                                <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                                                    {index + 1}
                                                </div>
                                                <img src={video.thumbnail} alt={video.title} className="w-20 h-12 object-cover rounded"/>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                    <p className="text-xs text-muted-foreground">заказал: {(video as any).requester_name || (video as any).user_id || 'Unknown'}</p>
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
                <Card className="transition-all duration-300 w-full bg-black border-none h-full">
                    <CardContent className="grid grid-cols-5 gap-6 h-full p-6">
                        <div className="col-span-4 space-y-4">
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
                                                <img src={currentVideo.thumbnail} alt={currentVideo.title} className="w-20 h-12 object-cover rounded"/>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm line-clamp-2">{currentVideo.title}</h4>
                                                    <p className="text-xs text-muted-foreground">от {(currentVideo as any).requester_name || (currentVideo as any).user_id || 'Unknown'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {queue.length > 0 ? (
                                        <div className="p-4 space-y-3">
                                            {queue.map((video: YoutubeVideo, index: number) => {
                                                return (
                                                    <div key={video.id} className="flex gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                                                        <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                                                            {index + 1}
                                                        </div>
                                                        <img src={video.thumbnail} alt={video.title} className="w-20 h-12 object-cover rounded"/>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                            <p className="text-xs text-muted-foreground">заказал: {(video as any).requester_name || (video as any).user_id || 'Unknown'}</p>
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

