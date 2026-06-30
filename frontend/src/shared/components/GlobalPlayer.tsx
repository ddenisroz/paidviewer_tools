import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Youtube } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import { usePlayer } from '@/context/PlayerContext';
import { youtubeService } from '@/services/api/services/youtubeService';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { toast } from '@/utils/toastManager';

import { MiniPlayerUI, useGlobalPlayer } from './player';

import type { DisplayVideo } from './player';
import type { YouTubePlayer } from './player/types';

type MaybePromise<T> = T | Promise<T>;

interface RawYouTubePlayer {
    playVideo?: () => MaybePromise<void>;
    pauseVideo?: () => MaybePromise<void>;
    setVolume?: (volume: number) => MaybePromise<void>;
    getVolume?: () => MaybePromise<number>;
    isMuted?: () => MaybePromise<boolean>;
    mute?: () => MaybePromise<void>;
    unMute?: () => MaybePromise<void>;
    getCurrentTime?: () => MaybePromise<number>;
    getDuration?: () => MaybePromise<number>;
    getPlayerState?: () => MaybePromise<number>;
    seekTo?: (seconds: number, allowSeekAhead?: boolean) => MaybePromise<void>;
    loadVideoById?: (
        videoId: string | { videoId: string; startSeconds?: number },
        startSeconds?: number
    ) => MaybePromise<void>;
    cueVideoById?: (
        videoId: string | { videoId: string; startSeconds?: number },
        startSeconds?: number
    ) => MaybePromise<void>;
}

interface YouTubeIframeApiEvent<TData = unknown> {
    data?: TData;
    target: RawYouTubePlayer;
}

interface YouTubeIframePlayerOptions {
    width: string;
    height: string;
    videoId: string;
    playerVars: Record<string, string | number>;
    events: {
        onReady: (event: YouTubeIframeApiEvent) => void;
        onStateChange: (event: YouTubeIframeApiEvent<number>) => void;
        onError: (event: YouTubeIframeApiEvent<number>) => void;
    };
}

interface YouTubeIframeApi {
    Player: new (elementId: string, options: YouTubeIframePlayerOptions) => RawYouTubePlayer;
}

declare global {
    interface Window {
        YT?: YouTubeIframeApi;
        onYouTubeIframeAPIReady?: () => void;
    }
}

interface YoutubeMetricsCache {
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
}

const readMaybePromise = <T,>(value: MaybePromise<T> | undefined, onValue: (resolved: T) => void): void => {
    if (value === undefined) {
        return;
    }
    Promise.resolve(value)
        .then(onValue)
        .catch(() => undefined);
};

let youtubeIframeApiPromise: Promise<void> | null = null;

const loadYoutubeIframeApi = (): Promise<void> => {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('YouTube iframe API requires a browser'));
    }
    if (window.YT?.Player) {
        return Promise.resolve();
    }
    if (youtubeIframeApiPromise) {
        return youtubeIframeApiPromise;
    }

    youtubeIframeApiPromise = new Promise<void>((resolve, reject) => {
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previousReady?.();
            resolve();
        };

        if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => reject(new Error('Failed to load YouTube iframe API'));
        document.head.appendChild(script);
    });

    return youtubeIframeApiPromise;
};

const createYoutubePlayerAdapter = (
    getPlayer: () => RawYouTubePlayer | null,
    metricsCache: React.MutableRefObject<YoutubeMetricsCache>
): YouTubePlayer => ({
    playVideo: () => {
        void getPlayer()?.playVideo?.();
    },
    pauseVideo: () => {
        void getPlayer()?.pauseVideo?.();
    },
    setVolume: (volume: number) => {
        const normalizedVolume = Math.max(0, Math.min(100, volume));
        metricsCache.current.volume = normalizedVolume;
        void getPlayer()?.setVolume?.(normalizedVolume);
    },
    getVolume: () => {
        readMaybePromise(getPlayer()?.getVolume?.(), (volume) => {
            metricsCache.current.volume = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
        });
        return Math.round(metricsCache.current.volume);
    },
    isMuted: () => {
        readMaybePromise(getPlayer()?.isMuted?.(), (muted) => {
            metricsCache.current.muted = Boolean(muted);
        });
        return metricsCache.current.muted;
    },
    mute: () => {
        metricsCache.current.muted = true;
        void getPlayer()?.mute?.();
    },
    unMute: () => {
        metricsCache.current.muted = false;
        void getPlayer()?.unMute?.();
    },
    getCurrentTime: () => {
        readMaybePromise(getPlayer()?.getCurrentTime?.(), (time) => {
            const nextTime = Number(time);
            metricsCache.current.currentTime = Number.isFinite(nextTime) ? nextTime : 0;
        });
        return metricsCache.current.currentTime;
    },
    getDuration: () => {
        readMaybePromise(getPlayer()?.getDuration?.(), (duration) => {
            const nextDuration = Number(duration);
            metricsCache.current.duration = Number.isFinite(nextDuration) ? nextDuration : 0;
        });
        return metricsCache.current.duration;
    },
    seekTo: (seconds: number) => {
        metricsCache.current.currentTime = Math.max(0, seconds);
        void getPlayer()?.seekTo?.(Math.max(0, seconds), true);
    },
    loadVideoById: (videoId: string, startSeconds?: number) => {
        void getPlayer()?.loadVideoById?.({ videoId, startSeconds });
    },
    cueVideoById: (videoId: string, startSeconds?: number) => {
        void getPlayer()?.cueVideoById?.({ videoId, startSeconds });
    },
});

