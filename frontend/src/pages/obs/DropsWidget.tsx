import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useParams } from 'react-router-dom';

import { dropsService } from '@/services/api/services/dropsService';
import { logger } from '@/shared/utils/prodLogger';
import { getDropsWidgetWebSocketUrl, resolveAudioUrl } from '@/shared/utils/urlUtils';

import {
    DropsWidgetOpeningStage,
    DropsWidgetReelStage,
    DropsWidgetResultPanel,
    qualityLabel,
} from './dropsWidgetVisuals';

interface Reward {
    id: number;
    name: string;
    description?: string;
    image_url?: string;
    reward_type?: string;
    reward_value?: string | number;
    sound_file?: string | null;
    sound_volume?: number;
    weight?: number;
    quality?: {
        name: string;
    };
    is_active?: boolean;
}

interface RewardData {
    quality?: string;
    quality_name?: string;
    viewer_name?: string;
    reward?: string;
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

interface UserTokenResponse {
    user_id?: number;
    channel_name?: string;
    platform?: string;
}

interface WidgetConfigData {
    widget_spinning_duration_ms?: number;
    widget_opening_duration_ms?: number;
    widget_result_duration_ms?: number;
    widget_spin_sound_file?: string | null;
    widget_start_sound_file?: string | null;
    widget_reveal_sound_file?: string | null;
    widget_sound_volume?: number;
    widget_frame_color?: string | null;
    widget_text_color?: string | null;
    widget_background_color?: string | null;
    widget_font_scale?: number | null;
}

interface DropsApiResponse<T = unknown> {
    success: boolean;
    data?: T;
}

interface ReelItem {
    id: string;
    quality: string;
    reward?: Reward;
    dropChance?: number;
}

type AnimationPhase = 'idle' | 'opening' | 'spinning' | 'result';

interface WidgetConfig {
    spinning_duration: number;
    opening_duration: number;
    result_duration: number;
    spin_sound_file?: string | null;
    start_sound_file?: string | null;
    reveal_sound_file?: string | null;
    sound_volume: number;
    frame_color: string;
    text_color: string;
    background_color: string;
    font_scale: number;
}

const CARD_WIDTH = 184;
const CARD_GAP = 16;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const WINNER_SLOT_INDEX = 26;
const REEL_LENGTH = 38;
const PREVIEW_QUALITIES = new Set(['common', 'rare', 'epic', 'legendary', 'mythical']);

const weightedPick = (rewards: Reward[]): Reward | null => {
    if (rewards.length === 0) return null;
    const totalWeight = rewards.reduce((sum, reward) => sum + Math.max(1, Number(reward.weight) || 1), 0);
    let roll = Math.random() * totalWeight;
    for (const reward of rewards) {
        roll -= Math.max(1, Number(reward.weight) || 1);
        if (roll <= 0) return reward;
    }
    return rewards[rewards.length - 1] || null;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const DropsWidget: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const location = useLocation();
    const [currentReward, setCurrentReward] = useState<RewardData | null>(null);
    const [reelItems, setReelItems] = useState<ReelItem[]>([]);
    const [previewRewards, setPreviewRewards] = useState<Reward[]>([]);
    const [phase, setPhase] = useState<AnimationPhase>('idle');
    const [, setStatus] = useState('Подключение...');
    const [translateX, setTranslateX] = useState('translate3d(0px, 0, 0)');
    const [pointerKick, setPointerKick] = useState(false);
    const [mythicalSession, setMythicalSession] = useState<MythicalSession | null>(null);
    const [mythicalTimer, setMythicalTimer] = useState<number | null>(null);

    const ws = useRef<WebSocket | null>(null);
    const widgetConfig = useRef<WidgetConfig>({
        spinning_duration: 5000,
        opening_duration: 700,
        result_duration: 5000,
        spin_sound_file: null,
        start_sound_file: null,
        reveal_sound_file: null,
        sound_volume: 1,
        frame_color: '#ff8a00',
        text_color: '#ffffff',
        background_color: '#120821',
        font_scale: 1,
    });
    const channelNameRef = useRef<string | null>(null);
    const platformRef = useRef<string | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const animationTimeoutsRef = useRef<number[]>([]);
    const mythicalIntervalRef = useRef<number | null>(null);
    const timerIntervalRef = useRef<number | null>(null);
    const lastTickSlotRef = useRef<number>(-1);
    const autoPreviewStartedRef = useRef(false);

    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const isPreviewMode = searchParams.get('preview') === 'true';
    const previewQuality = (searchParams.get('quality') || '').toLowerCase();
    const previewRun = searchParams.get('run') || '';
    const idleBackground = searchParams.get('background') === 'transparent' ? 'bg-transparent' : 'bg-[#00ff00]';

    const clearAnimations = useCallback(() => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        animationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        animationTimeoutsRef.current = [];
        lastTickSlotRef.current = -1;
    }, []);

