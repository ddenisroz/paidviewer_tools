import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { youtubeService } from '@/services/api/services/youtubeService';
import { logger } from '@/shared/utils/prodLogger';
import { getYoutubeObsWebSocketUrl } from '@/shared/utils/urlUtils';

import type { YoutubeObsState, YoutubeVideo } from '@/types/youtube';

const POLL_INTERVAL_MS = 10_000;

const formatDuration = (value?: string | null): string => {
    if (!value) return '';
    return value;
};

const YoutubeObsOverlay: React.FC = () => {
    const { token = '' } = useParams<{ token: string }>();
    const [state, setState] = useState<YoutubeObsState | null>(null);
    const [connected, setConnected] = useState(false);
    const reconnectTimerRef = useRef<number | null>(null);
    const pollTimerRef = useRef<number | null>(null);

    const currentVideo = useMemo<YoutubeVideo | null>(() => {
        return state?.current_video || state?.queue?.[0] || null;
    }, [state]);

    const overlayMode = state?.settings?.obs_overlay_mode || 'track';

    const loadState = useCallback(async () => {
        if (!token) return;
        try {
            const response = await youtubeService.getObsState(token);
            setState(response.data);
        } catch (error) {
            logger.error('Failed to load YouTube OBS state', error);
        }
    }, [token]);

    useEffect(() => {
        if (!token) return undefined;

        let websocket: WebSocket | null = null;
        let cancelled = false;

        const connect = () => {
            if (cancelled) return;
            websocket = new WebSocket(getYoutubeObsWebSocketUrl(token));

            websocket.onopen = () => {
                setConnected(true);
                websocket?.send(JSON.stringify({ type: 'request_state' }));
            };

            websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as { type?: string; data?: YoutubeObsState };
                    if (message.type === 'youtube_obs_state' && message.data) {
                        setState(message.data);
                    } else if (message.type === 'youtube_queue_updated') {
                        void loadState();
                    }
                } catch (error) {
                    logger.error('Failed to parse YouTube OBS websocket message', error);
                }
            };

            websocket.onclose = () => {
                setConnected(false);
                if (!cancelled) {
                    reconnectTimerRef.current = window.setTimeout(connect, 2500);
                }
            };

            websocket.onerror = () => {
                setConnected(false);
            };
        };

        connect();
        void loadState();
        pollTimerRef.current = window.setInterval(() => void loadState(), POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
            if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current);
            websocket?.close();
        };
    }, [loadState, token]);

    if (!token) {
        return <div className="min-h-screen bg-transparent" />;
    }

    if (!currentVideo) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-transparent p-6 text-white">
                <div className="rounded-lg border border-white/10 bg-black/55 px-5 py-4 text-sm text-white/75">
                    Очередь YouTube пуста
                </div>
            </div>
        );
    }

    if (overlayMode === 'video') {
        return (
            <div className="min-h-screen bg-black">
                <iframe
                    title={currentVideo.title}
                    src={`https://www.youtube.com/embed/${encodeURIComponent(
                        currentVideo.video_id
                    )}?autoplay=1&controls=0&rel=0&modestbranding=1`}
                    className="h-screen w-screen border-0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-end justify-start bg-transparent p-6 text-white">
            <div className="w-[min(560px,calc(100vw-48px))] rounded-lg border border-white/12 bg-[#080b12]/85 p-3 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="flex gap-3">
                    {currentVideo.thumbnail_url ? (
                        <img
                            src={currentVideo.thumbnail_url}
                            alt=""
                            className="h-20 w-32 rounded-md object-cover"
                            referrerPolicy="no-referrer"
                        />
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-sky-200">
                            <span className={connected ? 'text-emerald-300' : 'text-amber-300'}>
                                {connected ? 'Live' : 'Polling'}
                            </span>
                            <span className="text-white/35">YouTube</span>
                        </div>
                        <div className="truncate text-lg font-semibold leading-tight">{currentVideo.title}</div>
                        <div className="mt-1 truncate text-sm text-white/65">
                            {currentVideo.requester_name ? `Заказал: ${currentVideo.requester_name}` : 'Текущий трек'}
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-1/3 rounded-full bg-sky-400" />
                        </div>
                        <div className="mt-1 text-xs text-white/45">{formatDuration(currentVideo.duration)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default YoutubeObsOverlay;
