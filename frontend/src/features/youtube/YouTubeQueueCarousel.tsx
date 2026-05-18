import React, { useMemo, useState } from 'react';

import { ChevronDown, ChevronUp, GripVertical, History, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
    useAddYoutubeVideo,
    useClearYoutubeQueue,
    useDeleteYoutubeVideo,
    useMarkYoutubeVideoAsPlayed,
    usePlayYoutubeQueueItem,
    useYoutubeQueue,
} from '@/queries/youtube/youtubeQueries';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';

interface YouTubeVideo {
    id: string | number;
    title: string;
    duration?: string;
    thumbnail_url?: string;
    requester_name?: string;
    platform?: string;
    is_paid?: boolean;
    points_cost?: number;
    url?: string;
    video_id?: string;
}

interface QueueResponse {
    current_video?: YouTubeVideo;
    queue?: YouTubeVideo[];
    is_playing?: boolean;
    total_duration?: number;
}

// YouTube Play Button SVG Icon
const YouTubeIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
);

// Format seconds to HH:MM:SS or MM:SS
const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
};

// Parse duration string like "15:17" or "1:23:45" to display format
const parseDurationString = (duration: string): string => {
    if (!duration) return '';
    return `Duration ${duration}`;
};

const ITEMS_PER_PAGE = 5;

