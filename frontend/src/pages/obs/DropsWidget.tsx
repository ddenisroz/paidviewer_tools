import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { dropsService } from '@/services/api/services/dropsService';
import { logger } from '@/shared/utils/prodLogger';
import { getChatWebSocketUrl } from '@/shared/utils/urlUtils';

import CommonOpened from '../../images/lootboxes/common/common_opened.png';
import EpicOpened from '../../images/lootboxes/epic/epic_opened.png';
import LegendaryOpened from '../../images/lootboxes/legendary/legendary_opened.png';
import MythycOpened from '../../images/lootboxes/mythyc/mythyc_opened.png';
import RareOpened from '../../images/lootboxes/rare/rare_opened_.png';

const QUALITY_IMAGES: Record<string, string> = {
    common: CommonOpened,
    rare: RareOpened,
    epic: EpicOpened,
    legendary: LegendaryOpened,
    mythical: MythycOpened,
    mythyc: MythycOpened,
};

const CARD_WIDTH = 184;
const CARD_GAP = 16;
const CARD_STEP = CARD_WIDTH + CARD_GAP;

interface Reward {
    id: number;
    name: string;
    description?: string;
    image_url?: string;
    reward_type?: string;
    reward_value?: string | number;
    sound_file?: string | null;
    sound_volume?: number;
    quality?: {
        name: string;
    };
    is_active?: boolean;
}

interface RewardData {
    quality?: string;
    quality_name?: string;
    viewer_name?: string;
    reward_name?: string;
    reward_id?: number;
    reward_type?: string;
    reward_value?: string | number;
    description?: string;
    sound_file?: string | null;
    sound_volume?: number;
}

interface MythicalSession {
    donation_amount: number;
    time_remaining_seconds: number;
}

interface WebSocketMessage {
    type: string;
    event?: string;
    data?: RewardData;
}

type AnimationPhase = 'idle' | 'opening' | 'roulette' | 'result';

interface WidgetConfig {
    spinning_duration: number;
    opening_duration: number;
    result_duration: number;
}

interface UserTokenResponse {
    user_id?: number;
    channel_name?: string;
    platform?: string;
}

interface WidgetConfigData {
    widget_spinning_duration_ms?: number;
    widget_opening_duration_ms?: number;
    widget_result_duration_ms?: number;
}

interface DropsApiResponse<T = unknown> {
    success: boolean;
    data?: T;
}

const qualityLabel = (quality?: string): string => {
    switch ((quality || '').toLowerCase()) {
        case 'common':
            return 'Обычная';
        case 'rare':
            return 'Редкая';
        case 'epic':
            return 'Эпическая';
        case 'legendary':
            return 'Легендарная';
        case 'mythical':
        case 'mythyc':
            return 'Мифическая';
        default:
            return 'Награда';
    }
};

const qualityBadgeClass = (quality?: string): string => {
    switch ((quality || '').toLowerCase()) {
        case 'common':
            return 'border-slate-400/35 bg-slate-500/10 text-slate-200';
        case 'rare':
            return 'border-sky-400/35 bg-sky-500/10 text-sky-200';
        case 'epic':
            return 'border-violet-400/35 bg-violet-500/10 text-violet-200';
        case 'legendary':
            return 'border-amber-400/35 bg-amber-500/10 text-amber-200';
        case 'mythical':
        case 'mythyc':
            return 'border-pink-400/35 bg-pink-500/10 text-pink-200';
        default:
            return 'border-slate-400/35 bg-slate-500/10 text-slate-200';
    }
};

const qualityGlowClass = (quality?: string): string => {
    switch ((quality || '').toLowerCase()) {
        case 'common':
            return 'from-slate-500/20 via-slate-200/10 to-transparent';
        case 'rare':
            return 'from-sky-500/25 via-sky-200/10 to-transparent';
        case 'epic':
            return 'from-violet-500/25 via-fuchsia-200/10 to-transparent';
        case 'legendary':
            return 'from-amber-500/25 via-yellow-200/10 to-transparent';
        case 'mythical':
        case 'mythyc':
            return 'from-pink-500/25 via-fuchsia-200/10 to-transparent';
        default:
            return 'from-slate-500/20 via-slate-200/10 to-transparent';
    }
};

