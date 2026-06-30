import React, { createContext, ReactNode, useCallback, useContext, useEffect, useReducer, useRef } from 'react';

import { useLocation } from 'react-router-dom';
import { useInterval } from 'react-use';

import { useSkipYoutubeVideo, useYoutubeQueue } from '@/queries/youtube/youtubeQueries';
import { youtubeService } from '@/services/api/services/youtubeService';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';

import type { YoutubeQueue, YoutubeVideo } from '@/types/youtube';

declare global {
    interface Window {
        ytUserStarted?: boolean;
    }
}

interface YouTubePlayer {
    pauseVideo: () => void;
    playVideo: () => void;
    setVolume: (volume: number) => void;
    getVolume?: () => number;
    isMuted?: () => boolean;
    mute: () => void;
    unMute: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    destroy?: () => void;
    loadVideoById: (videoId: string, startSeconds?: number) => void;
    cueVideoById: (videoId: string, startSeconds?: number) => void;
}

interface PlayerState {
    currentVideo: YoutubeVideo | null;
    isPlaying: boolean;
    userPaused: boolean;
    volume: number;
    isMuted: boolean;
    isVisible: boolean;
    isMinimized: boolean;
    isTheaterMode: boolean;
    currentTime: number;
    duration: number;
    queue: YoutubeVideo[];
    skipVotes: { current: number; required: number; video_id?: number | string | null } | null;
    playerRef: YouTubePlayer | null;
    isLoading: boolean;
    error: string | null;
}

type PlayerSource = 'global' | 'page';
type PauseReason = 'user' | 'system' | null;
type PlaybackSyncCommand = 'intent' | 'play' | 'pause';

type PlayerAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_CURRENT_VIDEO'; payload: YoutubeVideo | null }
    | { type: 'SET_PLAYING'; payload: boolean }
    | { type: 'SET_USER_PAUSED'; payload: boolean }
    | { type: 'SET_VOLUME'; payload: number }
    | { type: 'SET_MUTED'; payload: boolean }
    | { type: 'SET_VISIBLE'; payload: boolean }
    | { type: 'SET_THEATER_MODE'; payload: boolean }
    | { type: 'SET_TIME'; payload: number }
    | { type: 'SET_DURATION'; payload: number }
    | { type: 'SET_QUEUE'; payload: YoutubeVideo[] }
    | { type: 'SET_PLAYER_REF'; payload: YouTubePlayer | null }
    | {
          type: 'LOAD_QUEUE';
          payload: {
              queue: YoutubeVideo[];
              current_video: YoutubeVideo | null;
              is_playing?: boolean;
              skip_votes?: { current: number; required: number; video_id?: number | string | null } | null;
          };
      }
    | { type: 'NEXT_VIDEO'; payload: { current_video: YoutubeVideo | null } }
    | { type: 'TOGGLE_PLAY_PAUSE' }
    | { type: 'CLOSE_PLAYER' }
    | { type: 'MINIMIZE_PLAYER' }
    | { type: 'MAXIMIZE_PLAYER' };

const initialState: PlayerState = {
    currentVideo: null,
    isPlaying: false,
    userPaused: false,
    volume: 100,
    isMuted: false,
    isVisible: false,
    isMinimized: false,
    isTheaterMode: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    skipVotes: null,
    playerRef: null,
    isLoading: false,
    error: null,
};

const YOUTUBE_VOLUME_STORAGE_KEY = 'yt_volume';
const YOUTUBE_MINIMIZED_STORAGE_KEY = 'yt_player_minimized';
const YOUTUBE_PLAYBACK_SYNC_STORAGE_KEY = 'yt_playback_sync';

const getInitialPlayerState = (): PlayerState => {
    if (typeof window === 'undefined') {
        return initialState;
    }

    try {
        return {
            ...initialState,
            isMinimized: window.localStorage.getItem(YOUTUBE_MINIMIZED_STORAGE_KEY) === 'true',
        };
    } catch {
        return initialState;
    }
};

