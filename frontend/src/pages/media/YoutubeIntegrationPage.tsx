import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
    AlertCircle,
    Copy,
    Eye,
    EyeOff,
    Maximize,
    Minimize,
    MonitorPlay,
    Pause,
    Play,
    Settings,
    SkipForward,
    Trash2,
    Volume2,
    VolumeX,
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
import { Card, CardContent } from '@/shared/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import QueueList from './components/QueueList';

import type { YoutubeVideo } from '@/types/youtube';

const PLAYER_CONTROL_BUTTON_CLASS =
    'border-border/60 bg-background/60 text-muted-foreground hover:bg-background/60 hover:text-blue-400';
const PLAYER_DANGER_BUTTON_CLASS =
    'border-red-500/30 bg-background/60 text-red-400 hover:bg-background/60 hover:text-red-300';
const PLAYER_STATUS_BUTTON_CLASS =
    'h-9 px-3 gap-2 border-border/60 bg-background/60 disabled:opacity-60 hover:bg-background/60';
const SETTINGS_CARD_CLASS = 'space-y-3 rounded-lg border border-border/60 bg-card/70 p-3';
const SETTINGS_SUBCARD_CLASS = 'rounded-md border border-border/50 bg-background/35 p-3';
const DEFAULT_VIDEO_REWARD_TITLE = 'Заказ видео';
const DEFAULT_VIDEO_REWARD_COST = 1000;

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
        markPlaybackStarted,
    } = usePlayer();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleUpsertReward = async (platform: 'twitch' | 'vk') => {
        try {
            const channelName = platform === 'vk' ? integrations.vk?.username : integrations.twitch?.username;
            const rewardId = platform === 'twitch' ? requestsRewardTwitchId : requestsRewardVkId;

            const payload = {
                title: DEFAULT_VIDEO_REWARD_TITLE,
                description: 'Заказ YouTube видео',
                cost: newRewardCost,
                prompt: 'Отправьте ссылку на YouTube видео',
                is_user_input_required: true,
                background_color: '#FF0000',
                platform,
                channel_name: channelName || '',
            };

            const response = (rewardId
                ? await pointsApi.updateReward(platform, rewardId, payload)
                : await pointsApi.createReward(platform, payload)) as {
                reward?: { id?: string; name?: string; title?: string };
            };

            if (platform === 'twitch') {
                const nextRewardId = response?.reward?.id || rewardId;
                if (nextRewardId) {
                    setRequestsRewardTwitchId(nextRewardId);
                    setRequestsRewardTwitchEnabled(true);
                    toast.success(rewardId ? 'Награда Twitch обновлена' : 'Награда Twitch создана');
                } else {
                    toast.error('Не удалось получить ID награды');
                }
            } else {
                const rewardTitle = response?.reward?.name || response?.reward?.title || rewardId || DEFAULT_VIDEO_REWARD_TITLE;
                setRequestsRewardVkId(rewardTitle);
                setRequestsRewardVkEnabled(true);
                toast.success(rewardId ? 'Награда VK обновлена' : 'Награда VK создана');
            }
        } catch (error) {
            logger.error('Failed to upsert reward', error);
            toast.error('Не удалось подготовить награду');
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
    const [requestsRewardTwitchEnabled, setRequestsRewardTwitchEnabled] = useState<boolean>(false);
    const [requestsRewardVkEnabled, setRequestsRewardVkEnabled] = useState<boolean>(false);
    const [requestsRewardTwitchId, setRequestsRewardTwitchId] = useState<string>('');
    const [requestsRewardVkId, setRequestsRewardVkId] = useState<string>('');
    const [donationalertsVideoEnabled, setDonationalertsVideoEnabled] = useState<boolean>(false);
    const [donationalertsVideoMinAmount, setDonationalertsVideoMinAmount] = useState<number>(0);
    const [obsOverlayMode, setObsOverlayMode] = useState<'video' | 'track'>('track');
    const [youtubeObsUrl, setYoutubeObsUrl] = useState('');
    const [isObsUrlLoading, setIsObsUrlLoading] = useState(false);
    const [isOrdersSaving, setIsOrdersSaving] = useState(false);
    const [newRewardCost, setNewRewardCost] = useState(DEFAULT_VIDEO_REWARD_COST);
    const { lastJsonMessage } = useChat();
    const hasVideo = Boolean(currentVideo || queue.length > 0);
    const ordersClosed = !requestsCommandEnabled && !requestsRewardTwitchEnabled && !requestsRewardVkEnabled;
    const activeSkipVotes =
        currentVideo &&
        skipVotes &&
        (skipVotes.video_id == null || skipVotes.video_id === currentVideo.id || skipVotes.video_id === currentVideo.video_id)
            ? skipVotes
            : null;
    const lastOrdersStateRef = useRef<{ command: boolean; twitchReward: boolean; vkReward: boolean } | null>(null);
    const setVolumeRef = useRef(setVolume);

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
            setObsOverlayMode(response.data.obs_overlay_mode || 'track');
            setRequestsCommandEnabled(response.data.requests_command_enabled ?? true);
            const rewardState = resolveYoutubeRewardState(response.data);
            setRequestsRewardTwitchEnabled(rewardState.requestsRewardTwitchEnabled);
            setRequestsRewardVkEnabled(rewardState.requestsRewardVkEnabled);
            setRequestsRewardTwitchId(rewardState.requestsRewardTwitchId);
            setRequestsRewardVkId(rewardState.requestsRewardVkId);
            setDonationalertsVideoEnabled(Boolean(response.data.donationalerts_video_enabled));
            setDonationalertsVideoMinAmount(Number(response.data.donationalerts_video_min_amount || 0));
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    }, []);

    const handleSaveSettings = async (): Promise<void> => {
        try {
            await youtubeService.saveSettings({
                obs_overlay_mode: obsOverlayMode,
                requests_command_enabled: requestsCommandEnabled,
                donationalerts_video_enabled: donationalertsVideoEnabled,
                donationalerts_video_min_amount: Math.max(0, Number(donationalertsVideoMinAmount) || 0),
                donationalerts_video_priority_next: true,
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

    const handleObsLinkButton = useCallback(async (): Promise<void> => {
        try {
            setIsObsUrlLoading(true);
            let ensuredUrl = youtubeObsUrl;
            if (!ensuredUrl) {
                const response = await youtubeService.generateObsUrl();
                ensuredUrl = response.data.youtube_obs_url || '';
                setYoutubeObsUrl(ensuredUrl);
            }
            if (!ensuredUrl) {
                toast.error('Не удалось получить OBS ссылку');
                return;
            }
            await navigator.clipboard.writeText(ensuredUrl);
            toast.success('OBS ссылка скопирована');
        } catch (error) {
            logger.error('Error preparing OBS URL:', error);
            toast.error('Не удалось подготовить OBS ссылку');
        } finally {
            setIsObsUrlLoading(false);
        }
    }, [youtubeObsUrl]);

    const persistOrdersState = useCallback(
        async (
            nextCommand: boolean,
            nextTwitchReward: boolean,
            nextVkReward: boolean,
            successMessage: string
        ): Promise<void> => {
            const previous = {
                command: requestsCommandEnabled,
                twitchReward: requestsRewardTwitchEnabled,
                vkReward: requestsRewardVkEnabled,
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
        },
        [
            requestsCommandEnabled,
            requestsRewardTwitchEnabled,
            requestsRewardVkEnabled,
            requestsRewardTwitchId,
            requestsRewardVkId,
        ]
    );

    const handleToggleOrders = useCallback(async (): Promise<void> => {
        if (isOrdersSaving) return;
        if (ordersClosed) {
            const restore = lastOrdersStateRef.current ?? { command: true, twitchReward: false, vkReward: false };
            await persistOrdersState(restore.command, restore.twitchReward, restore.vkReward, 'Приём заказов открыт');
        } else {
            lastOrdersStateRef.current = {
                command: requestsCommandEnabled,
                twitchReward: requestsRewardTwitchEnabled,
                vkReward: requestsRewardVkEnabled,
            };
            await persistOrdersState(false, false, false, 'Приём заказов закрыт');
        }
    }, [
        isOrdersSaving,
        ordersClosed,
        persistOrdersState,
        requestsCommandEnabled,
        requestsRewardTwitchEnabled,
        requestsRewardVkEnabled,
    ]);

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
                vkReward: requestsRewardVkEnabled,
            };
        }
    }, [requestsCommandEnabled, requestsRewardTwitchEnabled, requestsRewardVkEnabled]);

    // Set player container for GlobalPlayer portal - switches between normal and theater containers
    useEffect(() => {
        const container = isTheaterMode ? theaterPlayerContainerRef.current : playerContainerRef.current;
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
        if (messageType === 'youtube_queue_updated') {
            logger.log('[YouTube] Queue updated via WebSocket');
        }
    }, [lastJsonMessage]);

    const markUserStarted = useCallback((): void => {
        markPlaybackStarted();
    }, [markPlaybackStarted]);

    const handleNextVideo = useCallback((): void => {
        markUserStarted();
        void nextVideo();
    }, [markUserStarted, nextVideo]);

    const handleQueuePlay = useCallback(
        async (video: YoutubeVideo): Promise<void> => {
            try {
                markUserStarted();
                await youtubeService.playQueueItem(video.id);
                loadQueue(true);
            } catch (error) {
                logger.error('Error switching to queue item:', error);
                toast.error('Не удалось переключить видео');
            }
        },
        [loadQueue, markUserStarted]
    );

    const handleQueueRemove = useCallback(
        async (queueId: number): Promise<void> => {
            try {
                await youtubeService.removeFromQueue(queueId);
                toast.success('Удалено из очереди');
                loadQueue(true);
            } catch (error) {
                logger.error('Error removing queue item:', error);
                toast.error('Не удалось удалить из очереди');
            }
        },
        [loadQueue]
    );

    const handleQueueBan = useCallback(
        async (video: YoutubeVideo): Promise<void> => {
            try {
                await youtubeService.banQueueItem(video.id);
                toast.success('Видео забанено');
                loadQueue(true);
            } catch (error) {
                logger.error('Error banning queue item:', error);
                toast.error('Не удалось забанить видео');
            }
        },
        [loadQueue]
    );

    const handleClearQueue = async (): Promise<void> => {
        try {
            await youtubeService.clearQueue();
            toast.success('Очередь очищена.');
            setIsClearDialogOpen(false);
            loadQueue(true);
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number }; code?: string; message?: string };
            if (axiosError.response?.status === 429) {
                toast.error('Слишком много запросов. Пожалуйста, подождите немного.');
            } else if (axiosError.code === 'ERR_NETWORK' || axiosError.message?.includes('CORS')) {
                toast.error('Ошибка сети. Проверьте подключение к серверу.');
            } else {
                toast.error('Не удалось очистить очередь.');
            }
            logger.error('Error clearing queue:', error);
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
        window.dispatchEvent(
            new CustomEvent('youtube_event', {
                detail: { event: 'theater_mode_changed', data: { isTheaterMode: newTheaterMode } },
            })
        );
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
                            <h3 className="text-xl font-semibold text-foreground">Требуется авторизация</h3>
                            <p className="text-muted-foreground text-sm">
                                Для использования YouTube заказов необходимо войти в систему и привязать хотя бы одну
                                платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button onClick={() => navigate('/login')} className="gap-2">
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
            className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 bg-black z-50 p-2' : 'h-full min-h-0 overflow-hidden'}`}
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
                        <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button variant="destructive" onClick={handleClearQueue}>
                            Очистить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogContent className="max-w-[min(880px,calc(100vw-2rem))] bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-foreground">Заказы видео</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        <div className={SETTINGS_CARD_CLASS}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-foreground">Источники заказов</div>
                                    <div className="text-xs text-muted-foreground">Команда и площадки, из которых принимаются заявки.</div>
                                </div>
                                <Switch id="cmd-enabled" checked={requestsCommandEnabled} onCheckedChange={setRequestsCommandEnabled} />
                            </div>
                            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3">
                                <div className={SETTINGS_SUBCARD_CLASS}>
                                    <div className="mb-2 flex items-center justify-between">
                                        <Label htmlFor="cmd-enabled" className="text-sm font-bold text-foreground">
                                            Команда
                                        </Label>
                                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">!sr</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Разрешить добавление видео через чат-команду.</p>
                                </div>

                                <div className={SETTINGS_SUBCARD_CLASS}>
                                    <div className="mb-2 flex items-center justify-between">
                                        <Label className="text-sm font-bold text-foreground">Twitch</Label>
                                        <Switch checked={requestsRewardTwitchEnabled} onCheckedChange={setRequestsRewardTwitchEnabled} disabled={!integrations.twitch?.enabled} />
                                    </div>
                                    <details className="group">
                                        <summary className="cursor-pointer list-none text-xs font-semibold text-sky-300 group-open:mb-2">
                                            Ручная привязка награды
                                        </summary>
                                        <Input value={requestsRewardTwitchId} onChange={(event) => setRequestsRewardTwitchId(event.target.value)} placeholder="Reward ID" className="h-8 font-mono text-xs" />
                                    </details>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="mt-3 h-8 w-full"
                                        disabled={!integrations.twitch?.enabled}
                                        onClick={() => void handleUpsertReward('twitch')}
                                    >
                                        {requestsRewardTwitchId ? 'Обновить и привязать' : 'Создать и привязать'}
                                    </Button>
                                </div>

                                <div className={SETTINGS_SUBCARD_CLASS}>
                                    <div className="mb-2 flex items-center justify-between">
                                        <Label className="text-sm font-bold text-foreground">VK Live</Label>
                                        <Switch checked={requestsRewardVkEnabled} onCheckedChange={setRequestsRewardVkEnabled} disabled={!integrations.vk?.enabled} />
                                    </div>
                                    <details className="group">
                                        <summary className="cursor-pointer list-none text-xs font-semibold text-sky-300 group-open:mb-2">
                                            Ручная привязка награды
                                        </summary>
                                        <Input value={requestsRewardVkId} onChange={(event) => setRequestsRewardVkId(event.target.value)} placeholder="Название награды" className="h-8 text-xs" />
                                    </details>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="mt-3 h-8 w-full"
                                        disabled={!integrations.vk?.enabled}
                                        onClick={() => void handleUpsertReward('vk')}
                                    >
                                        {requestsRewardVkId ? 'Обновить и привязать' : 'Создать и привязать'}
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-2 rounded-md border border-border/50 bg-background/35 p-3 grid-cols-[180px_minmax(0,1fr)]">
                                <Label htmlFor="reward-cost" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Цена награды
                                </Label>
                                <Input
                                    id="reward-cost"
                                    type="number"
                                    min={0}
                                    value={newRewardCost}
                                    onChange={(event) => setNewRewardCost(Number(event.target.value) || 0)}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className={SETTINGS_CARD_CLASS}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-foreground">Paid video</div>
                                    <div className="text-xs text-muted-foreground">Подхват YouTube-ссылки из DonationAlerts с тарифом за минуту видео.</div>
                                </div>
                                <Switch checked={donationalertsVideoEnabled} onCheckedChange={setDonationalertsVideoEnabled} />
                            </div>
                            <div className="grid gap-2 rounded-md border border-border/50 bg-background/35 p-3 grid-cols-[180px_minmax(0,1fr)]">
                                <Label htmlFor="paid-rate" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Тариф, руб/мин
                                </Label>
                                <Input
                                    id="paid-rate"
                                    type="number"
                                    min={0}
                                    value={donationalertsVideoMinAmount}
                                    onChange={(event) => setDonationalertsVideoMinAmount(Number(event.target.value) || 0)}
                                    placeholder="Например 50"
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className={SETTINGS_CARD_CLASS}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-foreground">OBS overlay</div>
                                    <div className="text-xs text-muted-foreground">Режим виджета и ссылка для OBS.</div>
                                </div>
                                <MonitorPlay className="mt-0.5 h-4 w-4 text-sky-300" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" size="sm" variant={obsOverlayMode === 'track' ? 'default' : 'outline'} onClick={() => setObsOverlayMode('track')}>
                                    Трек
                                </Button>
                                <Button type="button" size="sm" variant={obsOverlayMode === 'video' ? 'default' : 'outline'} onClick={() => setObsOverlayMode('video')}>
                                    Видео
                                </Button>
                            </div>
                            <div className="flex justify-end">
                                <Button type="button" size="sm" onClick={() => void handleObsLinkButton()} disabled={isObsUrlLoading} className="min-w-[132px]">
                                    <Copy className="mr-2 h-4 w-4" />
                                    OBS ссылка
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-border pt-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsSettingsDialogOpen(false)}
                            className="border-border text-muted-foreground hover:text-white"
                        >
                            Отмена
                        </Button>
                        <Button onClick={handleSaveSettings}>Сохранить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {!isTheaterMode ? (
                <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
                    <Card className="card-glass">
                        <CardContent className="p-3">
                            <div className="grid w-full grid-cols-[minmax(220px,320px)_minmax(0,1fr)] items-start gap-3">
                                <div className="w-full space-y-3">
                                    <div
                                        className="relative aspect-video overflow-hidden rounded-lg bg-black"
                                        onPointerDown={markUserStarted}
                                    >
                                        {/* Container for YouTube portal from GlobalPlayer */}
                                        <div
                                            ref={playerContainerRef}
                                            data-player-container="inline"
                                            className="w-full h-full"
                                        />
                                        {!hasVideo && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-muted/70">
                                                <MonitorPlay className="h-10 w-10 text-muted-foreground/35" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0 space-y-3">
                                    <div className="card-glass w-full rounded-xl p-3 space-y-2.5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={togglePlayPause}
                                                    disabled={!hasVideo}
                                                    size="icon"
                                                    title={isPlaying ? 'Пауза' : 'Плей'}
                                                    aria-label={isPlaying ? 'Пауза' : 'Плей'}
                                                    className="h-10 w-10"
                                                >
                                                    {isPlaying ? (
                                                        <Pause className="w-5 h-5" />
                                                    ) : (
                                                        <Play className="w-5 h-5" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={handleNextVideo}
                                                    disabled={!hasVideo}
                                                    title="Следующее"
                                                    aria-label="Следующее"
                                                    className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                                                >
                                                    <SkipForward className="w-5 h-5" />
                                                </Button>
                                                {activeSkipVotes ? (
                                                    <div className="rounded-md border border-border/60 bg-background/45 px-3 py-1 text-xs font-medium text-muted-foreground">
                                                        Голоса за пропуск: {activeSkipVotes.current}/{activeSkipVotes.required}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={handleToggleOrders}
                                                    disabled={isOrdersSaving}
                                                    title={ordersClosed ? 'Заказы off' : 'Заказы on'}
                                                    aria-label={ordersClosed ? 'Заказы off' : 'Заказы on'}
                                                    className={cn(
                                                        PLAYER_STATUS_BUTTON_CLASS,
                                                        ordersClosed
                                                            ? 'text-red-300 border-red-500/40 hover:text-red-200'
                                                            : 'text-emerald-300 border-emerald-500/40 hover:text-emerald-200'
                                                    )}
                                                >
                                                    {ordersClosed ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                    <span className="text-xs font-medium">
                                                        {ordersClosed ? 'Заказы off' : 'Заказы on'}
                                                    </span>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setIsSettingsDialogOpen(true)}
                                                    title="Настройки заказа"
                                                    aria-label="Настройки заказа"
                                                    className={cn('h-9 w-9', PLAYER_CONTROL_BUTTON_CLASS)}
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className={cn('h-9 w-9', PLAYER_CONTROL_BUTTON_CLASS)}
                                                    onClick={handleToggleTheater}
                                                    title={
                                                        isTheaterMode ? 'Выйти из режима театра' : 'Театральный режим'
                                                    }
                                                    aria-label={
                                                        isTheaterMode ? 'Выйти из режима театра' : 'Театральный режим'
                                                    }
                                                >
                                                    {isTheaterMode ? (
                                                        <Minimize className="h-4 w-4" />
                                                    ) : (
                                                        <Maximize className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setIsClearDialogOpen(true)}
                                                    disabled={!hasVideo}
                                                    title="Очистить очередь"
                                                    aria-label="Очистить очередь"
                                                    className={cn('h-9 w-9', PLAYER_DANGER_BUTTON_CLASS)}
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
                                                title={isMuted ? 'Включить звук' : 'Выключить звук'}
                                                aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                                                className={cn('h-9 w-9', PLAYER_CONTROL_BUTTON_CLASS)}
                                            >
                                                {isMuted ? (
                                                    <VolumeX className="w-4 h-4" />
                                                ) : (
                                                    <Volume2 className="w-4 h-4" />
                                                )}
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
                    </Card>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <QueueList
                                queue={queue}
                                currentVideo={currentVideo}
                                skipVotes={skipVotes}
                                onRemove={handleQueueRemove}
                                onPlay={handleQueuePlay}
                                onBan={handleQueueBan}
                            />
                        </DndContext>
                    </div>
                </div>
            ) : (
                <Card className="transition-all duration-300 w-full bg-black border-none h-full">
                    <CardContent className="grid h-full grid-cols-[minmax(0,1fr)_minmax(240px,360px)] gap-3 p-3">
                        <div className="flex flex-col h-full min-h-0 overflow-hidden">
                            <div
                                className="relative flex-1 min-h-0 overflow-hidden rounded-lg bg-black"
                                onPointerDown={markUserStarted}
                            >
                                {/* Container for YouTube portal from GlobalPlayer in theater mode */}
                                <div
                                    ref={theaterPlayerContainerRef}
                                    data-player-container="theater"
                                    className="w-full h-full absolute inset-0"
                                />
                                {!hasVideo && (
                                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                                        <MonitorPlay className="h-14 w-14 text-muted-foreground/35" />
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
                                            title={isPlaying ? 'Пауза' : 'Плей'}
                                            aria-label={isPlaying ? 'Пауза' : 'Плей'}
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
                                        {activeSkipVotes ? (
                                            <div className="rounded-md border border-border/60 bg-background/45 px-3 py-1 text-xs font-medium text-muted-foreground">
                                                Голоса за пропуск: {activeSkipVotes.current}/{activeSkipVotes.required}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={handleToggleOrders}
                                            disabled={isOrdersSaving}
                                            title={ordersClosed ? 'Заказы off' : 'Заказы on'}
                                            aria-label={ordersClosed ? 'Заказы off' : 'Заказы on'}
                                            className={cn(
                                                PLAYER_STATUS_BUTTON_CLASS,
                                                ordersClosed
                                                    ? 'text-red-300 border-red-500/40 hover:text-red-200'
                                                    : 'text-emerald-300 border-emerald-500/40 hover:text-emerald-200'
                                            )}
                                        >
                                            {ordersClosed ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                            <span className="text-xs font-medium">
                                                {ordersClosed ? 'Заказы off' : 'Заказы on'}
                                            </span>
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
                                        title={isMuted ? 'Включить звук' : 'Выключить звук'}
                                        aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
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
        </div>
    );
};

export default YoutubeIntegrationPage;
