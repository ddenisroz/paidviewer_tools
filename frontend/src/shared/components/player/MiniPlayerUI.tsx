import React from 'react';

import { ChevronDown, List, Pause, Play, SkipForward, Trash2, Volume2, VolumeX, X } from 'lucide-react';

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

export const MiniPlayerUI: React.FC<MiniPlayerUIProps> = ({
    displayVideo,
    displayThumbnail,
    isPlaying,
    isMuted,
    volume,
    queue,
    showQueue,
    onToggleQueue,
    onSelectQueueItem,
    onTogglePlayPause,
    onNextVideo,
    onToggleMute,
    onVolumeChange,
    onClearQueue,
    onClose,
    variant = 'floating'
}) => {
    const isDocked = variant === 'sidebar';
    return (
        <div
            className={cn(
                isDocked
                    ? "w-full pointer-events-auto"
                    : "fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-2rem))] pointer-events-auto"
            )}
        >
            <div className="relative">
                {/* Queue panel - floating above */}
                {showQueue && queue.length > 0 && (
                    <QueuePanel
                        queue={queue}
                        onClose={() => onToggleQueue()}
                        onSelectQueueItem={onSelectQueueItem}
                        onClearQueue={onClearQueue}
                    />
                )}

                {/* Main Player Card */}
                <div className="relative overflow-hidden rounded-2xl bg-[#200b12] shadow-md shadow-black/45">
                    <div className="flex items-start p-3 gap-3">
                        {/* Album Art / Video Thumbnail */}
                        <ThumbnailSection
                            thumbnail={displayThumbnail}
                            title={displayVideo.title}
                            isPlaying={isPlaying}
                            onTogglePlayPause={onTogglePlayPause}
                        />

                        {/* Info & Controls */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3
                                        className="text-foreground font-medium text-sm leading-tight truncate"
                                        title={displayVideo.title}
                                    >
                                        {displayVideo.title}
                                    </h3>
                                    <p
                                        className="text-muted-foreground text-xs truncate"
                                        title={String(displayVideo.requester_name || displayVideo.user_id || 'Unknown')}
                                    >
                                        {displayVideo.requester_name || displayVideo.user_id || 'Unknown'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {queue.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={onToggleQueue}
                                            className={cn(
                                                "h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground",
                                                showQueue && "bg-accent/80 text-foreground"
                                            )}
                                            title={showQueue ? "Скрыть очередь" : "Показать очередь"}
                                        >
                                            <List className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onClose}
                                        className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                                        title="Закрыть плеер"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <ControlsRow
                                isMuted={isMuted}
                                volume={volume}
                                onNextVideo={onNextVideo}
                                onToggleMute={onToggleMute}
                                onVolumeChange={onVolumeChange}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-components for better organization

interface QueuePanelProps {
    queue: DisplayVideo[];
    onClose: () => void;
    onClearQueue?: () => void;
    onSelectQueueItem?: (video: DisplayVideo) => void;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ queue, onClose, onClearQueue, onSelectQueueItem }) => (
    <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-[#200b12] shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="flex items-center justify-between border-b border-border/60 bg-[#200b12] px-4 py-3">
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Очередь</span>
            <div className="flex items-center gap-1">
                {onClearQueue && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearQueue}
                        className="h-6 w-6 rounded-full p-0 hover:bg-accent/80"
                        title="Очистить очередь"
                    >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-6 w-6 rounded-full p-0 hover:bg-accent/80"
                    title="Скрыть"
                >
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
                    <span className="w-4 text-right text-[10px] font-mono text-muted-foreground/60">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{video.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{video.requester_name || video.user_id || 'Unknown'}</p>
                    </div>
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
}

const ThumbnailSection: React.FC<ThumbnailSectionProps> = ({
    thumbnail,
    title,
    isPlaying,
    onTogglePlayPause
}) => (
    <div className="group/thumb relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-900/60 ring-1 ring-white/10 shadow-inner">
        {thumbnail ? (
            <img
                src={thumbnail}
                alt={title}
                className={cn(
                    "w-full h-full object-cover transition-transform duration-700",
                    isPlaying ? "scale-110" : "scale-100 grayscale-[0.2]"
                )}
            />
        ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                <Volume2 className="w-6 h-6" />
            </div>
        )}
        {/* Overlay Play/Pause on hover */}
        <div
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover/thumb:opacity-100"
            onClick={onTogglePlayPause}
        >
            {isPlaying ? <Pause className="w-6 h-6 text-white fill-current" /> : <Play className="w-6 h-6 text-white fill-current" />}
        </div>
    </div>
);

interface ControlsRowProps {
    isMuted: boolean;
    volume: number;
    onNextVideo: () => void;
    onToggleMute: () => void;
    onVolumeChange: (value: number[]) => void;
}

const ControlsRow: React.FC<ControlsRowProps> = ({
    isMuted,
    volume,
    onNextVideo,
    onToggleMute,
    onVolumeChange
}) => (
    <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="sm"
                onClick={onNextVideo}
                className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                title="Следующий трек"
            >
                <SkipForward className="w-5 h-5 fill-current" />
            </Button>
        </div>

        <div className="flex items-center gap-2 w-40">
            <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMute}
                className="h-7 w-7 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                title={isMuted ? "Включить звук" : "Выключить звук"}
            >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider
                value={[isMuted ? 0 : (volume ?? 100)]}
                onValueChange={onVolumeChange}
                max={100}
                step={1}
                className="w-full"
            />
        </div>
    </div>
);

export default MiniPlayerUI;


