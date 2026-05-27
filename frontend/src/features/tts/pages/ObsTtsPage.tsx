import React, { useEffect, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { WS_BASE_URL } from '@/constants';
import { resolveAudioUrl } from '@/shared/utils/urlUtils';

interface ObsQueueItem {
    id: string;
    audioUrl: string;
    sourceMessageId?: string;
}

const ObsTtsPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [audioQueue, setAudioQueue] = useState<ObsQueueItem[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [status, setStatus] = useState(token ? 'connecting' : 'missing token');
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const playbackEnabledRef = useRef(true);

    useEffect(() => {
        const root = document.getElementById('root');
        const previousHtmlBackground = document.documentElement.style.background;
        const previousBodyBackground = document.body.style.background;
        const previousBodyMargin = document.body.style.margin;
        const previousRootBackground = root?.style.background;

        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
        document.body.style.margin = '0';
        if (root) {
            root.style.background = 'transparent';
        }

        return () => {
            document.documentElement.style.background = previousHtmlBackground;
            document.body.style.background = previousBodyBackground;
            document.body.style.margin = previousBodyMargin;
            if (root) {
                root.style.background = previousRootBackground || '';
            }
        };
    }, []);

    useEffect(() => {
        if (!token) {
            setStatus('missing token');
            return;
        }

        const connect = (): void => {
            const wsUrl = `${WS_BASE_URL}/ws/tts/${token}`;
            setStatus('connecting');
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = (): void => {
                setStatus('connected');
            };

            ws.current.onmessage = (event: MessageEvent): void => {
                try {
                    const message = JSON.parse(event.data) as {
                        type?: string;
                        data?: {
                            audio_url?: string;
                            source_message_id?: string;
                            command?: string;
                        };
                        audio_url?: string;
                        source_message_id?: string;
                        message?: string;
                        command?: string;
                    };

                    const payload = message.data || message;
                    if ((message.type === 'tts_audio' || message.type === 'tts_synthesized') && payload.audio_url) {
                        const audioUrl = resolveAudioUrl(payload.audio_url);
                        setAudioQueue((prevQueue) => [
                            ...prevQueue,
                            {
                                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                audioUrl,
                                sourceMessageId: payload.source_message_id,
                            },
                        ]);
                        setStatus('queued');
                    } else if (message.type === 'tts_control') {
                        const command = String(message.command || payload.command || '').trim().toLowerCase();
                        if (command === 'start') {
                            playbackEnabledRef.current = true;
                            setStatus('connected');
                            setIsPlaying(false);
                            setAudioQueue((prevQueue) => [...prevQueue]);
                        } else if (command === 'stop') {
                            playbackEnabledRef.current = false;
                            currentAudioRef.current?.pause();
                            currentAudioRef.current = null;
                            setIsPlaying(false);
                            setStatus('stopped');
                        } else if (command === 'skip') {
                            currentAudioRef.current?.pause();
                            currentAudioRef.current = null;
                            setIsPlaying(false);
                            setAudioQueue((prevQueue) => prevQueue.slice(1));
                            setStatus('connected');
                        } else if (command === 'clear') {
                            playbackEnabledRef.current = true;
                            currentAudioRef.current?.pause();
                            currentAudioRef.current = null;
                            setIsPlaying(false);
                            setAudioQueue([]);
                            setStatus('connected');
                        }
                    } else if (message.type === 'tts_error') {
                        setStatus(message.message || 'tts error');
                    }
                } catch {
                    // OBS source should stay silent on malformed events.
                }
            };

            ws.current.onerror = (): void => {
                setStatus('socket error');
            };

            ws.current.onclose = (): void => {
                setStatus('reconnecting');
                reconnectTimerRef.current = window.setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current);
            }
            ws.current?.close();
        };
    }, [token]);

    useEffect(() => {
        if (audioQueue.length === 0 || isPlaying || !playbackEnabledRef.current) return;

        const nextItem = audioQueue[0];
        const audio = new Audio(nextItem.audioUrl);
        currentAudioRef.current = audio;
        audio.preload = 'auto';
        setIsPlaying(true);
        setStatus('playing');

        const sendPlaybackStatus = (statusValue: 'playing' | 'played' | 'failed'): void => {
            const socket = ws.current;
            if (!socket || socket.readyState !== WebSocket.OPEN || !nextItem.sourceMessageId) return;
            socket.send(
                JSON.stringify({
                    type: 'tts_status',
                    source_message_id: nextItem.sourceMessageId,
                    status: statusValue,
                })
            );
        };
        sendPlaybackStatus('playing');

        const finish = (statusValue: 'played' | 'failed' = 'played'): void => {
            if (currentAudioRef.current === audio) {
                currentAudioRef.current = null;
            }
            setIsPlaying(false);
            setAudioQueue((prevQueue) => prevQueue.slice(1));
            setStatus('connected');
            sendPlaybackStatus(statusValue);
        };

        audio.onended = () => finish('played');
        audio.onerror = (): void => {
            finish('failed');
        };
        audio.play().catch(() => finish('failed'));
    }, [audioQueue, isPlaying]);

    return <div className="min-h-screen bg-transparent" data-tts-source-status={status} />;
};

export default ObsTtsPage;
