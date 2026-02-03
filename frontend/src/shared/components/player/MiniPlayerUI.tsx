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
                <div className="card-glass rounded-2xl shadow-2xl overflow-hidden">
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
                                        className="text-white font-medium text-sm leading-tight truncate"
                                        title={displayVideo.title}
                                    >
                                        {displayVideo.title}
                                    </h3>
                                    <p
                                        className="text-white/50 text-xs truncate"
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
                                                "h-8 w-8 p-0 rounded-full hover:bg-white/10 text-white/60 hover:text-white",
                                                showQueue && "bg-white/10 text-white"
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
                                        className="h-8 w-8 p-0 rounded-full hover:bg-white/10 text-white/60 hover:text-white"
                                        title="Скрыть плеер"
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
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Очередь</span>
            <div className="flex items-center gap-1">
                {onClearQueue && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearQueue}
                        className="h-6 w-6 p-0 hover:bg-white/10 rounded-full"
                        title="Очистить очередь"
                    >
                        <Trash2 className="w-4 h-4 text-white/70" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-6 w-6 p-0 hover:bg-white/10 rounded-full"
                    title="Скрыть"
                >
                    <ChevronDown className="w-4 h-4 text-white/70" />
                </Button>
            </div>
        </div>
        <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
            {queue.map((video, index) => (
                <button
                    key={video.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 text-left hover:bg-white/5 transition-colors"
                    onClick={() => onSelectQueueItem?.(video)}
                >
                    <span className="text-[10px] font-mono text-white/30 w-4 text-right">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                        <p className="text-white/90 text-xs font-medium truncate">{video.title}</p>
                        <p className="text-white/50 text-[10px] truncate">{video.requester_name || video.user_id || 'Unknown'}</p>
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
    <div className="group/thumb relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black/50 shadow-inner">
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
            <div className="w-full h-full flex items-center justify-center text-white/20">
                <Volume2 className="w-6 h-6" />
            </div>
        )}
        {/* Overlay Play/Pause on hover */}
        <div
            className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
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
                className="h-8 w-8 p-0 rounded-full hover:bg-white/10 text-white/70 hover:text-white"
                title="Следующее видео"
            >
                <SkipForward className="w-5 h-5 fill-current" />
            </Button>
        </div>

        <div className="flex items-center gap-2 w-40">
            <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMute}
                className="h-7 w-7 p-0 hover:bg-transparent text-white/50 hover:text-white/80"
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


