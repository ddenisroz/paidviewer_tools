import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { YoutubeVideo } from '@/types/youtube';
import { Button } from '@/shared/components/ui/button';
import { GripVertical, Play, Trash2, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming you have a utils/cn helper

interface QueueItemProps {
    video: YoutubeVideo;
    index: number;
    onRemove?: () => void;
    onPlay?: () => void;
    isPlaying?: boolean;
    isDraggable?: boolean;
}

const QueueItem: React.FC<QueueItemProps> = ({
    video,
    index,
    onRemove,
    onPlay,
    isPlaying = false,
    isDraggable = true
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: video.id, disabled: !isDraggable });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        position: isDragging ? 'relative' : undefined,
    } as React.CSSProperties;

    // Duration is already formatted string in API response
    const duration = video.duration || '00:00';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0",
                isPlaying && "bg-primary/10 border-l-2 border-l-primary"
            )}
        >
            {/* Index / Drag Handle */}
            <div className="w-12 flex items-center justify-center text-muted-foreground">
                {isDraggable ? (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-move opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-opacity"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                ) : null}

                <span className={cn(
                    "text-xs font-medium tabular-nums",
                    isDraggable && "group-hover:hidden"
                )}>
                    {isPlaying ? <BarChart2 className="w-4 h-4 text-primary animate-pulse" /> : index + 1}
                </span>

                {onPlay && !isPlaying && (
                    <button
                        onClick={onPlay}
                        className="hidden group-hover:flex items-center justify-center absolute ml-[-2px] text-white hover:scale-110 transition-transform"
                    >
                        <Play className="w-4 h-4 fill-white" />
                    </button>
                )}
            </div>

            {/* Thumbnail & Title */}
            <div className="flex-1 px-4 flex items-center gap-4 min-w-0">
                <div className="relative shrink-0 rounded overflow-hidden w-16 h-9 bg-muted">
                    <img
                        src={video.thumbnail || video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className={cn(
                        "font-medium text-sm truncate pr-4",
                        isPlaying ? "text-primary" : "text-foreground"
                    )}>
                        {video.title}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                        {video.channel_name || "YouTube"}
                    </span>
                </div>
            </div>

            {/* Requester */}
            <div className="w-32 hidden md:flex items-center text-xs text-muted-foreground truncate">
                {video.requester_name || video.user_id || 'Автозапуск'}
            </div>

            {/* Duration */}
            <div className="w-16 flex justify-end text-xs font-mono text-muted-foreground">
                {/* {formatDuration(video.duration)} */}
                --:--
            </div>

            {/* Actions */}
            <div className="w-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {onRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

export default QueueItem;
