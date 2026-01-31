import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { YoutubeVideo } from '@/types/youtube';
import QueueItem from './QueueItem';
import { Clock, ListMusic, User } from 'lucide-react';
// import { ScrollArea } from '@/shared/components/ui/scroll-area';

interface QueueListProps {
    queue: YoutubeVideo[];
    currentVideo: YoutubeVideo | null;
    onRemove: (id: number) => void;
    onPlay?: (video: YoutubeVideo) => void;
}

const QueueList: React.FC<QueueListProps> = ({ queue, currentVideo, onRemove, onPlay }) => {
    const { setNodeRef } = useDroppable({
        id: 'queue-list',
    });

    return (
        <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center px-4 py-3 border-b border-border/50 bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="w-12 text-center text-[10px]">#</div>
                <div className="flex-1 px-4">Трек</div>
                <div className="w-32 hidden md:flex items-center gap-1"><User className="w-3 h-3" /> Заказал</div>
                <div className="w-16 flex justify-end items-center gap-1"><Clock className="w-3 h-3" /> Время</div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                <div ref={setNodeRef} className="p-0">
                    <SortableContext
                        items={queue.map(v => v.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {/* Up Next Section if current video exists */}
                        {currentVideo && (
                            <div className="mb-4">
                                <div className="px-4 py-2 text-xs font-semibold text-primary/80 uppercase tracking-widest mt-2">
                                    Сейчас играет
                                </div>
                                <QueueItem
                                    video={currentVideo}
                                    index={-1}
                                    isPlaying={true}
                                    isDraggable={false}
                                />
                            </div>
                        )}

                        {/* Queue List */}
                        {queue.length > 0 && (
                            <div className="mb-2">
                                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2 border-t border-border/50">
                                    Далее
                                </div>
                                {queue.map((video, index) => (
                                    <QueueItem
                                        key={video.id} // Ensure 'id' is unique for dnd-kit
                                        video={video}
                                        index={index}
                                        onRemove={() => onRemove(video.id)}
                                        onPlay={() => onPlay?.(video)}
                                    />
                                ))}
                            </div>
                        )}

                        {queue.length === 0 && !currentVideo && (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                                <ListMusic className="w-12 h-12 mb-4 stroke-1" />
                                <p>Очередь пуста</p>
                            </div>
                        )}
                    </SortableContext>
                </div>
            </div>
        </div>
    );
};

export default QueueList;