const YouTubeQueueCarousel: React.FC = () => {
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);
    const [clearQueueConfirmOpen, setClearQueueConfirmOpen] = useState(false);

    const { data: queueResponse, isLoading: loading } = useYoutubeQueue({
        refetchInterval: 60 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

    const { queueData, totalDuration } = useMemo(() => {
        if (!queueResponse) return { queueData: [], totalDuration: 0 };
        const responseData = queueResponse as { data?: QueueResponse | YouTubeVideo[] };
        const data = responseData.data;
        if (!data) return { queueData: [], totalDuration: 0 };

        let videos: YouTubeVideo[] = [];
        let duration = 0;

        if (Array.isArray(data)) {
            videos = data;
        } else if (data.current_video && data.queue) {
            videos = [data.current_video, ...data.queue];
            duration = data.total_duration || 0;
        } else if (data.queue) {
            videos = data.queue;
            duration = data.total_duration || 0;
        }

        return { queueData: videos, totalDuration: duration };
    }, [queueResponse]);

    const addVideoMutation = useAddYoutubeVideo({
        onSuccess: () => {
            setNewVideoUrl('');
            setShowAddForm(false);
        },
    });

    const removeVideoMutation = useDeleteYoutubeVideo();
    const playVideoMutation = usePlayYoutubeQueueItem({
        onSuccess: () => {
            window.dispatchEvent(
                new CustomEvent('youtube_event', {
                    detail: { event: 'video_played' },
                })
            );
        },
    });
    const markAsPlayedMutation = useMarkYoutubeVideoAsPlayed();
    const clearQueueMutation = useClearYoutubeQueue();

    const queue = queueData;
    const addingVideo = addVideoMutation.isPending;

    const addVideo = (url: string) => {
        if (!url.trim()) return;
        addVideoMutation.mutate(url.trim());
    };

    const removeVideo = (queueId: number) => {
        removeVideoMutation.mutate(queueId);
    };

    const playVideo = (_queueId: number) => {
        // Skip to this video
        playVideoMutation.mutate(_queueId);
    };

    const markAsPlayed = (queueId: number) => {
        markAsPlayedMutation.mutate(queueId);
    };

    const clearQueue = () => {
        setClearQueueConfirmOpen(true);
    };

    const confirmClearQueue = (): void => {
        clearQueueMutation.mutate();
        setClearQueueConfirmOpen(false);
    };

    const showMore = () => {
        setVisibleItems((prev) => Math.min(prev + ITEMS_PER_PAGE, queue.length));
    };

    const visibleQueue = queue.slice(0, visibleItems);
    const hasMore = visibleItems < queue.length;

    if (loading) {
        return (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="p-4 animate-pulse">
                    <div className="h-5 bg-zinc-800 rounded w-48 mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-4 h-6 bg-zinc-800 rounded"></div>
                                <div className="w-6 h-6 bg-zinc-800 rounded"></div>
                                <div className="w-24 h-14 bg-zinc-800 rounded"></div>
                                <div className="flex-1">
                                    <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2">
                    {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                    ) : (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                    )}
                    <span className="text-sm font-medium text-zinc-300">
                        Queue ({queue.length} videos{totalDuration > 0 ? ` - ${formatDuration(totalDuration)}` : ''})
                    </span>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-zinc-800 h-8 px-3 text-xs font-medium"
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        ADD MEDIA
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 h-8 px-3 text-xs font-medium"
                    >
                        <History className="w-4 h-4 mr-1" />
                        HISTORY
                    </Button>

                    {queue.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-zinc-800 h-8 px-3 text-xs font-medium"
                            onClick={clearQueue}
                        >
                            <Trash2 className="w-4 h-4 mr-1" />
                            REMOVE ALL
                        </Button>
                    )}
                </div>
            </div>

            {/* Add Form */}
            {showAddForm && !isCollapsed && (
                <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="flex gap-2">
                        <Input
                            type="url"
                            value={newVideoUrl}
                            onChange={(e) => setNewVideoUrl(e.target.value)}
                            placeholder="Вставьте YouTube URL..."
                            className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                            disabled={addingVideo}
                            onKeyDown={(e) => e.key === 'Enter' && addVideo(newVideoUrl)}
                        />
                        <Button
                            onClick={() => addVideo(newVideoUrl)}
                            disabled={!newVideoUrl.trim() || addingVideo}
                            className="bg-blue-700 hover:bg-blue-800 text-white"
                        >
                            {addingVideo ? 'Добавление...' : 'Добавить'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Queue List */}
            {!isCollapsed && (
                <>
                    <div className="divide-y divide-zinc-800/50">
                        {queue.length === 0 ? (
                            <div className="p-8 text-center">
                                <YouTubeIcon className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
                                {!showAddForm && (
                                    <Button
                                        onClick={() => setShowAddForm(true)}
                                        className="mt-4 bg-blue-700 hover:bg-blue-800 text-white"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Добавить видео
                                    </Button>
                                )}
                            </div>
                        ) : (
                            visibleQueue.map((video: YouTubeVideo, index: number) => (
                                <div
                                    key={video.id}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors group',
                                        index === 0 && 'bg-zinc-800/30'
                                    )}
                                >
                                    {/* Drag Handle */}
                                    <div className="flex-shrink-0 cursor-grab text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <GripVertical className="w-4 h-5" />
                                    </div>

                                    {/* Number */}
                                    <div className="flex-shrink-0 w-6 text-center text-sm text-zinc-500">
                                        {index + 1}.
                                    </div>

                                    {/* Thumbnail */}
                                    <div className="flex-shrink-0 w-24 h-14 bg-zinc-800 rounded overflow-hidden relative">
                                        {video.thumbnail_url || video.video_id ? (
                                            <img
                                                src={
                                                    video.thumbnail_url ||
                                                    `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`
                                                }
                                                alt={video.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                                <YouTubeIcon className="w-8 h-8 text-zinc-700" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Video Info */}
                                    <div className="flex-1 min-w-0">
                                        {/* Up next label for first item */}
                                        {index === 0 && (
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
                                                Up next
                                            </span>
                                        )}
                                        <h4
                                            className="text-sm text-zinc-200 truncate leading-tight"
                                            title={video.title}
                                        >
                                            {video.title}
                                        </h4>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {video.duration ? parseDurationString(video.duration) : ''}
                                        </p>
                                    </div>

                                    {/* YouTube Icon */}
                                    <div className="flex-shrink-0">
                                        <YouTubeIcon className="w-5 h-5 text-red-500" />
                                    </div>

                                    {/* Points badge if paid */}
                                    {video.is_paid && video.points_cost && (
                                        <div className="flex-shrink-0">
                                            <span className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-medium">
                                                {video.points_cost} pts
                                            </span>
                                        </div>
                                    )}

                                    {/* Actions Menu */}
                                    <div className="flex-shrink-0">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
                                                <DropdownMenuItem
                                                    onClick={() => playVideo(Number(video.id))}
                                                    className="text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                                                >
                                                    Воспроизвести сейчас
                                                </DropdownMenuItem>
                                                {index === 0 && (
                                                    <DropdownMenuItem
                                                        onClick={() => markAsPlayed(Number(video.id))}
                                                        className="text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                                                    >
                                                        Пропустить
                                                    </DropdownMenuItem>
                                                )}
                                                {video.url && (
                                                    <DropdownMenuItem asChild>
                                                        <a
                                                            href={video.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                                                        >
                                                            Открыть на YouTube
                                                        </a>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={() => removeVideo(Number(video.id))}
                                                    className="text-red-400 hover:bg-zinc-700 cursor-pointer"
                                                >
                                                    Удалить
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Show More Button */}
                    {hasMore && (
                        <div className="py-3 text-center border-t border-zinc-800">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={showMore}
                                className="text-zinc-400 hover:text-zinc-200 text-xs uppercase tracking-wider"
                            >
                                SHOW MORE
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
        <ConfirmDialog
            open={clearQueueConfirmOpen}
            onOpenChange={setClearQueueConfirmOpen}
            title="Очистить очередь"
            description="Все видео будут удалены из очереди."
            confirmLabel="Очистить"
            variant="destructive"
            loading={clearQueueMutation.isPending}
            onConfirm={confirmClearQueue}
        />
        </>
    );
};

export default YouTubeQueueCarousel;
