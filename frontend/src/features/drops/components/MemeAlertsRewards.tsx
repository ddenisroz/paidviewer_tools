import React, { useCallback, useEffect, useState } from 'react';

import { CheckCircle2, Gift, HandCoins, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useIntegrations } from '@/context/IntegrationsContext';
import { AutomationCard } from '@/features/drops/components/MemeAlertsAutomationCard';
import { parseMemeAlertsTokenPayload } from '@/features/drops/utils/memealertsToken';
import { cn } from '@/lib/utils';
import apiClient from '@/services/api/client';
import { MemeAlertsMark } from '@/shared/components/icons/FeatureMarks';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { SliderWithInput } from '@/shared/components/ui/slider-with-input';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { TooltipHelp } from '@/shared/components/ui/tooltip-help';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';

import type { AxiosError } from 'axios';

const MEMEALERTS_API_BASE = '/api/memealerts';
const POPUP_STATUS_POLL_MS = 2_000;
const POPUP_STATUS_TIMEOUT_MS = 120_000;
type MemeAlertsAuthProvider = 'twitch' | 'google' | 'vk';
type PopupAuthState = 'idle' | 'redirecting' | 'sign_in' | 'saving' | 'success' | 'error';

type MemeAlertsHistoryItem = {
    id?: string | number;
    user_name?: string;
    user_id?: string | number;
    created_at?: string;
    amount?: number;
    type?: string;
};

type PlatformRewardSettings = {
    enabled: boolean;
    reward_id: string | null;
    reward_title: string | null;
    coins_amount: number;
    reward_cost: number;
};

type MemeAlertsAutomationSettings = {
    points_reward: {
        twitch: PlatformRewardSettings;
        vk: PlatformRewardSettings;
    };
    donation_auto: {
        enabled: boolean;
        coins_per_currency: number;
        min_donation_amount: number;
    };
};

const DEFAULT_AUTOMATION_SETTINGS: MemeAlertsAutomationSettings = {
    points_reward: {
        twitch: {
            enabled: false,
            reward_id: null,
            reward_title: null,
            coins_amount: 10,
            reward_cost: 500,
        },
        vk: {
            enabled: false,
            reward_id: null,
            reward_title: null,
            coins_amount: 10,
            reward_cost: 500,
        },
    },
    donation_auto: {
        enabled: false,
        coins_per_currency: 1,
        min_donation_amount: 1,
    },
};

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const FIELD_CLASS = 'h-9 border-border/70 bg-card/70 text-foreground placeholder:text-muted-foreground';
const MUTED_PANEL_CLASS = 'rounded-lg border border-border/70 bg-background/45';
const PROVIDER_LABELS: Record<MemeAlertsAuthProvider, string> = {
    twitch: 'Twitch',
    google: 'Google',
    vk: 'VK',
};
const POPUP_STATE_LABELS: Record<PopupAuthState, string> = {
    idle: 'Ожидание',
    redirecting: 'Переход',
    sign_in: 'Вход',
    saving: 'Сохранение',
    success: 'Готово',
    error: 'Ошибка',
};
const POPUP_STATE_CLASS: Record<PopupAuthState, string> = {
    idle: 'border-border/70 bg-card/70 text-muted-foreground',
    redirecting: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    sign_in: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
    saving: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    error: 'border-red-500/30 bg-red-500/10 text-red-200',
};
const REWARD_SWITCH_VARIANT = {
    twitch: 'twitch',
    vk: 'vk',
} as const;

// The file still owns legacy MemeAlerts data flow; UI sections are extracted above to keep the page readable.

