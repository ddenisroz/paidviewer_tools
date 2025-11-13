import React, { useEffect, useRef, useState } from 'react';
import { TTS_SERVICE_URL, WS_BASE_URL } from '../../constants';
import { useParams } from 'react-router-dom';

const ObsTtsPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [audioQueue, setAudioQueue] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [status, setStatus] = useState<string>('Initializing...');
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!token) {
            setStatus('Error: No authentication token provided in URL.');
            return;
        }

        const connect = (): void => {
            const wsUrl = `${WS_BASE_URL}/ws/tts/${token}`;
            setStatus(`Connecting to ${wsUrl}...`);
            
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = (): void => {
                setStatus(`Connection established. Waiting for TTS messages...`);
            };

            ws.current.onmessage = (event: MessageEvent): void => {
                try {
                    const message = JSON.parse(event.data) as { type: string; audio_url?: string; message?: string };
                    if (message.type === 'tts_synthesized' && message.audio_url) {
                        let audioUrl = message.audio_url;
                        if (!audioUrl.startsWith('http')) {
                            audioUrl = `${TTS_SERVICE_URL}${message.audio_url}`;
                        }
                        setAudioQueue(prevQueue => [...prevQueue, audioUrl]);
                    } else if (message.type === 'tts_error') {
                        setStatus(`Error: ${message.message || 'Unknown error'}`);
                    }
                } catch (error) {
                    // Ошибка обработки WebSocket сообщения
                }
            };

            ws.current.onerror = (): void => {
                setStatus('WebSocket Error. Reconnecting...');
            };

            ws.current.onclose = (): void => {
                setStatus('WebSocket Disconnected. Reconnecting in 5 seconds...');
                setTimeout(connect, 5000);
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
            setIsPlaying(true);
            
            const audio = new Audio(nextAudioUrl);
            
            audio.oncanplaythrough = (): void => {
                audio.play().catch(() => {
                    setIsPlaying(false);
                    setAudioQueue(prevQueue => prevQueue.slice(1));
                });
            };
            
            audio.onended = (): void => {
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            };
            
            audio.onerror = (): void => {
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            };
            
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

