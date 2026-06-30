import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { commandsService } from '@/services/api/services/commandsService';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import QueueList from './components/QueueList';

import type { PlatformReward } from '@/types/points';
import type { YoutubeVideo } from '@/types/youtube';

const PLAYER_CONTROL_BUTTON_CLASS =
    'border-border/60 bg-background/60 text-muted-foreground hover:bg-background/60 hover:text-blue-400';
const PLAYER_DANGER_BUTTON_CLASS =
    'border-red-500/30 bg-background/60 text-red-400 hover:bg-background/60 hover:text-red-300';
const PLAYER_STATUS_BUTTON_CLASS =
    'h-9 px-3 gap-2 border-border/60 bg-background/60 disabled:opacity-60 hover:bg-background/60';
const SETTINGS_CARD_CLASS = 'space-y-3 rounded-xl border border-border/70 bg-card/85 p-3.5';
const SETTINGS_SUBCARD_CLASS = 'rounded-lg border border-border/60 bg-background/35 p-2.5';
const DEFAULT_VIDEO_REWARD_TITLE = 'Заказ видео';
const DEFAULT_VIDEO_REWARD_COST = 1000;
const DEFAULT_SKIP_VOTES_REQUIRED = 5;
const MULTILINE_THREE_STYLE: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
};

const PlayingEqualizer: React.FC = () => (
    <span className="inline-flex h-4 w-4 shrink-0 items-end justify-center gap-[2px]" title="Сейчас играет">
        {[0, 1, 2].map((index) => (
            <span
                key={index}
                className="block w-[3px] origin-bottom rounded-full bg-emerald-300"
                style={{
                    height: `${7 + index * 3}px`,
                    animation: `youtubeEq 720ms ease-in-out ${index * 110}ms infinite alternate`,
                }}
            />
        ))}
    </span>
);

interface RewardCapability {
    can_create: boolean;
    platform: 'twitch' | 'vk';
    reason?: string | null;
}

interface RewardsResponse {
    rewards?: PlatformReward[];
    capability?: RewardCapability;
}

interface YoutubeSettingsDraft {
    obs_overlay_mode: 'video' | 'track';
    requests_command_enabled: boolean;
    request_command_name: string;
    paid_orders_enabled: boolean;
    paid_order_mode: 'rub_per_minute' | 'full_video';
    paid_order_rate_rub_per_minute: number;
    paid_order_min_amount_rub: number;
    paid_order_priority_by_amount: boolean;
    donationalerts_video_enabled: boolean;
    donationalerts_video_min_amount: number;
    donationalerts_video_priority_next: boolean;
    requests_reward_twitch_enabled?: boolean;
    requests_reward_vk_enabled?: boolean;
    requests_reward_enabled?: boolean;
    requests_reward_id?: string | null;
    requests_reward_platform?: 'twitch' | 'vk';
    requests_reward_twitch_id?: string | null;
    requests_reward_vk_id?: string | null;
    requests_reward_twitch_title?: string | null;
    requests_reward_vk_title?: string | null;
}

interface QueuedYoutubeAutosave {
    snapshot: string;
    payload: YoutubeSettingsDraft;
}

const serializeYoutubeSettingsDraft = (payload: YoutubeSettingsDraft): string => JSON.stringify(payload);

const disabledRewardCapability = (platform: 'twitch' | 'vk', reason: string): RewardCapability => ({
    can_create: false,
    platform,
    reason,
});

const enabledRewardCapability = (platform: 'twitch' | 'vk'): RewardCapability => ({
    can_create: true,
    platform,
    reason: null,
});

const normalizeRewardCapabilityReason = (
    platform: 'twitch' | 'vk',
    error: { message?: string; status?: number }
): string => {
    const message = error.message?.trim();
    if (message) {
        return message;
    }

    if (error.status === 404) {
        return platform === 'vk'
            ? 'Подключите VK Live, чтобы привязать награду.'
            : 'Подключите Twitch, чтобы привязать награду.';
    }

    if (platform === 'twitch' && error.status === 403) {
        return 'Twitch разрешает создавать награды только каналам со статусом Affiliate или Partner.';
    }

    if (platform === 'vk' && error.status === 403) {
        return 'У токена VK Live не хватает прав для управления наградами.';
    }

    return 'Не удалось получить список наград платформы.';
};

const getRewardLabel = (reward: PlatformReward): string =>
    String(reward.title || reward.name || reward.id || 'Награда').trim();

const getRewardValue = (platform: 'twitch' | 'vk', reward: PlatformReward): string =>
    platform === 'vk' ? getRewardLabel(reward) : String(reward.id ?? '').trim();
const parseDurationToSeconds = (value?: string | null): number => {
    const parts = String(value || '')
        .split(':')
        .map((part) => Number(part.trim()))
        .filter((part) => Number.isFinite(part));
    if (parts.length === 0) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
};