export const MemeAlertsRewards: React.FC = () => {
    const navigate = useNavigate();
    const { integrations } = useIntegrations();
    const donationAlertsConnected = !!integrations?.donationalerts?.enabled;

    const [statusLoading, setStatusLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [, setConnectionNote] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [activeProvider, setActiveProvider] = useState<MemeAlertsAuthProvider | null>(null);
    const [popupState, setPopupState] = useState<PopupAuthState>('idle');
    const [grantTarget, setGrantTarget] = useState('');
    const [grantValue, setGrantValue] = useState<number>(10);
    const [granting, setGranting] = useState(false);
    const [manualAuthUrl, setManualAuthUrl] = useState('');
    const [manualSubmitLoading, setManualSubmitLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTab, setHistoryTab] = useState<'grants' | 'purchases'>('grants');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [rewardCreating, setRewardCreating] = useState(false);
    const [selectedRewardPlatform, setSelectedRewardPlatform] = useState<'twitch' | 'vk'>('twitch');
    const [rewardTitle, setRewardTitle] = useState('MemeCoins');
    const [rewardCost, setRewardCost] = useState(500);
    const [rewardCoinsAmount, setRewardCoinsAmount] = useState(10);
    const [rewardCooldownSeconds, _setRewardCooldownSeconds] = useState(0);
    const [automationSettings, setAutomationSettings] =
        useState<MemeAlertsAutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);
    const [history, setHistory] = useState<{
        grants: MemeAlertsHistoryItem[];
        purchases: MemeAlertsHistoryItem[];
        unknown: MemeAlertsHistoryItem[];
    }>({
        grants: [],
        purchases: [],
        unknown: [],
    });
    const popupRef = React.useRef<Window | null>(null);
    const popupWatcherRef = React.useRef<number | null>(null);
    const popupWatcherStartedAtRef = React.useRef(0);
    const detachedPopupPollingRef = React.useRef(false);
    const statusPollingRef = React.useRef(false);
    const manualTokenInputRef = React.useRef<HTMLInputElement | null>(null);
    const lastPopupErrorToastRef = React.useRef<string | null>(null);

    const stopPopupWatcher = useCallback((clearPopup = true) => {
        if (popupWatcherRef.current !== null) {
            window.clearInterval(popupWatcherRef.current);
            popupWatcherRef.current = null;
        }
        popupWatcherStartedAtRef.current = 0;
        detachedPopupPollingRef.current = false;
        if (clearPopup) {
            popupRef.current = null;
        }
    }, []);

    const finishConnectFlow = useCallback(
        (nextState: PopupAuthState, note?: string | null) => {
            setPopupState(nextState);
            if (note !== undefined) {
                setConnectionNote(note);
            }
            if (nextState === 'error' && note) {
                if (lastPopupErrorToastRef.current !== note) {
                    toast.error(note);
                    lastPopupErrorToastRef.current = note;
                }
            } else if (nextState === 'success' || nextState === 'idle') {
                lastPopupErrorToastRef.current = null;
            }
            if (nextState === 'success' || nextState === 'error' || nextState === 'idle') {
                setConnecting(false);
            }
        },
        []
    );

    const checkStatus = useCallback(async (): Promise<boolean> => {
        try {
            const { data } = await apiClient.get(`${MEMEALERTS_API_BASE}/status`);
            const connected = Boolean(data.connected);
            setIsConnected(connected);
            setConnectionNote(data.reason || null);
            if (!connected) {
                setAutomationSettings(DEFAULT_AUTOMATION_SETTINGS);
            }
            return connected;
        } catch (error) {
            logger.error('Status check error', error);
            return false;
        } finally {
            setStatusLoading(false);
        }
    }, []);

    const startPopupWatcher = useCallback((detachedPopup = false) => {
        stopPopupWatcher(false);
        detachedPopupPollingRef.current = detachedPopup;
        popupWatcherStartedAtRef.current = Date.now();
        popupWatcherRef.current = window.setInterval(() => {
            if (Date.now() - popupWatcherStartedAtRef.current > POPUP_STATUS_TIMEOUT_MS) {
                stopPopupWatcher();
                finishConnectFlow(
                    'error',
                    'MemeAlerts не вернул подтверждение. Повторите вход или вставьте полную ссылку вручную.'
                );
                return;
            }
            if (statusPollingRef.current) return;
            statusPollingRef.current = true;
            void checkStatus()
                .then((connected) => {
                    if (connected) {
                        toast.success('MemeAlerts подключен');
                        if (popupRef.current && !popupRef.current.closed) {
                            popupRef.current.close();
                        }
                        stopPopupWatcher();
                        finishConnectFlow('success', null);
                        return;
                    }

                    const popup = popupRef.current;
                    if (!detachedPopupPollingRef.current && (!popup || popup.closed)) {
                        stopPopupWatcher();
                        finishConnectFlow('idle');
                    }
                })
                .finally(() => {
                    statusPollingRef.current = false;
                });
        }, POPUP_STATUS_POLL_MS);
    }, [checkStatus, finishConnectFlow, stopPopupWatcher]);

    const handleProxyAuthResult = useCallback(
        async (data: { ok?: boolean; status?: number; source?: string; detail?: string }) => {
            const connected = data.ok ? await checkStatus() : false;
            if (connected) {
                if (popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
                stopPopupWatcher();
                finishConnectFlow('success', null);
                toast.success('MemeAlerts подключен');
            } else if (data.ok === false) {
                const note = data.detail || 'MemeAlerts не подтвердил токен. Повторите подключение.';
                const popupStillOpen = !!popupRef.current && !popupRef.current.closed;
                finishConnectFlow('error', note);
                if (!popupStillOpen) {
                    stopPopupWatcher(false);
                }
            }
        },
        [checkStatus, finishConnectFlow, stopPopupWatcher]
    );

    useEffect(() => {
        void checkStatus();
    }, [checkStatus]);

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const { data } = await apiClient.get(`${MEMEALERTS_API_BASE}/history`, {
                params: { limit: 50 },
            });
            setHistory({
                grants: data.grants || [],
                purchases: data.purchases || [],
                unknown: data.unknown || [],
            });
        } catch (error) {
            logger.error('History load error', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchSettings = useCallback(async () => {
        if (!isConnected) return;
        try {
            setSettingsLoading(true);
            const { data } = await apiClient.get(`${MEMEALERTS_API_BASE}/settings`);
            if (data?.success && data?.settings) {
                setAutomationSettings(data.settings as MemeAlertsAutomationSettings);
            } else {
                setAutomationSettings(DEFAULT_AUTOMATION_SETTINGS);
            }
        } catch (error) {
            logger.error('MemeAlerts settings load error', error);
        } finally {
            setSettingsLoading(false);
        }
    }, [isConnected]);

    const saveSettingsPatch = useCallback(async (payload: Record<string, unknown>) => {
        try {
            setSettingsSaving(true);
            const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/settings`, payload);
            if (!data?.success) {
                throw new Error(data?.detail || data?.error || 'Не удалось сохранить настройки');
            }
            setAutomationSettings(data.settings as MemeAlertsAutomationSettings);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ошибка сохранения';
            toast.error(message);
            return false;
        } finally {
            setSettingsSaving(false);
        }
    }, []);

    const handleCreatePointsReward = useCallback(async () => {
        try {
            if (selectedRewardPlatform === 'twitch' && !integrations?.twitch?.enabled) {
                toast.error('Сначала подключите Twitch интеграцию');
                return;
            }
            if (selectedRewardPlatform === 'vk' && !integrations?.vk?.enabled) {
                toast.error('Сначала подключите VK Live интеграцию');
                return;
            }

            setRewardCreating(true);
            const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/rewards/create`, {
                platform: selectedRewardPlatform,
                title: rewardTitle,
                cost: rewardCost,
                coins_amount: rewardCoinsAmount,
                cooldown_seconds: rewardCooldownSeconds,
            });
            if (!data?.success) {
                throw new Error(data?.detail || data?.error || 'Не удалось создать награду');
            }
            toast.success(`Награда ${selectedRewardPlatform.toUpperCase()} создана`);
            if (data?.data?.settings) {
                setAutomationSettings((prev) => ({
                    ...prev,
                    points_reward: {
                        ...prev.points_reward,
                        [selectedRewardPlatform]: data.data.settings as PlatformRewardSettings,
                    } as MemeAlertsAutomationSettings['points_reward'],
                }));
            } else {
                await fetchSettings();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ошибка создания награды';
            toast.error(message);
        } finally {
            setRewardCreating(false);
        }
    }, [
        fetchSettings,
        integrations?.twitch?.enabled,
        integrations?.vk?.enabled,
        rewardCoinsAmount,
        rewardCooldownSeconds,
        rewardCost,
        rewardTitle,
        selectedRewardPlatform,
    ]);

    const saveTokenToBackend = useCallback(async (accessToken: string, refreshToken?: string, streamerId?: string) => {
        try {
            const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/connect`, {
                access_token: accessToken,
                refresh_token: refreshToken,
                streamer_id: streamerId,
            });

            if (data.success && data.connected) {
                setIsConnected(true);
                finishConnectFlow('success', null);
                toast.success('MemeAlerts подключен!', {
                    description: 'Теперь вы можете выдавать мемкоины',
                });
                return true;
            } else {
                const message = data.detail || data.error || 'MemeAlerts не подтвердил токен';
                finishConnectFlow('error', message);
                toast.error(message, {
                    description: 'Токен не сохранен',
                });
                return false;
            }
        } catch (error) {
            const axiosError = error as AxiosError<{ detail?: string; error?: string }>;
            const backendMessage = axiosError.response?.data?.detail || axiosError.response?.data?.error;
            const message =
                axiosError.response?.status === 400
                    ? backendMessage || 'Токен MemeAlerts пока не готов. Завершите вход в окне авторизации и повторите попытку.'
                    : backendMessage || 'Ошибка сети при сохранении токена';
            finishConnectFlow('error', message);
            toast.error(message);
            return false;
        }
    }, [finishConnectFlow]);

    // Listen for postMessage from the proxy popup with the extracted token.
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (popupRef.current && event.source !== popupRef.current) return;
            if (!event?.data || typeof event.data !== 'object') return;

            // Accept both old format and new typed format from the proxy script.
            const data = event.data as {
                type?: string;
                state?: PopupAuthState;
                provider?: MemeAlertsAuthProvider;
                access_token?: string;
                refresh_token?: string;
                streamer_id?: string;
                ok?: boolean;
                status?: number;
                source?: string;
                detail?: string;
            };

            if (data.type === 'memealerts_auth_state' && data.state) {
                if (data.provider) {
                    setActiveProvider(data.provider);
                }
                finishConnectFlow(
                    data.state,
                    data.state === 'error' ? data.detail || null : data.state === 'success' ? null : undefined
                );
                return;
            }

            if (data.type === 'memealerts_token' && data.access_token) {
                setPopupState('saving');
                setConnecting(true);
                const success = await saveTokenToBackend(data.access_token, data.refresh_token, data.streamer_id);
                if (success && popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
                stopPopupWatcher();
            } else if (data.access_token && !data.type) {
                // Legacy format - keep backward compatibility.
                setPopupState('saving');
                const success = await saveTokenToBackend(data.access_token, data.refresh_token, data.streamer_id);
                if (success && popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
                stopPopupWatcher();
            } else if (data.type === 'memealerts_proxy_result') {
                await handleProxyAuthResult(data);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            stopPopupWatcher();
        };
    }, [finishConnectFlow, handleProxyAuthResult, saveTokenToBackend, stopPopupWatcher]);

    useEffect(() => {
        if (!('BroadcastChannel' in window)) return undefined;

        const channel = new BroadcastChannel('memealerts-auth');
        channel.onmessage = (event) => {
            const data = event?.data as
                | {
                      type?: string;
                      state?: PopupAuthState;
                      provider?: MemeAlertsAuthProvider;
                      ok?: boolean;
                      status?: number;
                      source?: string;
                      access_token?: string;
                      refresh_token?: string;
                      streamer_id?: string;
                      detail?: string;
                  }
                | undefined;
            if (data?.type === 'memealerts_auth_state' && data.state) {
                if (data.provider) {
                    setActiveProvider(data.provider);
                }
                finishConnectFlow(
                    data.state,
                    data.state === 'error' ? data.detail || null : data.state === 'success' ? null : undefined
                );
                return;
            }

            if (data?.type === 'memealerts_token' && data.access_token) {
                setPopupState('saving');
                setConnecting(true);
                void saveTokenToBackend(data.access_token, data.refresh_token, data.streamer_id).then((success) => {
                    if (success && popupRef.current && !popupRef.current.closed) {
                        popupRef.current.close();
                    }
                    stopPopupWatcher();
                });
            } else if (data?.type === 'memealerts_proxy_result') {
                void handleProxyAuthResult(data);
            }
        };

        return () => {
            channel.close();
        };
    }, [finishConnectFlow, handleProxyAuthResult, saveTokenToBackend, stopPopupWatcher]);

    useEffect(() => {
        if (isConnected) {
            fetchHistory();
            fetchSettings();
        }
    }, [fetchSettings, isConnected]);

    useEffect(() => {
        if (historyTab === 'grants' && history.grants.length === 0 && history.purchases.length > 0) {
            setHistoryTab('purchases');
        }
    }, [history.grants.length, history.purchases.length, historyTab]);

    useEffect(() => {
        const platformSettings = automationSettings.points_reward[selectedRewardPlatform];
        setRewardTitle(
            platformSettings.reward_title || (selectedRewardPlatform === 'twitch' ? 'MemeCoins' : 'Награда MemeCoins')
        );
        setRewardCost(platformSettings.reward_cost || 500);
        setRewardCoinsAmount(platformSettings.coins_amount || 10);
    }, [automationSettings.points_reward, selectedRewardPlatform]);

    const handleConnect = useCallback((provider: MemeAlertsAuthProvider) => {
        setConnecting(true);
        setActiveProvider(provider);
        finishConnectFlow('redirecting', null);
        stopPopupWatcher();

        const redirectUrl = getSafeNavigationUrl(
            `/api/memealerts/connect-redirect?provider=${encodeURIComponent(provider)}`
        );
        if (!redirectUrl) {
            toast.error('Не удалось открыть MemeAlerts');
            finishConnectFlow('error', 'Не удалось открыть окно авторизации MemeAlerts.');
            return;
        }

        const popupWidth = 540;
        const popupHeight = 760;
        const left = window.screenX + Math.max(0, Math.round((window.outerWidth - popupWidth) / 2));
        const top = window.screenY + Math.max(0, Math.round((window.outerHeight - popupHeight) / 2));
        const features = [
            `width=${popupWidth}`,
            `height=${popupHeight}`,
            `left=${left}`,
            `top=${top}`,
            'resizable=yes',
            'scrollbars=yes',
        ].join(',');

        const popup = window.open('', 'memealerts-auth', features);
        if (popup) {
            popupRef.current = popup;
            startPopupWatcher();
            popup.location.href = redirectUrl;
            popup.focus();
            return;
        }

        startPopupWatcher(true);
        window.location.assign(redirectUrl);
    }, [finishConnectFlow, startPopupWatcher, stopPopupWatcher]);

    const handleDisconnect = async () => {
        try {
            setConnecting(true);
            const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/disconnect`);
            if (data.success) {
                setIsConnected(false);
                setPopupState('idle');
                setActiveProvider(null);
                setConnectionNote(null);
                setAutomationSettings(DEFAULT_AUTOMATION_SETTINGS);
                toast.success('MemeAlerts отключен');
            }
        } catch (error) {
            logger.error('Disconnect error', error);
        } finally {
            setConnecting(false);
        }
    };

    const handleManualTokenApply = useCallback(async () => {
        const rawValue = (manualAuthUrl || manualTokenInputRef.current?.value || '').trim();
        if (rawValue && rawValue !== manualAuthUrl) {
            setManualAuthUrl(rawValue);
        }
        const parsed = parseMemeAlertsTokenPayload(rawValue);
        if (!parsed.accessToken) {
            toast.error('Не найден access token', {
                description: 'Вставьте полную ссылку из окна MemeAlerts после авторизации',
            });
            return;
        }

        try {
            setManualSubmitLoading(true);
            const success = await saveTokenToBackend(parsed.accessToken, parsed.refreshToken, parsed.streamerId);
            if (success) {
                setManualAuthUrl('');
                if (popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
                stopPopupWatcher();
                setConnecting(false);
            }
        } finally {
            setManualSubmitLoading(false);
        }
    }, [manualAuthUrl, saveTokenToBackend, stopPopupWatcher]);

    const handleGrant = async () => {
        if (!grantTarget || !grantValue) {
            toast.error('Укажите никнейм/ID и количество монет');
            return;
        }

        try {
            setGranting(true);
            const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/grant`, {
                nickname: grantTarget,
                value: grantValue,
            });

            if (data.success) {
                toast.success(`Отправлено ${grantValue} монет пользователю ${grantTarget}`, {
                    description: 'Монеты выданы!',
                });
                fetchHistory();
            } else {
                toast.error(data.error || 'Не удалось выдать монеты', {
                    description: 'Ошибка',
                });
            }
        } catch {
            toast.error('Ошибка связи с сервером');
        } finally {
            setGranting(false);
        }
    };

    const handleToggleRewardPlatform = async (platform: 'twitch' | 'vk', enabled: boolean) => {
        const success = await saveSettingsPatch({
            [platform]: {
                enabled,
            },
        });
        if (success) {
            toast.success(enabled ? `Автовыдача по ${platform} включена` : `Автовыдача по ${platform} отключена`);
        }
    };

    const handleSaveDonationAuto = async () => {
        if (automationSettings.donation_auto.enabled && !donationAlertsConnected) {
            toast.error('Подключите DonationAlerts перед включением автоконвертации');
            return;
        }

        const success = await saveSettingsPatch({
            donation_auto: {
                enabled: automationSettings.donation_auto.enabled,
                coins_per_currency: automationSettings.donation_auto.coins_per_currency,
                min_donation_amount: automationSettings.donation_auto.min_donation_amount,
            },
        });
        if (success) {
            toast.success('Настройки донатов сохранены');
        }
    };

    const formatTimestamp = (value?: string) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString('ru-RU', { hour12: false });
    };

    const formatAmount = (value?: number | null) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return '0';
        return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
    };

    const currentRewardSettings = automationSettings.points_reward[selectedRewardPlatform];
    const selectedPlatformConnected =
        selectedRewardPlatform === 'twitch' ? !!integrations?.twitch?.enabled : !!integrations?.vk?.enabled;
    const selectedPlatformName = selectedRewardPlatform === 'twitch' ? 'Twitch' : 'VK Live';
    const rewardIdLabel = currentRewardSettings.reward_id || 'награда ещё не создана';
    const activeProviderLabel = activeProvider ? PROVIDER_LABELS[activeProvider] : 'MemeAlerts';

    if (statusLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                    <MemeAlertsMark className="h-9 w-9 text-lg" />
                    <div className="min-w-0">
                        <p className="font-brand text-sm font-bold tracking-wide text-foreground">MemeAlerts</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${isConnected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}
                    >
                        {isConnected ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                            <XCircle className="h-3.5 w-3.5" />
                        )}
                        {isConnected ? 'Токен активен' : 'Токен не подключен'}
                    </div>
                    {isConnected && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDisconnect}
                            disabled={connecting}
                            className="h-8 border-border/70 bg-card/70 hover:bg-accent"
                        >
                            {connecting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Отключить
                        </Button>
                    )}
                </div>
            </div>

            {!isConnected ? (
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="space-y-3 p-4">
                        <Button
                            type="button"
                            onClick={() => handleConnect('twitch')}
                            disabled={connecting}
                            className="h-11 w-full rounded-lg bg-blue-700 text-sm font-bold text-white hover:bg-blue-800 sm:w-auto sm:px-5"
                        >
                            {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Подключить MemeAlerts
                        </Button>

                        {(connecting || popupState !== 'idle') && popupState !== 'error' && (
                            <div
                                className={cn(
                                    'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                                    POPUP_STATE_CLASS[popupState]
                                )}
                            >
                                {popupState !== 'success' ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                <span className="font-medium">{activeProviderLabel}</span>
                                <span>{POPUP_STATE_LABELS[popupState]}</span>
                            </div>
                        )}

                        <details className={cn(MUTED_PANEL_CLASS, 'p-3')}>
                            <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground">
                                Резервный ввод
                            </summary>
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs">Ссылка после входа</Label>
                                    <TooltipHelp content="Нужно только если окно MemeAlerts не передало токен автоматически." />
                                </div>
                                <Input
                                    ref={manualTokenInputRef}
                                    value={manualAuthUrl}
                                    onChange={(e) => setManualAuthUrl(e.target.value)}
                                    placeholder="https://memealerts.com/auth/redirect?accessToken=..."
                                    className={FIELD_CLASS}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleManualTokenApply}
                                    disabled={manualSubmitLoading || !manualAuthUrl.trim()}
                                    className="h-8 w-full border-border/70 bg-card/70 hover:bg-accent"
                                >
                                    {manualSubmitLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                                    Применить
                                </Button>
                            </div>
                        </details>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
                    <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            <AutomationCard icon={HandCoins} title="Ручная выдача">
                                <Input
                                    placeholder="nickname или 12345"
                                    value={grantTarget}
                                    onChange={(e) => setGrantTarget(e.target.value)}
                                    className={FIELD_CLASS}
                                />
                                <SliderWithInput
                                    value={grantValue}
                                    onChange={setGrantValue}
                                    min={1}
                                    max={500}
                                    step={1}
                                    unit="coins"
                                    inputWidth={86}
                                    ariaLabel="Количество мемкоинов для ручной выдачи"
                                />
                                <Button
                                    onClick={handleGrant}
                                    disabled={granting}
                                    className="h-9 w-full bg-blue-700 text-white hover:bg-blue-800"
                                >
                                    {granting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Выдать
                                </Button>
                            </AutomationCard>

                            <AutomationCard icon={Gift} title="Награда за баллы">
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedRewardPlatform('twitch')}
                                        className={cn(
                                            'h-8 border-border/70',
                                            selectedRewardPlatform === 'twitch'
                                                ? 'border-[#9146FF] bg-[#9146FF] text-white hover:bg-[#7f3ee8]'
                                                : 'bg-card/70 hover:bg-accent'
                                        )}
                                    >
                                        Twitch
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedRewardPlatform('vk')}
                                        className={cn(
                                            'h-8 border-border/70',
                                            selectedRewardPlatform === 'vk'
                                                ? 'border-[#FF4444] bg-[#FF4444] text-white hover:bg-[#e13d3d]'
                                                : 'bg-card/70 hover:bg-accent'
                                        )}
                                    >
                                        VK Live
                                    </Button>
                                </div>

                                {!selectedPlatformConnected && (
                                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                                        Подключите {selectedPlatformName}, чтобы создать награду.
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs">Название</Label>
                                        <TooltipHelp content="Это название увидит зритель в наградах канала." />
                                    </div>
                                    <Input
                                        value={rewardTitle}
                                        onChange={(e) => setRewardTitle(e.target.value)}
                                        className={FIELD_CLASS}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Цена награды</Label>
                                        <SliderWithInput
                                            value={rewardCost}
                                            onChange={setRewardCost}
                                            min={1}
                                            max={10000}
                                            step={1}
                                            inputWidth={88}
                                            ariaLabel="Цена награды"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Мемкоины за покупку</Label>
                                        <SliderWithInput
                                            value={rewardCoinsAmount}
                                            onChange={setRewardCoinsAmount}
                                            min={1}
                                            max={1000}
                                            step={1}
                                            inputWidth={88}
                                            ariaLabel="Мемкоины за покупку награды"
                                        />
                                    </div>
                                </div>

                                <div className={cn(MUTED_PANEL_CLASS, 'space-y-2 p-2.5')}>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs text-foreground">
                                            Автовыдача {selectedPlatformName}
                                        </span>
                                        <Switch
                                            variant={REWARD_SWITCH_VARIANT[selectedRewardPlatform]}
                                            checked={currentRewardSettings.enabled}
                                            onCheckedChange={(checked) =>
                                                handleToggleRewardPlatform(selectedRewardPlatform, checked)
                                            }
                                            disabled={settingsSaving || !selectedPlatformConnected}
                                        />
                                    </div>
                                    <p className="truncate text-[11px] text-muted-foreground">{rewardIdLabel}</p>
                                </div>

                                <Button
                                    onClick={handleCreatePointsReward}
                                    disabled={rewardCreating || settingsLoading || !selectedPlatformConnected}
                                    className="h-9 w-full bg-blue-700 text-white hover:bg-blue-800"
                                >
                                    {rewardCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Создать или обновить
                                </Button>
                            </AutomationCard>

                            <AutomationCard
                                icon={MemeAlertsMark}
                                title="Кэшбек за донаты"
                                disabled={!donationAlertsConnected}
                            >
                                <div
                                    className={cn(
                                        MUTED_PANEL_CLASS,
                                        'flex items-center justify-between gap-3 px-3 py-2'
                                    )}
                                >
                                    <span className="text-xs text-foreground">Автоконвертация</span>
                                    <Switch
                                        variant="donation"
                                        checked={automationSettings.donation_auto.enabled}
                                        onCheckedChange={(checked) => {
                                            if (checked && !donationAlertsConnected) {
                                                toast.error(
                                                    'Подключите DonationAlerts перед включением автоконвертации'
                                                );
                                                return;
                                            }
                                            setAutomationSettings((prev) => ({
                                                ...prev,
                                                donation_auto: { ...prev.donation_auto, enabled: checked },
                                            }));
                                        }}
                                        disabled={!donationAlertsConnected && !automationSettings.donation_auto.enabled}
                                    />
                                </div>

                                {!donationAlertsConnected && (
                                    <div className="space-y-2 rounded-lg border border-orange-500/25 bg-orange-500/10 p-2.5">
                                        <p className="text-xs text-orange-200">
                                            DonationAlerts не подключен. Кэшбек включится после подключения интеграции.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate('/dashboard/settings?focus=donationalerts')}
                                            className="h-8 w-full border-orange-500/35 bg-orange-500/10 text-orange-100 hover:bg-orange-500/15"
                                        >
                                            Подключить DA
                                        </Button>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs">Курс</Label>
                                        <TooltipHelp content="Сколько мемкоинов начислять за 1 единицу доната." />
                                    </div>
                                    <SliderWithInput
                                        value={automationSettings.donation_auto.coins_per_currency}
                                        onChange={(value) =>
                                            setAutomationSettings((prev) => ({
                                                ...prev,
                                                donation_auto: { ...prev.donation_auto, coins_per_currency: value },
                                            }))
                                        }
                                        min={0.01}
                                        max={100}
                                        step={0.01}
                                        inputWidth={86}
                                        ariaLabel="Курс мемкоинов за донат"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Мин. донат</Label>
                                    <SliderWithInput
                                        value={automationSettings.donation_auto.min_donation_amount}
                                        onChange={(value) =>
                                            setAutomationSettings((prev) => ({
                                                ...prev,
                                                donation_auto: { ...prev.donation_auto, min_donation_amount: value },
                                            }))
                                        }
                                        min={0}
                                        max={5000}
                                        step={1}
                                        inputWidth={86}
                                        ariaLabel="Минимальная сумма доната"
                                    />
                                </div>

                                <Button
                                    onClick={handleSaveDonationAuto}
                                    disabled={
                                        settingsSaving ||
                                        (!donationAlertsConnected && !automationSettings.donation_auto.enabled)
                                    }
                                    className="h-9 w-full bg-blue-700 text-white hover:bg-blue-800"
                                >
                                    {settingsSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Сохранить
                                </Button>
                            </AutomationCard>
                        </div>
                    </div>

                    <Card className={`${SURFACE_CARD_CLASS} h-fit`}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle className="text-base">История</CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchHistory}
                                    disabled={historyLoading}
                                    className="h-8 border-border/70 bg-card/70 hover:bg-accent"
                                >
                                    <RefreshCw
                                        className={`mr-2 h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`}
                                    />
                                    Обновить
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Tabs
                                value={historyTab}
                                onValueChange={(value) => setHistoryTab(value as 'grants' | 'purchases')}
                            >
                                <TabsList className="grid h-8 w-full grid-cols-2 rounded-none border-b border-border bg-transparent p-0">
                                    <TabsTrigger
                                        value="grants"
                                        className="rounded-none border-b-2 border-transparent text-xs data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-sky-300"
                                    >
                                        Выдачи ({history.grants.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="purchases"
                                        className="rounded-none border-b-2 border-transparent text-xs data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-sky-300"
                                    >
                                        Покупки ({history.purchases.length})
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="grants" className="mt-3">
                                    <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                                        {history.grants.length === 0 && (
                                            <p className="rounded-lg border border-border/70 bg-card/60 px-3 py-4 text-xs text-muted-foreground">
                                                Выдач пока нет.
                                            </p>
                                        )}
                                        {history.grants.map((item, index) => (
                                            <div
                                                key={`${item.id || index}`}
                                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {item.user_name || item.user_id || 'Пользователь'}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {formatTimestamp(item.created_at)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-emerald-300">
                                                        +{formatAmount(item.amount)}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {item.type || 'grant'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                                <TabsContent value="purchases" className="mt-3">
                                    <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                                        {history.purchases.length === 0 && (
                                            <p className="rounded-lg border border-border/70 bg-card/60 px-3 py-4 text-xs text-muted-foreground">
                                                Покупок пока нет.
                                            </p>
                                        )}
                                        {history.purchases.map((item, index) => (
                                            <div
                                                key={`${item.id || index}`}
                                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {item.user_name || item.user_id || 'Пользователь'}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {formatTimestamp(item.created_at)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-violet-300">
                                                        {formatAmount(item.amount)}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {item.type || 'purchase'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