    const clearMythicalTimer = useCallback(() => {
        if (timerIntervalRef.current !== null) {
            window.clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => clearAnimations();
    }, [clearAnimations]);

    const startMythicalTimer = useCallback(
        (seconds: number) => {
            clearMythicalTimer();
            let remaining = Math.max(0, seconds);
            setMythicalTimer(remaining);
            timerIntervalRef.current = window.setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearMythicalTimer();
                    setMythicalTimer(0);
                    setMythicalSession(null);
                } else {
                    setMythicalTimer(remaining);
                }
            }, 1000);
        },
        [clearMythicalTimer]
    );

    const formatTimer = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const playRewardSound = useCallback((rewardData: RewardData): void => {
        if (!rewardData.sound_file) return;
        const audio = new Audio(resolveAudioUrl(rewardData.sound_file));
        audio.volume = clamp(rewardData.sound_volume ?? 1, 0, 1);
        audio.play().catch((error) => logger.error('Error playing reward sound:', error));
    }, []);

    const playWidgetSound = useCallback((kind: 'spin' | 'start' | 'reveal'): void => {
        const source =
            kind === 'spin'
                ? widgetConfig.current.spin_sound_file
                : kind === 'start'
                  ? widgetConfig.current.start_sound_file
                  : widgetConfig.current.reveal_sound_file;
        if (!source) return;
        const audio = new Audio(resolveAudioUrl(source));
        audio.volume = clamp(widgetConfig.current.sound_volume ?? 1, 0, 1);
        audio.play().catch((error) => logger.debug('Drops widget sound skipped:', error));
    }, []);

    const loadRewardsForQuality = useCallback(
        async (quality: string, channelName: string, platform: string): Promise<Reward[]> => {
            if (!channelName || !token) return [];
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

    const loadMythicalSession = useCallback(
        async (channel?: string | null): Promise<void> => {
            const currentChannel = channel ?? channelNameRef.current;
            if (!currentChannel || !token) return;
            try {
                const response = await dropsService.getMythicalSession(currentChannel, token);
                const payload = response.data as DropsApiResponse<MythicalSession>;
                if (payload.success && payload.data) {
                    setMythicalSession(payload.data);
                    startMythicalTimer(payload.data.time_remaining_seconds);
                } else {
                    setMythicalSession(null);
                    setMythicalTimer(null);
                    clearMythicalTimer();
                }
            } catch (error) {
                logger.error('Error loading mythical session:', error);
            }
        },
        [clearMythicalTimer, startMythicalTimer, token]
    );

    const buildPreviewRewardData = useCallback((reward: Reward): RewardData => {
        const rewardQuality = reward.quality?.name || 'common';
        return {
            quality: rewardQuality,
            quality_name: rewardQuality,
            viewer_name: 'Тест',
            reward_name: reward.name,
            reward_id: reward.id,
            reward_type: reward.reward_type,
            reward_value: reward.reward_value,
            description: reward.description,
            sound_file: reward.sound_file ?? null,
            sound_volume: reward.sound_volume ?? 1,
        };
    }, []);

    const runRewardAnimation = useCallback(
        async (rewardData: RewardData): Promise<void> => {
            const quality = (rewardData.quality || rewardData.quality_name || 'common').toLowerCase();
            const channelName = channelNameRef.current || '';
            const platform = platformRef.current || '';
            const rewardPool = await loadRewardsForQuality(quality, channelName, platform);
            const incomingRewardName = rewardData.reward_name || rewardData.reward;
            const fallbackReward: Reward = {
                id: rewardData.reward_id || -1,
                name: incomingRewardName || 'Награда',
                description: rewardData.description,
                reward_type: rewardData.reward_type,
                reward_value: rewardData.reward_value,
                sound_file: rewardData.sound_file,
                sound_volume: rewardData.sound_volume,
                weight: 1,
                quality: { name: quality },
                is_active: true,
            };
            const winnerReward =
                rewardPool.find((item) => item.id === rewardData.reward_id) ||
                rewardPool.find((item) => item.name === incomingRewardName) ||
                fallbackReward;
            const resolvedRewardData: RewardData = {
                ...rewardData,
                reward_id: rewardData.reward_id || winnerReward.id,
                reward_name: incomingRewardName || winnerReward.name,
                reward_type: rewardData.reward_type || winnerReward.reward_type,
                reward_value: rewardData.reward_value ?? winnerReward.reward_value,
                description: rewardData.description || winnerReward.description,
                sound_file: rewardData.sound_file ?? winnerReward.sound_file ?? null,
                sound_volume: rewardData.sound_volume ?? winnerReward.sound_volume ?? 1,
            };

            const fillerPool = rewardPool.length > 0 ? rewardPool : [fallbackReward];
            const totalWeight = fillerPool.reduce((sum, r) => sum + Math.max(1, Number(r.weight) || 1), 0);
            const strip = Array.from({ length: REEL_LENGTH }, (_, index) => {
                const reward = index === WINNER_SLOT_INDEX ? winnerReward : weightedPick(fillerPool) || winnerReward;
                const rewardWeight = Math.max(1, Number(reward.weight) || 1);
                const dropChance = totalWeight > 0 ? (rewardWeight / totalWeight) * 100 : 0;
                return {
                    id: `${reward.id}-${index}`,
                    quality: (reward.quality?.name || quality).toLowerCase(),
                    reward,
                    dropChance,
                } satisfies ReelItem;
            });

            clearAnimations();
            setCurrentReward(resolvedRewardData);
            setReelItems(strip);
            setPointerKick(false);
            setPhase('opening');
            playWidgetSound('start');

            const targetOffset = WINNER_SLOT_INDEX * CARD_STEP;

            const openingTimeout = window.setTimeout(() => {
                setPhase('spinning');
                const duration = widgetConfig.current.spinning_duration;
                const start = performance.now();

                const animate = (timestamp: number): void => {
                    const progress = clamp((timestamp - start) / duration, 0, 1);
                    const eased = 1 - Math.pow(1 - progress, 4);
                    const offset = targetOffset * eased;
                    const slotIndex = Math.floor(offset / CARD_STEP);

                    if (slotIndex !== lastTickSlotRef.current) {
                        lastTickSlotRef.current = slotIndex;
                        setPointerKick(true);
                        playWidgetSound('spin');
                        window.setTimeout(() => setPointerKick(false), 70);
                    }

                    setTranslateX(`translate3d(calc(50% - ${offset + CARD_WIDTH / 2}px), 0, 0)`);

                    if (progress < 1) {
                        animationFrameRef.current = requestAnimationFrame(animate);
                        return;
                    }

                    setTranslateX(`translate3d(calc(50% - ${targetOffset + CARD_WIDTH / 2}px), 0, 0)`);
                    setPhase('result');
                    playWidgetSound('reveal');
                    playRewardSound(resolvedRewardData);
                };

                animationFrameRef.current = requestAnimationFrame(animate);
            }, widgetConfig.current.opening_duration);

            const finishTimeout = window.setTimeout(() => {
                setPhase('idle');
                setCurrentReward(null);
                setReelItems([]);
                setTranslateX('translate3d(0px, 0, 0)');
                setPointerKick(false);
            }, widgetConfig.current.opening_duration + widgetConfig.current.spinning_duration + widgetConfig.current.result_duration);

            animationTimeoutsRef.current = [openingTimeout, finishTimeout];
        },
        [clearAnimations, loadRewardsForQuality, playRewardSound, playWidgetSound]
    );

    const triggerPreviewChest = useCallback(
        async (quality: string): Promise<void> => {
            const candidates = previewRewards.filter((reward) => (reward.quality?.name || 'common').toLowerCase() === quality);
            const selectedReward = weightedPick(candidates);
            if (selectedReward) {
                await runRewardAnimation(buildPreviewRewardData(selectedReward));
                return;
            }

            await runRewardAnimation({
                quality,
                quality_name: quality,
                viewer_name: 'Тест',
                reward_name: `${qualityLabel(quality)} сундук`,
                reward_id: -1,
                reward_type: 'custom',
                reward_value: '',
                description: 'Тестовое открытие сундука',
                sound_file: null,
                sound_volume: 1,
            });
        },
        [buildPreviewRewardData, previewRewards, runRewardAnimation]
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
                        spinning_duration: configData.data.widget_spinning_duration_ms || 5000,
                        opening_duration: configData.data.widget_opening_duration_ms || 700,
                        result_duration: configData.data.widget_result_duration_ms || 5000,
                        spin_sound_file: configData.data.widget_spin_sound_file || null,
                        start_sound_file: configData.data.widget_start_sound_file || null,
                        reveal_sound_file: configData.data.widget_reveal_sound_file || null,
                        sound_volume: clamp(configData.data.widget_sound_volume ?? 1, 0, 1),
                        frame_color: String(configData.data.widget_frame_color || '#ff8a00'),
                        text_color: String(configData.data.widget_text_color || '#ffffff'),
                        background_color: String(configData.data.widget_background_color || '#120821'),
                        font_scale: clamp(Number(configData.data.widget_font_scale ?? 1), 0.8, 1.6),
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
        autoPreviewStartedRef.current = false;
        clearAnimations();
        setCurrentReward(null);
        setReelItems([]);
        setPhase('idle');
        setTranslateX('translate3d(0px, 0, 0)');
        setPointerKick(false);
    }, [clearAnimations, isPreviewMode, previewQuality, previewRun, token]);

    useEffect(() => {
        if (!token) {
            setStatus('Ошибка: отсутствует токен');
            return;
        }

        let isMounted = true;
        let reconnectTimeout: number | null = null;

        const connect = async (): Promise<void> => {
            try {
                const widgetContext = await resolveWidgetContext();
                if (!widgetContext?.user_id) {
                    if (isMounted) setStatus('Ошибка: токен виджета недействителен');
                    return;
                }

                if (isPreviewMode) {
                    if (isMounted) setStatus('Тест сундуков');
                    if (PREVIEW_QUALITIES.has(previewQuality) && previewRun && !autoPreviewStartedRef.current) {
                        autoPreviewStartedRef.current = true;
                        void triggerPreviewChest(previewQuality);
                    }
                    return;
                }

                const websocket = new WebSocket(getDropsWidgetWebSocketUrl(token || ''));

                websocket.onopen = () => {
                    if (!isMounted) return;
                    ws.current = websocket;
                    setStatus('Ожидание события');
                };

                websocket.onmessage = (event: MessageEvent) => {
                    try {
                        const data = JSON.parse(event.data) as WebSocketMessage;
                        if (data.type === 'ping' && websocket.readyState === WebSocket.OPEN) {
                            websocket.send(JSON.stringify({ type: 'ping' }));
                            return;
                        }
                        if (data.type === 'drops' && data.event === 'reward_received' && data.data) {
                            void runRewardAnimation(data.data);
                            return;
                        }
                        if (data.type === 'drops' && data.event === 'mythical_session_started') {
                            void loadMythicalSession();
                            return;
                        }
                        if (data.type === 'drops' && data.event === 'mythical_session_ended') {
                            setMythicalSession(null);
                            setMythicalTimer(null);
                            clearMythicalTimer();
                        }
                    } catch (error) {
                        logger.error('Error parsing drops widget message:', error);
                    }
                };

                websocket.onclose = () => {
                    ws.current = null;
                    if (!isMounted) return;
                    setStatus('Переподключение...');
                    reconnectTimeout = window.setTimeout(() => void connect(), 3000);
                };

                websocket.onerror = () => logger.error('Drops widget WebSocket error');
            } catch (error) {
                logger.error('Error connecting drops widget:', error);
                if (isMounted) setStatus('Ошибка подключения к drops');
            }
        };

        void connect();

        mythicalIntervalRef.current = window.setInterval(() => {
            if (channelNameRef.current) {
                void loadMythicalSession(channelNameRef.current);
            }
        }, 10000);

        return () => {
            isMounted = false;
            if (reconnectTimeout !== null) window.clearTimeout(reconnectTimeout);
            if (ws.current) ws.current.close();
            if (mythicalIntervalRef.current !== null) window.clearInterval(mythicalIntervalRef.current);
            clearMythicalTimer();
        };
    }, [
        clearMythicalTimer,
        isPreviewMode,
        loadMythicalSession,
        previewQuality,
        previewRun,
        resolveWidgetContext,
        runRewardAnimation,
        token,
        triggerPreviewChest,
    ]);

    const currentQuality = (currentReward?.quality || currentReward?.quality_name || 'common').toLowerCase();
    const widgetFrameColor = widgetConfig.current.frame_color || '#ff8a00';
    const widgetTextColor = widgetConfig.current.text_color || '#ffffff';
    const widgetBackgroundColor = widgetConfig.current.background_color || '#120821';
    const widgetFontScale = widgetConfig.current.font_scale || 1;
    useEffect(() => {
        if (!isPreviewMode || autoPreviewStartedRef.current || phase !== 'idle') return;
        if (!PREVIEW_QUALITIES.has(previewQuality) || !previewRun) return;

        const timer = window.setTimeout(() => {
            autoPreviewStartedRef.current = true;
            void triggerPreviewChest(previewQuality);
        }, 350);
        return () => window.clearTimeout(timer);
    }, [isPreviewMode, phase, previewQuality, previewRun, triggerPreviewChest]);

    if (mythicalSession && mythicalTimer !== null && mythicalTimer > 0) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-transparent">
                <div className="rounded-[26px] border border-pink-400/35 bg-[#12071dcc] px-8 py-7 text-center text-white shadow-[0_24px_80px_rgba(236,72,153,0.22)] backdrop-blur-md">
                    <p className="text-xs uppercase tracking-[0.32em] text-pink-200/75">Мифический сундук</p>
                    <h2 className="mt-3 text-3xl font-semibold">Окно награды открыто</h2>
                    <p className="mt-3 text-base text-pink-100">Минимальный донат: {mythicalSession.donation_amount}₽</p>
                    <div className="mt-5 text-5xl font-bold tracking-[0.12em] text-amber-300">{formatTimer(mythicalTimer)}</div>
                </div>
            </div>
        );
    }

    if (phase === 'idle' || !currentReward) {
        return <div className={`fixed inset-0 ${idleBackground}`} data-drops-phase="idle" />;
    }

    return (
        <div className={`fixed inset-0 overflow-hidden ${idleBackground}`} data-drops-phase={phase}>
            <style>
                {`
                    @keyframes dropsPointerTick {
                        0%, 100% { transform: translateX(-50%) rotate(0deg); }
                        35% { transform: translateX(-50%) rotate(11deg); }
                        70% { transform: translateX(-50%) rotate(-7deg); }
                    }
                    @keyframes dropsChestPulse {
                        0%, 100% { transform: translateX(-50%); filter: brightness(1); }
                        50% { transform: translateX(-50%); filter: brightness(1.16) drop-shadow(0 0 18px rgba(255,255,255,0.28)); }
                    }
                    @keyframes dropsWinnerPulse {
                        0%, 100% { filter: brightness(1); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 rgba(255,255,255,0); }
                        50% { filter: brightness(1.18); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.55), 0 0 24px rgba(217,70,239,0.42); }
                    }
                `}
            </style>
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                <div className="relative mx-auto w-full max-w-[1120px] px-8">
                    <div
                        className={`pointer-events-none absolute left-1/2 top-[224px] z-40 h-0 w-0 -translate-x-1/2 border-l-[18px] border-r-[18px] border-t-[26px] border-l-transparent border-r-transparent ${
                            pointerKick ? '[animation:dropsPointerTick_120ms_ease-out]' : ''
                        }`}
                        style={{ borderTopColor: widgetFrameColor }}
                    />
                    <div
                        className="pointer-events-none absolute left-1/2 top-[250px] z-30 h-[170px] w-[3px] -translate-x-1/2 opacity-80"
                        style={{
                            background: `linear-gradient(to bottom, ${widgetFrameColor}, ${widgetFrameColor}, transparent)`,
                        }}
                    />

                    {phase === 'opening' ? (
                        <DropsWidgetOpeningStage
                            quality={currentQuality}
                            viewerName={currentReward.viewer_name}
                            frameColor={widgetFrameColor}
                        />
                    ) : (
                        <DropsWidgetReelStage
                            phase={phase}
                            quality={currentQuality}
                            reelItems={reelItems}
                            translateX={translateX}
                            winnerSlotIndex={WINNER_SLOT_INDEX}
                            frameColor={widgetFrameColor}
                            textColor={widgetTextColor}
                            backgroundColor={widgetBackgroundColor}
                            fontScale={widgetFontScale}
                        />
                    )}

                    {phase === 'result' ? (
                        <DropsWidgetResultPanel
                            reward={currentReward}
                            quality={currentQuality}
                            textColor={widgetTextColor}
                            fontScale={widgetFontScale}
                        />
                    ) : null}
                </div>
            </div>

        </div>
    );
};

export default DropsWidget;
