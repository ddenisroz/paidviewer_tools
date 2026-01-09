import React, { useEffect, useState } from 'react';

import { ChevronDown, ChevronUp, List, Pause, Play, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import YouTube from 'react-youtube';

import { BUTTON_SIZES, TRANSITIONS } from '@/constants/designSystem';
import { usePlayer } from '@/context/PlayerContext';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Slider } from '@/shared/components/ui/slider';


declare global {
    interface Window {
        originalConsoleError?: typeof console.error;
        youtubeErrorHandlerInstalled?: boolean;
    }
}

const GlobalPlayer: React.FC = () => {
    const {
        currentVideo,
        isPlaying,
        volume,
        isMuted,
        isVisible,
        isTheaterMode,
        queue,
        // currentTime,
        // duration,
        togglePlayPause,
        setVolume,
        toggleMute,
        nextVideo,
        closePlayer,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        setPlayerRef
    } = usePlayer();
    
    const [showQueue, setShowQueue] = useState(false);

    // Типы для YouTube Player
    interface YouTubePlayer {
        pauseVideo: () => void;
        playVideo: () => void;
        setVolume: (volume: number) => void;
        mute: () => void;
        unMute: () => void;
        getPlayerState: () => number;
        getCurrentTime: () => number;
        getDuration: () => number;
    }

    interface YouTubeEvent {
        target: YouTubePlayer;
        data?: number;
    }

    // Обработчик готовности плеера с установкой ссылки
    const handlePlayerReadyWithRef = (event: YouTubeEvent) => {
        setPlayerRef(event.target);
        handlePlayerReady(event as unknown as Event);
    };

    // Глобальный перехват ошибок YouTube API для браузерных расширений
    useEffect(() => {
        const originalConsoleError = console.error;
        window.originalConsoleError = originalConsoleError;
        
        // Перехватываем console.error только если еще не перехватывали
        if (!window.youtubeErrorHandlerInstalled) {
            console.error = (...args: unknown[]) => {
                const message = args[0]?.toString();
                if (message?.includes('TIMEOUT waiting for') || 
                    message?.includes('getYouTubeTitleNode') ||
                    message?.includes('Cannot read properties of null')) {
                    return; // Игнорируем эти ошибки от расширений
                }
                originalConsoleError.apply(console, args);
            };
            window.youtubeErrorHandlerInstalled = true;
        }

        return () => {
            // Восстанавливаем оригинальный console.error при размонтировании
            if (window.originalConsoleError && window.youtubeErrorHandlerInstalled) {
                console.error = window.originalConsoleError;
                window.youtubeErrorHandlerInstalled = false;
            }
        };
    }, []);

    // Обработка громкости
    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
    };

    // [OK] ВАЖНО: Вычисляем все переменные ДО условных return
    // Проверяем текущий путь, чтобы не показывать UI на странице YouTube
    const currentPath = window.location.pathname;
    const isOnYoutubePage = currentPath.includes('/dashboard/youtube');
    
    // Плеер работает всегда, UI показываем на всех страницах КРОМЕ YouTube
    // На YouTube странице - ничего не показываем (там свой встроенный плеер)
    const showUI = isVisible && !isTheaterMode && !isOnYoutubePage;

    // [OK] ТЕПЕРЬ проверяем если нет видео, не показываем плеер
    if (!currentVideo) {
        return null;
    }

    return (
        <>
            {/* Скрытый плеер - воспроизводит только звук */}
            {/* НА СТРАНИЦЕ /dashboard/youtube используется встроенный плеер из YoutubeIntegrationPage */}
            {currentVideo && !isOnYoutubePage && (
                <div className="hidden">
                    <YouTube
                        videoId={currentVideo.video_id}
                        onReady={handlePlayerReadyWithRef as (event: { target: unknown; data?: number }) => void}
                        onStateChange={handlePlayerStateChange as (event: { target: unknown; data?: number }) => void}
                        onError={handlePlayerError as (event: { target: unknown; data?: number }) => void}
                        opts={{
                            width: '1px',
                            height: '1px',
                            playerVars: {
                                autoplay: 1,  // [OK] Включаем автоплей
                                controls: 0,
                                disablekb: 1,
                                enablejsapi: 1,
                                fs: 0,
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
                        key={`hidden-player-${currentVideo.video_id}-${Date.now()}`}
                        className="hidden"
                    />
                </div>
            )}
            
            {/* UI плеера фиксирован внизу экрана с отступом */}
            {showUI && (
                <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
                    <div className="w-full max-w-4xl pointer-events-auto">
                        {/* Queue panel - показывается над плеером */}
                        {showQueue && queue.length > 0 && (
                            <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-t-xl shadow-2xl mb-0 max-h-64 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <List className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-300 font-medium">Очередь ({queue.length})</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowQueue(false)}
                                        className="text-gray-400 hover:text-white hover:bg-gray-800 border-0 p-1 h-6 w-6"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="h-56 overflow-y-auto">
                                    <div className="p-2 space-y-1">
                                        {queue.map((video, index) => (
                                            <div 
                                                key={video.id} 
                                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                                            >
                                                <div className="flex-shrink-0 w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-400">
                                                    {index + 1}
                                                </div>
                                                <div className="w-12 h-8 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                                                    {video.thumbnail && (
                                                        <img 
                                                            src={video.thumbnail} 
                                                            alt={video.title}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                            decoding="async"
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-white text-xs font-medium truncate">
                                                        {video.title}
                                                    </h4>
                                                    <p className="text-gray-400 text-xs truncate">
                                                        от {video.requester_name || video.user_id || 'Unknown'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Main player controls */}
                        <div className={`bg-gray-900/95 backdrop-blur-md border border-gray-700 shadow-2xl ${showQueue ? 'rounded-b-xl border-t-0' : 'rounded-xl'}`}>
                            {/* Основные элементы управления */}
                            <div className="flex items-center justify-between px-4 py-4">
                                {/* Информация о треке слева */}
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 bg-gray-800 rounded-md overflow-hidden flex-shrink-0">
                                        {currentVideo.thumbnail && (
                                            <img 
                                                src={currentVideo.thumbnail} 
                                                alt={currentVideo.title}
                                                className="w-full h-full object-cover"
                                                loading="eager"
                                                decoding="async"
                                            />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-white font-medium text-sm truncate">
                                            {currentVideo.title}
                                        </h3>
                                        <p className="text-gray-400 text-xs truncate">
                                            от {currentVideo.requester_name || currentVideo.user_id || 'Unknown'}
                                        </p>
                                    </div>
                                </div>

                                {/* Центральные кнопки управления */}
                                <div className="flex items-center gap-2">
                                    {/* Кнопка очереди */}
                                    {queue.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowQueue(!showQueue)}
                                            className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0 relative", TRANSITIONS.colors)}
                                            title={showQueue ? "Скрыть очередь" : "Показать очередь"}
                                        >
                                            {showQueue ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                                {queue.length}
                                            </span>
                                        </Button>
                                    )}
                                    
                                    {/* Кнопка закрытия */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={closePlayer}
                                        className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0", TRANSITIONS.colors)}
                                        title="Закрыть и поставить на паузу"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>

                                    {/* Кнопка воспроизведения/паузы */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={togglePlayPause}
                                        className={cn(BUTTON_SIZES.icon, "text-white bg-white/10 hover:bg-white/20 border-0", TRANSITIONS.colors)}
                                    >
                                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                    </Button>

                                    {/* Кнопка следующего видео */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={nextVideo}
                                        className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0", TRANSITIONS.colors)}
                                        title="Следующее видео"
                                    >
                                        <SkipForward className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Регулятор громкости справа */}
                                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleMute}
                                        className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0", TRANSITIONS.colors)}
                                        title={isMuted ? "Включить звук" : "Отключить звук"}
                                    >
                                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </Button>
                                    <div className="w-20">
                                        <Slider
                                            value={[isMuted ? 0 : (volume ?? 100)]}
                                            onValueChange={handleVolumeChange}
                                            max={100}
                                            step={1}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalPlayer;

