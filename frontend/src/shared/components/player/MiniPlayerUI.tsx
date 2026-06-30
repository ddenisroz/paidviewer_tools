import React from 'react';

import { ChevronDown, List, Pause, Play, Trash2, Volume2, VolumeX, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Slider } from '@/shared/components/ui/slider';

import type { DisplayVideo } from './types';

interface MiniPlayerUIProps {
    displayVideo: DisplayVideo;
    displayThumbnail?: string;
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    currentTime?: number;
    durationSeconds?: number;
    skipVotes?: { current: number; required: number; video_id?: number | string | null } | null;
    queue: DisplayVideo[];
    showQueue: boolean;
    onToggleQueue: () => void;
    onSelectQueueItem?: (video: DisplayVideo) => void;
    onTogglePlayPause: () => void;
    onNextVideo: () => void;
    onToggleMute: () => void;
    onVolumeChange: (value: number[]) => void;
    onClearQueue?: () => void;
    onClose: () => void;
    variant?: 'floating' | 'sidebar';
}

const parseDuration = (value?: string): number => {
    if (!value) return 0;
    const parts = value.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
};

const formatClock = (value?: number): string => {
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));
    const mins = Math.floor(safeValue / 60);
    const secs = safeValue % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

const Equalizer: React.FC = () => (
    <span className="inline-flex h-4 w-4 shrink-0 items-end justify-center gap-[2px]" title="Сейчас играет">
        {[0, 1, 2].map((index) => (
            <span
                key={index}
                className="block w-[3px] origin-bottom rounded-full bg-emerald-300"
                style={{
                    height: `${7 + index * 3}px`,
                    animation: `miniEq 720ms ease-in-out ${index * 110}ms infinite alternate`,
                }}
            />
        ))}
    </span>
);