const extractYoutubeVideoId = (url?: string): string | null => {
    if (!url) return null;
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.includes('youtu.be')) {
            return parsedUrl.pathname.split('/').filter(Boolean)[0] || null;
        }
        if (parsedUrl.searchParams.get('v')) {
            return parsedUrl.searchParams.get('v');
        }
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        const embedIndex = pathParts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
        return embedIndex >= 0 ? pathParts[embedIndex + 1] || null : null;
    } catch {
        return null;
    }
};

const parseYoutubeTime = (value: string | null): number | undefined => {
    if (!value) return undefined;
    const plainSeconds = Number(value.replace(/s$/, ''));
    if (Number.isFinite(plainSeconds)) {
        return Math.max(0, plainSeconds);
    }
    const match = value.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/i);
    if (!match) return undefined;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds > 0 ? totalSeconds : undefined;
};

const extractYoutubeStartSeconds = (url?: string): number | undefined => {
    if (!url) return undefined;
    try {
        const parsedUrl = new URL(url);
        return parseYoutubeTime(parsedUrl.searchParams.get('t') || parsedUrl.searchParams.get('start'));
    } catch {
        return undefined;
    }
};

const readYoutubeMessagePayload = (data: unknown): Record<string, unknown> | null => {
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    }
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
};

