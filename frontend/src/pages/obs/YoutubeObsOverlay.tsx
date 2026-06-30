import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { youtubeService } from '@/services/api/services/youtubeService';
import { logger } from '@/shared/utils/prodLogger';
import { getYoutubeObsWebSocketUrl } from '@/shared/utils/urlUtils';

import type { YoutubeObsState, YoutubeVideo } from '@/types/youtube';

const POLL_INTERVAL_MS = 10_000;

const formatDuration = (value?: string | null): string => (value ? value : '');

const VideoInfoPanel: React.FC<{
    video: YoutubeVideo;
    connected: boolean;
    skipVotes?: YoutubeObsState['skip_votes'];
    compact?: boolean;
}> = ({ video, connected, skipVotes, compact = false }) => (
    <div
        className={
            compact
                ? 'w-full rounded-lg border border-white/12 bg-[#080b12]/82 p-3 shadow-2xl shadow-black/50 backdrop-blur'
                : 'w-[min(560px,calc(100vw-48px))] rounded-lg border border-white/12 bg-[#080b12]/85 p-3 shadow-2xl shadow-black/50 backdrop-blur'
        }
    >
        <div className="flex gap-3">
            {video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt="" className="h-20 w-32 rounded-md object-cover" referrerPolicy="no-referrer" />
            ) : null}
            <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-sky-200">
                    <span className={connected ? 'text-emerald-300' : 'text-amber-300'}>{connected ? 'Live' : 'Polling'}</span>
                    <span className="text-white/35">YouTube</span>
                    {video.is_paid || video.paid_source ? (
                        <span className="rounded bg-amber-400/14 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                            Платные заказы
                        </span>
                    ) : null}
                </div>
                <div className="truncate text-lg font-semibold leading-tight">{video.title}</div>
                <div className="mt-1 truncate text-sm text-white/65">
                    {video.requester_name ? `Заказал: ${video.requester_name}` : 'Текущий трек'}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-white/50">
                    {formatDuration(video.duration) ? <span>Длительность: {formatDuration(video.duration)}</span> : null}
                    {skipVotes ? <span>Пропуск: {skipVotes.current}/{skipVotes.required}</span> : null}
                </div>
            </div>
        </div>
    </div>
);

const YoutubeObsOverlay: React.FC = () => {
    const { token = '' } = useParams<{ token: string }>();
    const [state, setState] = useState<YoutubeObsState | null>(null);
    const [connected, setConnected] = useState(false);
    const reconnectTimerRef = useRef<number | null>(null);
    const pollTimerRef = useRef<number | null>(null);

    const currentVideo = useMemo<YoutubeVideo | null>(() => state?.current_video || state?.queue?.[0] || null, [state]);
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

    if (!token || !currentVideo) {
        return <div className="min-h-screen bg-transparent" />;
    }

    if (overlayMode === 'video') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-transparent p-6 text-white">
                <div className="w-[min(920px,calc(100vw-48px))]">
                    <div className="aspect-video overflow-hidden rounded-lg bg-black shadow-2xl shadow-black/55">
                        <iframe
                            title={currentVideo.title}
                            src={`https://www.youtube.com/embed/${encodeURIComponent(
                                currentVideo.video_id
                            )}?autoplay=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3`}
                            className="h-full w-full border-0"
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                    <div className="mt-3">
                        <VideoInfoPanel video={currentVideo} connected={connected} skipVotes={state?.skip_votes} compact />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-end justify-start bg-transparent p-6 text-white">
            <VideoInfoPanel video={currentVideo} connected={connected} skipVotes={state?.skip_votes} />
        </div>
    );
};

export default YoutubeObsOverlay;