const formatSeconds = (seconds: number): string => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const rest = safeSeconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

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
                title: newRewardTitle.trim() || DEFAULT_VIDEO_REWARD_TITLE,
                description: 'Заказ YouTube видео',
                cost: newRewardCost,
                prompt: 'Отправьте ссылку на YouTube видео',
                is_user_input_required: true,
                background_color: '#FF0000',
                platform,
                channel_name: channelName || '',
            };

            const response = (
                rewardId
                    ? await pointsApi.updateReward(platform, rewardId, payload)
                    : await pointsApi.createReward(platform, payload)
            ) as {
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
                const rewardTitle =
                    response?.reward?.name || response?.reward?.title || rewardId || newRewardTitle.trim() || DEFAULT_VIDEO_REWARD_TITLE;
                setRequestsRewardVkId(rewardTitle);
                setRequestsRewardVkEnabled(true);
                toast.success(rewardId ? 'Награда VK обновлена' : 'Награда VK создана');
            }
            await loadPlatformRewards(platform);
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
    const [requestCommandName, setRequestCommandName] = useState<string>('!sr');
    const [requestsRewardTwitchEnabled, setRequestsRewardTwitchEnabled] = useState<boolean>(false);
    const [requestsRewardVkEnabled, setRequestsRewardVkEnabled] = useState<boolean>(false);
    const [requestsRewardTwitchId, setRequestsRewardTwitchId] = useState<string>('');
    const [requestsRewardVkId, setRequestsRewardVkId] = useState<string>('');
    const [donationalertsVideoEnabled, setDonationalertsVideoEnabled] = useState<boolean>(false);
    const [donationalertsVideoMinAmount, setDonationalertsVideoMinAmount] = useState<number>(0);
    const [paidOrderMode, setPaidOrderMode] = useState<'rub_per_minute' | 'full_video'>('rub_per_minute');
    const [paidOrderMinAmountRub, setPaidOrderMinAmountRub] = useState<number>(0);
    const [paidOrderPriorityByAmount, setPaidOrderPriorityByAmount] = useState<boolean>(true);
    const [obsOverlayMode, setObsOverlayMode] = useState<'video' | 'track'>('track');
    const [youtubeObsUrl, setYoutubeObsUrl] = useState('');
    const [isObsUrlLoading, setIsObsUrlLoading] = useState(false);
    const [isOrdersSaving, setIsOrdersSaving] = useState(false);
    const [newRewardCost, setNewRewardCost] = useState(DEFAULT_VIDEO_REWARD_COST);
    const [newRewardTitle, setNewRewardTitle] = useState(DEFAULT_VIDEO_REWARD_TITLE);
    const [skipVotesRequired, setSkipVotesRequired] = useState(DEFAULT_SKIP_VOTES_REQUIRED);
    const [isSkipVotesSaving, setIsSkipVotesSaving] = useState(false);
    const [twitchRewards, setTwitchRewards] = useState<PlatformReward[]>([]);
    const [vkRewards, setVkRewards] = useState<PlatformReward[]>([]);
    const [isRewardsLoading, setIsRewardsLoading] = useState(false);
    const [twitchRewardCapability, setTwitchRewardCapability] = useState<RewardCapability>(
        disabledRewardCapability('twitch', 'Подключите Twitch, чтобы привязать награду')
    );
    const [vkRewardCapability, setVkRewardCapability] = useState<RewardCapability>(
        disabledRewardCapability('vk', 'Подключите VK Live, чтобы привязать награду')
    );
    const settingsAutosaveTimeoutRef = useRef<number | null>(null);
    const lastSavedSettingsRef = useRef('');
    const autosaveInFlightRef = useRef(false);
    const queuedAutosaveRef = useRef<QueuedYoutubeAutosave | null>(null);
    const { lastJsonMessage } = useChat();
    const hasVideo = Boolean(currentVideo || queue.length > 0);
    const ordersClosed = !requestsCommandEnabled && !requestsRewardTwitchEnabled && !requestsRewardVkEnabled;
    const activeVideo = currentVideo || queue[0] || null;
    const activeVideoTitle = activeVideo?.title || 'Видео появится после первого заказа';
    const activeVideoRequester = activeVideo?.requester_name || activeVideo?.added_by || 'Не указан';
    const activeVideoSource = activeVideo?.channel_name || 'YouTube';
    const activeVideoDuration = activeVideo?.duration || '--:--';
    const activeVideoThumbnail = activeVideo?.thumbnail || activeVideo?.thumbnail_url || '';
    const activeVideoIsPaid = Boolean(activeVideo?.is_paid || activeVideo?.paid_source);
    const totalQueueDuration = useMemo(() => {
        const uniqueItems = currentVideo
            ? [currentVideo, ...queue.filter((item) => item.id !== currentVideo.id && item.video_id !== currentVideo.video_id)]
            : queue;
        return formatSeconds(uniqueItems.reduce((sum, item) => sum + parseDurationToSeconds(item.duration), 0));
    }, [currentVideo, queue]);
    const donationAlertsConnected = Boolean(integrations.donationalerts?.enabled);
    const activeSkipVotes =
        currentVideo &&
        skipVotes &&
        (skipVotes.video_id == null ||
            skipVotes.video_id === currentVideo.id ||
            skipVotes.video_id === currentVideo.video_id)
            ? skipVotes
            : null;
    const lastOrdersStateRef = useRef<{ command: boolean; twitchReward: boolean; vkReward: boolean } | null>(null);
    const setVolumeRef = useRef(setVolume);

    useEffect(() => {
        setVolumeRef.current = setVolume;
    }, [setVolume]);

    const buildYoutubeSettingsPayload = useCallback(
        (): YoutubeSettingsDraft => ({
            obs_overlay_mode: obsOverlayMode,
            requests_command_enabled: requestsCommandEnabled,
            request_command_name: requestCommandName.trim() || '!sr',
            paid_orders_enabled: donationAlertsConnected && donationalertsVideoEnabled,
            paid_order_mode: paidOrderMode,
            paid_order_rate_rub_per_minute: Math.max(0, Number(donationalertsVideoMinAmount) || 0),
            paid_order_min_amount_rub: Math.max(0, Number(paidOrderMinAmountRub) || 0),
            paid_order_priority_by_amount: paidOrderPriorityByAmount,
            donationalerts_video_enabled: donationAlertsConnected && donationalertsVideoEnabled,
            donationalerts_video_min_amount: Math.max(0, Number(donationalertsVideoMinAmount) || 0),
            donationalerts_video_priority_next: paidOrderPriorityByAmount,
            ...buildYoutubeRewardPayload({
                requestsRewardTwitchEnabled,
                requestsRewardVkEnabled,
                requestsRewardTwitchId,
                requestsRewardVkId,
            }),
        }),
        [
            obsOverlayMode,
            requestsCommandEnabled,
            requestCommandName,
            donationalertsVideoEnabled,
            paidOrderMode,
            donationalertsVideoMinAmount,
            paidOrderMinAmountRub,
            paidOrderPriorityByAmount,
            requestsRewardTwitchEnabled,
            requestsRewardVkEnabled,
            requestsRewardTwitchId,
            requestsRewardVkId,
            donationAlertsConnected,
        ]
    );

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
            setRequestCommandName(response.data.request_command_name || '!sr');
            const rewardState = resolveYoutubeRewardState(response.data);
            setRequestsRewardTwitchEnabled(rewardState.requestsRewardTwitchEnabled);
            setRequestsRewardVkEnabled(rewardState.requestsRewardVkEnabled);
            setRequestsRewardTwitchId(rewardState.requestsRewardTwitchId);
            setRequestsRewardVkId(rewardState.requestsRewardVkId);
            setDonationalertsVideoEnabled(
                Boolean(response.data.paid_orders_enabled ?? response.data.donationalerts_video_enabled)
            );
            setPaidOrderMode(response.data.paid_order_mode || 'rub_per_minute');
            setDonationalertsVideoMinAmount(
                Number(
                    response.data.paid_order_rate_rub_per_minute ?? response.data.donationalerts_video_min_amount ?? 0
                )
            );
            setPaidOrderMinAmountRub(
                Number(response.data.paid_order_min_amount_rub ?? response.data.donationalerts_video_min_amount ?? 0)
            );
            setPaidOrderPriorityByAmount(
                Boolean(
                    response.data.paid_order_priority_by_amount ??
                    response.data.donationalerts_video_priority_next ??
                    true
                )
            );
            lastSavedSettingsRef.current = serializeYoutubeSettingsDraft({
                obs_overlay_mode: response.data.obs_overlay_mode || 'track',
                requests_command_enabled: response.data.requests_command_enabled ?? true,
                request_command_name: response.data.request_command_name || '!sr',
                paid_orders_enabled: Boolean(
                    response.data.paid_orders_enabled ?? response.data.donationalerts_video_enabled
                ),
                paid_order_mode: response.data.paid_order_mode || 'rub_per_minute',
                paid_order_rate_rub_per_minute: Math.max(
                    0,
                    Number(
                        response.data.paid_order_rate_rub_per_minute ??
                            response.data.donationalerts_video_min_amount ??
                            0
                    )
                ),
                paid_order_min_amount_rub: Math.max(
                    0,
                    Number(
                        response.data.paid_order_min_amount_rub ?? response.data.donationalerts_video_min_amount ?? 0
                    )
                ),
                paid_order_priority_by_amount: Boolean(
                    response.data.paid_order_priority_by_amount ??
                    response.data.donationalerts_video_priority_next ??
                    true
                ),
                donationalerts_video_enabled: Boolean(
                    response.data.paid_orders_enabled ?? response.data.donationalerts_video_enabled
                ),
                donationalerts_video_min_amount: Math.max(
                    0,
                    Number(
                        response.data.paid_order_rate_rub_per_minute ??
                            response.data.donationalerts_video_min_amount ??
                            0
                    )
                ),
                donationalerts_video_priority_next: Boolean(
                    response.data.paid_order_priority_by_amount ??
                    response.data.donationalerts_video_priority_next ??
                    true
                ),
                ...buildYoutubeRewardPayload({
                    requestsRewardTwitchEnabled: rewardState.requestsRewardTwitchEnabled,
                    requestsRewardVkEnabled: rewardState.requestsRewardVkEnabled,
                    requestsRewardTwitchId: rewardState.requestsRewardTwitchId,
                    requestsRewardVkId: rewardState.requestsRewardVkId,
                }),
            });
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    }, []);

    const loadPlatformRewards = useCallback(
        async (platform: 'twitch' | 'vk'): Promise<void> => {
            const isConnected =
                platform === 'twitch' ? Boolean(integrations.twitch?.enabled) : Boolean(integrations.vk?.enabled);
            const setRewards = platform === 'twitch' ? setTwitchRewards : setVkRewards;
            const setCapability = platform === 'twitch' ? setTwitchRewardCapability : setVkRewardCapability;

            if (!isConnected) {
                setRewards([]);
                setCapability(
                    disabledRewardCapability(
                        platform,
                        platform === 'twitch'
                            ? 'Подключите Twitch, чтобы привязать награду'
                            : 'Подключите VK Live, чтобы привязать награду'
                    )
                );
                return;
            }

            try {
                const response = (await pointsApi.getRewards(platform)) as RewardsResponse;
                setRewards(Array.isArray(response.rewards) ? response.rewards : []);
                setCapability(response.capability ?? enabledRewardCapability(platform));
            } catch (error) {
                logger.error(`Failed to load ${platform} rewards`, error);
                setRewards([]);
                const apiError = error as { message?: string; status?: number };
                setCapability(disabledRewardCapability(platform, normalizeRewardCapabilityReason(platform, apiError)));
            }
        },
        [integrations.twitch?.enabled, integrations.vk?.enabled]
    );

    const loadRewardsForSettings = useCallback(async (): Promise<void> => {
        setIsRewardsLoading(true);
        try {
            await Promise.all([loadPlatformRewards('twitch'), loadPlatformRewards('vk')]);
        } finally {
            setIsRewardsLoading(false);
        }
    }, [loadPlatformRewards]);

    const handleSaveSettings = useCallback(
        async (showToast = false, payloadOverride?: YoutubeSettingsDraft): Promise<void> => {
            try {
                const payload = payloadOverride ?? buildYoutubeSettingsPayload();
                await youtubeService.saveSettings(payload);
                lastSavedSettingsRef.current = serializeYoutubeSettingsDraft(payload);
                if (showToast) {
                    toast.success('Настройки сохранены');
                }
            } catch (error) {
                logger.error('Error saving YouTube settings:', error);
                if (showToast) {
                    toast.error('Не удалось сохранить настройки');
                }
            }
        },
        [buildYoutubeSettingsPayload]
    );

    const flushQueuedAutosave = useCallback(async (): Promise<void> => {
        if (autosaveInFlightRef.current) {
            return;
        }

        const queuedEntry = queuedAutosaveRef.current as QueuedYoutubeAutosave | null;
        if (!queuedEntry || queuedEntry.snapshot === lastSavedSettingsRef.current) {
            queuedAutosaveRef.current = null;
            return;
        }

        queuedAutosaveRef.current = null;
        autosaveInFlightRef.current = true;

        try {
            await handleSaveSettings(false, queuedEntry.payload);
        } finally {
            autosaveInFlightRef.current = false;
            const nextQueuedEntry = queuedAutosaveRef.current as QueuedYoutubeAutosave | null;
            if (nextQueuedEntry && nextQueuedEntry.snapshot !== lastSavedSettingsRef.current) {
                void flushQueuedAutosave();
            }
        }
    }, [handleSaveSettings]);

    const loadYoutubeObsUrl = useCallback(async (): Promise<void> => {
        try {
            setIsObsUrlLoading(true);
            const response = await youtubeService.getObsUrl();
            setYoutubeObsUrl(response.data.youtube_obs_url || '');
        } catch (error) {
            logger.error('Error loading OBS URL:', error);
        } finally {
            setIsObsUrlLoading(false);
        }
    }, []);

    const handleObsLinkButton = useCallback(async (): Promise<void> => {
        if (!youtubeObsUrl) {
            toast.error('Не удалось получить OBS ссылку');
            return;
        }
        try {
            await navigator.clipboard.writeText(youtubeObsUrl);
            toast.success('OBS ссылка скопирована');
        } catch (error) {
            logger.error('Error copying OBS URL:', error);
            toast.error('Не удалось скопировать OBS ссылку');
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
            donationAlertsConnected,
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

    const loadSkipVotesRequired = useCallback(async (): Promise<void> => {
        try {
            const response = await commandsService.getCommands();
            const payload = response.data as {
                data?: {
                    basic_commands?: Array<{ command_name?: string; extra_settings?: Record<string, unknown> }>;
                    custom_commands?: Array<{ command_name?: string; extra_settings?: Record<string, unknown> }>;
                };
                basic_commands?: Array<{ command_name?: string; extra_settings?: Record<string, unknown> }>;
                custom_commands?: Array<{ command_name?: string; extra_settings?: Record<string, unknown> }>;
            };
            const commands = [
                ...(payload.basic_commands || payload.data?.basic_commands || []),
                ...(payload.custom_commands || payload.data?.custom_commands || []),
            ];
            const skipCommand = commands.find((command) => command.command_name === 'skip');
            const rawValue = Number(skipCommand?.extra_settings?.skip_votes_required ?? DEFAULT_SKIP_VOTES_REQUIRED);
            setSkipVotesRequired(
                Math.max(1, Math.min(99, Number.isFinite(rawValue) ? Math.round(rawValue) : DEFAULT_SKIP_VOTES_REQUIRED))
            );
        } catch (error) {
            logger.error('Failed to load skip command settings', error);
        }
    }, []);

    const handleSaveSkipVotesRequired = useCallback(async (): Promise<void> => {
        const nextValue = Math.max(1, Math.min(99, Math.round(Number(skipVotesRequired) || DEFAULT_SKIP_VOTES_REQUIRED)));
        setSkipVotesRequired(nextValue);
        setIsSkipVotesSaving(true);
        try {
            await commandsService.createOverride({
                command_name: 'skip',
                is_enabled: true,
                extra_settings: { skip_votes_required: nextValue },
            });
            toast.success('Голоса за пропуск сохранены');
            void loadQueue(true);
        } catch (error) {
            logger.error('Failed to save skip votes required', error);
            toast.error('Не удалось сохранить голоса за пропуск');
        } finally {
            setIsSkipVotesSaving(false);
        }
    }, [loadQueue, skipVotesRequired]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        void loadYoutubeSettings();
        void loadSkipVotesRequired();
    }, [isAuthenticated, loadSkipVotesRequired, loadYoutubeSettings]);

    useEffect(() => {
        if (!isSettingsDialogOpen) {
            return;
        }
        void loadRewardsForSettings();
    }, [isSettingsDialogOpen, loadRewardsForSettings]);

    useEffect(() => {
        if (!isSettingsDialogOpen) return;
        const nextPayload = buildYoutubeSettingsPayload();
        const nextSnapshot = serializeYoutubeSettingsDraft(nextPayload);
        if (nextSnapshot === lastSavedSettingsRef.current) return;
        if (settingsAutosaveTimeoutRef.current !== null) {
            window.clearTimeout(settingsAutosaveTimeoutRef.current);
        }
        settingsAutosaveTimeoutRef.current = window.setTimeout(() => {
            queuedAutosaveRef.current = { snapshot: nextSnapshot, payload: nextPayload };
            void flushQueuedAutosave();
            settingsAutosaveTimeoutRef.current = null;
        }, 700);

        return () => {
            if (settingsAutosaveTimeoutRef.current !== null) {
                window.clearTimeout(settingsAutosaveTimeoutRef.current);
                settingsAutosaveTimeoutRef.current = null;
            }
        };
    }, [buildYoutubeSettingsPayload, flushQueuedAutosave, isSettingsDialogOpen]);

    useEffect(() => {
        if (requestsCommandEnabled || requestsRewardTwitchEnabled || requestsRewardVkEnabled) {
            lastOrdersStateRef.current = {
                command: requestsCommandEnabled,
                twitchReward: requestsRewardTwitchEnabled,
                vkReward: requestsRewardVkEnabled,
            };
        }
    }, [requestsCommandEnabled, requestsRewardTwitchEnabled, requestsRewardVkEnabled]);

    // Set player container for GlobalPlayer portal - switches between normal and theater containers.
    React.useLayoutEffect(() => {
        const resolveContainer = () => (isTheaterMode ? theaterPlayerContainerRef.current : playerContainerRef.current);
        setPlayerContainer(resolveContainer());

        let rafId: number | null = null;
        let secondRafId: number | null = null;
        rafId = window.requestAnimationFrame(() => {
            setPlayerContainer(resolveContainer());
            secondRafId = window.requestAnimationFrame(() => setPlayerContainer(resolveContainer()));
        });

        return () => {
            if (rafId !== null) window.cancelAnimationFrame(rafId);
            if (secondRafId !== null) window.cancelAnimationFrame(secondRafId);
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
        if (!isTheaterMode) {
            return;
        }

        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPaddingRight = document.body.style.paddingRight;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.paddingRight = previousBodyPaddingRight;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [isTheaterMode]);

    useEffect(() => {
        const messageType = (lastJsonMessage as { type?: string } | null)?.type;
        if (messageType === 'youtube_queue_updated') {
            logger.log('[YouTube] Queue updated via WebSocket');
        }
    }, [lastJsonMessage]);

    useEffect(() => {
        if (!isSettingsDialogOpen || youtubeObsUrl || isObsUrlLoading) {
            return;
        }

        let cancelled = false;

        void loadYoutubeObsUrl().catch((error) => {
            if (!cancelled) {
                logger.error('Error loading OBS URL:', error);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [isObsUrlLoading, isSettingsDialogOpen, loadYoutubeObsUrl, youtubeObsUrl]);

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

    const renderPlayerControls = (theater = false): React.ReactElement => {
        const shownSkipVotesCurrent = activeSkipVotes?.current ?? 0;
        const shownSkipVotesRequired = activeSkipVotes?.required ?? skipVotesRequired;
        const volumeValue = isMuted ? 0 : (volume ?? 100);

        return (
            <div
                className={cn(
                    theater
                        ? 'rounded-xl border border-border/70 bg-card/92 p-3 shadow-sm shadow-black/20'
                        : 'card-glass w-full rounded-xl p-3'
                )}
            >
                <div className={cn('flex flex-wrap items-start justify-between gap-3', theater && 'gap-2')}>
                    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', theater && 'grid flex-1 grid-cols-2')}>
                        <Button
                            onClick={handleNextVideo}
                            disabled={!hasVideo}
                            title="Скип"
                            aria-label="Скип"
                            className={cn('h-11 min-w-[136px] gap-2 px-5', theater && 'min-w-0')}
                        >
                            <SkipForward className="h-5 w-5" />
                            <span className="text-sm font-semibold">Скип</span>
                        </Button>
                        <Button
                            variant={ordersClosed ? 'destructive' : 'default'}
                            onClick={handleToggleOrders}
                            disabled={isOrdersSaving}
                            title={ordersClosed ? 'Заказы off' : 'Заказы on'}
                            aria-label={ordersClosed ? 'Заказы off' : 'Заказы on'}
                            className={cn(
                                'h-11 min-w-[136px] gap-2 px-5',
                                !ordersClosed && 'bg-emerald-600 text-white hover:bg-emerald-500',
                                theater && 'min-w-0'
                            )}
                        >
                            {ordersClosed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            <span className="text-sm font-semibold">{ordersClosed ? 'Заказы off' : 'Заказы on'}</span>
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsSettingsDialogOpen(true)}
                            title="Настройки заказа"
                            aria-label="Настройки заказа"
                            className={cn('h-11 gap-2 px-4', PLAYER_CONTROL_BUTTON_CLASS, theater && 'col-span-2')}
                        >
                            <Settings className="w-4 h-4" />
                            <span className="text-sm font-semibold">Настройки</span>
                        </Button>
                    </div>

                    <div className="flex shrink-0 items-start justify-end gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleToggleTheater}
                            title={theater ? 'Выйти из режима театра' : 'Театральный режим'}
                            aria-label={theater ? 'Выйти из режима театра' : 'Театральный режим'}
                            className={cn('h-10 w-10', PLAYER_CONTROL_BUTTON_CLASS)}
                        >
                            {theater ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
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

                <div className="mt-3 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                    <Label htmlFor={theater ? 'skip-votes-theater' : 'skip-votes'} className="text-xs text-muted-foreground">
                        Голоса за пропуск: {shownSkipVotesCurrent}/{shownSkipVotesRequired}
                    </Label>
                    <Input
                        id={theater ? 'skip-votes-theater' : 'skip-votes'}
                        type="number"
                        min={1}
                        max={99}
                        value={skipVotesRequired}
                        onChange={(event) => setSkipVotesRequired(Number(event.target.value) || 1)}
                        className="h-8 w-20 text-xs"
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSaveSkipVotesRequired()}
                        disabled={isSkipVotesSaving}
                        className="h-8 px-3 text-xs"
                    >
                        Сохранить
                    </Button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleMute}
                        disabled={!hasVideo}
                        title={isMuted ? 'Включить звук' : 'Выключить звук'}
                        aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                        className={cn('h-9 w-9 shrink-0 rounded-sm', PLAYER_CONTROL_BUTTON_CLASS)}
                    >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[volumeValue]}
                        onValueChange={handleVolumeSliderChange}
                        disabled={!hasVideo}
                        aria-label="Громкость"
                        className="min-w-[150px] flex-1"
                        trackClassName="h-4 rounded-none border border-sky-300/30 bg-[repeating-linear-gradient(90deg,rgba(56,189,248,0.24)_0_10px,rgba(2,8,23,0.65)_10px_12px)]"
                        rangeClassName="rounded-none bg-[repeating-linear-gradient(90deg,#22d3ee_0_10px,#14b8a6_10px_12px)]"
                        thumbClassName="h-6 w-4 rounded-[2px] border-2 border-cyan-100 bg-emerald-300 shadow-[0_0_0_2px_rgba(20,184,166,0.28)]"
                    />
                    <span className="min-w-[52px] rounded-sm border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-center font-mono text-sm text-emerald-200">
                        {volumeValue}%
                    </span>
                </div>
            </div>
        );
    };

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
            className={`transition-all duration-300 ${isTheaterMode ? 'fixed inset-0 z-[9999] overflow-hidden bg-[#020207] p-4' : 'h-full min-h-0 overflow-hidden'}`}
            onClick={handleBackdropClick}
            style={isTheaterMode ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 } : {}}
        >
            <style>
                {`
                    @keyframes youtubeEq {
                        from { transform: scaleY(0.45); opacity: 0.62; }
                        to { transform: scaleY(1); opacity: 1; }
                    }
                `}
            </style>
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
                <DialogContent className="max-w-[min(820px,calc(100vw-2rem))] gap-2 border-border bg-background">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-foreground">Заказы видео</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-3 py-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                        <div className={`${SETTINGS_CARD_CLASS} md:col-span-2`}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-foreground">Источники заказов</div>
                                <div className="grid gap-2 sm:grid-cols-[minmax(180px,260px)_96px] sm:items-end">
                                    <div className="space-y-1">
                                        <Label htmlFor="reward-title" className="text-xs text-muted-foreground">
                                            Название награды
                                        </Label>
                                        <Input
                                            id="reward-title"
                                            value={newRewardTitle}
                                            onChange={(event) => setNewRewardTitle(event.target.value)}
                                            placeholder={DEFAULT_VIDEO_REWARD_TITLE}
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="reward-cost" className="text-xs text-muted-foreground">
                                            Баллы
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
                            </div>

                            <div className="grid gap-3 md:grid-cols-[minmax(0,0.72fr)_repeat(2,minmax(0,1fr))]">
                                <div className={SETTINGS_SUBCARD_CLASS}>
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <Label htmlFor="cmd-enabled" className="text-sm font-semibold text-foreground">
                                            Команда
                                        </Label>
                                        <Switch
                                            id="cmd-enabled"
                                            checked={requestsCommandEnabled}
                                            onCheckedChange={setRequestsCommandEnabled}
                                        />
                                    </div>
                                    <Input
                                        value={requestCommandName}
                                        onChange={(event) => setRequestCommandName(event.target.value)}
                                        placeholder="!sr"
                                        className="h-9 font-mono text-sm"
                                    />
                                </div>

                                <div className={SETTINGS_SUBCARD_CLASS}>
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <Label className="text-sm font-semibold text-foreground">Twitch</Label>
                                        <Switch
                                            checked={requestsRewardTwitchEnabled}
                                            onCheckedChange={setRequestsRewardTwitchEnabled}
                                            disabled={!integrations.twitch?.enabled}
                                        />
                                    </div>
                                    <Select
                                        value={requestsRewardTwitchId || '__none__'}
                                        onValueChange={(value) => {
                                            const nextValue = value === '__none__' ? '' : value;
                                            setRequestsRewardTwitchId(nextValue);
                                            if (nextValue) {
                                                setRequestsRewardTwitchEnabled(true);
                                            }
                                        }}
                                        disabled={!integrations.twitch?.enabled || isRewardsLoading}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue
                                                placeholder={isRewardsLoading ? 'Загрузка...' : 'Выбрать награду'}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Не выбрано</SelectItem>
                                            {twitchRewards.map((reward) => {
                                                const rewardValue = getRewardValue('twitch', reward);
                                                return (
                                                    <SelectItem key={`twitch-${rewardValue}`} value={rewardValue}>
                                                        {getRewardLabel(reward)}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 flex-1 text-xs"
                                            disabled={
                                                !integrations.twitch?.enabled || !twitchRewardCapability.can_create
                                            }
                                            title={twitchRewardCapability.reason || 'Создать новую награду Twitch'}
                                            onClick={() => void handleUpsertReward('twitch')}
                                        >
                                            Создать новую
                                        </Button>
                                    </div>
                                </div>

                                <div className={SETTINGS_SUBCARD_CLASS}>
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <Label className="text-sm font-semibold text-foreground">VK Live</Label>
                                        <Switch
                                            checked={requestsRewardVkEnabled}
                                            onCheckedChange={setRequestsRewardVkEnabled}
                                            disabled={!integrations.vk?.enabled}
                                        />
                                    </div>
                                    <Select
                                        value={requestsRewardVkId || '__none__'}
                                        onValueChange={(value) => {
                                            const nextValue = value === '__none__' ? '' : value;
                                            setRequestsRewardVkId(nextValue);
                                            if (nextValue) {
                                                setRequestsRewardVkEnabled(true);
                                            }
                                        }}
                                        disabled={!integrations.vk?.enabled || isRewardsLoading}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue
                                                placeholder={isRewardsLoading ? 'Загрузка...' : 'Выбрать награду'}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Не выбрано</SelectItem>
                                            {vkRewards.map((reward) => {
                                                const rewardValue = getRewardValue('vk', reward);
                                                return (
                                                    <SelectItem key={`vk-${rewardValue}`} value={rewardValue}>
                                                        {getRewardLabel(reward)}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 flex-1 text-xs"
                                            disabled={!integrations.vk?.enabled || !vkRewardCapability.can_create}
                                            title={vkRewardCapability.reason || 'Создать новую награду VK Live'}
                                            onClick={() => void handleUpsertReward('vk')}
                                        >
                                            Создать новую
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={SETTINGS_CARD_CLASS}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-foreground">Платные заказы</div>
                                    {!donationAlertsConnected ? (
                                        <div className="text-[11px] text-muted-foreground">
                                            Подключите DonationAlerts, чтобы включить платные заказы
                                        </div>
                                    ) : null}
                                </div>
                                <Switch
                                    checked={donationAlertsConnected && donationalertsVideoEnabled}
                                    onCheckedChange={(checked) => setDonationalertsVideoEnabled(donationAlertsConnected && checked)}
                                    disabled={!donationAlertsConnected}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={paidOrderMode === 'rub_per_minute' ? 'default' : 'outline'}
                                    onClick={() => setPaidOrderMode('rub_per_minute')}
                                >
                                    Руб/мин
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={paidOrderMode === 'full_video' ? 'default' : 'outline'}
                                    onClick={() => setPaidOrderMode('full_video')}
                                >
                                    Полное видео
                                </Button>
                            </div>

                            <div className={SETTINGS_SUBCARD_CLASS}>
                                {paidOrderMode === 'rub_per_minute' ? (
                                    <div className="grid gap-2 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-center">
                                        <Label
                                            htmlFor="paid-rate"
                                            className="text-xs uppercase tracking-wide text-muted-foreground"
                                        >
                                            Тариф, руб/мин
                                        </Label>
                                        <Input
                                            id="paid-rate"
                                            type="number"
                                            min={0}
                                            value={donationalertsVideoMinAmount}
                                            onChange={(event) =>
                                                setDonationalertsVideoMinAmount(Number(event.target.value) || 0)
                                            }
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-center">
                                        <Label
                                            htmlFor="paid-full"
                                            className="text-xs uppercase tracking-wide text-muted-foreground"
                                        >
                                            Полное видео, руб
                                        </Label>
                                        <Input
                                            id="paid-full"
                                            type="number"
                                            min={0}
                                            value={paidOrderMinAmountRub}
                                            onChange={(event) =>
                                                setPaidOrderMinAmountRub(Number(event.target.value) || 0)
                                            }
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5">
                                <span className="text-xs text-muted-foreground">
                                    Видео с большей суммой попадают вверх очереди
                                </span>
                                <Switch
                                    id="paid-priority"
                                    checked={paidOrderPriorityByAmount}
                                    onCheckedChange={setPaidOrderPriorityByAmount}
                                />
                            </div>
                        </div>

                        <div className={SETTINGS_CARD_CLASS}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-foreground">OBS</div>
                                <MonitorPlay className="h-4 w-4 text-sky-300" />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={obsOverlayMode === 'track' ? 'default' : 'outline'}
                                    onClick={() => setObsOverlayMode('track')}
                                >
                                    Информация о треке
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={obsOverlayMode === 'video' ? 'default' : 'outline'}
                                    onClick={() => setObsOverlayMode('video')}
                                >
                                    Видео
                                </Button>
                            </div>

                            <div className="flex items-center gap-2">
                                <Input
                                    value={youtubeObsUrl || 'Ссылка OBS недоступна'}
                                    readOnly
                                    className="h-9 min-w-0 font-mono text-xs"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => void handleObsLinkButton()}
                                    disabled={isObsUrlLoading || !youtubeObsUrl}
                                    className="min-w-[124px]"
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Скопировать
                                </Button>
                            </div>
                        </div>
                    </div>
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

                                <div className="min-w-0">
                                    {renderPlayerControls()}
                                </div>                            </div>
                        </CardContent>
                    </Card>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <QueueList
                                queue={queue}
                                currentVideo={currentVideo}
                                skipVotes={skipVotes}
                                isPlaybackActive={isPlaying}
                                totalDuration={totalQueueDuration}
                                onRemove={handleQueueRemove}
                                onPlay={handleQueuePlay}
                                onBan={handleQueueBan}
                            />
                        </DndContext>
                    </div>
                </div>
            ) : (
                <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-3">
                    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/6 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
                        <div
                            className="relative flex-1 min-h-0 overflow-hidden rounded-2xl bg-black"
                            onPointerDown={markUserStarted}
                        >
                            <div
                                ref={theaterPlayerContainerRef}
                                data-player-container="theater"
                                className="absolute inset-0 h-full w-full"
                            />
                            {!hasVideo && (
                                <div className="flex h-full w-full items-center justify-center bg-muted/20">
                                    <MonitorPlay className="h-14 w-14 text-muted-foreground/35" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
                        {renderPlayerControls(true)}

                        <div className="flex-1 min-h-0 overflow-hidden">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <QueueList
                                    queue={queue}
                                    currentVideo={currentVideo}
                                    skipVotes={skipVotes}
                                    compact={true}
                                    isPlaybackActive={isPlaying}
                                    totalDuration={totalQueueDuration}
                                    onRemove={handleQueueRemove}
                                    onPlay={handleQueuePlay}
                                    onBan={handleQueueBan}
                                />
                            </DndContext>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default YoutubeIntegrationPage;
