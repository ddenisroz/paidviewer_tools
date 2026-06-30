import React from 'react';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ban, GripVertical, SkipForward, Trash2 } from 'lucide-react';

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
    isCurrent?: boolean;
    isPlaying?: boolean;
    isDraggable?: boolean;
}

const PlayingEqualizer: React.FC = () => (
    <span className="inline-flex h-4 w-4 shrink-0 items-end justify-center gap-[2px]" title="Сейчас играет">
        {[0, 1, 2].map((index) => (
            <span
                key={index}
                className="block w-[3px] origin-bottom rounded-full bg-primary"
                style={{
                    height: `${7 + index * 3}px`,
                    animation: `queueEq 720ms ease-in-out ${index * 110}ms infinite alternate`,
                }}
            />
        ))}
    </span>
);

const QueueItem: React.FC<QueueItemProps> = ({
    video,
    index,
    compact = false,
    onRemove,
    onPlay,
    onBan,
    onSkip,
    isCurrent = false,
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
    const isRowClickable = Boolean(onPlay && !isCurrent);
    const gridClasses = compact
        ? 'grid grid-cols-[32px_minmax(0,1fr)_minmax(120px,0.8fr)_88px]'
        : 'grid grid-cols-[32px_minmax(0,1fr)_160px_96px_96px]';
    const requesterName = video.requester_name || video.added_by || 'Неизвестно';
    const youtubeUrl = video.url || `https://www.youtube.com/watch?v=${video.video_id}`;

    const handleRowClick = (): void => {
        if (isRowClickable) {
            onPlay?.();
        }
    };

    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (!isRowClickable) return;
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
                'group items-center gap-3 border-b border-border/30 px-3 py-2 transition-colors hover:bg-accent/50 last:border-0',
                gridClasses,
                isRowClickable && 'cursor-pointer',
                isCurrent && 'border-l-2 border-l-primary bg-primary/10'
            )}
            onClick={handleRowClick}
            onKeyDown={handleRowKeyDown}
            role={isRowClickable ? 'button' : undefined}
            tabIndex={isRowClickable ? 0 : undefined}
        >
            <style>
                {`
                    @keyframes queueEq {
                        from { transform: scaleY(0.45); opacity: 0.62; }
                        to { transform: scaleY(1); opacity: 1; }
                    }
                `}
            </style>

            <div className="flex items-center justify-center text-muted-foreground">
                {!compact && isDraggable ? (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-move p-1 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                    >
                        <GripVertical className="h-4 w-4" />
                    </div>
                ) : null}

                <span className={cn('text-xs font-medium tabular-nums', isDraggable && !compact && 'group-hover:hidden')}>
                    {isPlaying ? (
                        <PlayingEqualizer />
                    ) : isCurrent ? (
                        null
                    ) : (
                        index + 1
                    )}
                </span>
            </div>

            {compact ? (
                <>
                    <div className="min-w-0 flex items-center">
                        <span
                            className={cn('text-sm font-medium leading-snug', isCurrent ? 'text-primary' : 'text-foreground')}
                            style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                        >
                            {video.title}
                        </span>
                    </div>
                    <div className="min-w-0 truncate text-xs text-muted-foreground">{requesterName}</div>
                </>
            ) : (
                <>
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
                                    'pr-4 text-sm font-medium hover:text-blue-300',
                                    isCurrent ? 'text-primary' : 'text-foreground'
                                )}
                                style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {video.title}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{video.channel_name || 'YouTube'}</span>
                            {(video.is_paid || video.paid_source) && (
                                <span className="mt-0.5 w-fit rounded bg-amber-400/14 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-200">
                                    Платные заказы
                                </span>
                            )}
                        </div>
                    </a>

                    <div className="min-w-0 justify-self-center truncate text-center text-xs text-muted-foreground">
                        {requesterName}
                    </div>

                    <div className="flex w-full justify-center text-xs font-mono text-muted-foreground">{duration}</div>
                </>
            )}

            <div className="flex w-full items-center justify-center gap-1.5 justify-self-center">
                {!compact && isCurrent && onSkip && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:bg-white/10 hover:text-white"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSkip();
                                }}
                            >
                                <SkipForward className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Пропустить</TooltipContent>
                    </Tooltip>
                )}

                {onBan && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onBan();
                                }}
                            >
                                <Ban className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Забанить видео</TooltipContent>
                    </Tooltip>
                )}

                {onRemove && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRemove();
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Удалить</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default QueueItem;
