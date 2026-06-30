import React, { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';

import { useIntegrations } from '@/context/IntegrationsContext';
import { MemeAlertsConfiguredRewards } from '@/features/drops/components/MemeAlertsConfiguredRewards';
import { MemeAlertsConnectPanel } from '@/features/drops/components/MemeAlertsConnectPanel';
import { MemeAlertsDonationCard } from '@/features/drops/components/MemeAlertsDonationCard';
import { MemeAlertsGrantCard } from '@/features/drops/components/MemeAlertsGrantCard';
import { MemeAlertsHeader } from '@/features/drops/components/MemeAlertsHeader';
import { MemeAlertsHistoryCard } from '@/features/drops/components/MemeAlertsHistoryCard';
import { MemeAlertsPlatformRewardCard } from '@/features/drops/components/MemeAlertsPlatformRewardCard';
import {
    DEFAULT_AUTOMATION_SETTINGS,
    MEMEALERTS_API_BASE,
    MEMEALERTS_PROVIDER_LABELS,
    POPUP_STATUS_POLL_MS,
    POPUP_STATUS_TIMEOUT_MS,
    getDonationCourseRub,
    normalizeAutomationSettings,
    type MemeAlertsAuthProvider,
    type MemeAlertsAutomationSettings,
    type MemeAlertsBalanceItem,
    type MemeAlertsConnectionInfo,
    type MemeAlertsHistoryItem,
    type MemeAlertsProxyState,
    type PlatformRewardSettings,
    type PopupAuthState,
} from '@/features/drops/components/memealertsTypes';
import apiClient from '@/services/api/client';
import { integrationsService } from '@/services/api/services/integrationsService';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';
import { normalizeDateInput } from '@/shared/utils/dateTime';

import type { AxiosError } from 'axios';
import type { PlatformReward } from '@/types';

export const MemeAlertsRewards: React.FC = () => {
    const { integrations } = useIntegrations();
    const donationAlertsConnected = !!integrations?.donationalerts?.enabled;

    const [statusLoading, setStatusLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionInfo, setConnectionInfo] = useState<MemeAlertsConnectionInfo | null>(null);
    const [, setConnectionNote] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [connectingProvider, setConnectingProvider] = useState<MemeAlertsAuthProvider | null>(null);
    const [popupState, setPopupState] = useState<PopupAuthState>('idle');
    const [grantTarget, setGrantTarget] = useState('');
    const [grantValue, setGrantValue] = useState<number>(10);
    const [granting, setGranting] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [balancesLoading, setBalancesLoading] = useState(false);
    const [balancesError, setBalancesError] = useState<string | null>(null);
    const [balances, setBalances] = useState<MemeAlertsBalanceItem[]>([]);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [donationAuthStarted, setDonationAuthStarted] = useState(false);
    const [rewardCreating, setRewardCreating] = useState(false);
    const [rewardDeletingId, setRewardDeletingId] = useState<string | null>(null);
    const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
    const [selectedRewardPlatform, setSelectedRewardPlatform] = useState<'twitch' | 'vk'>('twitch');
    const [rewardTitle, setRewardTitle] = useState('MemeCoins');
    const [rewardCost, setRewardCost] = useState(500);
    const [rewardCoinsAmount, setRewardCoinsAmount] = useState(10);
    const [automationSettings, setAutomationSettings] =
        useState<MemeAlertsAutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);
    const [history, setHistory] = useState<{
        history: MemeAlertsHistoryItem[];
        localGrants: MemeAlertsHistoryItem[];
        unknown: MemeAlertsHistoryItem[];
    }>({
        history: [],
        localGrants: [],
        unknown: [],
    });
    const popupRef = React.useRef<Window | null>(null);
    const popupWatcherRef = React.useRef<number | null>(null);
    const popupWatcherStartedAtRef = React.useRef(0);
    const detachedPopupPollingRef = React.useRef(false);
    const statusPollingRef = React.useRef(false);
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

    const finishConnectFlow = useCallback((nextState: PopupAuthState, note?: string | null) => {
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
            setConnectingProvider(null);
        }
    }, []);

    const checkStatus = useCallback(async (): Promise<boolean> => {
        try {
            const { data } = await apiClient.get(`${MEMEALERTS_API_BASE}/status`);
            const connected = Boolean(data.connected);
            setIsConnected(connected);
            setConnectionInfo(
                connected
                    ? {
                          authProvider: data.auth_provider || null,
                          streamerId: data.streamer_id || data.platform_user_id || null,
                          tokenId: data.token_id || null,
                      }
                    : null
            );
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

    const startPopupWatcher = useCallback(
        (detachedPopup = false) => {
            stopPopupWatcher(false);
            detachedPopupPollingRef.current = detachedPopup;
            popupWatcherStartedAtRef.current = Date.now();
            popupWatcherRef.current = window.setInterval(() => {
                if (Date.now() - popupWatcherStartedAtRef.current > POPUP_STATUS_TIMEOUT_MS) {
                    stopPopupWatcher();
                    finishConnectFlow(
                        'error',
                        'Страница авторизации MemeAlerts не вернула токен. Повторите подключение.'
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
        },
        [checkStatus, finishConnectFlow, stopPopupWatcher]
    );

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

    const handleAuthStateMessage = useCallback(
        (data: { state?: MemeAlertsProxyState; ok?: boolean; detail?: string }) => {
            if (!data.state) return;

            if (data.state === 'token_found' || data.state === 'connect_posted') {
                finishConnectFlow(
                    data.ok === false ? 'error' : 'saving',
                    data.ok === false ? data.detail || null : null
                );
                return;
            }

            if (data.state === 'storage_scanned') {
                if (popupState === 'idle' || popupState === 'redirecting') {
                    finishConnectFlow('sign_in', null);
                }
                return;
            }

            if (data.state === 'proxy_timeout') {
                finishConnectFlow('error', data.detail || 'MemeAlerts auth proxy timeout');
                return;
            }

            finishConnectFlow(
                data.state,
                data.state === 'error' ? data.detail || null : data.state === 'success' ? null : undefined
            );
        },
        [finishConnectFlow, popupState]
    );

    useEffect(() => {
        void checkStatus();
    }, [checkStatus]);

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            setHistoryError(null);
            const { data } = await apiClient.get(`${MEMEALERTS_API_BASE}/history`, {
                params: { limit: 50 },
            });
            const payload = data?.data && typeof data.data === 'object' ? data.data : data;
            setHistory({
                history: payload.history || payload.purchases || [],
                localGrants: payload.local_grants || payload.grants || [],
                unknown: payload.unknown || [],
            });
        } catch (error) {
            logger.error('History load error', error);
            setHistoryError('Не удалось загрузить историю MemeAlerts');
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchBalances = useCallback(async () => {
        try {
            setBalancesLoading(true);
            setBalancesError(null);
            const { data } = await apiClient.get(`${MEMEALERTS_API_BASE}/balances`, {
                params: { limit: 200 },
            });
            const payload = data?.data && typeof data.data === 'object' ? data.data : data;
            setBalances(Array.isArray(payload?.balances) ? payload.balances : []);
        } catch (error) {
            logger.error('MemeAlerts balances load error', error);
            const axiosError = error as AxiosError<{ detail?: string; error?: string }>;
            setBalancesError(
                axiosError.response?.data?.detail ||
                    axiosError.response?.data?.error ||
                    'Не удалось загрузить баланс мемкоинов'
            );
        } finally {
            setBalancesLoading(false);
        }
    }, []);

    const fetchSettings = useCallback(async () => {
        if (!isConnected) return;
        try {
            setSettingsLoading(true);
            const { data } = await apiClient.get(`${MEMEALERTS_API_BASE}/settings`);
            if (data?.success && data?.settings) {
                setAutomationSettings(normalizeAutomationSettings(data.settings));
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
            setAutomationSettings(normalizeAutomationSettings(data.settings));
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
                local_id: editingRewardId || undefined,
                platform: selectedRewardPlatform,
                title: rewardTitle,
                cost: rewardCost,
                coins_amount: rewardCoinsAmount,
                cooldown_seconds: 0,
            });
            if (!data?.success) {
                throw new Error(data?.detail || data?.error || 'Не удалось создать награду');
            }
            toast.success(editingRewardId ? 'Награда обновлена' : 'Награда создана');
            setEditingRewardId(null);
            if (data?.data?.all_settings) {
                setAutomationSettings(normalizeAutomationSettings(data.data.all_settings));
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
        editingRewardId,
        integrations?.twitch?.enabled,
        integrations?.vk?.enabled,
        rewardCoinsAmount,
        rewardCost,
        rewardTitle,
        selectedRewardPlatform,
    ]);

    const handleAttachPointsReward = useCallback(
        async (reward: PlatformReward) => {
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
                const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/rewards/attach`, {
                    local_id: editingRewardId || undefined,
                    platform: selectedRewardPlatform,
                    reward_id: String(reward.id),
                    coins_amount: rewardCoinsAmount,
                });
                if (!data?.success) {
                    throw new Error(data?.detail || data?.error || 'Не удалось привязать награду');
                }
                toast.success('Награда привязана');
                setEditingRewardId(null);
                if (data?.data?.all_settings) {
                    setAutomationSettings(normalizeAutomationSettings(data.data.all_settings));
                } else {
                    await fetchSettings();
                }
            } catch (error) {
                const axiosError = error as AxiosError<{ detail?: string; error?: string }>;
                const message =
                    axiosError.response?.data?.detail ||
                    axiosError.response?.data?.error ||
                    (error instanceof Error ? error.message : 'Ошибка привязки награды');
                toast.error(message);
            } finally {
                setRewardCreating(false);
            }
        },
        [
            editingRewardId,
            fetchSettings,
            integrations?.twitch?.enabled,
            integrations?.vk?.enabled,
            rewardCoinsAmount,
            selectedRewardPlatform,
        ]
    );

    const saveTokenToBackend = useCallback(
        async (accessToken: string, refreshToken?: string, streamerId?: string) => {
            try {
                const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/connect`, {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    streamer_id: streamerId,
                    auth_provider: connectingProvider,
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
                        ? backendMessage ||
                          'Токен MemeAlerts пока не готов. Завершите вход в окне авторизации и повторите попытку.'
                        : backendMessage || 'Ошибка сети при сохранении токена';
                finishConnectFlow('error', message);
                toast.error(message);
                return false;
            }
        },
        [connectingProvider, finishConnectFlow]
    );

    // Listen for postMessage from the proxy popup with the extracted token.
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (popupRef.current && event.source !== popupRef.current) return;
            if (!event?.data || typeof event.data !== 'object') return;

            // Accept both old format and new typed format from the proxy script.
            const data = event.data as {
                type?: string;
                state?: MemeAlertsProxyState;
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
                handleAuthStateMessage(data);
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
    }, [handleAuthStateMessage, handleProxyAuthResult, saveTokenToBackend, stopPopupWatcher]);

    useEffect(() => {
        if (!('BroadcastChannel' in window)) return undefined;

        const channel = new BroadcastChannel('memealerts-auth');
        channel.onmessage = (event) => {
            const data = event?.data as
                | {
                      type?: string;
                      state?: MemeAlertsProxyState;
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
                handleAuthStateMessage(data);
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
    }, [handleAuthStateMessage, handleProxyAuthResult, saveTokenToBackend, stopPopupWatcher]);

    useEffect(() => {
        if (isConnected) {
            fetchHistory();
            void fetchBalances();
            fetchSettings();
        }
    }, [fetchBalances, fetchSettings, isConnected]);

    useEffect(() => {
        const platformSettings = editingRewardId
            ? automationSettings.points_rewards.find((item) => item.local_id === editingRewardId)
            : undefined;
        setRewardTitle(
            platformSettings?.reward_title || (selectedRewardPlatform === 'twitch' ? 'MemeCoins' : 'Награда MemeCoins')
        );
        setRewardCost(platformSettings?.reward_cost || 500);
        setRewardCoinsAmount(platformSettings?.coins_amount || 10);
        if (platformSettings?.platform) {
            setSelectedRewardPlatform(platformSettings.platform);
        }
    }, [automationSettings.points_rewards, editingRewardId, selectedRewardPlatform]);

    const handleConnect = useCallback(
        (provider: MemeAlertsAuthProvider) => {
            setConnecting(true);
            setConnectingProvider(provider);
            finishConnectFlow('redirecting', null);
            stopPopupWatcher();

            const redirectUrl = getSafeNavigationUrl(
                `/api/memealerts/connect-redirect?provider=${encodeURIComponent(provider)}`
            );
            if (!redirectUrl) {
                toast.error('Не удалось открыть MemeAlerts');
                finishConnectFlow('error', 'Не удалось открыть окно авторизации MemeAlerts.');
                setConnectingProvider(null);
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
        },
        [finishConnectFlow, startPopupWatcher, stopPopupWatcher]
    );

    const handleDisconnect = async () => {
        try {
            setConnecting(true);
            const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/disconnect`);
            if (data.success) {
                setIsConnected(false);
                setConnectionInfo(null);
                setPopupState('idle');
                setConnectionNote(null);
                setAutomationSettings(DEFAULT_AUTOMATION_SETTINGS);
                toast.success('MemeAlerts отключен');
            }
        } catch (error) {
            logger.error('Disconnect error', error);
        } finally {
            setConnecting(false);
            setConnectingProvider(null);
        }
    };

    const handleGrant = async () => {
        if (!grantTarget || !grantValue) {
            toast.error('Укажите nickname и количество мемкоинов');
            return;
        }

        try {
            setGranting(true);
            const { data } = await apiClient.post(`${MEMEALERTS_API_BASE}/grant`, {
                nickname: grantTarget,
                value: grantValue,
            });

            if (data.success) {
                toast.success(`Отправлено ${grantValue} мемкоинов пользователю ${grantTarget}`, {
                    description: 'Мемкоины выданы',
                });
                fetchHistory();
                void fetchBalances();
            } else {
                toast.error(data.error || 'Не удалось выдать монеты', {
                    description: 'Ошибка',
                });
            }
        } catch (error) {
            const axiosError = error as AxiosError<{
                detail?: string | { error?: string; detail?: string; status_code?: number };
                error?: string;
            }>;
            const responseDetail = axiosError.response?.data?.detail;
            const title =
                typeof responseDetail === 'object'
                    ? responseDetail.error || 'Не удалось выдать монеты'
                    : axiosError.response?.data?.error || responseDetail || 'Ошибка связи с сервером';
            const description = typeof responseDetail === 'object' ? responseDetail.detail : undefined;
            toast.error(title, {
                description,
            });
        } finally {
            setGranting(false);
        }
    };

    const handleEditReward = (reward: PlatformRewardSettings) => {
        setEditingRewardId(reward.local_id || null);
        setSelectedRewardPlatform(reward.platform || 'twitch');
        setRewardTitle(reward.reward_title || 'MemeCoins');
        setRewardCost(reward.reward_cost || 500);
        setRewardCoinsAmount(reward.coins_amount || 10);
    };

    const handleResetRewardForm = () => {
        setEditingRewardId(null);
        setRewardTitle(selectedRewardPlatform === 'twitch' ? 'MemeCoins' : 'Награда MemeCoins');
        setRewardCost(500);
        setRewardCoinsAmount(10);
    };

    const handleToggleReward = async (reward: PlatformRewardSettings, enabled: boolean) => {
        if (!reward.local_id) return;
        try {
            setSettingsSaving(true);
            const { data } = await apiClient.patch(`${MEMEALERTS_API_BASE}/rewards/${reward.local_id}`, { enabled });
            if (!data?.success) throw new Error(data?.detail || 'Не удалось изменить награду');
            setAutomationSettings(normalizeAutomationSettings(data.settings));
            toast.success(enabled ? 'Выдача за донаты включена' : 'Выдача за донаты выключена');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Не удалось изменить награду';
            toast.error(message);
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleDeleteReward = async (reward: PlatformRewardSettings) => {
        if (!reward.local_id) return;
        try {
            setRewardDeletingId(reward.local_id);
            const { data } = await apiClient.delete(`${MEMEALERTS_API_BASE}/rewards/${reward.local_id}`);
            if (!data?.success) throw new Error(data?.detail || 'Не удалось удалить награду');
            setAutomationSettings(normalizeAutomationSettings(data.settings));
            if (editingRewardId === reward.local_id) {
                handleResetRewardForm();
            }
            toast.success('Награда удалена');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Не удалось удалить награду';
            toast.error(message);
        } finally {
            setRewardDeletingId(null);
        }
    };

    const handleSaveDonationAuto = async () => {
        if (automationSettings.donation_auto.enabled && !donationAlertsConnected) {
            toast.error('Подключите DonationAlerts перед включением выдачи за донаты');
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

    const handleConnectDonationAlerts = () => {
        setDonationAuthStarted(true);
        const redirected = integrationsService.connectDonationAlertsRedirect();
        if (!redirected) {
            setDonationAuthStarted(false);
            toast.error('Не удалось открыть авторизацию DonationAlerts');
        }
    };

    const configuredRewards = automationSettings.points_rewards || [];
    const connectedProviderLabel = connectionInfo?.authProvider
        ? MEMEALERTS_PROVIDER_LABELS[connectionInfo.authProvider]
        : null;
    const selectedPlatformConnected =
        selectedRewardPlatform === 'twitch' ? !!integrations?.twitch?.enabled : !!integrations?.vk?.enabled;
    const platformAvailability = {
        twitch: !!integrations?.twitch?.enabled,
        vk: !!integrations?.vk?.enabled,
    };
    const canCreateMoreRewards = configuredRewards.length < 3 || Boolean(editingRewardId);
    const donationCourseRub = getDonationCourseRub(automationSettings.donation_auto.coins_per_currency);
    const historyRows = [...history.localGrants].sort((a, b) => {
        const left = normalizeDateInput(a.created_at)?.getTime() ?? 0;
        const right = normalizeDateInput(b.created_at)?.getTime() ?? 0;
        return right - left;
    });
    const authStatusText = connecting
        ? 'Запущена авторизация...'
        : popupState === 'success'
          ? 'Авторизация завершена'
          : popupState === 'error'
            ? 'Авторизация не завершена'
            : '';

    if (statusLoading) {
        return <div className="p-4 text-sm text-muted-foreground">Загрузка MemeAlerts...</div>;
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <MemeAlertsHeader
                isConnected={isConnected}
                connectedProviderLabel={connectedProviderLabel}
                connecting={connecting}
                onDisconnect={handleDisconnect}
            />

            {!isConnected ? (
                <MemeAlertsConnectPanel
                    connecting={connecting}
                    connectedProvider={connectionInfo?.authProvider || null}
                    popupState={popupState}
                    authStatusText={authStatusText}
                    onConnect={handleConnect}
                />
            ) : (
                <div className="min-w-0 space-y-4">
                    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] items-stretch gap-2.5">
                        <MemeAlertsGrantCard
                            grantTarget={grantTarget}
                            grantValue={grantValue}
                            granting={granting}
                            onGrantTargetChange={setGrantTarget}
                            onGrantValueChange={setGrantValue}
                            onGrant={handleGrant}
                        />
                        <MemeAlertsPlatformRewardCard
                            platform={selectedRewardPlatform}
                            platformConnected={selectedPlatformConnected}
                            platformAvailability={platformAvailability}
                            title={rewardTitle}
                            cost={rewardCost}
                            coinsAmount={rewardCoinsAmount}
                            canCreateMoreRewards={canCreateMoreRewards}
                            creating={rewardCreating}
                            settingsLoading={settingsLoading}
                            editingRewardId={editingRewardId}
                            onPlatformChange={(platform) => {
                                setSelectedRewardPlatform(platform);
                                setEditingRewardId(null);
                            }}
                            onTitleChange={setRewardTitle}
                            onCostChange={setRewardCost}
                            onCoinsAmountChange={setRewardCoinsAmount}
                            onCreate={handleCreatePointsReward}
                            onAttach={handleAttachPointsReward}
                            onCancelEdit={handleResetRewardForm}
                        />
                        <MemeAlertsDonationCard
                            donationAlertsConnected={donationAlertsConnected}
                            enabled={automationSettings.donation_auto.enabled}
                            courseRub={donationCourseRub}
                            saving={settingsSaving}
                            authStarted={donationAuthStarted}
                            onConnectDonationAlerts={handleConnectDonationAlerts}
                            onCourseRubChange={(rub) => {
                                setAutomationSettings((prev) => ({
                                    ...prev,
                                    donation_auto: {
                                        ...prev.donation_auto,
                                        coins_per_currency: 1 / rub,
                                        min_donation_amount: 1,
                                    },
                                }));
                            }}
                            onToggleEnabled={() => {
                                setAutomationSettings((prev) => ({
                                    ...prev,
                                    donation_auto: {
                                        ...prev.donation_auto,
                                        enabled: !prev.donation_auto.enabled,
                                    },
                                }));
                            }}
                            onSave={handleSaveDonationAuto}
                        />
                    </div>

                    <MemeAlertsConfiguredRewards
                        rewards={configuredRewards}
                        settingsSaving={settingsSaving}
                        deletingId={rewardDeletingId}
                        onToggle={handleToggleReward}
                        onEdit={handleEditReward}
                        onDelete={handleDeleteReward}
                    />

                    <MemeAlertsHistoryCard
                        historyRows={historyRows}
                        historyLoading={historyLoading}
                        historyError={historyError}
                        balanceRows={balances}
                        balancesLoading={balancesLoading}
                        balancesError={balancesError}
                        onRefreshHistory={fetchHistory}
                        onRefreshBalances={fetchBalances}
                    />
                </div>
            )}
        </div>
    );
};
