import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import api from '../services/api';
import logger from '../utils/logger';
import { useAuth } from './AuthContext';

// Контекст для глобального состояния плеера
const PlayerContext = createContext();

// Начальное состояние
const initialState = {
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

// Действия для управления состоянием
const playerActions = {
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    SET_CURRENT_VIDEO: 'SET_CURRENT_VIDEO',
    SET_PLAYING: 'SET_PLAYING',
    SET_VOLUME: 'SET_VOLUME',
    SET_MUTED: 'SET_MUTED',
    SET_VISIBLE: 'SET_VISIBLE',
    SET_THEATER_MODE: 'SET_THEATER_MODE',
    SET_TIME: 'SET_TIME',
    SET_DURATION: 'SET_DURATION',
    SET_QUEUE: 'SET_QUEUE',
    SET_PLAYER_REF: 'SET_PLAYER_REF',
    LOAD_QUEUE: 'LOAD_QUEUE',
    NEXT_VIDEO: 'NEXT_VIDEO',
    TOGGLE_PLAY_PAUSE: 'TOGGLE_PLAY_PAUSE',
    CLOSE_PLAYER: 'CLOSE_PLAYER'
};

// Редьюсер для управления состоянием
const playerReducer = (state, action) => {
    switch (action.type) {
        case playerActions.SET_LOADING:
            return { ...state, isLoading: action.payload };
        case playerActions.SET_ERROR:
            return { ...state, error: action.payload, isLoading: false };
        case playerActions.SET_CURRENT_VIDEO:
            return { 
                ...state, 
                currentVideo: action.payload,
                isVisible: !!action.payload,
                error: null
            };
        case playerActions.SET_PLAYING:
            return { ...state, isPlaying: action.payload };
        case playerActions.SET_VOLUME:
            return { ...state, volume: action.payload, isMuted: action.payload === 0 };
        case playerActions.SET_MUTED:
            return { ...state, isMuted: action.payload };
        case playerActions.SET_VISIBLE:
            return { ...state, isVisible: action.payload };
        case playerActions.SET_THEATER_MODE:
            return { ...state, isTheaterMode: action.payload };
        case playerActions.SET_TIME:
            return { ...state, currentTime: action.payload };
        case playerActions.SET_DURATION:
            return { ...state, duration: action.payload };
        case playerActions.SET_QUEUE:
            return { ...state, queue: action.payload };
        case playerActions.SET_PLAYER_REF:
            return { ...state, playerRef: action.payload };
        case playerActions.LOAD_QUEUE:
            return { 
                ...state, 
                queue: action.payload.queue || [],
                currentVideo: action.payload.current_video || null,
                isPlaying: action.payload.is_playing || false,
                isVisible: !!(action.payload.current_video),
                isLoading: false,
                error: null
            };
        case playerActions.NEXT_VIDEO:
            return {
                ...state,
                currentVideo: action.payload.current_video,
                isPlaying: true,
                isVisible: true
            };
        case playerActions.TOGGLE_PLAY_PAUSE:
            return { ...state, isPlaying: !state.isPlaying };
        case playerActions.CLOSE_PLAYER:
            return { 
                ...state, 
                isVisible: false, 
                isPlaying: false,
                currentVideo: null
            };
        default:
            return state;
    }
};

// Провайдер контекста
export const PlayerProvider = ({ children }) => {
    const [state, dispatch] = useReducer(playerReducer, initialState);
    const lastUpdateTimeRef = useRef(0);
    const { isAuthenticated } = useAuth();

    // Загрузка очереди и текущего видео
    const loadQueue = async () => {
        // Не загружаем данные если пользователь не авторизован
        if (!isAuthenticated) {
            return;
        }
        
        try {
            dispatch({ type: playerActions.SET_LOADING, payload: true });
            const response = await api.get('/api/youtube/queue');
            const data = response.data;
            
            dispatch({ 
                type: playerActions.LOAD_QUEUE, 
                payload: {
                    queue: data.queue || [],
                    current_video: data.current_video || null,
                    is_playing: data.is_playing || false
                }
            });
            
            logger.debug('Queue loaded:', data);
        } catch (error) {
            console.error('Error loading queue:', error);
            
            // Не показываем ошибки для rate limiting и CORS
            if (error.response?.status === 429 || error.code === 'ERR_NETWORK') {
                return;
            }
            
            dispatch({ 
                type: playerActions.SET_ERROR, 
                payload: 'Ошибка загрузки очереди' 
            });
        }
    };

    // Переход к следующему видео
    const nextVideo = async () => {
        if (!isAuthenticated) {
            return;
        }
        
        try {
            logger.debug('Skipping to next video');
            const response = await api.post('/api/youtube/player/next');
            
            if (response.data.success) {
                dispatch({ 
                    type: playerActions.NEXT_VIDEO, 
                    payload: { current_video: response.data.current_video }
                });
                
                // Обновляем очередь
                setTimeout(loadQueue, 500);
            } else {
                // Если нет видео, скрываем плеер
                dispatch({ type: playerActions.CLOSE_PLAYER });
            }
        } catch (error) {
            logger.error('Error skipping to next video:', error);
            dispatch({ 
                type: playerActions.SET_ERROR, 
                payload: 'Не удалось перейти к следующему видео' 
            });
        }
    };

    // Управление воспроизведением
    const togglePlayPause = () => {
        if (state.playerRef) {
            try {
                if (state.isPlaying) {
                    state.playerRef.pauseVideo();
                } else {
                    state.playerRef.playVideo();
                }
                dispatch({ type: playerActions.TOGGLE_PLAY_PAUSE });
                logger.debug('Play/pause toggled');
            } catch (error) {
                logger.warn('Error toggling play/pause:', error);
            }
        }
    };

    // Управление громкостью
    const setVolume = (volume) => {
        dispatch({ type: playerActions.SET_VOLUME, payload: volume });
        
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

    // Управление звуком
    const toggleMute = () => {
        const newMuted = !state.isMuted;
        dispatch({ type: playerActions.SET_MUTED, payload: newMuted });
        
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

    // Установка ссылки на плеер
    const setPlayerRef = (ref) => {
        dispatch({ type: playerActions.SET_PLAYER_REF, payload: ref });
    };

    // Обновление времени воспроизведения
    const updateTime = () => {
        if (state.playerRef) {
            try {
                const time = state.playerRef.getCurrentTime();
                const dur = state.playerRef.getDuration();
                
                dispatch({ type: playerActions.SET_TIME, payload: time });
                dispatch({ type: playerActions.SET_DURATION, payload: dur });
                
                // Обновляем время только при значительных изменениях
                if (Math.abs(time - lastUpdateTimeRef.current) > 1) {
                    lastUpdateTimeRef.current = time;
                }
            } catch (error) {
                // Игнорируем ошибки
            }
        }
    };

    // Обработчики событий YouTube плеера
    const handlePlayerReady = (event) => {
        const player = event.target;
        setPlayerRef(player);
        logger.debug('YouTube player ready');
        
        if (state.currentVideo) {
            player.loadVideoById(state.currentVideo.video_id);
        }
        
        // Настраиваем громкость
        setTimeout(() => {
            if (player) {
                try {
                    player.setVolume(state.volume);
                    if (state.isMuted) {
                        player.mute();
                    }
                } catch (error) {
                    logger.warn('Error setting initial volume:', error);
                }
            }
        }, 1000);
    };

    const handlePlayerStateChange = (event) => {
        const playerState = event.data;
        
        if (playerState === 1) { // Воспроизведение
            dispatch({ type: playerActions.SET_PLAYING, payload: true });
            logger.debug('Video playing');
        } else if (playerState === 2) { // Пауза
            dispatch({ type: playerActions.SET_PLAYING, payload: false });
            logger.debug('Video paused');
        } else if (playerState === 0) { // Окончание видео
            logger.debug('Video ended, switching to next');
            nextVideo();
        }
    };

    const handlePlayerError = (event) => {
        console.error('YouTube player error:', event);
    };

    // Закрытие плеера
    const closePlayer = () => {
        if (state.playerRef) {
            state.playerRef.pauseVideo();
        }
        dispatch({ type: playerActions.CLOSE_PLAYER });
    };

    // Обработка WebSocket сообщений для синхронизации YouTube плеера
    const handleYoutubeStateUpdate = (data) => {
        const { action, data: payload } = data;
        
        switch (action) {
            case 'next_video':
                if (payload.current_video) {
                    dispatch({
                        type: playerActions.SET_CURRENT_VIDEO,
                        payload: {
                            current_video: payload.current_video,
                            is_playing: true
                        }
                    });
                }
                break;
            case 'queue_empty':
                dispatch({ type: playerActions.CLOSE_PLAYER });
                break;
            case 'play':
                if (state.playerRef) {
                    state.playerRef.playVideo();
                }
                dispatch({ type: playerActions.SET_PLAYING, payload: true });
                break;
            case 'pause':
                if (state.playerRef) {
                    state.playerRef.pauseVideo();
                }
                dispatch({ type: playerActions.SET_PLAYING, payload: false });
                break;
            default:
                logger.debug('Unknown YouTube state action:', action);
        }
    };

    // Загрузка данных при монтировании
    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        
        loadQueue();
        
        // Периодическое обновление очереди
        const interval = setInterval(loadQueue, 15000);
        
        // Обновление времени воспроизведения
        const timeInterval = setInterval(updateTime, 3000);
        
        // WebSocket подключение для синхронизации YouTube плеера
        const ws = new WebSocket(`ws://localhost:8000/ws/chat/1`);
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'youtube_state') {
                    handleYoutubeStateUpdate(data);
                }
            } catch (error) {
                logger.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onerror = (error) => {
            logger.error('WebSocket error:', error);
        };
        
        return () => {
            clearInterval(interval);
            clearInterval(timeInterval);
            ws.close();
        };
    }, [isAuthenticated]);

    // Обработка событий YouTube
    useEffect(() => {
        const handleYoutubeEvent = (event) => {
            const { event: eventType, data } = event.detail;
            logger.debug('YouTube event received:', eventType, data);
            
            switch (eventType) {
                case 'queue_updated':
                    loadQueue();
                    break;
                case 'video_played':
                    if (data.video) {
                        dispatch({ 
                            type: playerActions.SET_CURRENT_VIDEO, 
                            payload: data.video 
                        });
                        dispatch({ type: playerActions.SET_PLAYING, payload: true });
                    }
                    break;
                case 'queue_empty':
                    dispatch({ type: playerActions.CLOSE_PLAYER });
                    break;
                case 'theater_mode_changed':
                    dispatch({ 
                        type: playerActions.SET_THEATER_MODE, 
                        payload: data.isTheaterMode 
                    });
                    break;
                default:
                    break;
            }
        };
        
        window.addEventListener('youtube_event', handleYoutubeEvent);
        
        return () => {
            window.removeEventListener('youtube_event', handleYoutubeEvent);
        };
    }, []);

    const value = {
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
        updateTime
    };

    return (
        <PlayerContext.Provider value={value}>
            {children}
        </PlayerContext.Provider>
    );
};

// Хук для использования контекста
export const usePlayer = () => {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
};

export default PlayerContext;

