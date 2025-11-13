import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import { logger } from '../utils/prodLogger';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';
import { useInterval } from '../hooks/useInterval';
import { useYoutubeQueue, useSkipYoutubeVideo } from '../queries/youtube/youtubeQueries';
import type { YoutubeVideo } from '../types/youtube';

interface YouTubePlayer {
    pauseVideo: () => void;
    playVideo: () => void;
    setVolume: (volume: number) => void;
    mute: () => void;
    unMute: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
}

interface PlayerState {
    currentVideo: YoutubeVideo | null;
    isPlaying: boolean;
    volume: number;
    isMuted: boolean;
    isVisible: boolean;
    isTheaterMode: boolean;
    currentTime: number;
    duration: number;
    queue: YoutubeVideo[];
    playerRef: YouTubePlayer | null;
    isLoading: boolean;
    error: string | null;
}

type PlayerAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_CURRENT_VIDEO'; payload: YoutubeVideo | null }
    | { type: 'SET_PLAYING'; payload: boolean }
    | { type: 'SET_VOLUME'; payload: number }
    | { type: 'SET_MUTED'; payload: boolean }
    | { type: 'SET_VISIBLE'; payload: boolean }
    | { type: 'SET_THEATER_MODE'; payload: boolean }
    | { type: 'SET_TIME'; payload: number }
    | { type: 'SET_DURATION'; payload: number }
    | { type: 'SET_QUEUE'; payload: YoutubeVideo[] }
    | { type: 'SET_PLAYER_REF'; payload: YouTubePlayer | null }
    | { type: 'LOAD_QUEUE'; payload: { queue: YoutubeVideo[]; current_video: YoutubeVideo | null } }
    | { type: 'NEXT_VIDEO'; payload: { current_video: YoutubeVideo | null } }
    | { type: 'TOGGLE_PLAY_PAUSE' }
    | { type: 'CLOSE_PLAYER' };

