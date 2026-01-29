// src/pages/media/YoutubeIntegrationPage.tsx
import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, Maximize, Minimize, Monitor, Pause, Play, RefreshCw, Settings, SkipForward, Trash2, Volume2, VolumeX, Youtube } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';

import { BUTTON_SIZES } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { usePlayer } from '@/context/PlayerContext';
import { youtubeService } from '@/services/api/services/youtubeService';
import PageWrapper from '@/shared/components/PageWrapper';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Slider } from "@/shared/components/ui/slider";
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


import type { YouTubePlayer, YoutubeVideo } from '@/types/youtube';

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
        handlePlayerStateChange,
        handlePlayerError,
        setPlayerRef,
        releasePlayerRef,
        setIsTheaterMode,
        loadQueue
    } = usePlayer();

    const [isClearDialogOpen, setIsClearDialogOpen] = useState<boolean>(false);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('browser');
    const [youtubeObsUrl, setYoutubeObsUrl] = useState<string>('');
    const { lastJsonMessage } = useChat();
    const currentThumbnail = currentVideo?.thumbnail || currentVideo?.thumbnail_url;

    // Handler for the embedded player on this page
    const handlePagePlayerReady = (event: { target: YouTubePlayer }): void => {
        setPlayerRef(event.target as YouTubePlayer, 'page');
        handlePlayerReady(event);
        if (!isPlaying) {
            try {
                event.target.pauseVideo();
            } catch (error) {
                logger.debug('[YouTube Page] Pause on ready skipped:', error);
            }
        }
        logger.debug('[YouTube Page] Player ready');
    };

    const loadYoutubeSettings = useCallback(async (): Promise<void> => {
        try {
            const response = await youtubeService.getSettings();
            setPlaybackMode(response.data.playback_mode || 'browser');
            setVolume(response.data.volume_level || 100);
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    }, [setVolume]);

    const generateYoutubeObsUrl = async (): Promise<string | null> => {
        try {
            const response = await youtubeService.generateObsUrl();
            const url = response.data.youtube_obs_url;
            setYoutubeObsUrl(url);

            toast.success('OBS URL скопирован!', {
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
            const url = response.data.youtube_obs_url;
            setYoutubeObsUrl(url);

            toast.success('OBS URL пересоздан!', {
                description: 'Новый URL скопирован в буфер обмена'
            });

            navigator.clipboard.writeText(url);
            return url;
        } catch (error) {
            logger.error('Error regenerating YouTube OBS URL:', error);
            toast.error('Ошибка пересоздания YouTube OBS URL');
            return null;
        }
    };

    const loadExistingObsUrl = useCallback(async (): Promise<void> => {
        try {
            const response = await youtubeService.getObsUrl();
            if (response.data.obs_token) {
                const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
                const url = `${frontendUrl}/youtube-obs/${response.data.obs_token}`;
                setYoutubeObsUrl(url);
            }
        } catch (error) {
            logger.error('Error loading existing OBS URL:', error);
        }
    }, []);

    useEffect(() => {
        loadYoutubeSettings();
        loadExistingObsUrl();
    }, []); // [OK] Пустой массив зависимостей - запускаем только один раз при монтировании

    useEffect(() => {
        return () => {
            releasePlayerRef('page');
        };
    }, [releasePlayerRef]);

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
        if (lastJsonMessage && (lastJsonMessage as { type?: string }).type === 'youtube_queue_update') {
            logger.log('[YouTube] Queue updated via WebSocket');
        }
    }, [lastJsonMessage]);

    const handleClearQueue = async (): Promise<void> => {
        try {
            await youtubeService.clearQueue();
            toast.success("Очередь очищена.");
            setIsClearDialogOpen(false);
            loadQueue(true);
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number }; code?: string; message?: string };
            if (axiosError.response?.status === 429) {
                toast.error("Слишком много запросов. Пожалуйста, подождите немного.");
            } else if (axiosError.code === 'ERR_NETWORK' || axiosError.message?.includes('CORS')) {
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
            <PageWrapper title="YouTube Заказы">
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
                                Для использования YouTube заказов необходимо войти в систему и привязать хотя бы одну платформу (Twitch или VK Live)
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
            className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 bg-black z-50 p-2' : 'h-[calc(100vh-8rem)]'}`}
            onClick={handleBackdropClick}
            style={isTheaterMode ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 } : {}}
        >
            {!isTheaterMode ? (
                <div className="flex flex-col gap-4 h-full">
                    <Card className="card-glass">
                        <CardContent className="p-6">
                            <div className="flex gap-4">
                                <div className="w-[360px] flex-shrink-0">
                                    {playbackMode === 'browser' ? (
                                        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                                            {currentVideo ? (
                                                <YouTube
                                                    videoId={currentVideo.video_id}
                                                    onReady={handlePagePlayerReady}
                                                    onStateChange={handlePlayerStateChange}
                                                    onError={handlePlayerError}
                                                    opts={{
                                                        width: '100%',
                                                        height: '100%',
                                                        playerVars: {
                                                            autoplay: isPlaying ? 1 : 0,
                                                            controls: 1,
                                                            disablekb: 0,
                                                            enablejsapi: 1,
                                                            fs: 1,
                                                            iv_load_policy: 3,
                                                            modestbranding: 1,
                                                            playsinline: 1,
                                                            rel: 0,
                                                            showinfo: 0,
                                                            cc_load_policy: 0,
                                                            hl: 'ru',
                                                            origin: window.location.origin,
                                                            widget_referrer: window.location.origin
                                                        }
                                                    }}
                                                    key={`page-player-${currentVideo.video_id}`}
                                                    className="w-full h-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                                    <p className="text-muted-foreground text-xs">Нет видео для воспроизведения.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-purple-500 aspect-video">
                                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-3">
                                                <div className="text-3xl mb-1">[VIDEO]</div>
                                                <h3 className="text-sm font-medium text-purple-300 mb-1">Режим OBS Studio</h3>
                                                <p className="text-gray-300 text-xs">
                                                    Видео воспроизводится в OBS Studio
                                                </p>
                                                {currentVideo && (
                                                    <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded mt-1 max-w-full truncate">
                                                        <strong>Сейчас:</strong> {currentVideo.title}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-3">
                                    <div className="bg-muted/30 rounded-lg p-3">
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={togglePlayPause} disabled={!currentVideo} className={BUTTON_SIZES.icon} title={isPlaying ? "Пауза" : "Воспроизвести"}>
                                                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={nextVideo} disabled={!currentVideo} className={BUTTON_SIZES.icon} title="Следующий">
                                                <SkipForward className="h-5 w-5" />
                                            </Button>
                                            <div className="h-6 w-px bg-border mx-2" />
                                            <Button variant="ghost" size="sm" onClick={toggleMute} className={BUTTON_SIZES.icon} title={isMuted ? "Включить звук" : "Выключить звук"}>
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
                                                    <DialogDescription>Вы уверены, что хотите очистить очередь заказов?</DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>Отмена</Button>
                                                    <Button variant="destructive" onClick={handleClearQueue}>Очистить</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="h-12 w-full" title="OBS Интеграция">
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
                                                                        title="Пересоздать URL"
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
                                            title="Театральный режим"
                                        >
                                            {isTheaterMode ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                                            {isTheaterMode ? 'Выйти из режима театра' : 'Театральный режим'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-glass flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3">
                            <CardTitle>Очередь ({queue.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto">
                            {currentVideo && (
                                <div className="p-4 border-b bg-muted/20">
                                    <p className="text-xs text-muted-foreground mb-2">Сейчас играет:</p>
                                    <div className="flex gap-3 p-2 rounded-lg">
                                        <img src={currentThumbnail} alt={currentVideo.title} className="w-20 h-12 object-cover rounded" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm line-clamp-2">{currentVideo.title}</h4>
                                            <p className="text-xs text-muted-foreground">от {currentVideo.requester_name || currentVideo.user_id || 'Unknown'}</p>
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
                                                <img src={video.thumbnail || video.thumbnail_url} alt={video.title} className="w-20 h-12 object-cover rounded" />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                    <p className="text-xs text-muted-foreground">Заказал: {video.requester_name || video.user_id || 'Unknown'}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground p-4">
                                    <div className="text-4xl mb-4">[AUDIO]</div>
                                    <p className="font-medium text-base mb-2">Очередь пуста</p>
                                    <p className="text-sm text-muted-foreground">
                                        Очередь пуста. Зрители могут заказывать видео командой !sr
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
                                    Выйти из режима театра
                                </Button>
                            </div>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                {currentVideo ? (
                                    <YouTube
                                        videoId={currentVideo.video_id}
                                        onReady={handlePagePlayerReady}
                                        onStateChange={handlePlayerStateChange}
                                        onError={handlePlayerError}
                                        opts={{
                                            width: '100%',
                                            height: '100%',
                                            playerVars: {
                                                autoplay: isPlaying ? 1 : 0,
                                                controls: 1,
                                                disablekb: 0,
                                                enablejsapi: 1,
                                                fs: 1,
                                                iv_load_policy: 3,
                                                modestbranding: 1,
                                                playsinline: 1,
                                                rel: 0,
                                                showinfo: 0,
                                                cc_load_policy: 0,
                                                hl: 'ru',
                                                origin: window.location.origin,
                                                widget_referrer: window.location.origin
                                            }
                                        }}
                                        key={`theater-player-${currentVideo.video_id}`}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                        <p className="text-muted-foreground">Нет видео для воспроизведения.</p>
                                    </div>
                                )}
                            </div>
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
                                                <img src={currentVideo.thumbnail} alt={currentVideo.title} className="w-20 h-12 object-cover rounded" />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm line-clamp-2">{currentVideo.title}</h4>
                                                    <p className="text-xs text-muted-foreground">от {currentVideo.requester_name || currentVideo.user_id || 'Unknown'}</p>
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
                                                        <img src={video.thumbnail} alt={video.title} className="w-20 h-12 object-cover rounded" />
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                                            <p className="text-xs text-muted-foreground">Заказал: {video.requester_name || video.user_id || 'Unknown'}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground p-4">
                                            <div className="text-4xl mb-4">[AUDIO]</div>
                                            <p className="font-medium text-base mb-2">Очередь пуста</p>
                                            <p className="text-sm text-muted-foreground">
                                                Очередь пуста. Зрители могут заказывать видео командой !sr
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