const getQualityImage = (quality?: string): string => QUALITY_IMAGES[(quality || '').toLowerCase()] || QUALITY_IMAGES.common;

const DropsWidget: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [currentReward, setCurrentReward] = useState<RewardData | null>(null);
    const [carouselRewards, setCarouselRewards] = useState<Reward[]>([]);
    const [previewRewards, setPreviewRewards] = useState<Reward[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
    const [status, setStatus] = useState('Подключение...');
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [roulettePosition, setRoulettePosition] = useState(0);
    const [winningIndex, setWinningIndex] = useState<number | null>(null);
    const [mythicalSession, setMythicalSession] = useState<MythicalSession | null>(null);
    const [mythicalTimer, setMythicalTimer] = useState<number | null>(null);

    const ws = useRef<WebSocket | null>(null);
    const channelNameRef = useRef<string | null>(null);
    const platformRef = useRef<string | null>(null);
    const mythicalTimerInterval = useRef<NodeJS.Timeout | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const animationTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
    const widgetConfig = useRef<WidgetConfig>({
        spinning_duration: 1500,
        opening_duration: 1000,
        result_duration: 5500,
    });

    const clearAnimationTimers = useCallback((): void => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        animationTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        animationTimeoutsRef.current = [];
    }, []);

    const startMythicalTimer = useCallback((initialSeconds: number): void => {
        if (mythicalTimerInterval.current) {
            clearInterval(mythicalTimerInterval.current);
        }

        let remaining = initialSeconds;
        setMythicalTimer(remaining);

        mythicalTimerInterval.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                setMythicalTimer(0);
                setMythicalSession(null);
                if (mythicalTimerInterval.current) {
                    clearInterval(mythicalTimerInterval.current);
                }
            } else {
                setMythicalTimer(remaining);
            }
        }, 1000);
    }, []);

    const formatTimer = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const loadMythicalSession = useCallback(
        async (channel?: string | null): Promise<void> => {
            const targetChannel = channel ?? channelNameRef.current;
            if (!targetChannel || !token) return;

            try {
                const response = await dropsService.getMythicalSession(targetChannel, token);
                const data = response.data as DropsApiResponse<MythicalSession>;

                if (data.success && data.data) {
                    setMythicalSession(data.data);
                    startMythicalTimer(data.data.time_remaining_seconds);
                    return;
                }

                setMythicalSession(null);
                setMythicalTimer(null);
                if (mythicalTimerInterval.current) {
                    clearInterval(mythicalTimerInterval.current);
                }
            } catch (error) {
                logger.error('Error loading mythical session:', error);
            }
        },
        [startMythicalTimer, token]
    );

    const loadRewardsForQuality = useCallback(
        async (quality: string, channelName: string, platform: string): Promise<Reward[]> => {
            if (!channelName || !token) {
                return [];
            }

            try {
                const response = await dropsService.getRewardsForWidget(channelName, {
                    platform: platform || undefined,
                    quality,
                    widget_token: token,
                });
                const data = response.data as { success?: boolean; data?: Reward[] } | Reward[];
                const rewards = Array.isArray(data) ? data : data.success && data.data ? data.data : [];
                return rewards.filter((reward) => reward.is_active !== false);
            } catch (error) {
                logger.error('Error loading rewards for widget:', error);
                return [];
            }
        },
        [token]
    );

    const loadPreviewRewards = useCallback(
        async (channelName: string, platform: string): Promise<void> => {
            if (!channelName || !token) return;

            try {
                const response = await dropsService.getRewardsForWidget(channelName, {
                    platform: platform || undefined,
                    widget_token: token,
                });
                const data = response.data as { success?: boolean; data?: Reward[] } | Reward[];
                const rewards = Array.isArray(data) ? data : data.success && data.data ? data.data : [];
                setPreviewRewards(rewards.filter((reward) => reward.is_active !== false));
            } catch (error) {
                logger.error('Error loading preview rewards:', error);
                setPreviewRewards([]);
            }
        },
        [token]
    );

    const playRewardSound = useCallback((rewardData: RewardData): void => {
        if (!rewardData.sound_file) return;

        const audio = new Audio(rewardData.sound_file);
        audio.volume = rewardData.sound_volume ?? 1;
        audio.play().catch((error) => logger.error('Error playing reward sound:', error));
    }, []);

    const showReward = useCallback(
        async (rewardData: RewardData): Promise<void> => {
            const quality = (rewardData.quality || rewardData.quality_name || 'common').toLowerCase();
            const channelName = channelNameRef.current || '';
            const platform = platformRef.current || '';
            const rewards = await loadRewardsForQuality(quality, channelName, platform);
            const baseRewards =
                rewards.length > 0
                    ? rewards
                    : [
                          {
                              id: rewardData.reward_id || -1,
                              name: rewardData.reward_name || 'Награда',
                              description: rewardData.description,
                              reward_type: rewardData.reward_type,
                              reward_value: rewardData.reward_value,
                              sound_file: rewardData.sound_file,
                              sound_volume: rewardData.sound_volume,
                              quality: { name: quality },
                              is_active: true,
                          },
                      ];

            clearAnimationTimers();

            const repeatedRewards = Array.from({ length: Math.max(baseRewards.length * 6, 18) }, (_, index) => {
                return baseRewards[index % baseRewards.length];
            });

            const baseWinnerIndex = baseRewards.findIndex(
                (reward) => reward.id === rewardData.reward_id || reward.name === rewardData.reward_name
            );
            const winnerIndex = (baseWinnerIndex >= 0 ? baseWinnerIndex : 0) + baseRewards.length * 3;

            setCurrentReward(rewardData);
            setCarouselRewards(repeatedRewards);
            setWinningIndex(winnerIndex);
            setRoulettePosition(0);
            setIsAnimating(true);
            setAnimationPhase('opening');

            const openingTimeout = setTimeout(() => {
                setAnimationPhase('roulette');

                const duration = widgetConfig.current.spinning_duration;
                const startTime = performance.now();
                const targetPosition = winnerIndex;

                const animate = (currentTime: number): void => {
                    const progress = Math.min((currentTime - startTime) / duration, 1);
                    const easedProgress = 1 - Math.pow(1 - progress, 4);
                    setRoulettePosition(targetPosition * easedProgress);

                    if (progress < 1) {
                        animationFrameRef.current = requestAnimationFrame(animate);
                        return;
                    }

                    setRoulettePosition(targetPosition);
                    setAnimationPhase('result');
                    playRewardSound(rewardData);
                };

                animationFrameRef.current = requestAnimationFrame(animate);
            }, widgetConfig.current.opening_duration);

            const finishTimeout = setTimeout(() => {
                setAnimationPhase('idle');
                setRoulettePosition(0);
                setWinningIndex(null);
                setIsAnimating(false);
                setCurrentReward(null);
                setCarouselRewards([]);
            }, widgetConfig.current.opening_duration + widgetConfig.current.spinning_duration + widgetConfig.current.result_duration);

            animationTimeoutsRef.current = [openingTimeout, finishTimeout];
        },
        [clearAnimationTimers, loadRewardsForQuality, playRewardSound]
    );

    const buildPreviewRewardData = useCallback((reward: Reward): RewardData => {
        const rewardQuality = reward.quality?.name || 'common';
        return {
            quality: rewardQuality,
            quality_name: rewardQuality,
            viewer_name: 'Тестовый зритель',
            reward_name: reward.name,
            reward_id: reward.id,
            reward_type: reward.reward_type,
            reward_value: reward.reward_value,
            description: reward.description,
            sound_file: reward.sound_file ?? null,
            sound_volume: reward.sound_volume ?? 1,
        };
    }, []);

    const testAnimation = useCallback(
        async (quality: string = 'epic'): Promise<void> => {
            const matchingReward = previewRewards.find((reward) => (reward.quality?.name || 'common').toLowerCase() === quality);
            if (matchingReward) {
                await showReward(buildPreviewRewardData(matchingReward));
                return;
            }

            await showReward({
                quality,
                quality_name: quality,
                viewer_name: 'Тестовый зритель',
                reward_name: `${qualityLabel(quality)} награда`,
                reward_id: -1,
                reward_type: 'points',
                reward_value: '',
                description: 'Тестовый сценарий',
                sound_file: null,
                sound_volume: 1,
            });
        },
        [buildPreviewRewardData, previewRewards, showReward]
    );

    const resolveWidgetContext = useCallback(async (): Promise<UserTokenResponse | null> => {
        if (!token) return null;

        const response = await dropsService.getUserFromToken(token);
        const apiData = response.data as DropsApiResponse<UserTokenResponse>;
        const data = apiData.data || (apiData as unknown as UserTokenResponse);

        if (!data.user_id || !data.channel_name) {
            return null;
        }

        channelNameRef.current = data.channel_name || null;
        platformRef.current = data.platform || null;

        if (data.channel_name && data.platform) {
            try {
                const configResponse = await dropsService.getConfigWithToken(data.channel_name, {
                    platform: data.platform,
                    widget_token: token,
                });
                const configData = configResponse.data as DropsApiResponse<WidgetConfigData>;
                if (configData.success && configData.data) {
                    widgetConfig.current = {
                        spinning_duration: configData.data.widget_spinning_duration_ms || 1500,
                        opening_duration: configData.data.widget_opening_duration_ms || 1000,
                        result_duration: configData.data.widget_result_duration_ms || 5500,
                    };
                }
            } catch (error) {
                logger.error('Error loading widget config:', error);
            }

            await loadPreviewRewards(data.channel_name, data.platform);
            await loadMythicalSession(data.channel_name);
        }

        return data;
    }, [loadMythicalSession, loadPreviewRewards, token]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const preview = urlParams.get('preview') === 'true';
        setIsPreviewMode(preview);

        if (!token) {
            setStatus('Ошибка: отсутствует токен');
            return;
        }

        let reconnectTimeout: NodeJS.Timeout | null = null;
        let isMounted = true;

        const connect = async (): Promise<void> => {
            try {
                const widgetContext = await resolveWidgetContext();
                if (!widgetContext?.user_id) {
                    if (isMounted) {
                        setStatus('Ошибка: токен виджета недействителен');
                    }
                    return;
                }

                if (preview) {
                    if (isMounted) {
                        setStatus('Тестовый режим: выберите награду');
                    }
                    return;
                }

                const wsUrl = getChatWebSocketUrl(widgetContext.user_id);
                const websocket = new WebSocket(wsUrl);

                websocket.onopen = () => {
                    if (!isMounted) return;
                    ws.current = websocket;
                    setStatus('Ожидание наград...');
                };

                websocket.onmessage = (event: MessageEvent) => {
                    try {
                        const data = JSON.parse(event.data) as WebSocketMessage;
                        if (data.type === 'drops' && data.event === 'reward_received' && data.data) {
                            void showReward(data.data);
                            return;
                        }
                        if (data.type === 'drops' && data.event === 'mythical_session_started') {
                            void loadMythicalSession();
                            return;
                        }
                        if (data.type === 'drops' && data.event === 'mythical_session_ended') {
                            setMythicalSession(null);
                            setMythicalTimer(null);
                        }
                    } catch (error) {
                        logger.error('Error parsing drops widget message:', error);
                    }
                };

                websocket.onclose = () => {
                    if (!isMounted) return;
                    ws.current = null;
                    setStatus('Переподключение...');
                    reconnectTimeout = setTimeout(() => {
                        void connect();
                    }, 3000);
                };

                websocket.onerror = () => {
                    logger.error('Drops widget WebSocket error');
                };
            } catch (error) {
                logger.error('Error connecting drops widget:', error);
                if (isMounted) {
                    setStatus('Ошибка подключения к drops');
                }
            }
        };

        void connect();

        const mythicalCheckInterval = setInterval(() => {
            const currentChannel = channelNameRef.current;
            if (currentChannel) {
                void loadMythicalSession(currentChannel);
            }
        }, 10000);

        return () => {
            isMounted = false;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (ws.current) {
                ws.current.close();
            }
            if (mythicalTimerInterval.current) {
                clearInterval(mythicalTimerInterval.current);
            }
            clearInterval(mythicalCheckInterval);
            clearAnimationTimers();
        };
    }, [clearAnimationTimers, loadMythicalSession, resolveWidgetContext, showReward, token]);

    const currentQuality = (currentReward?.quality || currentReward?.quality_name || 'common').toLowerCase();
    const chestImage = useMemo(() => getQualityImage(currentQuality), [currentQuality]);
    const translateX = `translateX(calc(50% - ${roulettePosition * CARD_STEP + CARD_WIDTH / 2}px))`;

    if (mythicalSession && mythicalTimer !== null && mythicalTimer > 0) {
        return (
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.28),_transparent_40%),linear-gradient(160deg,_rgba(18,11,35,0.96),_rgba(6,8,18,0.98))]">
                <div className="rounded-[30px] border border-pink-400/30 bg-black/20 px-10 py-8 text-center text-white shadow-[0_30px_120px_rgba(236,72,153,0.18)] backdrop-blur-xl">
                    <img src={QUALITY_IMAGES.mythical} alt="Мифический drops" className="mx-auto mb-5 h-36 w-36 animate-pulse object-contain" />
                    <p className="text-xs uppercase tracking-[0.34em] text-pink-200/70">Мифический drops</p>
                    <h2 className="mt-3 text-3xl font-semibold text-white">Окно награды открыто</h2>
                    <p className="mt-3 text-lg text-pink-100">Минимальный донат: {mythicalSession.donation_amount}₽</p>
                    <div className="mt-6 text-5xl font-semibold tracking-[0.12em] text-amber-300">{formatTimer(mythicalTimer)}</div>
                </div>
            </div>
        );
    }

    if (!isAnimating || !currentReward) {
        return (
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_38%),linear-gradient(160deg,_rgba(11,15,28,0.98),_rgba(2,6,16,1))] p-6">
                <div className="w-full max-w-[980px] rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-white shadow-[0_40px_140px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-center">
                        <div className="rounded-[24px] border border-white/10 bg-black/20 p-6 text-center">
                            <img src={QUALITY_IMAGES.common} alt="Drops" className="mx-auto h-36 w-36 object-contain opacity-70" />
                            <p className="mt-4 text-xs uppercase tracking-[0.32em] text-sky-100/50">
                                {isPreviewMode ? 'Тестовый режим' : 'Drops widget'}
                            </p>
                            <p className="mt-3 text-base text-white/80">{status}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.32em] text-white/45">Сценарии проверки</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">
                                    {isPreviewMode ? 'Проверка реальных наград' : 'Ожидание живых событий'}
                                </h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                                    {isPreviewMode
                                        ? 'Кнопки ниже запускают именно ваши активные награды. Если у награды есть звук, он тоже проиграется после остановки колеса.'
                                        : 'Виджет слушает реальные события из подключенного чата и показывает выпадение награды без перезагрузки.'}
                                </p>
                            </div>

                            {isPreviewMode ? (
                                previewRewards.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {previewRewards.slice(0, 9).map((reward) => {
                                            const rewardQuality = reward.quality?.name || 'common';
                                            return (
                                                <button
                                                    key={reward.id}
                                                    onClick={() => void showReward(buildPreviewRewardData(reward))}
                                                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-sky-400/5"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <span
                                                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${qualityBadgeClass(rewardQuality)}`}
                                                        >
                                                            {qualityLabel(rewardQuality)}
                                                        </span>
                                                        {reward.sound_file ? (
                                                            <span className="text-[11px] uppercase tracking-[0.22em] text-sky-200/70">
                                                                звук
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">{reward.name}</p>
                                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/50">
                                                        {reward.description || 'Без описания'}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        {['common', 'rare', 'epic', 'legendary', 'mythical'].map((quality) => (
                                            <button
                                                key={quality}
                                                onClick={() => void testAnimation(quality)}
                                                className={`rounded-2xl border px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5 ${qualityBadgeClass(quality)}`}
                                            >
                                                <p className="text-sm font-semibold">{qualityLabel(quality)}</p>
                                                <p className="mt-1 text-xs opacity-80">Запуск базового теста</p>
                                            </button>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/55">
                                    Виджет подключен к чату канала и ждет реальную выдачу награды.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.1),_transparent_38%),linear-gradient(160deg,_rgba(10,14,26,0.98),_rgba(3,6,16,1))] p-6">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${qualityGlowClass(currentQuality)}`} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <img src={chestImage} alt={qualityLabel(currentQuality)} className="h-[440px] w-[440px] object-contain opacity-[0.14]" />
            </div>

            <div className="relative z-10 w-full max-w-[1040px]">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-white">
                    <div>
                        <p className="text-xs uppercase tracking-[0.34em] text-white/45">Награда</p>
                        <h2 className="mt-2 text-2xl font-semibold">{currentReward.viewer_name || 'Зритель'}</h2>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${qualityBadgeClass(currentQuality)}`}>
                        {qualityLabel(currentQuality)}
                    </span>
                </div>

                <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] px-4 py-8 shadow-[0_40px_140px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-y-6 left-1/2 z-30 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-300/90 to-transparent" />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[244px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-amber-300/35 bg-amber-200/5 shadow-[0_0_80px_rgba(251,191,36,0.22)]" />

                    <div className="relative h-[248px] overflow-hidden">
                        <div
                            className="absolute top-1/2 flex -translate-y-1/2 items-stretch gap-4"
                            style={{ transform: translateX, transition: animationPhase === 'roulette' ? 'none' : 'transform 200ms ease-out' }}
                        >
                            {carouselRewards.map((reward, index) => {
                                const rewardQuality = reward.quality?.name || 'common';
                                const isWinner = animationPhase === 'result' && winningIndex === index;
                                return (
                                    <div
                                        key={`${reward.id}-${index}`}
                                        className={`flex h-[228px] w-[184px] shrink-0 flex-col overflow-hidden rounded-[24px] border bg-[#07111f]/95 transition-all duration-300 ${
                                            isWinner
                                                ? 'border-amber-300 shadow-[0_0_60px_rgba(251,191,36,0.28)] scale-[1.04]'
                                                : 'border-white/10 opacity-65'
                                        }`}
                                    >
                                        <div className="h-[118px] overflow-hidden bg-black/20">
                                            {reward.image_url ? (
                                                <img
                                                    src={reward.image_url}
                                                    alt={reward.name}
                                                    className="h-full w-full object-cover"
                                                    onError={(event) => {
                                                        (event.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%),linear-gradient(180deg,_rgba(17,24,39,0.9),_rgba(3,7,18,0.95))]">
                                                    <img
                                                        src={getQualityImage(rewardQuality)}
                                                        alt={qualityLabel(rewardQuality)}
                                                        className="h-16 w-16 object-contain opacity-80"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-1 flex-col px-4 py-3">
                                            <span
                                                className={`inline-flex w-fit rounded-full border px-2 py-1 text-[11px] font-medium ${qualityBadgeClass(rewardQuality)}`}
                                            >
                                                {qualityLabel(rewardQuality)}
                                            </span>
                                            <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">{reward.name}</p>
                                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/50">
                                                {reward.description || 'Награда из вашего активного пула'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {animationPhase === 'result' ? (
                    <div className="mt-5 rounded-[26px] border border-white/10 bg-black/25 px-6 py-5 text-white shadow-[0_20px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                        <p className="text-xs uppercase tracking-[0.34em] text-white/45">Получено</p>
                        <h3 className="mt-3 text-3xl font-semibold">{currentReward.reward_name || 'Награда'}</h3>
                        {currentReward.description ? (
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{currentReward.description}</p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default DropsWidget;