const playerReducer = (state: PlayerState, action: PlayerAction): PlayerState => {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false };
        case 'SET_CURRENT_VIDEO':
            return {
                ...state,
                currentVideo: action.payload,
                isVisible: !!action.payload,
                isMinimized: action.payload ? state.isMinimized : false,
                error: null,
            };
        case 'SET_PLAYING':
            return { ...state, isPlaying: action.payload };
        case 'SET_USER_PAUSED':
            return { ...state, userPaused: action.payload };
        case 'SET_VOLUME': {
            const normalizedVolume = Math.max(0, Math.min(100, Math.round(action.payload)));
            if (state.volume === normalizedVolume) {
                return state;
            }
            return { ...state, volume: normalizedVolume };
        }
        case 'SET_MUTED':
            return { ...state, isMuted: action.payload };
        case 'SET_VISIBLE':
            return { ...state, isVisible: action.payload };
        case 'SET_THEATER_MODE':
            return { ...state, isTheaterMode: action.payload };
        case 'SET_TIME':
            return { ...state, currentTime: action.payload };
        case 'SET_DURATION':
            return { ...state, duration: action.payload };
        case 'SET_QUEUE':
            return { ...state, queue: action.payload };
        case 'SET_PLAYER_REF':
            return { ...state, playerRef: action.payload };
        case 'LOAD_QUEUE': {
            const queue = action.payload.queue || [];
            const currentVideo = action.payload.current_video || queue[0] || null;
            const hasQueue = queue.length > 0 || !!currentVideo;
            const rawIsPlaying = (action.payload as { is_playing?: boolean }).is_playing ?? false;
            const userStarted = typeof window !== 'undefined' && window.ytUserStarted === true;
            const isPlaying = state.userPaused ? false : state.isPlaying || (Boolean(rawIsPlaying) && userStarted);
            const skipVotes = action.payload.skip_votes ?? null;
            return {
                ...state,
                queue,
                currentVideo,
                isPlaying,
                skipVotes,
                isVisible: hasQueue,
                isMinimized: hasQueue ? state.isMinimized : false,
                isLoading: false,
                error: null,
            };
        }
        case 'NEXT_VIDEO': {
            const hasNextVideo = Boolean(action.payload.current_video);
            return {
                ...state,
                currentVideo: action.payload.current_video,
                userPaused: false,
                isPlaying: hasNextVideo,
                isVisible: hasNextVideo,
                isMinimized: hasNextVideo ? state.isMinimized : false,
            };
        }
        case 'TOGGLE_PLAY_PAUSE':
            return {
                ...state,
                isPlaying: !state.isPlaying,
                isVisible: !state.isPlaying ? true : state.isVisible,
            };
        case 'CLOSE_PLAYER':
            return {
                ...state,
                isVisible: false,
                isPlaying: false,
                isMinimized: false,
            };
        case 'MINIMIZE_PLAYER':
            return {
                ...state,
                isMinimized: true,
                isPlaying: false,
            };
        case 'MAXIMIZE_PLAYER':
            return {
                ...state,
                isMinimized: false,
            };
        default:
            return state;
    }
};

interface PlayerContextValue extends PlayerState {
    loadQueue: (force?: boolean) => Promise<void>;
    nextVideo: () => Promise<void>;
    togglePlayPause: () => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    setPlayerRef: (ref: YouTubePlayer | null, source?: PlayerSource) => void;
    releasePlayerRef: (source: PlayerSource) => void;
    handlePlayerReady: (event: unknown) => void;
    handlePlayerStateChange: (event: unknown) => void;
    handlePlayerError: (event: unknown) => void;
    closePlayer: () => void;
    minimizePlayer: () => void;
    maximizePlayer: () => void;
    updateTime: () => void;
    setIsTheaterMode: (value: boolean) => void;
    markPlaybackStarted: () => void;
    // Legacy portal support (deprecated)
    playerContainerRef: HTMLDivElement | null;
    setPlayerContainer: (container: HTMLDivElement | null) => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

interface PlayerProviderProps {
    children: ReactNode;
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(playerReducer, undefined, getInitialPlayerState);
    const lastUpdateTimeRef = useRef<number>(0);
    const volumeSaveTimeoutRef = useRef<number | null>(null);
    const lastSavedVolumeRef = useRef<number | null>(null);
    const lastNonZeroVolumeRef = useRef<number>(100);
    const playerSourceRef = useRef<PlayerSource | null>(null);
    const pauseReasonRef = useRef<PauseReason>(null);
    const [playerContainerRef, setPlayerContainer] = React.useState<HTMLDivElement | null>(null);
    const { isAuthenticated } = useAuth();
    const { lastJsonMessage, isConnected: isChatConnected } = useChat();
    const location = useLocation();

    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const activeTab = searchParams.get('tab');
    const isMediaYoutubeTab = currentPath.startsWith('/dashboard/media') && (!activeTab || activeTab === 'youtube');
    const isOnYoutubePage = currentPath.startsWith('/dashboard/youtube') || isMediaYoutubeTab;
    const shouldPollQueue = isOnYoutubePage || state.isPlaying;
    const queueRefetchInterval = shouldPollQueue ? (isChatConnected ? 30000 : 15000) : state.isVisible ? 60000 : 120000;

