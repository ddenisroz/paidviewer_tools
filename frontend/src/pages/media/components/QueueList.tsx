import React from 'react';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Clock, ListMusic, User } from 'lucide-react';

import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { YoutubeVideo } from '@/types/youtube';

import QueueItem from './QueueItem';

interface QueueListProps {
    queue: YoutubeVideo[];
    currentVideo: YoutubeVideo | null;
    skipVotes?: { current: number; required: number; video_id?: number | string | null } | null;
    compact?: boolean;
    isPlaybackActive?: boolean;
    totalDuration?: string;
    onRemove: (id: number) => void;
    onPlay?: (video: YoutubeVideo) => void;
    onBan?: (video: YoutubeVideo) => void;
}

const QueueList: React.FC<QueueListProps> = ({
    queue,
    currentVideo,
    isPlaybackActive = false,
    totalDuration,
    compact = false,
    onRemove,
    onPlay,
    onBan,
}) => {
    const { setNodeRef } = useDroppable({
        id: 'queue-list',
    });

    // Filter out current video from queue to avoid duplication
    const filteredQueue = currentVideo
        ? queue.filter((v) => v.id !== currentVideo.id && v.video_id !== currentVideo.video_id)
        : queue;

    return (
        <TooltipProvider>
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card/90">
                {/* Header */}
                <div
                    className={
                        compact
                            ? 'grid grid-cols-[32px_minmax(0,1fr)_minmax(120px,0.8fr)_88px] items-center gap-3 border-b border-border/70 bg-card/90 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'
                            : 'grid grid-cols-[32px_minmax(0,1fr)_160px_96px_96px] items-center gap-3 border-b border-border/70 bg-card/90 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'
                    }
                >
                    <div className="text-center">#</div>
                    {compact ? (
                        <>
                            <div className="whitespace-nowrap">{'\u0422\u0440\u0435\u043a'}</div>
                            <div className="flex w-full items-center justify-center gap-1 whitespace-nowrap">
                                <User className="w-3 h-3" />
                                {'\u0417\u0430\u043a\u0430\u0437\u0430\u043b'}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="whitespace-nowrap">{'\u0422\u0440\u0435\u043a'}</div>
                            <div className="flex w-full items-center justify-center gap-1 whitespace-nowrap">
                                <User className="w-3 h-3" />
                                {'\u0417\u0430\u043a\u0430\u0437\u0430\u043b'}
                            </div>
                            <div className="flex w-full justify-center items-center gap-1 whitespace-nowrap text-center">
                                <Clock className="w-3 h-3" />
                                {totalDuration ? `Время (${totalDuration})` : '\u0412\u0440\u0435\u043c\u044f'}
                            </div>
                        </>
                    )}
                    <div className="w-full text-center">{'\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f'}</div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                    <div ref={setNodeRef} className="p-0">
                        <SortableContext items={filteredQueue.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                            {/* Currently Playing Section */}
                            {currentVideo && (
                            <div className="mb-3">
                                    <div className="mt-1 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary/80">
                                        <span>
                                            {
                                                '\u0421\u0435\u0439\u0447\u0430\u0441 \u0438\u0433\u0440\u0430\u0435\u0442'
                                            }
                                        </span>
                                    </div>
                                    <QueueItem
                                        video={currentVideo}
                                        index={-1}
                                        isCurrent
                                        isPlaying={isPlaybackActive}
                                        isDraggable={false}
                                        compact={compact}
                                        onRemove={() => onRemove(currentVideo.id)}
                                        onBan={onBan ? () => onBan(currentVideo) : undefined}
                                    />
                                </div>
                            )}

                            {/* Queue List - filtered to exclude current video */}
                            {filteredQueue.length > 0 && (
                                <div className="mb-2">
                                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1 border-t border-border/50">
                                        {'\u0414\u0430\u043b\u0435\u0435'}
                                    </div>
                                    {filteredQueue.map((video, index) => (
                                        <QueueItem
                                            key={video.id}
                                            video={video}
                                            index={index}
                                            compact={compact}
                                            onRemove={() => onRemove(video.id)}
                                            onPlay={() => onPlay?.(video)}
                                            onBan={onBan ? () => onBan(video) : undefined}
                                        />
                                    ))}
                                </div>
                            )}

                            {filteredQueue.length === 0 && !currentVideo && (
                                <div className="flex items-center justify-center py-20 text-muted-foreground opacity-45">
                                    <ListMusic className="h-12 w-12 stroke-1" />
                                </div>
                            )}
                        </SortableContext>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
};

export default QueueList;
