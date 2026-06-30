import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/shared/utils/prodLogger';

import type { DisplayVideo, YouTubePlayer } from './types';

interface UseGlobalPlayerOptions {
    displayVideo: DisplayVideo | null;
    currentVideo: DisplayVideo | null;
    setPlayerRef: (ref: YouTubePlayer | null, source?: 'global' | 'page') => void;
    handlePlayerReady: (event: { target: YouTubePlayer }) => void;
    handlePlayerStateChange: (event: { data: number; target: YouTubePlayer }) => void;
    handlePlayerError: (event: { data: unknown }) => void;
    nextVideo: () => Promise<void>;
}

export function useGlobalPlayer({
    displayVideo,
    currentVideo,
    setPlayerRef,
    handlePlayerReady,
    handlePlayerStateChange,
    handlePlayerError,
    nextVideo,
}: UseGlobalPlayerOptions) {
    const playerRef = useRef<YouTubePlayer | null>(null);
    const endedVideoKeyRef = useRef<string | number | null>(null);

    // Sync playback time with server
    const syncPlaybackTime = useCallback(() => {
        if (!currentVideo?.played_at || !playerRef.current) return;

        try {
            const playedAtDate = new Date(
                currentVideo.played_at.endsWith('Z') ? currentVideo.played_at : `${currentVideo.played_at}Z`
            );
            const now = new Date();
            const diffSeconds = (now.getTime() - playedAtDate.getTime()) / 1000;
            const currentTime = playerRef.current.getCurrentTime?.() ?? 0;

            // Avoid rewinding an already playing seamless instance
            if (currentTime > 0 && diffSeconds <= currentTime + 1) {
                return;
            }

            if (diffSeconds > 0) {
                playerRef.current.seekTo?.(diffSeconds, true);
            }
        } catch (e) {
            logger.error('Error syncing time', e);
        }
    }, [currentVideo?.played_at]);

    // Handler for player ready
    const handleReady = useCallback((event?: { target: YouTubePlayer }) => {
        if (event?.target) {
            playerRef.current = event.target;
        }
        if (!playerRef.current || !displayVideo) return;
        setPlayerRef(playerRef.current, 'global');
        handlePlayerReady({ target: playerRef.current });
        syncPlaybackTime();
    }, [displayVideo, setPlayerRef, handlePlayerReady, syncPlaybackTime]);

    useEffect(() => {
        endedVideoKeyRef.current = null;
    }, [displayVideo?.id, displayVideo?.video_id]);

    // Handle video end
    const handleEnded = useCallback(() => {
        const endedKey = displayVideo?.id ?? displayVideo?.video_id ?? null;
        if (endedKey !== null && endedVideoKeyRef.current === endedKey) {
            return;
        }
        endedVideoKeyRef.current = endedKey;
        void nextVideo();
    }, [displayVideo?.id, displayVideo?.video_id, nextVideo]);

    // Handle errors
    const handleError = useCallback(
        (error: unknown) => {
            logger.error('[YouTubePlayer] Error:', error);
            handlePlayerError({ data: error });
        },
        [handlePlayerError]
    );

    const handleStateChange = useCallback(
        (event?: { data: number; target: YouTubePlayer }) => {
            if (!event?.target || typeof event.data !== 'number') {
                return;
            }
            if (event.data === 0) {
                handleEnded();
                return;
            }
            handlePlayerStateChange(event);
        },
        [handleEnded, handlePlayerStateChange]
    );

    return {
        playerRef,
        handleReady,
        handleEnded,
        handleError,
        handleStateChange,
    };
}
