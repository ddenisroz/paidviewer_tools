import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AlertCircle, Maximize, Minimize, Monitor, Pause, Play, RefreshCw, Settings, SkipForward, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { BUTTON_SIZES } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { usePlayer } from '@/context/PlayerContext';
import { youtubeService } from '@/services/api/services/youtubeService';
import PageWrapper from '@/shared/components/PageWrapper';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


import type { YoutubeVideo } from '@/types/youtube';
import QueueList from './components/QueueList';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

type PlaybackMode = 'browser' | 'obs';

const YoutubeIntegrationPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const {
        currentVideo,
        isPlaying,
        volume,
        isMuted,
        isTheaterMode,
        queue,
        togglePlayPause,
        setVolume,
        toggleMute,
        nextVideo,
        setIsTheaterMode,
        loadQueue,
        setPlayerContainer
    } = usePlayer();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            // Note: In a real implementation you would call an API to reorder
            // For now we just optimistically update the UI if we had a setQueue method, 
            // but since queue comes from context/API, we might need to implement reorder API first
            // or just let it snap back for now as a visual demo until API is ready.
            console.log('Reorder requested:', active.id, '->', over.id);
            toast.info('Изменение порядка пока не сохраняется на сервере');
        }
    };

    // Container ref for YouTube portal from GlobalPlayer
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const theaterPlayerContainerRef = useRef<HTMLDivElement>(null);

    const [isClearDialogOpen, setIsClearDialogOpen] = useState<boolean>(false);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState<boolean>(false);
    const [requestsCommandEnabled, setRequestsCommandEnabled] = useState<boolean>(true);
    const [requestsRewardEnabled, setRequestsRewardEnabled] = useState<boolean>(false);
    const [requestsRewardId, setRequestsRewardId] = useState<string>('');
    const { lastJsonMessage } = useChat();
    const currentThumbnail = currentVideo?.thumbnail || currentVideo?.thumbnail_url;

    const loadYoutubeSettings = useCallback(async (): Promise<void> => {
        try {
            const response = await youtubeService.getSettings();
            setVolume(response.data.volume_level || 100);
            setRequestsCommandEnabled(response.data.requests_command_enabled ?? true);
            setRequestsRewardEnabled(response.data.requests_reward_enabled ?? false);
            setRequestsRewardId(response.data.requests_reward_id || '');
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    }, [setVolume]);

    const handleSaveSettings = async (): Promise<void> => {
        try {
            await youtubeService.saveSettings({
                requests_command_enabled: requestsCommandEnabled,
                requests_reward_enabled: requestsRewardEnabled,
                requests_reward_id: requestsRewardId
            });
            toast.success('Настройки сохранены');
            setIsSettingsDialogOpen(false);
        } catch (error) {
            logger.error('Error saving YouTube settings:', error);
            toast.error('Ошибка сохранения настроек');
        }
    };



    useEffect(() => {
        loadYoutubeSettings();
    }, []); // [OK] Пустой массив зависимостей - запускаем только один раз при монтировании

    // Set player container for GlobalPlayer portal - switches between normal and theater containers
    useEffect(() => {
        const container = isTheaterMode
            ? theaterPlayerContainerRef.current
            : playerContainerRef.current;
        if (container) {
            setPlayerContainer(container);
        }
        return () => {
            setPlayerContainer(null);
        };
    }, [setPlayerContainer, isTheaterMode]);

    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape' && isTheaterMode) {
                setIsTheaterMode(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [isTheaterMode, setIsTheaterMode]);

    useEffect(() => {
        if (lastJsonMessage && (lastJsonMessage as { type?: string }).type === 'youtube_queue_update') {
            logger.log('[YouTube] Queue updated via WebSocket');
        }
    }, [lastJsonMessage]);

    const handleClearQueue = async (): Promise<void> => {
        try {
            await youtubeService.clearQueue();
            toast.success("Очередь очищена.");
            setIsClearDialogOpen(false);
            loadQueue(true);
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number }; code?: string; message?: string };
            if (axiosError.response?.status === 429) {
                toast.error("Слишком много запросов. Пожалуйста, подождите немного.");
            } else if (axiosError.code === 'ERR_NETWORK' || axiosError.message?.includes('CORS')) {
                toast.error("Ошибка сети. Проверьте подключение к серверу.");
            } else {
                toast.error("Не удалось очистить очередь.");
            }
            logger.error("Error clearing queue:", error);
        }
    };

    const handleVolumeChange = (value: number[]): void => {
        const newVolume = value[0];
        setVolume(newVolume);
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (e.target === e.currentTarget && isTheaterMode) {
            setIsTheaterMode(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <PageWrapper title="YouTube Заказы">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Требуется авторизация
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для использования YouTube заказов необходимо войти в систему и привязать хотя бы одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Войти в систему
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <div
            className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 bg-black z-50 p-2' : 'h-[calc(100vh-8rem)]'}`}
            onClick={handleBackdropClick}
            style={isTheaterMode ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 } : {}}
        >
            {!isTheaterMode ? (
                <div className="flex flex-col gap-4 h-full">
                    <Card className="card-glass">
                        <CardContent className="p-6">
                            <div className="flex gap-4">
                                <div className="w-[360px] flex-shrink-0">
                                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                                        {currentVideo ? (
                                            // Container for YouTube portal from GlobalPlayer
                                            <div
                                                ref={playerContainerRef}
                                                className="w-full h-full"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                                <p className="text-muted-foreground text-xs">Нет видео для воспроизведения.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 space-y-3">
                                    <div className="bg-muted/30 rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground text-center">
                                            Управление плеером доступно через встроенные элементы YouTube или мини-плеер.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="h-12 w-full" title="Очистить очередь">
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Очистить
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Подтверждение</DialogTitle>
                                                    <DialogDescription>Вы уверены, что хотите очистить очередь заказов?</DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>Отмена</Button>
                                                    <Button variant="destructive" onClick={handleClearQueue}>Очистить</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="h-12 w-full" title="Настройки заказа">
                                                    <Settings className="h-4 w-4 mr-2" />
                                                    Настройки
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Настройки заказов YouTube</DialogTitle>
                                                    <DialogDescription>Настройте способы добавления видео в очередь</DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="flex items-center justify-between space-x-2">
                                                        <Label htmlFor="cmd-enabled" className="flex-1">Заказ через команду (!sr)</Label>
                                                        <Switch
                                                            id="cmd-enabled"
                                                            checked={requestsCommandEnabled}
                                                            onCheckedChange={setRequestsCommandEnabled}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between space-x-2">
                                                        <Label htmlFor="reward-enabled" className="flex-1">Заказ через награду (Channel Points)</Label>
                                                        <Switch
                                                            id="reward-enabled"
                                                            checked={requestsRewardEnabled}
                                                            onCheckedChange={setRequestsRewardEnabled}
                                                        />
                                                    </div>
                                                    {requestsRewardEnabled && (
                                                        <div className="space-y-2">
                                                            <Label htmlFor="reward-id">ID Награды Twitch</Label>
                                                            <Input
                                                                id="reward-id"
                                                                value={requestsRewardId}
                                                                onChange={(e) => setRequestsRewardId(e.target.value)}
                                                                placeholder="Введите ID награды..."
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Создайте награду на Twitch и скопируйте её ID (или просто название, если бот поддерживает поиск по названию).
                                                                Рекомендуется использовать ID.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>Отмена</Button>
                                                    <Button onClick={handleSaveSettings}>Сохранить</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>



                                        <Button
                                            variant="outline"
                                            className="h-12 w-full col-span-2"
                                            onClick={() => {
                                                const newTheaterMode = !isTheaterMode;
                                                setIsTheaterMode(newTheaterMode);
                                                window.dispatchEvent(new CustomEvent('youtube_event', {
                                                    detail: { event: 'theater_mode_changed', data: { isTheaterMode: newTheaterMode } }
                                                }));
                                            }}
                                            title="Театральный режим"
                                        >
                                            {isTheaterMode ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                                            {isTheaterMode ? 'Выйти из режима театра' : 'Театральный режим'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-glass flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3">
                            <CardTitle>Очередь ({queue.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <QueueList
                                    queue={queue}
                                    currentVideo={currentVideo}
                                    onRemove={(id) => {
                                        // TODO: Implement remove by ID specific logic if needed, 
                                        // currently API removes by index or ID?
                                        // youtubeService.removeFromQueue(id);
                                        // For now reusing the concept but we need queue_id vs video_id clarification
                                        // Assuming 'id' in queue items is the unique queue entry id
                                        youtubeService.removeFromQueue(id).then(() => {
                                            toast.success('Удалено из очереди');
                                            loadQueue();
                                        });
                                    }}
                                    onPlay={(video) => {
                                        // Optional: Play specific video
                                    }}
                                />
                            </DndContext>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card className="transition-all duration-300 w-full bg-black border-none h-full">
                    <CardContent className="grid grid-cols-5 gap-6 h-full p-6">
                        <div className="col-span-4 space-y-4">
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsTheaterMode(false);
                                        window.dispatchEvent(new CustomEvent('youtube_event', {
                                            detail: { event: 'theater_mode_changed', data: { isTheaterMode: false } }
                                        }));
                                    }}
                                >
                                    <Minimize className="h-4 w-4 mr-2" />
                                    Выйти из режима театра
                                </Button>
                            </div>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                {currentVideo ? (
                                    // Container for YouTube portal from GlobalPlayer in theater mode
                                    <div
                                        ref={theaterPlayerContainerRef}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                                        <p className="text-muted-foreground">Нет видео</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 h-full flex flex-col overflow-hidden">
                            <h3 className="font-semibold text-lg">Очередь</h3>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                {queue.map((video: YoutubeVideo, index: number) => (
                                    <div key={video.id} className="flex gap-2 p-2 rounded bg-muted/20 text-sm">
                                        <div className="flex-shrink-0 w-5 h-5 bg-muted rounded-full flex items-center justify-center text-[10px] font-medium">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{video.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{video.requester_name}</p>
                                        </div>
                                    </div>
                                ))}
                                {queue.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">Очередь пуста</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div >
    );
};

export default YoutubeIntegrationPage;
