import { useCallback, useRef } from 'react';

import { logger } from '@/shared/utils/prodLogger';

import type { DisplayVideo, YouTubePlayer, ReactPlayerInstance } from './types';

interface UseGlobalPlayerOptions {
    displayVideo: DisplayVideo | null;
    currentVideo: DisplayVideo | null;
    isPlaying: boolean;
    setVolume: (vol: number) => void;
    toggleMute: () => void;
    setPlayerRef: (ref: YouTubePlayer | null, source?: 'global' | 'page') => void;
    handlePlayerReady: (event: { target: YouTubePlayer }) => void;
    handlePlayerStateChange: (event: { data: number }) => void;
    handlePlayerError: (event: { data: unknown }) => void;
    nextVideo: () => void;
}

export function useGlobalPlayer({
    displayVideo,
    currentVideo,
    isPlaying,
    setVolume: _setVolume,
    toggleMute: _toggleMute,
    setPlayerRef,
    handlePlayerReady,
    handlePlayerStateChange,
    handlePlayerError,
    nextVideo
}: UseGlobalPlayerOptions) {
    const playerRef = useRef<ReactPlayerInstance>(null);
    const playerWrapperRef = useRef<YouTubePlayer | null>(null);

    const getInternalPlayer = useCallback(() => {
        const internal = playerRef.current?.getInternalPlayer?.();
        return (internal ?? playerRef.current) as (Partial<YouTubePlayer> & Partial<HTMLMediaElement>) | null;
    }, []);

    // Create player wrapper that matches YouTubePlayer interface
    const createPlayerWrapper = useCallback((): YouTubePlayer => ({
        pauseVideo: () => {
            const internal = getInternalPlayer();
            if (internal?.pauseVideo) {
                internal.pauseVideo();
                return;
            }
            internal?.pause?.();
        },
        playVideo: () => {
            const internal = getInternalPlayer();
            if (internal?.playVideo) {
                internal.playVideo();
                return;
            }
            internal?.play?.();
        },
        setVolume: (vol: number) => {
            const internal = getInternalPlayer();
            if (internal?.setVolume) {
                internal.setVolume(vol);
                return;
            }
            if (typeof internal?.volume === 'number') {
                internal.volume = Math.max(0, Math.min(1, vol / 100));
            }
        },
        getVolume: () => {
            const internal = getInternalPlayer();
            if (internal?.getVolume) {
                return internal.getVolume();
            }
            if (typeof internal?.volume === 'number') {
                return Math.round(internal.volume * 100);
            }
            return 0;
        },
        mute: () => {
            const internal = getInternalPlayer();
            if (internal?.mute) {
                internal.mute();
                return;
            }
            if (typeof internal?.muted === 'boolean') {
                internal.muted = true;
            }
        },
        unMute: () => {
            const internal = getInternalPlayer();
            if (internal?.unMute) {
                internal.unMute();
                return;
            }
            if (typeof internal?.muted === 'boolean') {
                internal.muted = false;
            }
        },
        getCurrentTime: () => {
            const internal = getInternalPlayer();
            if (internal?.getCurrentTime) {
                return internal.getCurrentTime();
            }
            return typeof internal?.currentTime === 'number' ? internal.currentTime : 0;
        },
        getDuration: () => {
            const internal = getInternalPlayer();
            if (internal?.getDuration) {
                return internal.getDuration();
            }
            return typeof internal?.duration === 'number' ? internal.duration : 0;
        },
        loadVideoById: (videoId: string, startSeconds?: number) => {
            const internal = getInternalPlayer();
            if (internal?.loadVideoById) {
                internal.loadVideoById(videoId, startSeconds);
            }
        },
        cueVideoById: (videoId: string, startSeconds?: number) => {
            const internal = getInternalPlayer();
            if (internal?.cueVideoById) {
                internal.cueVideoById(videoId, startSeconds);
            }
        }
    }), [getInternalPlayer]);

    // Sync playback time with server
    const syncPlaybackTime = useCallback(() => {
        if (!currentVideo?.played_at || !playerRef.current) return;

        try {
            const playedAtDate = new Date(
                currentVideo.played_at.endsWith('Z')
                    ? currentVideo.played_at
                    : `${currentVideo.played_at}Z`
            );
            const now = new Date();
            const diffSeconds = (now.getTime() - playedAtDate.getTime()) / 1000;
            const currentTime = playerRef.current.getCurrentTime?.() ?? 0;

            // Avoid rewinding an already playing seamless instance
            if (currentTime > 0 && diffSeconds <= currentTime + 1) {
                return;
            }

            if (diffSeconds > 0) {
                playerRef.current.seekTo(diffSeconds, 'seconds');
            }
        } catch (e) {
            logger.error("Error syncing time", e);
        }
    }, [currentVideo?.played_at]);

    // Handler for player ready
    const handleReady = useCallback(() => {
        if (!playerRef.current || !displayVideo) return;

        if (!playerWrapperRef.current) {
            playerWrapperRef.current = createPlayerWrapper();
        }
        const playerWrapper = playerWrapperRef.current;
        setPlayerRef(playerWrapper, 'global');
        handlePlayerReady({ target: playerWrapper });
        syncPlaybackTime();
    }, [displayVideo, createPlayerWrapper, setPlayerRef, handlePlayerReady, syncPlaybackTime]);

    // Handle video end
    const handleEnded = useCallback(() => {
        handlePlayerStateChange({ data: 2 }); // pause to avoid brief replay
        nextVideo();
    }, [handlePlayerStateChange, nextVideo]);

    // Handle errors
    const handleError = useCallback((error: unknown) => {
        logger.error('[ReactPlayer] Error:', error);
        handlePlayerError({ data: error });
    }, [handlePlayerError]);

    // Handle play state
    const handlePlay = useCallback(() => {
        if (!isPlaying) {
            handlePlayerStateChange({ data: 1 }); // Playing state
        }
    }, [isPlaying, handlePlayerStateChange]);

    // Handle pause state
    const handlePause = useCallback(() => {
        if (isPlaying) {
            handlePlayerStateChange({ data: 2 }); // Paused state
        }
    }, [isPlaying, handlePlayerStateChange]);

    return {
        playerRef,
        handleReady,
        handleEnded,
        handleError,
        handlePlay,
        handlePause
    };
}
