import React from 'react';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ban, BarChart2, GripVertical, SkipForward, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { YoutubeVideo } from '@/types/youtube';

interface QueueItemProps {
    video: YoutubeVideo;
    index: number;
    compact?: boolean;
    onRemove?: () => void;
    onPlay?: () => void;
    onBan?: () => void;
    onSkip?: () => void;
    isPlaying?: boolean;
    isDraggable?: boolean;
}

const QueueItem: React.FC<QueueItemProps> = ({
    video,
    index,
    compact = false,
    onRemove,
    onPlay,
    onBan,
    onSkip,
    isPlaying = false,
    isDraggable = true,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: video.id,
        disabled: !isDraggable,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        position: isDragging ? 'relative' : undefined,
    } as React.CSSProperties;

    const duration = video.duration || '--:--';

    const isRowClickable = Boolean(onPlay && !isPlaying);
    const gridClasses = compact
        ? 'grid grid-cols-[32px_minmax(0,1fr)_minmax(120px,0.8fr)_88px]'
        : 'grid grid-cols-[32px_minmax(0,1fr)_160px_96px_96px]';
    const requesterName = video.requester_name || video.added_by || 'Unknown';
    const youtubeUrl = video.url || `https://www.youtube.com/watch?v=${video.video_id}`;

    const handleRowClick = (): void => {
        if (isRowClickable) {
            onPlay?.();
        }
    };

    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (!isRowClickable) {
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onPlay?.();
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0',
                gridClasses,
                isRowClickable && 'cursor-pointer',
                isPlaying && 'bg-primary/10 border-l-2 border-l-primary'
            )}
            onClick={handleRowClick}
            onKeyDown={handleRowKeyDown}
            role={isRowClickable ? 'button' : undefined}
            tabIndex={isRowClickable ? 0 : undefined}
        >
            {/* Index / Drag Handle */}
            <div className="flex items-center justify-center text-muted-foreground">
                {!compact && isDraggable ? (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-move opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-opacity"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                ) : null}

                <span
                    className={cn('text-xs font-medium tabular-nums', isDraggable && !compact && 'group-hover:hidden')}
                >
                    {isPlaying ? <BarChart2 className="w-4 h-4 text-primary animate-pulse" /> : index + 1}
                </span>
            </div>

            {compact ? (
                <>
                    <div className="min-w-0 flex items-center">
                        <span
                            className={cn(
                                'text-sm font-medium truncate',
                                isPlaying ? 'text-primary' : 'text-foreground'
                            )}
                        >
                            {video.title}
                        </span>
                    </div>
                    <div className="min-w-0 truncate text-xs text-muted-foreground">{requesterName}</div>
                </>
            ) : (
                <>
                    {/* Thumbnail & Title */}
                    <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="relative h-9 w-16 shrink-0 overflow-hidden rounded bg-muted">
                            <img
                                src={video.thumbnail || video.thumbnail_url}
                                alt={video.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        </div>
                        <div className="flex min-w-0 flex-col">
                            <span
                                className={cn(
                                    'truncate pr-4 text-sm font-medium hover:text-blue-300',
                                    isPlaying ? 'text-primary' : 'text-foreground'
                                )}
                            >
                                {video.title}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                {video.channel_name || 'YouTube'}
                            </span>
                            {(video.is_paid || video.paid_source) && (
                                <span className="mt-0.5 w-fit rounded bg-amber-400/14 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-200">
                                    Paid video
                                </span>
                            )}
                        </div>
                    </a>

                    <div className="min-w-0 truncate text-center text-xs text-muted-foreground justify-self-center">
                        {requesterName}
                    </div>

                    {/* Duration */}
                    <div className="flex w-full justify-center text-xs font-mono text-muted-foreground">
                        {duration}
                    </div>
                </>
            )}

            {/* Actions */}
            <div className="flex w-full items-center justify-center gap-1.5 justify-self-center">
                {/* Skip button - for currently playing */}
                {!compact && isPlaying && onSkip && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-white hover:bg-white/10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSkip();
                                }}
                            >
                                <SkipForward className="w-3.5 h-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {'\u041f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c'}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Ban button */}
                {onBan && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onBan();
                                }}
                            >
                                <Ban className="w-3.5 h-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {'\u0417\u0430\u0431\u0430\u043d\u0438\u0442\u044c \u0432\u0438\u0434\u0435\u043e'}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Remove button */}
                {onRemove && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove();
                                }}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default QueueItem;
