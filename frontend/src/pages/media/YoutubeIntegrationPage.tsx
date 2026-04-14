import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
    AlertCircle,
    Eye,
    EyeOff,
    Maximize,
    Minimize,
    Pause,
    Play,
    Plus,
    Settings,
    SkipForward,
    Trash2,
    Volume2,
    VolumeX,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { usePlayer } from '@/context/PlayerContext';
import { buildYoutubeRewardPayload, resolveYoutubeRewardState } from '@/features/youtube/utils/rewardSettings';
import { cn } from '@/lib/utils';
import { youtubeService } from '@/services/api/services/youtubeService';
import { pointsApi } from '@/services/pointsApi';
import PageWrapper from '@/shared/components/PageWrapper';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


import QueueList from './components/QueueList';

import type { YoutubeVideo } from '@/types/youtube';

const PLAYER_CONTROL_BUTTON_CLASS =
    'border-border/60 bg-background/60 text-muted-foreground hover:bg-background/60 hover:text-blue-400';
const PLAYER_DANGER_BUTTON_CLASS =
    'border-red-500/30 bg-background/60 text-red-400 hover:bg-background/60 hover:text-red-300';
const PLAYER_STATUS_BUTTON_CLASS =
    'h-10 px-3 gap-2 border-border/60 bg-background/60 disabled:opacity-60 hover:bg-background/60';

const YoutubeIntegrationPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const {
        currentVideo,
        isPlaying,
        volume,
        isMuted,
        isTheaterMode,
        queue,
        skipVotes,
        togglePlayPause,
        setVolume,
        toggleMute,
        nextVideo,
        setIsTheaterMode,
        loadQueue,
        setPlayerContainer,
        markPlaybackStarted
    } = usePlayer();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleCreateReward = async () => {
        if (!newRewardTitle) {
            toast.error('Введите название награды');
            return;
        }

        try {
            const platform = requestsRewardEditorPlatform;
            const channelName = platform === 'vk' ? integrations.vk?.username : integrations.twitch?.username;

            const payload = {
                title: newRewardTitle,
                description: 'Заказ YouTube видео',
                cost: newRewardCost,
                prompt: 'Отправьте ссылку на YouTube видео',
                is_user_input_required: true,
                background_color: '#FF0000',
                platform,
                channel_name: channelName || ''
            };

            const response = await pointsApi.createReward(platform, payload) as {
                reward?: { id?: string; name?: string; title?: string };
            };

            if (platform === 'twitch') {
                const rewardId = response?.reward?.id;
                if (rewardId) {
                    setRequestsRewardTwitchId(rewardId);
                    setRequestsRewardTwitchEnabled(true);
                    setIsCreatingReward(false);
                    toast.success('Награда создана и выбрана');
                } else {
                    toast.error('Не удалось получить ID награды');
                }
            } else {
                const rewardTitle = response?.reward?.name || response?.reward?.title || newRewardTitle;
                setRequestsRewardVkId(rewardTitle);
                setRequestsRewardVkEnabled(true);
                setIsCreatingReward(false);
                toast.success('Награда создана и выбрана');
            }
        } catch (error) {
            logger.error('Failed to create reward', error);
            toast.error('Ошибка создания награды');
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const activeQueueId = Number(active.id);
        const overQueueId = Number(over.id);
        if (!Number.isFinite(activeQueueId) || !Number.isFinite(overQueueId)) {
            logger.warn('Invalid queue ids for reorder', { activeId: active.id, overId: over.id });
            return;
        }

        try {
            await youtubeService.reorderQueue(activeQueueId, overQueueId);
            await loadQueue();
        } catch (error) {
            logger.error('Failed to reorder YouTube queue', error);
            toast.error('Не удалось сохранить порядок очереди');
        }
    };

    // Container ref for YouTube portal from GlobalPlayer
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const theaterPlayerContainerRef = useRef<HTMLDivElement>(null);

    const [isClearDialogOpen, setIsClearDialogOpen] = useState<boolean>(false);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState<boolean>(false);
    const [requestsCommandEnabled, setRequestsCommandEnabled] = useState<boolean>(true);
    const [requestsRewardEditorPlatform, setRequestsRewardEditorPlatform] = useState<'twitch' | 'vk'>('twitch');
    const [requestsRewardTwitchEnabled, setRequestsRewardTwitchEnabled] = useState<boolean>(false);
    const [requestsRewardVkEnabled, setRequestsRewardVkEnabled] = useState<boolean>(false);
    const [requestsRewardTwitchId, setRequestsRewardTwitchId] = useState<string>('');
    const [requestsRewardVkId, setRequestsRewardVkId] = useState<string>('');
    const [isCreatingReward, setIsCreatingReward] = useState(false);
    const [isOrdersSaving, setIsOrdersSaving] = useState(false);
    const [newRewardTitle, setNewRewardTitle] = useState('Заказ видео');
    const [newRewardCost, setNewRewardCost] = useState(1000);
    const { lastJsonMessage } = useChat();
    const hasVideo = Boolean(currentVideo || queue.length > 0);
    const ordersClosed = !requestsCommandEnabled && !requestsRewardTwitchEnabled && !requestsRewardVkEnabled;
    const lastOrdersStateRef = useRef<{ command: boolean; twitchReward: boolean; vkReward: boolean } | null>(null);
    const setVolumeRef = useRef(setVolume);

    const activeRewardEnabled = requestsRewardEditorPlatform === 'vk'
        ? requestsRewardVkEnabled
        : requestsRewardTwitchEnabled;
    const activeRewardId = requestsRewardEditorPlatform === 'vk'
        ? requestsRewardVkId
        : requestsRewardTwitchId;
    const setActiveRewardEnabled = useCallback((enabled: boolean) => {
        if (requestsRewardEditorPlatform === 'vk') {
            setRequestsRewardVkEnabled(enabled);
        } else {
            setRequestsRewardTwitchEnabled(enabled);
        }
    }, [requestsRewardEditorPlatform]);
    const setActiveRewardId = useCallback((value: string) => {
        if (requestsRewardEditorPlatform === 'vk') {
            setRequestsRewardVkId(value);
        } else {
            setRequestsRewardTwitchId(value);
        }
    }, [requestsRewardEditorPlatform]);

    useEffect(() => {
        setVolumeRef.current = setVolume;
    }, [setVolume]);

    const loadYoutubeSettings = useCallback(async (): Promise<void> => {
        try {
            let hasLocalVolume = false;
            if (typeof window !== 'undefined') {
                const storedVolume = window.localStorage.getItem('yt_volume');
                if (storedVolume !== null) {
                    const parsedVolume = Number(storedVolume);
                    if (!Number.isNaN(parsedVolume)) {
                        const clamped = Math.max(0, Math.min(100, Math.round(parsedVolume)));
                        setVolumeRef.current(clamped);
                        hasLocalVolume = true;
                    }
                }
            }
            const response = await youtubeService.getSettings();
            const volumeLevel = response.data.volume_level;
            if (!hasLocalVolume && typeof volumeLevel === 'number') {
                setVolumeRef.current(volumeLevel);
            }
            setRequestsCommandEnabled(response.data.requests_command_enabled ?? true);
            const rewardState = resolveYoutubeRewardState(response.data);
            setRequestsRewardTwitchEnabled(rewardState.requestsRewardTwitchEnabled);
            setRequestsRewardVkEnabled(rewardState.requestsRewardVkEnabled);
            setRequestsRewardTwitchId(rewardState.requestsRewardTwitchId);
            setRequestsRewardVkId(rewardState.requestsRewardVkId);
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    }, []);

    const handleSaveSettings = async (): Promise<void> => {
        try {
            await youtubeService.saveSettings({
                requests_command_enabled: requestsCommandEnabled,
                ...buildYoutubeRewardPayload({
                    requestsRewardTwitchEnabled,
                    requestsRewardVkEnabled,
                    requestsRewardTwitchId,
                    requestsRewardVkId,
                }),
            });
            toast.success('Настройки сохранены');
            setIsSettingsDialogOpen(false);
        } catch (error) {
            logger.error('Error saving YouTube settings:', error);
            toast.error('Ошибка сохранения настроек');
        }
    };

    const persistOrdersState = useCallback(async (
        nextCommand: boolean,
        nextTwitchReward: boolean,
        nextVkReward: boolean,
        successMessage: string
    ): Promise<void> => {
        const previous = {
            command: requestsCommandEnabled,
            twitchReward: requestsRewardTwitchEnabled,
            vkReward: requestsRewardVkEnabled
        };
        setRequestsCommandEnabled(nextCommand);
        setRequestsRewardTwitchEnabled(nextTwitchReward);
        setRequestsRewardVkEnabled(nextVkReward);
        setIsOrdersSaving(true);
        try {
            await youtubeService.saveSettings({
                requests_command_enabled: nextCommand,
                ...buildYoutubeRewardPayload({
                    requestsRewardTwitchEnabled: nextTwitchReward,
                    requestsRewardVkEnabled: nextVkReward,
                    requestsRewardTwitchId,
                    requestsRewardVkId,
                }),
            });
            toast.success(successMessage);
        } catch (error) {
            logger.error('Error saving YouTube settings:', error);
            setRequestsCommandEnabled(previous.command);
            setRequestsRewardTwitchEnabled(previous.twitchReward);
            setRequestsRewardVkEnabled(previous.vkReward);
            toast.error('Не удалось изменить приём заказов');
        } finally {
            setIsOrdersSaving(false);
        }
    }, [requestsCommandEnabled, requestsRewardTwitchEnabled, requestsRewardVkEnabled, requestsRewardTwitchId, requestsRewardVkId]);

    const handleToggleOrders = useCallback(async (): Promise<void> => {
        if (isOrdersSaving) return;
        if (ordersClosed) {
            const restore = lastOrdersStateRef.current ?? { command: true, twitchReward: false, vkReward: false };
            await persistOrdersState(restore.command, restore.twitchReward, restore.vkReward, 'Приём заказов открыт');
        } else {
            lastOrdersStateRef.current = {
                command: requestsCommandEnabled,
                twitchReward: requestsRewardTwitchEnabled,
                vkReward: requestsRewardVkEnabled
            };
            await persistOrdersState(false, false, false, 'Приём заказов закрыт');
        }
    }, [isOrdersSaving, ordersClosed, persistOrdersState, requestsCommandEnabled, requestsRewardTwitchEnabled, requestsRewardVkEnabled]);



    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        void loadYoutubeSettings();
    }, [isAuthenticated, loadYoutubeSettings]);

    useEffect(() => {
        if (requestsCommandEnabled || requestsRewardTwitchEnabled || requestsRewardVkEnabled) {
            lastOrdersStateRef.current = {
                command: requestsCommandEnabled,
                twitchReward: requestsRewardTwitchEnabled,
                vkReward: requestsRewardVkEnabled
            };
        }
    }, [requestsCommandEnabled, requestsRewardTwitchEnabled, requestsRewardVkEnabled]);

    // Set player container for GlobalPlayer portal - switches between normal and theater containers
    useEffect(() => {
        const container = isTheaterMode
            ? theaterPlayerContainerRef.current
            : playerContainerRef.current;
        if (container) {
            setPlayerContainer(container);
        } else {
            setPlayerContainer(null);
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
        const messageType = (lastJsonMessage as { type?: string } | null)?.type;
        if (messageType === 'youtube_queue_update' || messageType === 'youtube_queue_updated') {
            logger.log('[YouTube] Queue updated via WebSocket');
        }
    }, [lastJsonMessage]);

    const markUserStarted = useCallback((): void => {
        markPlaybackStarted();
    }, [markPlaybackStarted]);

    const handlePlayerSurfaceClick = useCallback((): void => {
        if (!hasVideo) {
            return;
        }
        markUserStarted();
    }, [hasVideo, markUserStarted]);

    const handleNextVideo = useCallback((): void => {
        markUserStarted();
        void nextVideo();
    }, [markUserStarted, nextVideo]);

    const handleQueuePlay = useCallback(async (video: YoutubeVideo): Promise<void> => {
        try {
            markUserStarted();
            await youtubeService.playQueueItem(video.id);
            loadQueue(true);
        } catch (error) {
            logger.error('Error switching to queue item:', error);
            toast.error('Не удалось переключить видео');
        }
    }, [loadQueue, markUserStarted]);

    const handleQueueRemove = useCallback(async (queueId: number): Promise<void> => {
        try {
            await youtubeService.removeFromQueue(queueId);
            toast.success('Удалено из очереди');
            loadQueue(true);
        } catch (error) {
            logger.error('Error removing queue item:', error);
            toast.error('Не удалось удалить из очереди');
        }
    }, [loadQueue]);

    const handleQueueBan = useCallback(async (video: YoutubeVideo): Promise<void> => {
        try {
            await youtubeService.banQueueItem(video.id);
            toast.success('Видео забанено');
            loadQueue(true);
        } catch (error) {
            logger.error('Error banning queue item:', error);
            toast.error('Не удалось забанить видео');
        }
    }, [loadQueue]);

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

    const handleVolumeSliderChange = (value: number[]): void => {
        const nextVolume = value[0];
        if (typeof nextVolume !== 'number' || Number.isNaN(nextVolume)) {
            return;
        }
        setVolume(nextVolume);
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (e.target === e.currentTarget && isTheaterMode) {
            setIsTheaterMode(false);
        }
    };

    const handleToggleTheater = useCallback((): void => {
        const newTheaterMode = !isTheaterMode;
        setIsTheaterMode(newTheaterMode);
        window.dispatchEvent(new CustomEvent('youtube_event', {
            detail: { event: 'theater_mode_changed', data: { isTheaterMode: newTheaterMode } }
        }));
    }, [isTheaterMode, setIsTheaterMode]);

    if (!isAuthenticated) {
        return (
            <PageWrapper title="YouTube Заказы">
                <Card className="card-glass border-border">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">
                                Требуется авторизация
                            </h3>
                            <p className="text-muted-foreground text-sm">
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
            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
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
                <DialogContent className="sm:max-w-[425px] bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-foreground">Способы заказа</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Настройте как зрители могут добавлять видео
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        {/* Command Section */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="space-y-1">
                                <Label htmlFor="cmd-enabled" className="text-base text-foreground">Команда</Label>
                                <p className="text-xs text-muted-foreground">Бесплатный заказ через чат (название задаётся в Команды)</p>
                            </div>
                            <Switch
                                id="cmd-enabled"
                                checked={requestsCommandEnabled}
                                onCheckedChange={setRequestsCommandEnabled}
                            />
                        </div>

                        {/* Reward Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                                <div className="space-y-1">
                                    <Label htmlFor="reward-enabled" className="text-base text-foreground">Баллы канала</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {requestsRewardEditorPlatform === 'vk'
                                            ? 'Заказ за награду VK Live'
                                            : 'Заказ за награду Twitch'}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Twitch: {requestsRewardTwitchEnabled ? 'on' : 'off'} · VK: {requestsRewardVkEnabled ? 'on' : 'off'}
                                    </p>
                                </div>
                                <Switch
                                    id="reward-enabled"
                                    checked={activeRewardEnabled}
                                    onCheckedChange={setActiveRewardEnabled}
                                    className={requestsRewardEditorPlatform === 'vk'
                                        ? 'data-[state=checked]:bg-[#FF4444]'
                                        : 'data-[state=checked]:bg-[#9146FF]'}
                                />
                            </div>

                            <div className="flex items-center gap-2 px-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={requestsRewardEditorPlatform === 'twitch' ? 'default' : 'outline'}
                                    onClick={() => setRequestsRewardEditorPlatform('twitch')}
                                    disabled={!integrations.twitch?.enabled}
                                    className={requestsRewardEditorPlatform === 'twitch'
                                        ? 'bg-[#9146FF] hover:bg-[#7d3cff] text-white'
                                        : 'border-border/60'}
                                >
                                    Twitch
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={requestsRewardEditorPlatform === 'vk' ? 'default' : 'outline'}
                                    onClick={() => setRequestsRewardEditorPlatform('vk')}
                                    disabled={!integrations.vk?.enabled}
                                    className={requestsRewardEditorPlatform === 'vk'
                                        ? 'bg-[#FF4444] hover:bg-[#e03a3a] text-white'
                                        : 'border-border/60'}
                                >
                                    VK Live
                                </Button>
                            </div>

                            {activeRewardEnabled && (
                                <div className="pl-1 pt-2 animate-in fade-in slide-in-from-top-2">
                                    {!isCreatingReward ? (
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        id="reward-id"
                                                        value={activeRewardId}
                                                        onChange={(e) => setActiveRewardId(e.target.value)}
                                                        placeholder={requestsRewardEditorPlatform === 'vk' ? 'Название награды...' : 'ID награды...'}
                                                        className="bg-muted border-border text-foreground font-mono text-xs h-9"
                                                    />
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => setIsCreatingReward(true)}
                                                    className="h-9 px-3"
                                                    title="Создать новую награду"
                                                >
                                                    <Plus className="h-4 w-4 mr-1.5" />
                                                    Создать
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                {requestsRewardEditorPlatform === 'vk'
                                                    ? 'Введите точное название награды VK Live или создайте новую'
                                                    : 'Вставьте ID существующей награды или создайте новую автоматически'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-muted/80 rounded-lg p-3 border border-emerald-500/30 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-medium text-emerald-300">Новая награда</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 w-5 p-0 text-muted-foreground hover:text-white"
                                                    onClick={() => setIsCreatingReward(false)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                <Input
                                                    value={newRewardTitle}
                                                    onChange={(e) => setNewRewardTitle(e.target.value)}
                                                    placeholder="Название"
                                                    className="h-8 bg-background/50 border-border text-xs"
                                                />
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        value={newRewardCost}
                                                        onChange={(e) => setNewRewardCost(Number(e.target.value))}
                                                        placeholder="Цена"
                                                        className="h-8 bg-background/50 border-border text-xs flex-1"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={handleCreateReward}
                                                        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-xs"
                                                    >
                                                        OK
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="border-t border-border pt-3">
                        <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)} className="border-border text-muted-foreground hover:text-white">Отмена</Button>
                        <Button onClick={handleSaveSettings}>Сохранить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {!isTheaterMode ? (
                <div className="flex flex-col gap-4 h-full">
                    <Card className="card-glass">
                        <CardContent className="p-4">
                            <div className="w-full flex flex-col xl:flex-row gap-4 items-start">
                                <div className="w-full xl:w-[clamp(260px,32vw,360px)] space-y-3">
                                    <div
                                        className="relative bg-black rounded-lg overflow-hidden aspect-video cursor-pointer"
                                        onPointerDown={markUserStarted}
                                        onClick={handlePlayerSurfaceClick}
                                    >
                                        {/* Container for YouTube portal from GlobalPlayer */}
                                        <div
                                            ref={playerContainerRef}
                                            data-player-container="inline"
                                            className="w-full h-full"
                                        />
                                        {!hasVideo && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                                <p className="text-muted-foreground text-xs">{'Нет видео для воспроизведения.'}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full xl:flex-1 space-y-3 xl:ml-0">
                                    <div className="card-glass w-full rounded-xl p-3 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={togglePlayPause}
                                                    disabled={!hasVideo}
                                                    size="icon"
                                                    title={isPlaying ? "Пауза" : "Плей"}
                                                    aria-label={isPlaying ? "Пауза" : "Плей"}
                                                    className="h-12 w-12"
                                                >
                                                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={handleNextVideo}
                                                    disabled={!hasVideo}
                                                    title="Следующее"
                                                    aria-label="Следующее"
                                                    className={cn('h-12 w-12', PLAYER_CONTROL_BUTTON_CLASS)}
                                                >
                                                    <SkipForward className="w-5 h-5" />
                                                </Button>
                                            </div>
                                            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={handleToggleOrders}
                                                    disabled={isOrdersSaving}
                                                    title={ordersClosed ? "Заказы off" : "Заказы on"}
                                                    aria-label={ordersClosed ? "Заказы off" : "Заказы on"}
                                                    className={cn(
                                                        PLAYER_STATUS_BUTTON_CLASS,
                                                        ordersClosed
                                                            ? 'text-red-300 border-red-500/40 hover:text-red-200'
                                                            : 'text-emerald-300 border-emerald-500/40 hover:text-emerald-200'
                                                    )}
                                                >
                                                    {ordersClosed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    <span className="text-xs font-medium">{ordersClosed ? 'Заказы off' : 'Заказы on'}</span>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setIsSettingsDialogOpen(true)}
                                                    title="Настройки заказа"
                                                    aria-label="Настройки заказа"
                                                    className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                                                    onClick={handleToggleTheater}
                                                    title={isTheaterMode ? "Выйти из режима театра" : "Театральный режим"}
                                                    aria-label={isTheaterMode ? "Выйти из режима театра" : "Театральный режим"}
                                                >
                                                    {isTheaterMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setIsClearDialogOpen(true)}
                                                    disabled={!hasVideo}
                                                    title="Очистить очередь"
                                                    aria-label="Очистить очередь"
                                                    className={cn('h-10 w-10', PLAYER_DANGER_BUTTON_CLASS)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={toggleMute}
                                                disabled={!hasVideo}
                                                title={isMuted ? "Включить звук" : "Выключить звук"}
                                                aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                                                className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                                            >
                                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                            </Button>
                                            <div className="flex-1 min-w-[clamp(140px,22vw,180px)] px-1">
                                                <Slider
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    value={[isMuted ? 0 : (volume ?? 100)]}
                                                    onValueChange={handleVolumeSliderChange}
                                                    disabled={!hasVideo}
                                                    aria-label="Громкость"
                                                    className="w-full"
                                                />
                                            </div>
                                            <span className="text-sm text-emerald-200 bg-emerald-500/10 px-2 py-1 rounded">
                                                {isMuted ? 0 : (volume ?? 100)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card >

                    <Card className="card-glass flex flex-col overflow-hidden max-h-[min(520px,65vh)]">
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
                                    skipVotes={skipVotes}
                                    onRemove={handleQueueRemove}
                                    onPlay={handleQueuePlay}
                                    onBan={handleQueueBan}
                                />
                            </DndContext>
                        </CardContent>
                    </Card>
                </div >
            ) : (
                <Card className="transition-all duration-300 w-full bg-black border-none h-full">
                    <CardContent className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] gap-3 h-full p-3">
                        <div className="flex flex-col h-full min-h-0 overflow-hidden">
                            <div
                                className="flex-1 min-h-0 bg-black rounded-lg overflow-hidden relative cursor-pointer"
                                onPointerDown={markUserStarted}
                                onClick={handlePlayerSurfaceClick}
                            >
                                {/* Container for YouTube portal from GlobalPlayer in theater mode */}
                                <div
                                    ref={theaterPlayerContainerRef}
                                    data-player-container="theater"
                                    className="w-full h-full absolute inset-0"
                                />
                                {!hasVideo && (
                                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                                        <p className="text-muted-foreground">{'Нет видео'}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="h-full min-h-0 min-w-0 flex flex-col overflow-hidden gap-3">
                            <div className="card-glass rounded-xl p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="default"
                                            size="icon"
                                            onClick={togglePlayPause}
                                            disabled={!hasVideo}
                                            title={isPlaying ? "Пауза" : "Плей"}
                                            aria-label={isPlaying ? "Пауза" : "Плей"}
                                            className="h-11 w-11"
                                        >
                                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleNextVideo}
                                            disabled={!hasVideo}
                                            title="Следующее"
                                            aria-label="Следующее"
                                            className={cn('h-11 w-11', PLAYER_CONTROL_BUTTON_CLASS)}
                                        >
                                            <SkipForward className="w-5 h-5" />
                                        </Button>
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={handleToggleOrders}
                                            disabled={isOrdersSaving}
                                            title={ordersClosed ? "Заказы off" : "Заказы on"}
                                            aria-label={ordersClosed ? "Заказы off" : "Заказы on"}
                                            className={cn(
                                                PLAYER_STATUS_BUTTON_CLASS,
                                                ordersClosed
                                                    ? 'text-red-300 border-red-500/40 hover:text-red-200'
                                                    : 'text-emerald-300 border-emerald-500/40 hover:text-emerald-200'
                                            )}
                                        >
                                            {ordersClosed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            <span className="text-xs font-medium">{ordersClosed ? 'Заказы off' : 'Заказы on'}</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setIsSettingsDialogOpen(true)}
                                            title="Настройки заказа"
                                            aria-label="Настройки заказа"
                                            className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                                        >
                                            <Settings className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setIsClearDialogOpen(true)}
                                            disabled={!hasVideo}
                                            title="Очистить очередь"
                                            aria-label="Очистить очередь"
                                            className={cn('h-10 w-10', PLAYER_DANGER_BUTTON_CLASS)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleToggleTheater}
                                            title="Выйти из режима театра"
                                            aria-label="Выйти из режима театра"
                                            className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                                        >
                                            <Minimize className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={toggleMute}
                                        disabled={!hasVideo}
                                        title={isMuted ? "Включить звук" : "Выключить звук"}
                                        aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                                        className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                                    >
                                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </Button>
                                    <div className="flex-1 min-w-[clamp(140px,22vw,180px)] px-1">
                                        <Slider
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={[isMuted ? 0 : (volume ?? 100)]}
                                            onValueChange={handleVolumeSliderChange}
                                            disabled={!hasVideo}
                                            aria-label="Громкость"
                                            className="w-full"
                                        />
                                    </div>
                                    <span className="text-sm text-emerald-200 bg-emerald-500/10 px-2 py-1 rounded">
                                        {isMuted ? 0 : (volume ?? 100)}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-hidden">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <QueueList
                                        queue={queue}
                                        currentVideo={currentVideo}
                                        skipVotes={skipVotes}
                                        compact={true}
                                        onRemove={handleQueueRemove}
                                        onPlay={handleQueuePlay}
                                        onBan={handleQueueBan}
                                    />
                                </DndContext>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div >
    );
};

export default YoutubeIntegrationPage;
