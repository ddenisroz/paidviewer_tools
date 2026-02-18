import React, { useEffect, useState } from 'react';

import { Youtube } from 'lucide-react';
import { createPortal } from 'react-dom';
import ReactPlayer from 'react-player';
import { useLocation } from 'react-router-dom';

import { usePlayer } from '@/context/PlayerContext';
import { youtubeService } from '@/services/api/services/youtubeService';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { toast } from '@/utils/toastManager';

import { MiniPlayerUI, useGlobalPlayer } from './player';

import type { DisplayVideo } from './player';

/**
 * GlobalPlayer - Orchestrates YouTube playback across the application.
 * 
 * Architecture:
 * - useGlobalPlayer hook: player wrapper, event handlers, time sync
 * - MiniPlayerUI: floating mini-player UI for non-YouTube pages
 * - This component: orchestration, portal rendering, visibility logic
 */
const GlobalPlayer: React.FC = () => {
    const {
        currentVideo,
        isPlaying,
        volume,
        isMuted,
        isVisible,
        isMinimized,
        isTheaterMode,
        queue,
        togglePlayPause,
        setVolume,
        toggleMute,
        nextVideo,
        loadQueue,
        minimizePlayer,
        maximizePlayer,
        setPlayerRef,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        playerContainerRef
    } = usePlayer();

    const [showQueue, setShowQueue] = useState(false);
    const [miniPlayerContainer, setMiniPlayerContainer] = useState<HTMLElement | null>(null);
    const [playerRoot] = useState<HTMLDivElement | null>(() => {
        if (typeof document === 'undefined') return null;
        const node = document.createElement('div');
        node.id = 'global-youtube-root';
        node.className = 'w-full h-full';
        node.style.width = '100%';
        node.style.height = '100%';
        node.style.position = 'fixed';
        node.style.top = '-9999px';
        node.style.left = '-9999px';
        node.style.pointerEvents = 'none';
        node.style.opacity = '0';
        node.style.zIndex = '40';
        node.style.overflow = 'hidden';
        node.style.willChange = 'top, left, width, height';
        node.style.backgroundColor = 'transparent';
        return node;
    });

    useEffect(() => {
        setMiniPlayerContainer(document.getElementById('youtube-mini-player-slot'));
    }, []);

    // Page detection
    const location = useLocation();
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const activeTab = searchParams.get('tab');
    const isMediaYoutubeTab = currentPath.startsWith('/dashboard/media') && (!activeTab || activeTab === 'youtube');
    const isOnYoutubePage = currentPath.startsWith('/dashboard/youtube') || isMediaYoutubeTab;

    // Show mini-UI only on non-YouTube pages and not minimized
    const showMiniUI = isVisible && !isMinimized && !isTheaterMode && !isOnYoutubePage;

    // Show minimized button when player is minimized (in sidebar)
    const showMinimizedButton = isVisible && isMinimized && !isOnYoutubePage;

    // Display video logic
    const displayVideo = (currentVideo || queue[0] || null) as DisplayVideo | null;
    const hasVideo = Boolean(displayVideo);
    const displayThumbnail = displayVideo?.thumbnail || displayVideo?.thumbnail_url;
    const upcomingQueue = displayVideo
        ? queue.filter((item) => item.id !== displayVideo.id && item.video_id !== displayVideo.video_id)
        : queue;

    // Player hook
    const {
        playerRef,
        handleReady,
        handleEnded,
        handleError,
        handlePlay,
        handlePause
    } = useGlobalPlayer({
        displayVideo,
        currentVideo: currentVideo as DisplayVideo | null,
        isPlaying,
        setVolume,
        toggleMute,
        setPlayerRef,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        nextVideo
    });

    // Volume change handler
    const handleVolumeChange = (value: number[]) => {
        setVolume(value[0]);
    };

    const handleMiniClose = (): void => {
        setShowQueue(false);
        minimizePlayer();
    };

    const handleClearQueue = async (): Promise<void> => {
        const confirmed = window.confirm('Очистить очередь треков?');
        if (!confirmed) return;
        try {
            await youtubeService.clearQueue();
            toast.success('Очередь очищена');
            loadQueue(true);
        } catch {
            toast.error('Не удалось очистить очередь');
        }
    };

    const handleQueueSelect = async (video: DisplayVideo): Promise<void> => {
        try {
            if (!video?.id) return;
            if (typeof window !== 'undefined') {
                window.ytUserStarted = true;
            }
            await youtubeService.playQueueItem(Number(video.id));
            loadQueue(true);
            setShowQueue(false);
        } catch {
            toast.error('Не удалось переключить видео');
        }
    };

    const handlePlayerSurfaceInteract = (): void => {
        if (typeof window !== 'undefined') {
            window.ytUserStarted = true;
        }
    };

    useEffect(() => {
        if (!showMiniUI && showQueue) {
            setShowQueue(false);
        }
    }, [showMiniUI, showQueue]);

    const youtubeUrl = displayVideo ? (displayVideo.url || `https://www.youtube.com/watch?v=${displayVideo.video_id}`) : '';

    // React-Player component (cast to any for library compatibility - same as original)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ReactPlayerAny = ReactPlayer as any;

    const reactPlayerComponent = hasVideo ? (
        <div
            className="relative w-full h-full"
            data-player-container="overlay"
            onPointerDownCapture={handlePlayerSurfaceInteract}
        >
            <ReactPlayerAny
                ref={playerRef}
                src={youtubeUrl}
                playing={isPlaying}
                volume={volume / 100}
                muted={isMuted}
                width="100%"
                height="100%"
                controls={true}
                pip={false}
                stopOnUnmount={false}
                onReady={() => {
                    handleReady();
                }}
                onPlay={handlePlay}
                onPlaying={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onError={handleError}
                config={{
                    youtube: {
                        enablejsapi: 1,
                        rel: 0,
                        iv_load_policy: 3,
                        cc_load_policy: 0,
                        hl: 'ru',
                        origin: window.location.origin
                    }
                }}
            />
            
        </div>
    ) : null;

    useEffect(() => {
        if (!playerRoot) return;
        if (!playerRoot.parentElement) {
            document.body.appendChild(playerRoot);
        }
    }, [playerRoot]);

    useEffect(() => {
        if (!playerRoot) return;
        if (!hasVideo || !playerContainerRef) {
            playerRoot.style.position = 'fixed';
            playerRoot.style.top = '-9999px';
            playerRoot.style.left = '-9999px';
            playerRoot.style.width = '320px';
            playerRoot.style.height = '180px';
            playerRoot.style.pointerEvents = 'none';
            playerRoot.style.opacity = '0';
            return;
        }

        const updatePosition = () => {
            const rect = playerContainerRef.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                requestAnimationFrame(updatePosition);
                return;
            }
            const computed = window.getComputedStyle(playerContainerRef);
            playerRoot.style.position = 'fixed';
            playerRoot.style.top = `${rect.top}px`;
            playerRoot.style.left = `${rect.left}px`;
            playerRoot.style.width = `${rect.width}px`;
            playerRoot.style.height = `${rect.height}px`;
            playerRoot.style.borderRadius = isTheaterMode ? '0px' : (computed.borderRadius || '0px');
            playerRoot.style.overflow = 'hidden';
            playerRoot.style.pointerEvents = 'auto';
            playerRoot.style.zIndex = isTheaterMode ? '10000' : '40';
            playerRoot.style.opacity = '1';
            playerRoot.style.backgroundColor = isTheaterMode ? 'black' : 'transparent';
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        const observer = new ResizeObserver(updatePosition);
        observer.observe(playerContainerRef);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            observer.disconnect();
        };
    }, [playerRoot, playerContainerRef, hasVideo, isOnYoutubePage, isTheaterMode]);

    useEffect(() => {
        return () => {
            if (playerRoot?.parentElement) {
                playerRoot.parentElement.removeChild(playerRoot);
            }
        };
    }, [playerRoot]);

    if (!hasVideo || !displayVideo) {
        return null;
    }

    const activeDisplayVideo = displayVideo;

    return (
        <>
            {/* Keep a single ReactPlayer instance mounted in a fixed overlay root */}
            {playerRoot && reactPlayerComponent && createPortal(reactPlayerComponent, playerRoot)}

            {/* Mini player UI */}
            {showMiniUI && (miniPlayerContainer
                ? createPortal(
                    <MiniPlayerUI
                        displayVideo={activeDisplayVideo}
                        displayThumbnail={displayThumbnail}
                        isPlaying={isPlaying}
                        isMuted={isMuted}
                        volume={volume}
                        queue={upcomingQueue as DisplayVideo[]}
                        showQueue={showQueue}
                        onToggleQueue={() => setShowQueue(!showQueue)}
                        onSelectQueueItem={handleQueueSelect}
                        onTogglePlayPause={togglePlayPause}
                        onNextVideo={nextVideo}
                        onToggleMute={toggleMute}
                        onVolumeChange={handleVolumeChange}
                        onClearQueue={handleClearQueue}
                        onClose={handleMiniClose}
                        variant="sidebar"
                    />,
                    miniPlayerContainer
                )
                : (
                    <MiniPlayerUI
                        displayVideo={activeDisplayVideo}
                        displayThumbnail={displayThumbnail}
                        isPlaying={isPlaying}
                        isMuted={isMuted}
                        volume={volume}
                        queue={upcomingQueue as DisplayVideo[]}
                        showQueue={showQueue}
                        onToggleQueue={() => setShowQueue(!showQueue)}
                        onSelectQueueItem={handleQueueSelect}
                        onTogglePlayPause={togglePlayPause}
                        onNextVideo={nextVideo}
                        onToggleMute={toggleMute}
                        onVolumeChange={handleVolumeChange}
                        onClearQueue={handleClearQueue}
                        onClose={handleMiniClose}
                        variant="floating"
                    />
                )
            )}

            {/* Minimized player button - positioned at bottom of sidebar */}
            {showMinimizedButton && (
                <div className="fixed bottom-4 left-4 z-50">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => {
                                        maximizePlayer();
                                    }}
                                    className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-500 shadow-lg ring-2 ring-red-500/50 transition-colors"
                                >
                                    <div className="relative">
                                        <Youtube className="h-6 w-6 text-white" />
                                    </div>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p className="text-xs max-w-[200px] truncate">{activeDisplayVideo.title}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </>
    );
};

export default GlobalPlayer;