const initialState: PlayerState = {
    currentVideo: null,
    isPlaying: false,
    volume: 100,
    isMuted: false,
    isVisible: false,
    isTheaterMode: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    playerRef: null,
    isLoading: false,
    error: null
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
                error: null
            };
        case 'SET_PLAYING':
            return { ...state, isPlaying: action.payload };
        case 'SET_VOLUME':
            return { ...state, volume: action.payload, isMuted: action.payload === 0 };
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
        case 'LOAD_QUEUE':
            return { 
                ...state, 
                queue: action.payload.queue || [],
                currentVideo: action.payload.current_video || null,
                isPlaying: false,
                isVisible: false,
                isLoading: false,
                error: null
            };
        case 'NEXT_VIDEO':
            return {
                ...state,
                currentVideo: action.payload.current_video,
                isPlaying: true,
                isVisible: true
            };
        case 'TOGGLE_PLAY_PAUSE':
            return { 
                ...state, 
                isPlaying: !state.isPlaying,
                isVisible: !state.isPlaying ? true : state.isVisible
            };
        case 'CLOSE_PLAYER':
            return { 
                ...state, 
                isVisible: false, 
                isPlaying: false
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
    setPlayerRef: (ref: YouTubePlayer | null) => void;
    handlePlayerReady: (event: any) => void;
    handlePlayerStateChange: (event: any) => void;
    handlePlayerError: (event: any) => void;
    closePlayer: () => void;
    updateTime: () => void;
    setIsTheaterMode: (value: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

interface PlayerProviderProps {
    children: ReactNode;
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(playerReducer, initialState);
    const lastUpdateTimeRef = useRef<number>(0);
    const { isAuthenticated } = useAuth();
    const { lastJsonMessage } = useChat();
    
    const { data: queueData, isLoading: isLoadingQueue, refetch: refetchQueue, error: queueError } = useYoutubeQueue({
        enabled: isAuthenticated,
        refetchInterval: 15000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
    
    // React Query v5: onSuccess/onError moved to useEffect
    useEffect(() => {
        if (queueData) {
            const queueResponse = queueData?.data || queueData;
            dispatch({ 
                type: 'LOAD_QUEUE', 
                payload: {
                    queue: queueResponse.queue || [],
                    current_video: queueResponse.current_video || null
                }
            });
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [queueData]);
    
    useEffect(() => {
        if (queueError) {
            logger.error('Error loading queue:', queueError);
            if ((queueError as any).response?.status === 429 || (queueError as any).code === 'ERR_NETWORK') {
                return;
            }
            dispatch({ 
                type: 'SET_ERROR', 
                payload: 'Ошибка загрузки очереди' 
            });
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [queueError]);

    useEffect(() => {
        dispatch({ type: 'SET_LOADING', payload: isLoadingQueue });
    }, [isLoadingQueue]);

    const loadQueue = useCallback(async (force: boolean = false): Promise<void> => {
        if (!isAuthenticated) {
            return;
        }
        if (force) {
            await refetchQueue();
        }
    }, [isAuthenticated, refetchQueue]);

    const skipVideoMutation = useSkipYoutubeVideo({
        onSuccess: (response: any) => {
            const data = response?.data || response;
            if (data.success) {
                dispatch({ 
                    type: 'NEXT_VIDEO', 
                    payload: { current_video: data.current_video }
                });
                setTimeout(() => refetchQueue(), 500);
            } else {
                dispatch({ type: 'CLOSE_PLAYER' });
            }
        },
        onError: (error: any) => {
            logger.error('Error skipping to next video:', error);
            dispatch({ 
                type: 'SET_ERROR', 
                payload: 'Не удалось перейти к следующему видео' 
            });
        },
    });

    const nextVideo = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) {
            return;
        }
        logger.debug('Skipping to next video');
        skipVideoMutation.mutate();
    }, [isAuthenticated, skipVideoMutation]);

    const togglePlayPause = (): void => {
        if (state.playerRef) {
            try {
                if (state.isPlaying) {
                    state.playerRef.pauseVideo();
                } else {
                    state.playerRef.playVideo();
                }
                dispatch({ type: 'TOGGLE_PLAY_PAUSE' });
                logger.debug('Play/pause toggled');
            } catch (error) {
                logger.warn('Error toggling play/pause:', error);
            }
        }
    };

    const setVolume = (volume: number): void => {
        dispatch({ type: 'SET_VOLUME', payload: volume });
        
        if (state.playerRef) {
            try {
                state.playerRef.setVolume(volume);
                if (volume === 0) {
                    state.playerRef.mute();
                } else {
                    state.playerRef.unMute();
                }
                logger.debug('Volume set to', volume);
            } catch (error) {
                logger.warn('Error setting volume:', error);
            }
        }
    };

    const toggleMute = (): void => {
        const newMuted = !state.isMuted;
        dispatch({ type: 'SET_MUTED', payload: newMuted });
        
        if (state.playerRef) {
            try {
                if (newMuted) {
                    state.playerRef.mute();
                } else {
                    state.playerRef.unMute();
                }
                logger.debug('Mute toggled:', newMuted);
            } catch (error) {
                logger.warn('Error toggling mute:', error);
            }
        }
    };

    const setPlayerRef = (ref: YouTubePlayer | null): void => {
        dispatch({ type: 'SET_PLAYER_REF', payload: ref });
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
            } catch (error) {
                // Игнорируем ошибки
            }
        }
    }, [state.playerRef]);

    const handlePlayerReady = (event: any): void => {
        const player = event.target;
        setPlayerRef(player);
        logger.debug('✅ [YOUTUBE] Player ready - autoplay handled by iframe params');
    };

    const handlePlayerStateChange = (event: any): void => {
        const playerState = event.data;
        const player = event.target;
        
        if (playerState === 1) {
            dispatch({ type: 'SET_PLAYING', payload: true });
            dispatch({ type: 'SET_VISIBLE', payload: true });
            logger.debug('▶️ [YOUTUBE] Playing, mini-player visible');
        } else if (playerState === 2) {
            dispatch({ type: 'SET_PLAYING', payload: false });
            logger.debug('⏸️ [YOUTUBE] Paused');
        } else if (playerState === 0) {
            logger.debug('⏭️ [YOUTUBE] Video ended, switching to next');
            nextVideo();
        } else if (playerState === 5) {
            try {
                if (player && player.playVideo) {
                    player.playVideo();
                    logger.debug('▶️ [YOUTUBE] Auto-play triggered (video cued)');
                }
            } catch (error: any) {
                logger.debug('Auto-play skipped:', error.message);
            }
        }
    };

    const handlePlayerError = (event: any): void => {
        logger.error('YouTube player error:', event);
    };

    const closePlayer = (): void => {
        if (state.playerRef) {
            state.playerRef.pauseVideo();
        }
        dispatch({ type: 'CLOSE_PLAYER' });
    };

    useInterval(() => {
        if (isAuthenticated) {
            updateTime();
        }
    }, isAuthenticated ? 3000 : null);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        
        loadQueue(true);
    }, [isAuthenticated, loadQueue]);

    useEffect(() => {
        if (lastJsonMessage && (lastJsonMessage as any).type === 'youtube_queue_update') {
            logger.debug('📺 [YouTube] Queue updated via WebSocket, reloading...');
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
                            payload: data.video 
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
                        payload: data.isTheaterMode 
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
        handlePlayerReady,
        handlePlayerStateChange,
        handlePlayerError,
        closePlayer,
        updateTime,
        setIsTheaterMode
    };

    return (
        <PlayerContext.Provider value={value}>
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = (): PlayerContextValue => {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
};

export default PlayerContext;

