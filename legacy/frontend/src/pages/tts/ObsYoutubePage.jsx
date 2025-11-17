import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import YouTube from 'react-youtube';
import { logger } from '../../utils/prodLogger';

const ObsYoutubePage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState('Подключение...');
    const [currentVideo, setCurrentVideo] = useState(null);
    const [volume, setVolume] = useState(50);
    const [isPlaying, setIsPlaying] = useState(false);
    const [queue, setQueue] = useState([]);
    const ws = useRef(null);
    const playerRef = useRef(null);

    useEffect(() => {
        if (!token) {
            setStatus('Ошибка: Отсутствует токен авторизации');
            return;
        }

        // Подключаемся к WebSocket
        const wsBaseUrl = import.meta.env.VITE_BOT_SERVICE_WS_URL;
        if (!wsBaseUrl) {
            logger.error('VITE_BOT_SERVICE_WS_URL environment variable is required');
            return;
        }
        const wsUrl = `${wsBaseUrl}/obs/youtube/${token}`;
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            // YouTube OBS WebSocket connected');
            setStatus('Подключено к YouTube OBS');
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // YouTube OBS message received:', data);

                switch (data.type) {
                    case 'youtube_play':
                        setCurrentVideo(data.video);
                        setVolume(data.volume || 50);
                        setIsPlaying(true);
                        break;
                    case 'youtube_pause':
                        setIsPlaying(false);
                        break;
                    case 'youtube_next':
                        // Переключаем на следующее видео
                        handleNextVideo();
                        break;
                    case 'youtube_volume':
                        setVolume(data.volume || 50);
                        if (playerRef.current && playerRef.current.getInternalPlayer()) {
                            playerRef.current.getInternalPlayer().setVolume(data.volume || 50);
                        }
                        break;
                    case 'youtube_queue_update':
                        setQueue(data.queue || []);
                        setCurrentVideo(data.current_video || null);
                        break;
                    case 'youtube_clear':
                        setQueue([]);
                        setCurrentVideo(null);
                        setIsPlaying(false);
                        break;
                    default:
                        // Unknown YouTube OBS message type:', data.type);
                }
            } catch (error) {
                logger.error('Error parsing YouTube OBS WebSocket message:', error);
            }
        };

        ws.current.onclose = () => {
            // YouTube OBS WebSocket disconnected');
            setStatus('Отключено от YouTube OBS');
        };

        ws.current.onerror = (error) => {
            logger.error('YouTube OBS WebSocket error:', error);
            setStatus('Ошибка подключения YouTube OBS');
        };

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [token]);

    const handleNextVideo = () => {
        if (queue.length > 0) {
            const nextVideo = queue[0];
            setCurrentVideo(nextVideo);
            setQueue(prev => prev.slice(1));
        } else {
            setCurrentVideo(null);
            setIsPlaying(false);
        }
    };

    const handleVideoEnd = () => {
        handleNextVideo();
    };

    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 0, // Отключаем стандартные элементы управления для OBS
            disablekb: 1, // Отключаем клавиатурные команды
            fs: 0, // Отключаем полноэкранный режим
            modestbranding: 1, // Минимальный брендинг YouTube
            rel: 0, // Не показывать связанные видео
            showinfo: 0, // Не показывать информацию о видео
        },
    };

    const handleReady = (event) => {
        if (playerRef.current) {
            playerRef.current.getInternalPlayer().setVolume(volume);
        }
    };

    const handlePlay = () => {
        setIsPlaying(true);
    };

    const handlePause = () => {
        setIsPlaying(false);
    };

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Статус подключения (маленький индикатор) */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '5px 10px',
                borderRadius: '5px',
                fontSize: '12px',
                zIndex: 10
            }}>
                {status}
            </div>

            {/* YouTube плеер */}
            {currentVideo ? (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <YouTube
                        videoId={currentVideo.video_id}
                        opts={opts}
                        onReady={handleReady}
                        onEnd={handleVideoEnd}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        ref={playerRef}
                        style={{
                            width: '100%',
                            height: '100%'
                        }}
                    />
                </div>
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '48px',
                        marginBottom: '20px',
                        opacity: 0.3
                    }}>
                        🎵
                    </div>
                    <div style={{
                        fontSize: '24px',
                        marginBottom: '10px'
                    }}>
                        YouTube Queue для OBS
                    </div>
                    <div style={{
                        fontSize: '16px',
                        opacity: 0.7
                    }}>
                        Ожидание видео из очереди...
                    </div>
                    {queue.length > 0 && (
                        <div style={{
                            fontSize: '14px',
                            marginTop: '20px',
                            opacity: 0.5
                        }}>
                            Видео в очереди: {queue.length}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ObsYoutubePage;
