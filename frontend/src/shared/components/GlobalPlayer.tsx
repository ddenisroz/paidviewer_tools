import React, { useEffect, useState } from 'react';

import { ChevronDown, ChevronUp, List, Pause, Play, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import YouTube from 'react-youtube';
import { useLocation } from 'react-router-dom';

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
        setPlayerRef,
        releasePlayerRef
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
        setPlayerRef(event.target, 'global');
        handlePlayerReady(event as unknown as Event);
        if (!isPlaying) {
            try {
                event.target.pauseVideo();
                event.target.mute();
            } catch (error) {
                // Ignore autoplay prevention errors
            }
        }
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

    useEffect(() => {
        return () => {
            releasePlayerRef('global');
        };
    }, [releasePlayerRef]);

    // Обработка громкости
    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
    };

    // [OK] IMPORTANT: compute variables before conditional return
    // Check current route to avoid showing UI on YouTube page
    const location = useLocation();
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const searchParams = new URLSearchParams(currentSearch);
    const activeTab = searchParams.get('tab');
    const isMediaYoutubeTab = currentPath.startsWith('/dashboard/media') && (!activeTab || activeTab === 'youtube');
    const isOnYoutubePage = currentPath.startsWith('/dashboard/youtube') || isMediaYoutubeTab;
    
    // Плеер работает всегда, UI показываем на всех страницах КРОМЕ YouTube
    // На YouTube странице - ничего не показываем (там свой встроенный плеер)
    const showUI = isVisible && !isTheaterMode && !isOnYoutubePage;

    const displayVideo = currentVideo || queue[0] || null;
    const displayThumbnail = displayVideo?.thumbnail || displayVideo?.thumbnail_url;

    // [OK] ТЕПЕРЬ проверяем если нет видео, не показываем плеер
    if (!displayVideo) {
        return null;
    }

    return (
        <>
            {/* Скрытый плеер - воспроизводит только звук */}
            {/* НА СТРАНИЦЕ /dashboard/youtube используется встроенный плеер из YoutubeIntegrationPage */}
            {displayVideo && !isOnYoutubePage && (
                <div className="hidden">
                    <YouTube
                        videoId={displayVideo.video_id}
                        onReady={handlePlayerReadyWithRef as (event: { target: unknown; data?: number }) => void}
                        onStateChange={handlePlayerStateChange as (event: { target: unknown; data?: number }) => void}
                        onError={handlePlayerError as (event: { target: unknown; data?: number }) => void}
                        opts={{
                            width: '1px',
                            height: '1px',
                            playerVars: {
                                autoplay: isPlaying ? 1 : 0,
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
                        key={`hidden-player-${displayVideo.video_id}`}
                        className="hidden"
                    />
                </div>
            )}
            
            {/* UI плеера фиксирован внизу экрана с отступом */}
            {showUI && (
                <div className="absolute bottom-4 left-4 z-40 w-[calc(100%-2rem)] max-w-[320px] pointer-events-none">
                    <div className="w-full pointer-events-auto">
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
                                                    {(video.thumbnail || video.thumbnail_url) && (
                                                        <img 
                                                            src={video.thumbnail || video.thumbnail_url} 
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
                            <div className="flex flex-col gap-2 px-3 py-1.5">
                                {/* Информация о треке слева */}
                                <div className="flex items-center gap-2 min-w-0 w-full">
                                    <div className="w-8 h-8 bg-gray-800 rounded-md overflow-hidden flex-shrink-0">
                                {displayThumbnail && (
                                    <img 
                                        src={displayThumbnail} 
                                        alt={displayVideo.title}
                                        className="w-full h-full object-cover"
                                        loading="eager"
                                        decoding="async"
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-white font-medium text-sm truncate">
                                    {displayVideo.title}
                                </h3>
                                <p className="text-gray-400 text-xs truncate">
                                    от {displayVideo.requester_name || displayVideo.user_id || 'Unknown'}
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
                                <div className="flex items-center gap-2 w-full">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleMute}
                                        className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0", TRANSITIONS.colors)}
                                        title={isMuted ? "Включить звук" : "Отключить звук"}
                                    >
                                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </Button>
                                    <div className="flex-1">
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

