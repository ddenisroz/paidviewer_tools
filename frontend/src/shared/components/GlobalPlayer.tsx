import React, { useRef, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { createPortal } from 'react-dom';

import { ChevronDown, ChevronUp, List, Pause, Play, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { BUTTON_SIZES, TRANSITIONS } from '@/constants/designSystem';
import { usePlayer } from '@/context/PlayerContext';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Slider } from '@/shared/components/ui/slider';

// react-player YouTube instance type
interface ReactPlayerInstance {
    seekTo: (seconds: number, type?: 'seconds' | 'fraction') => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    getInternalPlayer: () => unknown;
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
        togglePlayPause,
        setVolume,
        toggleMute,
        nextVideo,
        closePlayer,
        setPlayerRef,
        releasePlayerRef,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        // Portal container from context
        playerContainerRef
    } = usePlayer();

    const [showQueue, setShowQueue] = useState(false);
    const playerRef = useRef<ReactPlayerInstance>(null);
    const hiddenContainerRef = useRef<HTMLDivElement>(null);

    // Определяем текущую страницу
    const location = useLocation();
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const searchParams = new URLSearchParams(currentSearch);
    const activeTab = searchParams.get('tab');
    const isMediaYoutubeTab = currentPath.startsWith('/dashboard/media') && (!activeTab || activeTab === 'youtube');
    const isOnYoutubePage = currentPath.startsWith('/dashboard/youtube') || isMediaYoutubeTab;

    // Показывать мини-UI только на страницах НЕ YouTube
    const showMiniUI = isVisible && !isTheaterMode && !isOnYoutubePage;

    const displayVideo = currentVideo || queue[0] || null;
    const displayThumbnail = displayVideo?.thumbnail || displayVideo?.thumbnail_url;

    // Handler for player ready
    const handleReady = useCallback(() => {
        if (!playerRef.current || !displayVideo) return;

        // Create a wrapper that matches the expected interface
        const playerWrapper = {
            pauseVideo: () => {
                // react-player controls via playing prop
            },
            playVideo: () => {
                // react-player controls via playing prop
            },
            setVolume: (vol: number) => {
                setVolume(vol);
            },
            mute: () => {
                toggleMute();
            },
            unMute: () => {
                toggleMute();
            },
            getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
            getDuration: () => playerRef.current?.getDuration() || 0,
            seekTo: (seconds: number) => {
                playerRef.current?.seekTo(seconds, 'seconds');
            },
            getPlayerState: () => isPlaying ? 1 : 2,
            // Required by YouTubePlayer interface
            loadVideoById: () => { },
            cueVideoById: () => { }
        };

        setPlayerRef(playerWrapper, 'global');
        handlePlayerReady({ target: playerWrapper });

        // Sync playback time with server
        if (currentVideo?.played_at) {
            try {
                const playedAtDate = new Date(currentVideo.played_at.endsWith('Z') ? currentVideo.played_at : currentVideo.played_at + 'Z');
                const now = new Date();
                const diffSeconds = (now.getTime() - playedAtDate.getTime()) / 1000;

                if (diffSeconds > 0 && playerRef.current) {
                    playerRef.current.seekTo(diffSeconds, 'seconds');
                }
            } catch (e) {
                console.error("Error syncing time", e);
            }
        }
    }, [displayVideo, currentVideo, setPlayerRef, handlePlayerReady, isPlaying, setVolume, toggleMute]);

    // Handle video end
    const handleEnded = useCallback(() => {
        nextVideo();
    }, [nextVideo]);

    // Handle errors
    const handleError = useCallback((error: unknown) => {
        console.error('[ReactPlayer] Error:', error);
        handlePlayerError({ data: error });
    }, [handlePlayerError]);

    // Handle progress/state changes
    const handlePlay = useCallback(() => {
        if (!isPlaying) {
            handlePlayerStateChange({ data: 1 }); // Playing state
        }
    }, [isPlaying, handlePlayerStateChange]);

    const handlePause = useCallback(() => {
        if (isPlaying) {
            handlePlayerStateChange({ data: 2 }); // Paused state
        }
    }, [isPlaying, handlePlayerStateChange]);

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
    };

    if (!displayVideo) {
        return null;
    }

    // Определяем, куда рендерить YouTube iframe
    const hasExternalContainer = !!playerContainerRef;
    const targetContainer = hasExternalContainer ? playerContainerRef : hiddenContainerRef.current;

    // YouTube URL from video_id
    const youtubeUrl = `https://www.youtube.com/watch?v=${displayVideo.video_id}`;

    // Cast to any to avoid TypeScript errors with the library import
    const ReactPlayerAny = ReactPlayer as any;

    // React-Player component
    const reactPlayerComponent = (
        <ReactPlayerAny
            ref={playerRef}
            url={youtubeUrl}
            playing={isPlaying}
            volume={(isMuted ? 0 : volume) / 100}
            muted={isMuted}
            width="100%"
            height="100%"
            controls={hasExternalContainer}
            pip={true}
            stopOnUnmount={false}
            onReady={handleReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleError}
            config={{
                youtube: {
                    playerVars: {
                        autoplay: 1,
                        modestbranding: 1,
                        rel: 0,
                        iv_load_policy: 3,
                        cc_load_policy: 0,
                        hl: 'ru',
                        origin: window.location.origin
                    }
                } as any
            }}
        />
    );

    return (
        <>
            {/* Hidden container for when there's no external container */}
            <div
                ref={hiddenContainerRef}
                className={hasExternalContainer ? 'hidden' : 'fixed'}
                style={{
                    top: -9999,
                    left: -9999,
                    width: 320,
                    height: 180,
                    pointerEvents: 'none',
                    opacity: 0
                }}
            >
                {!hasExternalContainer && reactPlayerComponent}
            </div>

            {/* Portal to external container if available */}
            {hasExternalContainer && targetContainer && createPortal(reactPlayerComponent, targetContainer)}

            {/* Mini player UI - shows in sidebar on non-YouTube pages */}
            {showMiniUI && (
                <div className="fixed bottom-0 right-0 p-6 z-40 w-[400px]">
                    <div className="relative group">
                        {/* Queue panel - floating above */}
                        {showQueue && queue.length > 0 && (
                            <div className="absolute bottom-full mb-2 left-0 right-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                                    <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Очередь</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowQueue(false)}
                                        className="h-6 w-6 p-0 hover:bg-white/10 rounded-full"
                                    >
                                        <ChevronDown className="w-4 h-4 text-white/70" />
                                    </Button>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                                    {queue.map((video, index) => (
                                        <div
                                            key={video.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors group/item"
                                        >
                                            <span className="text-[10px] font-mono text-white/30 w-4 text-center">{index + 1}</span>
                                            <div className="w-10 h-6 bg-black/50 rounded overflow-hidden flex-shrink-0 relative">
                                                <img
                                                    src={video.thumbnail || video.thumbnail_url}
                                                    alt=""
                                                    className="w-full h-full object-cover opacity-80 group-hover/item:opacity-100 transition-opacity"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white/90 text-xs font-medium truncate">{video.title}</p>
                                                <p className="text-white/50 text-[10px] truncate">{video.requester_name || video.user_id}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Main Player Card */}
                        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflo-hidden flex flex-col relative overflow-hidden">
                            {/* Progress bar could go here if we had progress state */}

                            <div className="flex items-center p-3 gap-3">
                                {/* Album Art / Video Thumbnail */}
                                <div className="group/thumb relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black/50 shadow-inner">
                                    {displayThumbnail ? (
                                        <img
                                            src={displayThumbnail}
                                            alt={displayVideo.title}
                                            className={cn(
                                                "w-full h-full object-cover transition-transform duration-700",
                                                isPlaying ? "scale-110" : "scale-100 grayscale-[0.2]"
                                            )}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/20">
                                            <Volume2 className="w-6 h-6" />
                                        </div>
                                    )}
                                    {/* Overlay Play/Pause on hover */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={togglePlayPause}>
                                        {isPlaying ? <Pause className="w-6 h-6 text-white fill-current" /> : <Play className="w-6 h-6 text-white fill-current" />}
                                    </div>
                                </div>

                                {/* Info & Controls */}
                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                    <div className="space-y-0.5">
                                        <h3 className="text-white font-medium text-sm leading-tight truncate pr-8">
                                            {displayVideo.title}
                                        </h3>
                                        <p className="text-white/50 text-xs truncate">
                                            {displayVideo.requester_name || displayVideo.user_id || 'Unknown'}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={togglePlayPause}
                                                className="h-7 w-7 p-0 rounded-full hover:bg-white/10 text-white/90"
                                            >
                                                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={nextVideo}
                                                className="h-7 w-7 p-0 rounded-full hover:bg-white/10 text-white/70 hover:text-white"
                                            >
                                                <SkipForward className="w-4 h-4 fill-current" />
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={toggleMute}
                                                className="h-6 w-6 p-0 hover:bg-transparent text-white/50 hover:text-white/80"
                                            >
                                                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                            </Button>
                                            <Slider
                                                value={[isMuted ? 0 : (volume ?? 100)]}
                                                onValueChange={handleVolumeChange}
                                                max={100}
                                                step={1}
                                                className="h-1.5 w-full cursor-pointer [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/20 [&_span]:bg-white/80 [&>span:last-child]:h-3 [&>span:last-child]:w-3 [&>span:last-child]:border-0 [&>span:last-child]:shadow-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Top Right Controls */}
                            <div className="absolute top-2 right-2 flex items-center gap-1">
                                {queue.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowQueue(!showQueue)}
                                        className={cn(
                                            "h-6 w-6 p-0 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors",
                                            showQueue && "text-white bg-white/10"
                                        )}
                                    >
                                        <List className="w-3.5 h-3.5" />
                                        {queue.length > 0 && (
                                            <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full ring-2 ring-black" />
                                        )}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={closePlayer}
                                    className="h-6 w-6 p-0 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalPlayer;
