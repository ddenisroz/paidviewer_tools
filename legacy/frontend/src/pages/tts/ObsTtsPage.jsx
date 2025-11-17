import React, { useEffect, useRef, useState } from 'react';
import { TTS_SERVICE_URL, WS_BASE_URL } from '../../constants';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

const ObsTtsPage = () => {
    const { token } = useParams();
    const [audioQueue, setAudioQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [status, setStatus] = useState('Initializing...');
    const ws = useRef(null);

    useEffect(() => {
        if (!token) {
            setStatus('Error: No authentication token provided in URL.');
            return;
        }

        const connect = () => {
            const wsUrl = `${WS_BASE_URL}/ws/tts/${token}`;
            setStatus(`Connecting to ${wsUrl}...`);
            
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                setStatus(`Connection established. Waiting for TTS messages...`);
                // OBS TTS WebSocket Connected');
            };

            ws.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'tts_synthesized' && message.audio_url) {
                        // Проверяем, является ли URL уже полным
                        let audioUrl = message.audio_url;
                        if (!audioUrl.startsWith('http')) {
                            audioUrl = `${TTS_SERVICE_URL}${message.audio_url}`;
                        }
                        // Received audio URL:', audioUrl);
                        setAudioQueue(prevQueue => [...prevQueue, audioUrl]);
                    } else if (message.type === 'tts_error') {
                        // TTS ошибка - показываем пользователю
                        setError(message.message);
                    }
                } catch (error) {
                    // Ошибка обработки WebSocket сообщения
                }
            };

            ws.current.onerror = (error) => {
                setStatus('WebSocket Error. Reconnecting...');
                // WebSocket ошибка
                // The 'onclose' event will handle the reconnection logic.
            };

            ws.current.onclose = () => {
                setStatus('WebSocket Disconnected. Reconnecting in 5 seconds...');
                // WebSocket Disconnected. Reconnecting...');
                setTimeout(connect, 5000); // Attempt to reconnect every 5 seconds
            };
        };

        connect();

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [token]);

    useEffect(() => {
        if (audioQueue.length > 0 && !isPlaying) {
            const nextAudioUrl = audioQueue[0];
            // Playing audio:', nextAudioUrl);
            setIsPlaying(true);
            
            const audio = new Audio(nextAudioUrl);
            
            // Добавляем обработчики событий перед попыткой воспроизведения
            audio.oncanplaythrough = () => {
                // Audio ready to play');
                audio.play().catch(e => {
                    // Ошибка воспроизведения аудио
                    setIsPlaying(false);
                    setAudioQueue(prevQueue => prevQueue.slice(1));
                });
            };
            
            audio.onended = () => {
                // Audio playback ended');
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            };
            
            audio.onerror = (e) => {
                // Ошибка загрузки или воспроизведения аудио
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            };
            
            // Загружаем аудио
            audio.load();
        }
    }, [audioQueue, isPlaying]);

    return (
        <div style={{
            fontFamily: 'sans-serif',
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '20px',
            borderRadius: '10px',
            position: 'absolute',
            top: '10px',
            left: '10px',
        }}>
            <h1>OBS TTS Player</h1>
            <p><strong>Status:</strong> {status}</p>
            <p>This is a browser source for OBS. It will automatically play TTS audio from your chat when enabled.</p>
            <p>Queue length: {audioQueue.length}</p>
        </div>
    );
};

export default ObsTtsPage;