const readYoutubeMessageState = (payload: Record<string, unknown>): number | null => {
    if (payload.event === 'onStateChange' && typeof payload.info === 'number') {
        return payload.info;
    }
    if (payload.event === 'infoDelivery' && payload.info && typeof payload.info === 'object') {
        const info = payload.info as Record<string, unknown>;
        return typeof info.playerState === 'number' ? info.playerState : null;
    }
    return null;
};

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
        currentTime,
        duration,
        isMuted,
        isVisible,
        isMinimized,
        isTheaterMode,
        queue,
        skipVotes,
        togglePlayPause,
        setVolume,
        toggleMute,
        nextVideo,
        loadQueue,
        minimizePlayer,
        maximizePlayer,
        setPlayerRef,
        updateTime,
        markPlaybackStarted,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        playerContainerRef,
    } = usePlayer();

    const [showQueue, setShowQueue] = useState(false);
    const youtubePlayerRef = useRef<RawYouTubePlayer | null>(null);
    const activePlayerVideoIdRef = useRef<string | null>(null);
    const lastObservedPlayerStateRef = useRef<number | null>(null);
    const metricsCacheRef = useRef<YoutubeMetricsCache>({
        currentTime: 0,
        duration: 0,
        volume,
        muted: isMuted,
    });
    const [clearQueueConfirmOpen, setClearQueueConfirmOpen] = useState(false);
    const [miniPlayerContainer, setMiniPlayerContainer] = useState<HTMLElement | null>(null);
    const [canDockMiniPlayer, setCanDockMiniPlayer] = useState(false);
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
        const slot = document.getElementById('youtube-mini-player-slot');
        setMiniPlayerContainer(slot);

        if (!slot) {
            setCanDockMiniPlayer(false);
            return;
        }

        const updateDockState = () => {
            const width = slot.getBoundingClientRect().width;
            const isVisible = window.getComputedStyle(slot).display !== 'none';
            setCanDockMiniPlayer(isVisible && width >= 220);
        };

        updateDockState();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateDockState);
            return () => {
                window.removeEventListener('resize', updateDockState);
            };
        }
        const observer = new ResizeObserver(updateDockState);
        observer.observe(slot);
        window.addEventListener('resize', updateDockState);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateDockState);
        };
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

    // Display video logic
    const displayVideo = (currentVideo || queue[0] || null) as DisplayVideo | null;
    const hasVideo = Boolean(displayVideo);

    // Show minimized button only after closing an active mini-player in this session.
    const showMinimizedButton = isVisible && isMinimized && !isOnYoutubePage && hasVideo;
    const displayThumbnail = displayVideo?.thumbnail || displayVideo?.thumbnail_url;
    const upcomingQueue = displayVideo
        ? queue.filter((item) => item.id !== displayVideo.id && item.video_id !== displayVideo.video_id)
        : queue;
    const playerAdapter = useMemo(
        () => createYoutubePlayerAdapter(() => youtubePlayerRef.current, metricsCacheRef),
        []
    );
    const playerVideoId = displayVideo?.video_id || extractYoutubeVideoId(displayVideo?.url) || '';
    const playerStartSeconds = extractYoutubeStartSeconds(displayVideo?.url);
    const refreshCachedMetrics = useCallback(() => {
        const player = youtubePlayerRef.current;
        if (!player) return;
        readMaybePromise(player.getCurrentTime?.(), (time) => {
            const nextTime = Number(time);
            metricsCacheRef.current.currentTime = Number.isFinite(nextTime) ? nextTime : 0;
            updateTime();
        });
        readMaybePromise(player.getDuration?.(), (duration) => {
            const nextDuration = Number(duration);
            metricsCacheRef.current.duration = Number.isFinite(nextDuration) ? nextDuration : 0;
            updateTime();
        });
        readMaybePromise(player.getVolume?.(), (playerVolume) => {
            metricsCacheRef.current.volume = Math.max(0, Math.min(100, Math.round(Number(playerVolume) || 0)));
            updateTime();
        });
        readMaybePromise(player.isMuted?.(), (muted) => {
            metricsCacheRef.current.muted = Boolean(muted);
            updateTime();
        });
    }, [updateTime]);

    const syncPlayerMetrics = useCallback(() => {
        refreshCachedMetrics();
        updateTime();
    }, [refreshCachedMetrics, updateTime]);

    // Player hook
    const { handleReady, handleError, handleStateChange } = useGlobalPlayer({
        displayVideo,
        currentVideo: currentVideo as DisplayVideo | null,
        setPlayerRef,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        nextVideo,
    });

    const handleYoutubeWindowMessage = useCallback(
        (event: MessageEvent) => {
            if (!event.origin.includes('youtube.com') && !event.origin.includes('youtube-nocookie.com')) {
                return;
            }

            const iframe = document.getElementById('global-youtube-player') as HTMLIFrameElement | null;
            if (!iframe) {
                return;
            }

            const payload = readYoutubeMessagePayload(event.data);
            if (!payload) {
                return;
            }

            if (payload.event === 'infoDelivery' && payload.info && typeof payload.info === 'object') {
                const info = payload.info as Record<string, unknown>;
                if (typeof info.currentTime === 'number') {
                    metricsCacheRef.current.currentTime = info.currentTime;
                }
                if (typeof info.duration === 'number') {
                    metricsCacheRef.current.duration = info.duration;
                }
                if (typeof info.volume === 'number') {
                    metricsCacheRef.current.volume = Math.max(0, Math.min(100, Math.round(info.volume)));
                }
                if (typeof info.muted === 'boolean') {
                    metricsCacheRef.current.muted = info.muted;
                }
            }

            const nextPlayerState = readYoutubeMessageState(payload);
            if (nextPlayerState === null) {
                return;
            }

            handleStateChange({ data: nextPlayerState, target: playerAdapter });
            updateTime();
        },
        [handleStateChange, playerAdapter, updateTime]
    );

    useEffect(() => {
        window.addEventListener('message', handleYoutubeWindowMessage);
        return () => {
            window.removeEventListener('message', handleYoutubeWindowMessage);
        };
    }, [handleYoutubeWindowMessage]);

    const pollYoutubePlayerState = useCallback(() => {
        const player = youtubePlayerRef.current;
        if (!player?.getPlayerState) {
            return;
        }

        readMaybePromise(player.getPlayerState(), (playerState) => {
            if (typeof playerState !== 'number' || !Number.isFinite(playerState)) {
                return;
            }
            if (lastObservedPlayerStateRef.current === playerState) {
                return;
            }
            lastObservedPlayerStateRef.current = playerState;
            handleStateChange({ data: playerState, target: playerAdapter });
            updateTime();
        });
    }, [handleStateChange, playerAdapter, updateTime]);

    useEffect(() => {
        if (!hasVideo || !playerVideoId) {
            return;
        }

        const intervalId = window.setInterval(pollYoutubePlayerState, 500);
        return () => window.clearInterval(intervalId);
    }, [hasVideo, playerVideoId, pollYoutubePlayerState]);

    // Volume change handler
    const handleVolumeChange = (value: number[]) => {
        setVolume(value[0]);
    };

    const handleMiniClose = (): void => {
        setShowQueue(false);
        minimizePlayer();
    };

    const handleClearQueue = async (): Promise<void> => {
        setClearQueueConfirmOpen(true);
    };

    const confirmClearQueue = async (): Promise<void> => {
        try {
            await youtubeService.clearQueue();
            toast.success('Очередь очищена');
            loadQueue(true);
        } catch {
            toast.error('Не удалось очистить очередь');
        } finally {
            setClearQueueConfirmOpen(false);
        }
    };

    const handleQueueSelect = async (video: DisplayVideo): Promise<void> => {
        try {
            if (!video?.id) return;
            markPlaybackStarted();
            await youtubeService.playQueueItem(Number(video.id));
            loadQueue(true);
            setShowQueue(false);
        } catch {
            toast.error('Не удалось переключить видео');
        }
    };

    const handlePlayerSurfaceInteract = (): void => {
        markPlaybackStarted();
    };

    useEffect(() => {
        if (!showMiniUI && showQueue) {
            setShowQueue(false);
        }
    }, [showMiniUI, showQueue]);

    useEffect(() => {
        metricsCacheRef.current.volume = volume;
        metricsCacheRef.current.muted = isMuted;
    }, [isMuted, volume]);

    useEffect(() => {
        metricsCacheRef.current.currentTime = 0;
        metricsCacheRef.current.duration = 0;
        lastObservedPlayerStateRef.current = null;
    }, [playerVideoId]);

    useEffect(() => {
        if (!hasVideo || !playerVideoId) {
            return;
        }

        let cancelled = false;

        void loadYoutubeIframeApi()
            .then(() => {
                if (cancelled || !window.YT?.Player || youtubePlayerRef.current) {
                    return;
                }

                youtubePlayerRef.current = new window.YT.Player('global-youtube-player', {
                    width: '100%',
                    height: '100%',
                    videoId: playerVideoId,
                    playerVars: {
                        autoplay: isPlaying ? 1 : 0,
                        controls: 1,
                        enablejsapi: 1,
                        fs: 1,
                        iv_load_policy: 3,
                        modestbranding: 1,
                        origin: window.location.origin,
                        playsinline: 1,
                        rel: 0,
                        ...(playerStartSeconds !== undefined ? { start: Math.floor(playerStartSeconds) } : {}),
                    },
                    events: {
                        onReady: (event) => {
                            if (cancelled) {
                                return;
                            }
                            youtubePlayerRef.current = event.target;
                            activePlayerVideoIdRef.current = playerVideoId;
                            handleReady({ target: playerAdapter });
                            playerAdapter.setVolume(volume);
                            if (isMuted) {
                                playerAdapter.mute();
                            } else {
                                playerAdapter.unMute();
                            }
                            if (isPlaying) {
                                playerAdapter.playVideo();
                            }
                            syncPlayerMetrics();
                        },
                        onStateChange: (event) => {
                            lastObservedPlayerStateRef.current =
                                typeof event.data === 'number' ? event.data : lastObservedPlayerStateRef.current;
                            handleStateChange({ data: Number(event.data), target: playerAdapter });
                            syncPlayerMetrics();
                        },
                        onError: (event) => {
                            handleError(event.data);
                        },
                    },
                });
            })
            .catch((error) => {
                handleError(error);
            });

        return () => {
            cancelled = true;
        };
    }, [
        handleError,
        handleReady,
        handleStateChange,
        hasVideo,
        isMuted,
        isPlaying,
        playerAdapter,
        playerStartSeconds,
        playerVideoId,
        syncPlayerMetrics,
        volume,
    ]);

    useEffect(() => {
        const player = youtubePlayerRef.current;
        if (!player || !playerVideoId || activePlayerVideoIdRef.current === playerVideoId) {
            return;
        }

        activePlayerVideoIdRef.current = playerVideoId;
        if (isPlaying) {
            playerAdapter.loadVideoById(playerVideoId, playerStartSeconds);
        } else {
            playerAdapter.cueVideoById(playerVideoId, playerStartSeconds);
        }
    }, [isPlaying, playerAdapter, playerStartSeconds, playerVideoId]);

    const youtubePlayerComponent = hasVideo && playerVideoId ? (
        <div
            className="relative w-full h-full"
            data-player-container="overlay"
            onPointerDownCapture={handlePlayerSurfaceInteract}
        >
            <div
                id="global-youtube-player"
                className="h-full w-full bg-black"
                title={displayVideo?.title || 'YouTube video player'}
            />
        </div>
    ) : null;

    useEffect(() => {
        if (!playerRoot) return;
        if (!playerRoot.parentElement) {
            document.body.appendChild(playerRoot);
        }
    }, [playerRoot]);

    useLayoutEffect(() => {
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

        let rafId: number | null = null;
        let secondRafId: number | null = null;
        let settleTimeoutId: number | null = null;

        const updatePosition = () => {
            const rect = playerContainerRef.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                rafId = requestAnimationFrame(updatePosition);
                return;
            }
            const computed = window.getComputedStyle(playerContainerRef);
            playerRoot.style.position = 'fixed';
            playerRoot.style.top = `${rect.top}px`;
            playerRoot.style.left = `${rect.left}px`;
            playerRoot.style.width = `${rect.width}px`;
            playerRoot.style.height = `${rect.height}px`;
            playerRoot.style.borderRadius = isTheaterMode ? '0px' : computed.borderRadius || '0px';
            playerRoot.style.overflow = 'hidden';
            playerRoot.style.pointerEvents = 'auto';
            playerRoot.style.zIndex = isTheaterMode ? '10000' : '40';
            playerRoot.style.opacity = '1';
            playerRoot.style.backgroundColor = isTheaterMode ? 'black' : 'transparent';
        };

        const schedulePositionUpdate = () => {
            updatePosition();
            if (rafId !== null) window.cancelAnimationFrame(rafId);
            if (secondRafId !== null) window.cancelAnimationFrame(secondRafId);
            if (settleTimeoutId !== null) window.clearTimeout(settleTimeoutId);

            rafId = window.requestAnimationFrame(() => {
                updatePosition();
                secondRafId = window.requestAnimationFrame(updatePosition);
            });
            settleTimeoutId = window.setTimeout(updatePosition, 240);
        };

        schedulePositionUpdate();
        window.addEventListener('scroll', schedulePositionUpdate, true);
        window.addEventListener('resize', schedulePositionUpdate);
        const observer = new ResizeObserver(schedulePositionUpdate);
        observer.observe(playerContainerRef);

        return () => {
            window.removeEventListener('scroll', schedulePositionUpdate, true);
            window.removeEventListener('resize', schedulePositionUpdate);
            if (rafId !== null) window.cancelAnimationFrame(rafId);
            if (secondRafId !== null) window.cancelAnimationFrame(secondRafId);
            if (settleTimeoutId !== null) window.clearTimeout(settleTimeoutId);
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
            {/* Keep a single YouTube iframe mounted in a fixed overlay root */}
            {playerRoot && youtubePlayerComponent && createPortal(youtubePlayerComponent, playerRoot)}

            {/* Mini player UI */}
            {showMiniUI &&
                (miniPlayerContainer && canDockMiniPlayer ? (
                    createPortal(
                        <MiniPlayerUI
                            displayVideo={activeDisplayVideo}
                            displayThumbnail={displayThumbnail}
                            isPlaying={isPlaying}
                            isMuted={isMuted}
                            volume={volume}
                            currentTime={currentTime}
                            durationSeconds={duration}
                            skipVotes={skipVotes}
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
                ) : (
                    <MiniPlayerUI
                        displayVideo={activeDisplayVideo}
                        displayThumbnail={displayThumbnail}
                        isPlaying={isPlaying}
                        isMuted={isMuted}
                        volume={volume}
                        currentTime={currentTime}
                        durationSeconds={duration}
                        skipVotes={skipVotes}
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
                ))}

            {/* Minimized player button - pinned to the bottom-left corner */}
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
            <ConfirmDialog
                open={clearQueueConfirmOpen}
                onOpenChange={setClearQueueConfirmOpen}
                title="Очистить очередь"
                description="Все треки будут удалены из очереди."
                confirmLabel="Очистить"
                variant="destructive"
                onConfirm={confirmClearQueue}
            />
        </>
    );
};

export default GlobalPlayer;
