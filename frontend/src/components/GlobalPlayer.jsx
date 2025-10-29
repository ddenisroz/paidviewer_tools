import React, { useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, X, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import YouTube from 'react-youtube';
import { usePlayer } from '../context/PlayerContext';

const GlobalPlayer = () => {
    const {
        currentVideo,
        isPlaying,
        volume,
        isMuted,
        isVisible,
        isTheaterMode,
        // currentTime,
        // duration,
        playerRef,
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

    // Обработчик готовности плеера с установкой ссылки
    const handlePlayerReadyWithRef = (event) => {
        setPlayerRef(event.target);
        handlePlayerReady(event);
    };

    // Глобальный перехват ошибок YouTube API для браузерных расширений
    useEffect(() => {
        const originalConsoleError = console.error;
        window.originalConsoleError = originalConsoleError;
        
        // Перехватываем console.error только если еще не перехватывали
        if (!window.youtubeErrorHandlerInstalled) {
            console.error = (...args) => {
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
    const handleVolumeChange = (value) => {
        const newVolume = value[0];
        setVolume(newVolume);
    };

    // ✅ ВАЖНО: Вычисляем все переменные ДО условных return
    // Проверяем текущий путь, чтобы не показывать UI на странице YouTube
    const currentPath = window.location.pathname;
    const isOnYoutubePage = currentPath.includes('/dashboard/media/youtube');
    
    // Плеер работает всегда, UI показываем на всех страницах
    // На YouTube странице показываем видео, на других - только управление
    const showUI = isVisible && !isTheaterMode && !isOnYoutubePage;

    // ✅ ТЕПЕРЬ проверяем если нет видео, не показываем плеер
    if (!currentVideo) {
        return null;
    }

    return (
        <>
            {/* Основной YouTube плеер - показываем на YouTube странице */}
            {currentVideo && isOnYoutubePage && (
                <div className="w-full flex justify-center mt-4">
                    <div className="w-full max-w-4xl">
                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                            <YouTube
                                videoId={currentVideo.video_id}
                                onReady={handlePlayerReadyWithRef}
                                onStateChange={handlePlayerStateChange}
                                onError={handlePlayerError}
                                opts={{
                                    width: '100%',
                                    height: '100%',
                                    playerVars: {
                                        autoplay: 1,  // ✅ Включаем автоплей
                                        controls: 1,
                                        disablekb: 0,
                                        enablejsapi: 1,
                                        fs: 1,
                                        iv_load_policy: 3,
                                        modestbranding: 0,
                                        playsinline: 1,
                                        rel: 0,
                                        showinfo: 1,
                                        cc_load_policy: 0,
                                        hl: 'ru',
                                        origin: window.location.origin,
                                        widget_referrer: window.location.origin
                                    }
                                }}
                                key={`main-player-${currentVideo.video_id}-${Date.now()}`}
                                className="w-full h-full"
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Скрытый плеер для других страниц - воспроизводит только звук */}
            {currentVideo && !isOnYoutubePage && (
                <div className="hidden">
                    <YouTube
                        videoId={currentVideo.video_id}
                        onReady={handlePlayerReadyWithRef}
                        onStateChange={handlePlayerStateChange}
                        onError={handlePlayerError}
                        opts={{
                            width: '1px',
                            height: '1px',
                            playerVars: {
                                autoplay: 1,  // ✅ Включаем автоплей
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
            
            {/* UI плеера отцентрирован относительно main контейнера */}
            {showUI && (
                <div className="w-full flex justify-center mt-4">
                    <div className="w-full max-w-4xl">
                    <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl">
                        {/* Убрали тайм-бар для снижения нагрузки */}
                        
                        {/* Основные элементы управления */}
                        <div className="flex items-center justify-between px-4 py-4">
                            {/* Информация о треке слева */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-gray-800 rounded-md overflow-hidden flex-shrink-0">
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
                                    <p className="text-gray-400 text-xs truncate">
                                        от {currentVideo.requester_name || currentVideo.user_id || 'Unknown'}
                                    </p>
                                </div>
                            </div>

                            {/* Центральные кнопки управления */}
                            <div className="flex items-center gap-2">
                                {/* Кнопка закрытия (вместо предыдущего трека) */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={closePlayer}
                                    className="text-gray-400 hover:text-white hover:bg-gray-800 border-0 p-2 h-8 w-8"
                                    title="Закрыть и поставить на паузу"
                                >
                                    <X className="w-4 h-4" />
                                </Button>

                                {/* Кнопка воспроизведения/паузы */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        togglePlayPause();
                                        // Синхронизируем с основным плеером
                                        if (playerRef) {
                                            if (isPlaying) {
                                                playerRef.pauseVideo();
                                            } else {
                                                playerRef.playVideo();
                                            }
                                        }
                                    }}
                                    className="text-white bg-white/10 hover:bg-white/20 border-0 p-2 h-10 w-10"
                                >
                                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                </Button>

                                {/* Кнопка следующего видео */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={nextVideo}
                                    className="text-gray-400 hover:text-white hover:bg-gray-800 border-0 p-2 h-8 w-8"
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
                                    className="text-gray-400 hover:text-white hover:bg-gray-800 border-0 p-2 h-8 w-8"
                                    title={isMuted ? "Включить звук" : "Отключить звук"}
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
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalPlayer;