    const broadcastPlaybackSync = useCallback((command: PlaybackSyncCommand): void => {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            window.localStorage.setItem(
                YOUTUBE_PLAYBACK_SYNC_STORAGE_KEY,
                JSON.stringify({ command, timestamp: Date.now() })
            );
        } catch (error) {
            logger.debug('[YouTube] Failed to broadcast playback sync', error);
        }
    }, []);

    const markPlaybackStarted = useCallback((): void => {
        if (typeof window === 'undefined') {
            return;
        }
        window.ytUserStarted = true;
        broadcastPlaybackSync('intent');
    }, [broadcastPlaybackSync]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const storedVolume = window.localStorage.getItem(YOUTUBE_VOLUME_STORAGE_KEY);
        if (storedVolume === null) {
            return;
        }
        const parsedVolume = Number(storedVolume);
        if (Number.isNaN(parsedVolume)) {
            return;
        }
        const clamped = Math.max(0, Math.min(100, Math.round(parsedVolume)));
        dispatch({ type: 'SET_VOLUME', payload: clamped });
        dispatch({ type: 'SET_MUTED', payload: clamped === 0 });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            if (state.currentVideo || state.queue.length > 0) {
                window.localStorage.setItem(YOUTUBE_MINIMIZED_STORAGE_KEY, String(state.isMinimized));
            } else {
                window.localStorage.removeItem(YOUTUBE_MINIMIZED_STORAGE_KEY);
            }
        } catch (error) {
            logger.debug('[YouTube] Failed to persist minimized state', error);
        }
    }, [state.currentVideo, state.isMinimized, state.queue.length]);

    useEffect(() => {
        if (!state.playerRef) {
            return;
        }
        try {
            state.playerRef.setVolume(state.volume);
            if (state.isMuted || state.volume === 0) {
                state.playerRef.mute();
            } else {
                state.playerRef.unMute();
            }
        } catch (error) {
            logger.debug('[YouTube] Failed to sync player volume', error);
        }
    }, [state.playerRef, state.volume, state.isMuted]);

    const {
        data: queueData,
        isLoading: isLoadingQueue,
        refetch: refetchQueue,
        error: _queueError,
    } = useYoutubeQueue({
        enabled: !!isAuthenticated,
        refetchInterval: queueRefetchInterval,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // React Query v5: onSuccess/onError moved to useEffect
    const normalizeVideo = useCallback((video: YoutubeVideo | null | undefined): YoutubeVideo | null => {
        if (!video) return null;
        const normalized = { ...video };
        normalized.thumbnail = normalized.thumbnail || normalized.thumbnail_url;
        return normalized;
    }, []);

    useEffect(() => {
        if (queueData) {
            // queueData is already typed as YoutubeQueue from the service
            const response = queueData as { data?: YoutubeQueue } | YoutubeQueue;
            const queue = 'data' in response && response.data ? response.data : (response as YoutubeQueue);
            const rawIsPlaying = queue.is_playing ?? false;
            const normalizedQueue = (queue.queue || []).map(normalizeVideo).filter(Boolean) as YoutubeVideo[];
            const normalizedCurrent = normalizeVideo(queue.current_video) || normalizedQueue[0] || null;
            const skipVotes = (queue as YoutubeQueue & { skip_votes?: PlayerState['skipVotes'] }).skip_votes ?? null;
            const hasVideo = Boolean(normalizedCurrent || normalizedQueue.length > 0);
            const userStarted = typeof window !== 'undefined' && window.ytUserStarted === true;
            const nextIsPlaying = hasVideo ? state.isPlaying || (rawIsPlaying && userStarted) : false;
            dispatch({
                type: 'LOAD_QUEUE',
                payload: {
                    queue: normalizedQueue,
                    current_video: normalizedCurrent,
                    is_playing: nextIsPlaying,
                    skip_votes: skipVotes,
                },
            });
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [queueData, state.isPlaying, normalizeVideo]);

    useEffect(() => {
        if (_queueError) {
            logger.error('Error loading queue:', _queueError);
            const error = _queueError as { response?: { status?: number }; code?: string };
            if (error.response?.status === 429 || error.code === 'ERR_NETWORK') {
                return;
            }
            dispatch({
                type: 'SET_ERROR',
                payload: 'Ошибка загрузки очереди',
            });
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [_queueError]);

    useEffect(() => {
        dispatch({ type: 'SET_LOADING', payload: isLoadingQueue });
    }, [isLoadingQueue]);

    const loadQueue = useCallback(
        async (_force: boolean = false): Promise<void> => {
            if (!isAuthenticated) {
                return;
            }
            await refetchQueue();
        },
        [isAuthenticated, refetchQueue]
    );

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleStorage = (event: StorageEvent): void => {
            if (event.key === YOUTUBE_VOLUME_STORAGE_KEY && event.newValue !== null) {
                const parsedVolume = Number(event.newValue);
                if (!Number.isNaN(parsedVolume)) {
                    dispatch({ type: 'SET_VOLUME', payload: parsedVolume });
                    dispatch({ type: 'SET_MUTED', payload: parsedVolume === 0 });
                }
                return;
            }

            if (event.key !== YOUTUBE_PLAYBACK_SYNC_STORAGE_KEY || !event.newValue) {
                return;
            }

            try {
                const payload = JSON.parse(event.newValue) as { command?: PlaybackSyncCommand };
                if (!payload.command) {
                    return;
                }

                if (payload.command === 'intent') {
                    window.ytUserStarted = true;
                    if (!state.userPaused) {
                        void refetchQueue();
                    }
                    return;
                }

                if (payload.command === 'play') {
                    window.ytUserStarted = true;
                    pauseReasonRef.current = null;
                    dispatch({ type: 'SET_USER_PAUSED', payload: false });
                    if (state.playerRef) {
                        try {
                            state.playerRef.playVideo();
                        } catch (error) {
                            logger.debug('[YouTube] Remote play sync skipped', error);
                        }
                    }
                    void refetchQueue();
                    return;
                }

                pauseReasonRef.current = 'user';
                dispatch({ type: 'SET_PLAYING', payload: false });
                dispatch({ type: 'SET_USER_PAUSED', payload: true });
                if (state.playerRef) {
                    try {
                        state.playerRef.pauseVideo();
                    } catch (error) {
                        logger.debug('[YouTube] Remote pause sync skipped', error);
                    }
                }
            } catch (error) {
                logger.debug('[YouTube] Failed to parse playback sync payload', error);
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, [refetchQueue, state.playerRef, state.userPaused]);

    const skipVideoMutation = useSkipYoutubeVideo({
        onSuccess: (response) => {
            // Response is typed from youtubeService
            const data = response as {
                success: boolean;
                current_video?: YoutubeVideo | null;
                data?: { current_video?: YoutubeVideo | null };
            };
            if (data.success) {
                const nextCurrentVideo = data.current_video ?? data.data?.current_video ?? null;
                dispatch({
                    type: 'NEXT_VIDEO',
                    payload: { current_video: nextCurrentVideo },
                });
                void refetchQueue();
            } else {
                dispatch({ type: 'CLOSE_PLAYER' });
            }
        },
        onError: (error) => {
            logger.error('Error skipping to next video:', error);
            dispatch({
                type: 'SET_ERROR',
                payload: 'Не удалось перейти к следующему видео',
            });
        },
    });

    const nextVideo = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) {
            return;
        }
        if (skipVideoMutation.isPending) {
            logger.debug('[YouTube] nextVideo skipped: transition already in progress');
            return;
        }
        logger.debug('Skipping to next video');
        skipVideoMutation.mutate();
    }, [isAuthenticated, skipVideoMutation]);

    const togglePlayPause = (): void => {
        const nextIsPlaying = !state.isPlaying;
        if (nextIsPlaying) {
            markPlaybackStarted();
            broadcastPlaybackSync('play');
        } else {
            broadcastPlaybackSync('pause');
        }
        dispatch({ type: 'SET_USER_PAUSED', payload: !nextIsPlaying });
        try {
            if (state.playerRef) {
                if (state.isPlaying) {
                    pauseReasonRef.current = 'user';
                    state.playerRef.pauseVideo();
                } else {
                    pauseReasonRef.current = null;
                    state.playerRef.playVideo();
                }
            }
        } catch (error) {
            logger.warn('Error toggling play/pause:', error);
        }
        dispatch({ type: 'TOGGLE_PLAY_PAUSE' });
        logger.debug('Play/pause toggled');
    };

    const setVolume = (volume: number): void => {
        const normalizedVolume = Math.max(0, Math.min(100, Math.round(volume)));
        const nextMuted = normalizedVolume === 0;
        if (normalizedVolume > 0) {
            lastNonZeroVolumeRef.current = normalizedVolume;
        }
        if (state.volume === normalizedVolume && state.isMuted === nextMuted) {
            return;
        }
        dispatch({ type: 'SET_VOLUME', payload: normalizedVolume });
        dispatch({ type: 'SET_MUTED', payload: nextMuted });

        if (state.playerRef) {
            try {
                state.playerRef.setVolume(normalizedVolume);
                if (normalizedVolume === 0) {
                    state.playerRef.mute();
                } else {
                    state.playerRef.unMute();
                }
                logger.debug('Volume set to', normalizedVolume);
            } catch (error) {
                logger.warn('Error setting volume:', error);
            }
        }
    };

    const toggleMute = (): void => {
        if (state.isMuted) {
            const restoredVolume =
                state.volume > 0
                    ? state.volume
                    : Math.max(1, Math.min(100, Math.round(lastNonZeroVolumeRef.current || 50)));
            dispatch({ type: 'SET_VOLUME', payload: restoredVolume });
            dispatch({ type: 'SET_MUTED', payload: false });
            if (state.playerRef) {
                try {
                    state.playerRef.setVolume(restoredVolume);
                    state.playerRef.unMute();
                    logger.debug('Mute toggled:', false);
                } catch (error) {
                    logger.warn('Error toggling mute:', error);
                }
            }
            return;
        }

        if (state.volume > 0) {
            lastNonZeroVolumeRef.current = state.volume;
        }
        dispatch({ type: 'SET_MUTED', payload: true });
        if (state.playerRef) {
            try {
                state.playerRef.mute();
                logger.debug('Mute toggled:', true);
            } catch (error) {
                logger.warn('Error toggling mute:', error);
            }
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (lastSavedVolumeRef.current === null) {
            lastSavedVolumeRef.current = state.volume;
            return;
        }
        if (state.volume === lastSavedVolumeRef.current) {
            return;
        }
        if (volumeSaveTimeoutRef.current) {
            window.clearTimeout(volumeSaveTimeoutRef.current);
        }
        volumeSaveTimeoutRef.current = window.setTimeout(async () => {
            try {
                window.localStorage.setItem(YOUTUBE_VOLUME_STORAGE_KEY, String(state.volume));
                if (isAuthenticated) {
                    await youtubeService.saveSettings({ volume_level: state.volume });
                }
                lastSavedVolumeRef.current = state.volume;
            } catch (error) {
                logger.debug('[YouTube] Failed to persist volume setting', error);
            }
        }, 500);

        return () => {
            if (volumeSaveTimeoutRef.current) {
                window.clearTimeout(volumeSaveTimeoutRef.current);
            }
        };
    }, [state.volume, isAuthenticated]);

    const setPlayerRef = (ref: YouTubePlayer | null, source: PlayerSource = 'global'): void => {
        const currentRef = state.playerRef;

        // НЕ уничтожаем предыдущий плеер - просто ставим на паузу и мьютим
        // Это позволяет hidden плееру продолжать существовать для бесшовного воспроизведения
        if (currentRef && currentRef !== ref) {
            try {
                pauseReasonRef.current = 'system';
                currentRef.pauseVideo();
                currentRef.mute();
                // НЕ вызываем destroy - плеер должен остаться для бесшовного переключения
            } catch (error) {
                logger.debug('[YouTube] Previous player pause/mute skipped:', error);
            }
        }

        playerSourceRef.current = source;
        dispatch({ type: 'SET_PLAYER_REF', payload: ref });
    };

    const releasePlayerRef = (source: PlayerSource): void => {
        if (playerSourceRef.current !== source) {
            return;
        }
        // НЕ уничтожаем плеер - просто ставим на паузу и мьютим
        if (state.playerRef) {
            try {
                pauseReasonRef.current = 'system';
                state.playerRef.pauseVideo();
                state.playerRef.mute();
                // НЕ вызываем destroy - плеер может понадобиться для бесшовного воспроизведения
            } catch (error) {
                logger.debug('[YouTube] Player release cleanup skipped:', error);
            }
        }
        playerSourceRef.current = null;
        dispatch({ type: 'SET_PLAYER_REF', payload: null });
    };

    const updateTime = useCallback((): void => {
        if (state.playerRef) {
            try {
                const time = state.playerRef.getCurrentTime();
                const dur = state.playerRef.getDuration();

                dispatch({ type: 'SET_TIME', payload: time });
                dispatch({ type: 'SET_DURATION', payload: dur });

                if (Math.abs(time - lastUpdateTimeRef.current) > 1) {
                    lastUpdateTimeRef.current = time;
                }

                const playerVolume = state.playerRef.getVolume?.();
                if (typeof playerVolume === 'number' && Math.abs(playerVolume - state.volume) > 1) {
                    const clampedVolume = Math.max(0, Math.min(100, Math.round(playerVolume)));
                    dispatch({ type: 'SET_VOLUME', payload: clampedVolume });
                    if (clampedVolume > 0) {
                        lastNonZeroVolumeRef.current = clampedVolume;
                    }
                }

                const playerMuted = state.playerRef.isMuted?.();
                if (typeof playerMuted === 'boolean' && playerMuted !== state.isMuted) {
                    dispatch({ type: 'SET_MUTED', payload: playerMuted });
                }
            } catch {
                // Игнорируем ошибки
            }
        }
    }, [state.isMuted, state.playerRef, state.volume]);

    const handlePlayerReady = (event: unknown): void => {
        const playerEvent = event as { target: YouTubePlayer };
        const player = playerEvent.target;
        if (!player) {
            logger.debug('[WARN] [YOUTUBE] Player ready without target');
            return;
        }
        logger.debug('[OK] [YOUTUBE] Player ready - autoplay handled by iframe params');
    };

    const handlePlayerStateChange = (event: unknown): void => {
        const playerEvent = event as { data: number; target: YouTubePlayer };
        const playerState = playerEvent.data;
        const player = playerEvent.target;

        if (playerState === 1) {
            pauseReasonRef.current = null;
            if (!window.ytUserStarted) {
                // Клик по контролам внутри iframe YouTube не всегда пробрасывает pointer events наружу.
                // Если мы дошли до PLAYING, считаем это пользовательским запуском.
                window.ytUserStarted = true;
            }
            broadcastPlaybackSync('play');
            dispatch({ type: 'SET_PLAYING', payload: true });
            dispatch({ type: 'SET_USER_PAUSED', payload: false });
            dispatch({ type: 'SET_VISIBLE', payload: true });
            window.ytUserStarted = true;
            logger.debug('▶ [YOUTUBE] Playing, mini-player visible');
        } else if (playerState === 2) {
            const wasSystemPause = pauseReasonRef.current === 'system';
            const wasUserPause = !wasSystemPause;
            pauseReasonRef.current = null;
            dispatch({ type: 'SET_PLAYING', payload: false });
            dispatch({ type: 'SET_USER_PAUSED', payload: wasUserPause });
            if (wasUserPause) {
                broadcastPlaybackSync('pause');
            }
            logger.debug('⏸ [YOUTUBE] Paused');
        } else if (playerState === 0) {
            logger.debug('[SKIP] [YOUTUBE] Video ended, switching to next');
            nextVideo();
        } else if (playerState === 5) {
            try {
                if (player && player.playVideo && state.isPlaying) {
                    player.playVideo();
                    logger.debug('▶ [YOUTUBE] Auto-play triggered (video cued)');
                }
            } catch (error: unknown) {
                const err = error as { message?: string };
                logger.debug('Auto-play skipped:', err.message);
            }
        }
    };

    const handlePlayerError = (event: unknown): void => {
        const errorEvent = event as { data: number };
        const errorCode = errorEvent.data;

        logger.error('YouTube player error:', errorCode);

        // Error codes: 2 (invalid ID), 5 (HTML5 error), 100 (not found), 101/150 (not embeddable)
        if ([2, 100, 101, 150].includes(errorCode)) {
            toast.error('Видео недоступно, переход к следующему');
            nextVideo(); // Автоматически включаем следующее видео
        }
    };

    const closePlayer = (): void => {
        if (state.playerRef) {
            pauseReasonRef.current = 'user';
            state.playerRef.pauseVideo();
        }
        window.ytUserStarted = false;
        broadcastPlaybackSync('pause');
        dispatch({ type: 'SET_USER_PAUSED', payload: true });
        dispatch({ type: 'CLOSE_PLAYER' });
    };

    const minimizePlayer = (): void => {
        if (state.playerRef) {
            pauseReasonRef.current = 'user';
            state.playerRef.pauseVideo();
        }
        broadcastPlaybackSync('pause');
        dispatch({ type: 'SET_USER_PAUSED', payload: true });
        dispatch({ type: 'MINIMIZE_PLAYER' });
    };

    const maximizePlayer = (): void => {
        dispatch({ type: 'MAXIMIZE_PLAYER' });
    };

    const playerSyncInterval = !isAuthenticated ? null : isOnYoutubePage ? 250 : state.isPlaying ? 1000 : 2000;

    useInterval(() => {
        if (isAuthenticated) {
            updateTime();
        }
    }, playerSyncInterval);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        loadQueue(true);
    }, [isAuthenticated, loadQueue]);

    useEffect(() => {
        const messageType = (lastJsonMessage as { type?: string } | null)?.type;
        if (messageType === 'youtube_queue_updated') {
            logger.debug('[YouTube] Queue updated via WebSocket, reloading...');
            loadQueue(true);
        }
    }, [lastJsonMessage, loadQueue]);

    useEffect(() => {
        const handleYoutubeEvent = (event: CustomEvent): void => {
            const { event: eventType, data } = event.detail;
            logger.debug('YouTube event received:', eventType, data);

            switch (eventType) {
                case 'queue_updated':
                    loadQueue();
                    break;
                case 'video_played':
                    if (data.video) {
                        dispatch({
                            type: 'SET_CURRENT_VIDEO',
                            payload: data.video,
                        });
                        dispatch({ type: 'SET_PLAYING', payload: true });
                    }
                    break;
                case 'queue_empty':
                    dispatch({ type: 'CLOSE_PLAYER' });
                    break;
                case 'theater_mode_changed':
                    dispatch({
                        type: 'SET_THEATER_MODE',
                        payload: data.isTheaterMode,
                    });
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('youtube_event', handleYoutubeEvent as EventListener);

        return () => {
            window.removeEventListener('youtube_event', handleYoutubeEvent as EventListener);
        };
    }, [loadQueue]);

    const setIsTheaterMode = (value: boolean): void => {
        dispatch({ type: 'SET_THEATER_MODE', payload: value });
    };

    const value: PlayerContextValue = {
        ...state,
        loadQueue,
        nextVideo,
        togglePlayPause,
        setVolume,
        toggleMute,
        setPlayerRef,
        releasePlayerRef,
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        closePlayer,
        minimizePlayer,
        maximizePlayer,
        updateTime,
        setIsTheaterMode,
        markPlaybackStarted,
        playerContainerRef,
        setPlayerContainer,
    };

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePlayer = (): PlayerContextValue => {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
};

export default PlayerContext;