export const MiniPlayerUI: React.FC<MiniPlayerUIProps> = ({
    displayVideo,
    displayThumbnail,
    isPlaying,
    isMuted,
    volume,
    currentTime = 0,
    durationSeconds,
    queue,
    showQueue,
    onToggleQueue,
    onSelectQueueItem,
    onTogglePlayPause,
    onToggleMute,
    onVolumeChange,
    onClearQueue,
    onClose,
    variant = 'floating',
}) => {
    const isDocked = variant === 'sidebar';
    const resolvedDuration = durationSeconds || parseDuration(displayVideo.duration);
    const progress = resolvedDuration ? Math.max(0, Math.min(100, (currentTime / resolvedDuration) * 100)) : 0;
    const requesterName = displayVideo.requester_name || displayVideo.added_by || 'Неизвестно';
    const isPaidVideo = Boolean(displayVideo.is_paid || displayVideo.paid_source);

    return (
        <div
            className={cn(
                isDocked
                    ? 'pointer-events-auto w-full'
                    : 'pointer-events-auto fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-2rem))]'
            )}
            data-mini-player-variant={variant}
        >
            <style>
                {`
                    @keyframes miniEq {
                        from { transform: scaleY(0.45); opacity: 0.62; }
                        to { transform: scaleY(1); opacity: 1; }
                    }
                `}
            </style>

            <div className="relative">
                {showQueue && queue.length > 0 ? (
                    <QueuePanel
                        queue={queue}
                        onClose={onToggleQueue}
                        onClearQueue={onClearQueue}
                        onSelectQueueItem={onSelectQueueItem}
                    />
                ) : null}

                <div
                    className={cn(
                        'relative overflow-hidden rounded-2xl border border-white/12 bg-[#13060d] shadow-md shadow-black/55 ring-1 ring-white/5',
                        isDocked && 'h-[108px]'
                    )}
                    data-mini-player-card={variant}
                >
                    {isDocked ? (
                        <div className="relative flex h-[108px] items-start gap-3 px-3 py-2.5">
                            <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                                {queue.length > 0 ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onToggleQueue}
                                        className={cn(
                                            'h-5 w-5 rounded-full p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                                            showQueue && 'bg-accent/80 text-foreground'
                                        )}
                                        title="Очередь"
                                    >
                                        <List className="h-3 w-3" />
                                    </Button>
                                ) : null}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    className="h-5 w-5 rounded-full p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                                    title="Скрыть мини-плеер"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>

                            <div className="flex items-start pt-0.5">
                                <ThumbnailSection
                                    thumbnail={displayThumbnail}
                                    title={displayVideo.title}
                                    isPlaying={isPlaying}
                                    onTogglePlayPause={onTogglePlayPause}
                                    docked
                                />
                            </div>

                            <div className="min-w-0 flex-1 pr-8">
                                <div className="flex min-w-0 items-start gap-2">
                                    {isPlaying ? <Equalizer /> : null}
                                    <h3
                                        className="text-left text-[11px] font-semibold leading-[0.95rem] text-foreground"
                                        title={displayVideo.title}
                                        style={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {displayVideo.title}
                                    </h3>
                                </div>

                                {resolvedDuration ? (
                                    <>
                                        <div className="mt-1 text-[10px] font-semibold text-white/70">
                                            {formatClock(currentTime)} / {formatClock(resolvedDuration)}
                                        </div>
                                        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10">
                                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
                                        </div>
                                    </>
                                ) : null}

                                <ControlsRow
                                    docked
                                    isMuted={isMuted}
                                    volume={volume}
                                    onToggleMute={onToggleMute}
                                    onVolumeChange={onVolumeChange}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3 p-3">
                            <ThumbnailSection
                                thumbnail={displayThumbnail}
                                title={displayVideo.title}
                                isPlaying={isPlaying}
                                onTogglePlayPause={onTogglePlayPause}
                            />

                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        {isPlaying ? <Equalizer /> : null}
                                        <h3
                                            className="text-sm font-medium leading-tight text-foreground"
                                            title={displayVideo.title}
                                            style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {displayVideo.title}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {queue.length > 0 ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={onToggleQueue}
                                                className={cn(
                                                    'h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                                                    showQueue && 'bg-accent/80 text-foreground'
                                                )}
                                        title="Очередь"
                                            >
                                                <List className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={onClose}
                                            className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                                        title="Скрыть мини-плеер"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-semibold text-white/62">
                                    <span className="truncate">Заказал: {requesterName}</span>
                                    {isPaidVideo ? (
                                        <span className="rounded bg-amber-400/14 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-200">
                                            Платные заказы
                                        </span>
                                    ) : null}
                                    {resolvedDuration ? <span>{formatClock(currentTime)} / {formatClock(resolvedDuration)}</span> : null}
                                </div>

                                {resolvedDuration ? (
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${progress}%` }} />
                                    </div>
                                ) : null}

                                <ControlsRow
                                    isMuted={isMuted}
                                    volume={volume}
                                    onToggleMute={onToggleMute}
                                    onVolumeChange={onVolumeChange}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface QueuePanelProps {
    queue: DisplayVideo[];
    onClose: () => void;
    onClearQueue?: () => void;
    onSelectQueueItem?: (video: DisplayVideo) => void;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ queue, onClose, onClearQueue, onSelectQueueItem }) => (
    <div className="pv-static-anchor-in absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-[#13060d] shadow-2xl shadow-black/50 ring-1 ring-white/5">
        <div className="flex items-center justify-between border-b border-border/50 bg-[#13060d] px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">Очередь</span>
            <div className="flex items-center gap-1">
                {onClearQueue ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearQueue}
                        className="h-6 w-6 rounded-full p-0 hover:bg-accent/80"
                        title="Очистить очередь"
                    >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 rounded-full p-0 hover:bg-accent/80" title="Скрыть">
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
            </div>
        </div>
        <div className="max-h-[220px] overflow-y-auto">
            {queue.map((video, index) => (
                <button
                    key={video.id}
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left transition-colors hover:bg-accent/70 last:border-0"
                    onClick={() => onSelectQueueItem?.(video)}
                >
                    <span className="w-4 text-right font-mono text-[10px] text-muted-foreground/60">{index + 1}</span>
                    <p className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-foreground">
                        <span className="truncate">{video.title}</span>
                        {video.is_paid || video.paid_source ? (
                            <span className="shrink-0 rounded bg-amber-400/14 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-200">
                                Платный
                            </span>
                        ) : null}
                    </p>
                </button>
            ))}
        </div>
    </div>
);

interface ThumbnailSectionProps {
    thumbnail?: string;
    title: string;
    isPlaying: boolean;
    onTogglePlayPause: () => void;
    docked?: boolean;
}

const ThumbnailSection: React.FC<ThumbnailSectionProps> = ({
    thumbnail,
    title,
    isPlaying,
    onTogglePlayPause,
    docked = false,
}) => (
    <div className={cn('flex shrink-0 flex-col items-center gap-1.5', docked ? 'w-12' : 'w-16')}>
        <div
            className={cn(
                'group/thumb relative overflow-hidden rounded-lg bg-slate-900/60 shadow-inner ring-1 ring-white/10',
                docked ? 'h-12 w-12 rounded-md' : 'h-16 w-16'
            )}
        >
        {thumbnail ? (
            <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
        ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                <Volume2 className="h-6 w-6" />
            </div>
        )}
        <button
            type="button"
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover/thumb:opacity-100"
            onClick={onTogglePlayPause}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
        >
            {isPlaying ? <Pause className="h-6 w-6 fill-current text-white" /> : <Play className="h-6 w-6 fill-current text-white" />}
        </button>
        </div>
    </div>
);

interface ControlsRowProps {
    docked?: boolean;
    isMuted: boolean;
    volume: number;
    onToggleMute: () => void;
    onVolumeChange: (value: number[]) => void;
}

const ControlsRow: React.FC<ControlsRowProps> = ({ docked = false, isMuted, volume, onToggleMute, onVolumeChange }) => (
    <div className="mt-2 flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMute}
                className={cn(
                    'p-0 text-muted-foreground hover:bg-transparent hover:text-foreground',
                    docked ? 'h-6 w-6' : 'h-7 w-7'
                )}
                title={isMuted ? 'Включить звук' : 'Выключить звук'}
            >
                {isMuted ? (
                    <VolumeX className={cn(docked ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                ) : (
                    <Volume2 className={cn(docked ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                )}
            </Button>
            <Slider
                value={[isMuted ? 0 : (volume ?? 100)]}
                onValueChange={onVolumeChange}
                max={100}
                step={1}
                className="min-w-0 flex-1"
            />
        </div>
    </div>
);

export default MiniPlayerUI;
