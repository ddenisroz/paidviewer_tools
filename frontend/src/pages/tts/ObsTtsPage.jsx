import React, { useEffect, useRef, useState } from 'react';
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
            const wsUrl = `${import.meta.env.VITE_BOT_SERVICE_WS_URL}/ws/chat/obs/${token}`;
            setStatus(`Connecting to ${wsUrl}...`);
            
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                setStatus(`Connection established. Waiting for TTS messages...`);
                console.log('OBS TTS WebSocket Connected');
            };

            ws.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'tts_synthesized' && message.audio_url) {
                        const audioUrl = `${import.meta.env.VITE_TTS_SERVICE_URL}${message.audio_url}`;
                        console.log('Received audio URL:', audioUrl);
                        setAudioQueue(prevQueue => [...prevQueue, audioUrl]);
                    } else if (message.type === 'tts_error') {
                        console.error('TTS Error:', message.message);
                        // Показываем красивое уведомление об ошибке
                        toast.error(message.message);
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            };

            ws.current.onerror = (error) => {
                setStatus('WebSocket Error. Reconnecting...');
                console.error('WebSocket Error:', error);
                // The 'onclose' event will handle the reconnection logic.
            };

            ws.current.onclose = () => {
                setStatus('WebSocket Disconnected. Reconnecting in 5 seconds...');
                console.log('WebSocket Disconnected. Reconnecting...');
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
            setIsPlaying(true);
            const audio = new Audio(nextAudioUrl);
            audio.play().catch(e => {
                console.error("Audio play failed:", e);
                // If play fails, move to the next item
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            });

            audio.onended = () => {
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            };
            audio.onerror = () => {
                console.error("Error loading or playing audio:", nextAudioUrl);
                setIsPlaying(false);
                setAudioQueue(prevQueue => prevQueue.slice(1));
            }
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
