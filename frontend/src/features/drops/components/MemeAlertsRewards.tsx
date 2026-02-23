import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, Coins, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { useIntegrations } from '@/context/IntegrationsContext';
import { cn } from '@/lib/utils';
import { MemeAlertsLogo } from '@/shared/components/icons/MemeAlertsLogoV2';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';



const MEMEALERTS_API_BASE = '/api/memealerts';

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
            reward_cost: 500
        },
        vk: {
            enabled: false,
            reward_id: null,
            reward_title: null,
            coins_amount: 10,
            reward_cost: 500
        }
    },
    donation_auto: {
        enabled: false,
        coins_per_currency: 1,
        min_donation_amount: 1
    }
};

const SURFACE_CARD_CLASS = 'card-glass border-border/70 bg-card/75 backdrop-blur-sm shadow-sm shadow-black/10';
const FIELD_CLASS = 'h-9 border-border/70 bg-card/70 text-foreground placeholder:text-muted-foreground';

const parseMemeAlertsTokenPayload = (
    raw: string
): { accessToken?: string; refreshToken?: string } => {
    const value = raw.trim();
    if (!value) return {};

    const extractFromParams = (params: URLSearchParams) => {
        const accessToken =
            params.get('access_token') ||
            params.get('accessToken') ||
            params.get('token') ||
            params.get('auth_token') ||
            params.get('jwt') ||
            undefined;
        const refreshToken = params.get('refresh_token') || params.get('refreshToken') || undefined;
        return { accessToken, refreshToken };
    };

    try {
        const url = new URL(value);
        const fromQuery = extractFromParams(url.searchParams);
        if (fromQuery.accessToken) return fromQuery;
        if (url.hash) {
            const hash = url.hash.replace(/^#/, '');
            const fromHash = extractFromParams(new URLSearchParams(hash));
            if (fromHash.accessToken) return fromHash;
        }
    } catch {
        // ignore invalid URL format and continue with fallback parsing
    }

    try {
        const fromText = extractFromParams(new URLSearchParams(value.replace(/^[#?]/, '')));
        if (fromText.accessToken) return fromText;
    } catch {
        // ignore
    }

    if (value.split('.').length === 3 || value.length > 30) {
        return { accessToken: value };
    }

    return {};
};

export const MemeAlertsRewards: React.FC = () => {
    const { integrations } = useIntegrations();
    const donationAlertsConnected = !!integrations?.donationalerts?.enabled;

    const [statusLoading, setStatusLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
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
    const [rewardCooldownSeconds, setRewardCooldownSeconds] = useState(0);
    const [automationSettings, setAutomationSettings] = useState<MemeAlertsAutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);
    const [history, setHistory] = useState<{
        grants: MemeAlertsHistoryItem[];
        purchases: MemeAlertsHistoryItem[];
        unknown: MemeAlertsHistoryItem[];
    }>({
        grants: [],
        purchases: [],
        unknown: []
    });
    const popupRef = React.useRef<Window | null>(null);
    const popupWatcherRef = React.useRef<number | null>(null);
    const manualTokenInputRef = React.useRef<HTMLInputElement | null>(null);

    const stopPopupWatcher = useCallback(() => {
        if (popupWatcherRef.current !== null) {
            window.clearInterval(popupWatcherRef.current);
            popupWatcherRef.current = null;
        }
        popupRef.current = null;
    }, []);

    const startPopupWatcher = useCallback(() => {
        stopPopupWatcher();
        popupWatcherRef.current = window.setInterval(() => {
            const popup = popupRef.current;
            if (!popup || popup.closed) {
                stopPopupWatcher();
                setConnecting(false);
            }
        }, 500);
    }, [stopPopupWatcher]);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const response = await fetch(`${MEMEALERTS_API_BASE}/status`);
            const data = await response.json();
            setIsConnected(data.connected);
            if (!data.connected) {
                setAutomationSettings(DEFAULT_AUTOMATION_SETTINGS);
            }
        } catch (error) {
            logger.error('Status check error', error);
        } finally {
            setStatusLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const response = await fetch(`${MEMEALERTS_API_BASE}/history?limit=50`);
            const data = await response.json();
            setHistory({
                grants: data.grants || [],
                purchases: data.purchases || [],
                unknown: data.unknown || []
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
            const response = await fetch(`${MEMEALERTS_API_BASE}/settings`);
            const data = await response.json();
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
            const response = await fetch(`${MEMEALERTS_API_BASE}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok || !data?.success) {
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
            const response = await fetch(`${MEMEALERTS_API_BASE}/rewards/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: selectedRewardPlatform,
                    title: rewardTitle,
                    cost: rewardCost,
                    coins_amount: rewardCoinsAmount,
                    cooldown_seconds: rewardCooldownSeconds
                })
            });
            const data = await response.json();
            if (!response.ok || !data?.success) {
                throw new Error(data?.detail || data?.error || 'Не удалось создать награду');
            }
            toast.success(`Награда ${selectedRewardPlatform.toUpperCase()} создана`);
            if (data?.data?.settings) {
                setAutomationSettings((prev) => ({
                    ...prev,
                    points_reward: {
                        ...prev.points_reward,
                        [selectedRewardPlatform]: data.data.settings as PlatformRewardSettings
                    } as MemeAlertsAutomationSettings['points_reward']
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
        selectedRewardPlatform
    ]);

    const saveTokenToBackend = useCallback(async (accessToken: string, refreshToken?: string) => {
        try {
            const response = await fetch(`${MEMEALERTS_API_BASE}/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: accessToken,
                    refresh_token: refreshToken
                })
            });
            const data = await response.json();

            if (data.success && data.connected) {
                setIsConnected(true);
                toast.success("MemeAlerts подключен!", {
                    description: "Теперь вы можете выдавать мемкоины"
                });
                return true;
            } else {
                toast.error(data.error || "Не удалось сохранить токен", {
                    description: "Ошибка подключения"
                });
                return false;
            }
        } catch {
            toast.error("Ошибка сети при сохранении токена");
            return false;
        }
    }, []);

    // Listen for postMessage from the proxy popup with the extracted token.
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (popupRef.current && event.source !== popupRef.current) return;
            if (!event?.data || typeof event.data !== 'object') return;

            // Accept both old format and new typed format from the proxy script.
            const data = event.data as {
                type?: string;
                access_token?: string;
                refresh_token?: string;
            };

            if (data.type === 'memealerts_token' && data.access_token) {
                setConnecting(true);
                const success = await saveTokenToBackend(data.access_token, data.refresh_token);
                if (success && popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
                stopPopupWatcher();
                setConnecting(false);
            } else if (data.access_token && !data.type) {
                // Legacy format - keep backward compatibility.
                const success = await saveTokenToBackend(data.access_token, data.refresh_token);
                if (success && popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
                stopPopupWatcher();
                setConnecting(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            stopPopupWatcher();
        };
    }, [saveTokenToBackend, stopPopupWatcher]);

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
            platformSettings.reward_title ||
            (selectedRewardPlatform === 'twitch' ? 'MemeCoins' : 'Награда MemeCoins')
        );
        setRewardCost(platformSettings.reward_cost || 500);
        setRewardCoinsAmount(platformSettings.coins_amount || 10);
    }, [automationSettings.points_reward, selectedRewardPlatform]);

    const handleConnect = useCallback(async () => {
        try {
            setConnecting(true);
            const response = await fetch(`${MEMEALERTS_API_BASE}/connect-url`);
            const data = await response.json();
            if (!response.ok || !data?.success || !data?.auth_url) {
                throw new Error(data?.error || 'Не удалось получить ссылку подключения');
            }

            const safeUrl = getSafeNavigationUrl(data.auth_url);
            if (!safeUrl) {
                throw new Error('Небезопасный URL авторизации');
            }

            const popup = window.open(safeUrl, '_blank', 'width=500,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
            if (!popup) {
                toast.error("Не удалось открыть окно", {
                    description: "Разрешите всплывающие окна в настройках браузера"
                });
                setConnecting(false);
                return;
            }

            popupRef.current = popup;
            startPopupWatcher();
            toast.info("Авторизуйтесь в MemeAlerts", {
                description: "После входа окно закроется автоматически"
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ошибка запуска авторизации';
            toast.error(message);
            setConnecting(false);
        }
    }, [startPopupWatcher]);

    const handleDisconnect = async () => {
        try {
            setConnecting(true);
            const response = await fetch(`${MEMEALERTS_API_BASE}/disconnect`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                setIsConnected(false);
                setAutomationSettings(DEFAULT_AUTOMATION_SETTINGS);
                toast.success("MemeAlerts отключен");
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
            toast.error("Не найден access token", {
                description: "Вставьте полную ссылку из окна MemeAlerts после авторизации"
            });
            return;
        }

        try {
            setManualSubmitLoading(true);
            const success = await saveTokenToBackend(parsed.accessToken, parsed.refreshToken);
            if (success) {
                setManualAuthUrl('');
                stopPopupWatcher();
                setConnecting(false);
                if (popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
            }
        } finally {
            setManualSubmitLoading(false);
        }
    }, [manualAuthUrl, saveTokenToBackend, stopPopupWatcher]);

    const handleGrant = async () => {
        if (!grantTarget || !grantValue) {
            toast.error("Укажите никнейм/ID и количество монет");
            return;
        }

        try {
            setGranting(true);
            const response = await fetch(`${MEMEALERTS_API_BASE}/grant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: grantTarget,
                    value: grantValue
                })
            });
            const data = await response.json();

            if (data.success) {
                toast.success(`Отправлено ${grantValue} монет пользователю ${grantTarget}`, {
                    description: "Монеты выданы!"
                });
                fetchHistory();
            } else {
                toast.error(data.error || "Не удалось выдать монеты", {
                    description: "Ошибка"
                });
            }
        } catch {
            toast.error("Ошибка связи с сервером");
        } finally {
            setGranting(false);
        }
    };

    const handleToggleRewardPlatform = async (platform: 'twitch' | 'vk', enabled: boolean) => {
        const success = await saveSettingsPatch({
            [platform]: {
                enabled
            }
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
                min_donation_amount: automationSettings.donation_auto.min_donation_amount
            }
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

    if (statusLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card/70 px-1 py-1">
                <div className="flex items-center gap-2">
                    <MemeAlertsLogo className="h-10 w-auto" />
                </div>
                <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${isConnected ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {isConnected ? 'Подключено' : 'Не подключено'}
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
                <div className={SURFACE_CARD_CLASS}>
                    <div className="space-y-3 p-4">
                        <div className="flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-200">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Нажмите «Подключить MemeAlerts» и войдите в popup-окне.
                                После успешного входа подключение завершится автоматически.
                            </p>
                        </div>

                        <Button onClick={handleConnect} disabled={connecting} className="w-full h-9 bg-[#9146FF] hover:bg-[#7f3ee8] text-white">
                            {connecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Ожидание авторизации...
                                </>
                            ) : (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Подключить MemeAlerts
                                </>
                            )}
                        </Button>

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
                            className="w-full h-8 border-border/70 bg-card/70 hover:bg-accent"
                        >
                            {manualSubmitLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Применить ссылку вручную
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="space-y-4">
                        <Card className={SURFACE_CARD_CLASS}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-primary" />
                                    Быстрая выдача мемкоинов
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                                    <Input
                                        placeholder="nickname или 12345"
                                        value={grantTarget}
                                        onChange={(e) => setGrantTarget(e.target.value)}
                                        className={FIELD_CLASS}
                                    />
                                    <Input
                                        type="number"
                                        placeholder="10"
                                        value={grantValue}
                                        onChange={(e) => setGrantValue(Number(e.target.value))}
                                        className={FIELD_CLASS}
                                    />
                                    <Button onClick={handleGrant} disabled={granting} className="h-9 md:min-w-[140px] bg-blue-700 hover:bg-blue-800 text-white">
                                        {granting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Выдать
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card className={SURFACE_CARD_CLASS}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Награда за баллы Twitch/VK</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-xs text-muted-foreground">
                                        Редим с обязательным ником саппортера, после чего выдаются мемкоины автоматически.
                                    </p>

                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedRewardPlatform('twitch')}
                                            className={cn(
                                                'h-8 border-border/70',
                                                selectedRewardPlatform === 'twitch'
                                                    ? 'bg-[#9146FF] border-[#9146FF] text-white hover:bg-[#7f3ee8]'
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
                                                    ? 'bg-[#FF4444] border-[#FF4444] text-white hover:bg-[#e13d3d]'
                                                    : 'bg-card/70 hover:bg-accent'
                                            )}
                                        >
                                            VK Live
                                        </Button>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Название награды</Label>
                                        <Input
                                            value={rewardTitle}
                                            onChange={(e) => setRewardTitle(e.target.value)}
                                            className={FIELD_CLASS}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Цена</Label>
                                            <Input
                                                type="number"
                                                value={rewardCost}
                                                onChange={(e) => setRewardCost(Number(e.target.value))}
                                                className={FIELD_CLASS}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Мемкоины</Label>
                                            <Input
                                                type="number"
                                                value={rewardCoinsAmount}
                                                onChange={(e) => setRewardCoinsAmount(Number(e.target.value))}
                                                className={FIELD_CLASS}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Кулдаун (сек)</Label>
                                        <Input
                                            type="number"
                                            value={rewardCooldownSeconds}
                                            onChange={(e) => setRewardCooldownSeconds(Number(e.target.value))}
                                            className={FIELD_CLASS}
                                        />
                                    </div>

                                    <div className="rounded-md border border-border/70 bg-card/60 p-2.5 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-foreground">
                                                Автовыдача {selectedRewardPlatform === 'twitch' ? 'Twitch' : 'VK'}
                                            </span>
                                            <Switch
                                                checked={currentRewardSettings.enabled}
                                                onCheckedChange={(checked) => handleToggleRewardPlatform(selectedRewardPlatform, checked)}
                                                disabled={settingsSaving}
                                            />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">
                                            Reward ID: {currentRewardSettings.reward_id || 'не задан'}
                                        </p>
                                    </div>

                                    <Button
                                        onClick={handleCreatePointsReward}
                                        disabled={rewardCreating || settingsLoading}
                                        className="h-9 w-full bg-blue-700 hover:bg-blue-800 text-white"
                                    >
                                        {rewardCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Создать/обновить награду
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className={SURFACE_CARD_CLASS}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Автоконвертация DonationAlerts</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-card/60 px-3 py-2">
                                        <p className="text-xs text-foreground">Включить автоконвертацию донатов</p>
                                        <Switch
                                            checked={automationSettings.donation_auto.enabled}
                                            onCheckedChange={(checked) => {
                                                if (checked && !donationAlertsConnected) {
                                                    toast.error('Подключите DonationAlerts перед включением автоконвертации');
                                                    return;
                                                }
                                                setAutomationSettings((prev) => ({
                                                    ...prev,
                                                    donation_auto: { ...prev.donation_auto, enabled: checked }
                                                }));
                                            }}
                                            disabled={!donationAlertsConnected && !automationSettings.donation_auto.enabled}
                                        />
                                    </div>

                                    {!donationAlertsConnected && (
                                        <p className="text-xs text-amber-300">
                                            Сначала подключите DonationAlerts в интеграциях.
                                        </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Курс</Label>
                                            <Input
                                                type="number"
                                                value={automationSettings.donation_auto.coins_per_currency}
                                                onChange={(e) => setAutomationSettings((prev) => ({
                                                    ...prev,
                                                    donation_auto: {
                                                        ...prev.donation_auto,
                                                        coins_per_currency: Number(e.target.value)
                                                    }
                                                }))}
                                                className={FIELD_CLASS}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Мин. донат</Label>
                                            <Input
                                                type="number"
                                                value={automationSettings.donation_auto.min_donation_amount}
                                                onChange={(e) => setAutomationSettings((prev) => ({
                                                    ...prev,
                                                    donation_auto: {
                                                        ...prev.donation_auto,
                                                        min_donation_amount: Number(e.target.value)
                                                    }
                                                }))}
                                                className={FIELD_CLASS}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleSaveDonationAuto}
                                        disabled={settingsSaving || (!donationAlertsConnected && !automationSettings.donation_auto.enabled)}
                                        className="h-9 w-full bg-blue-700 hover:bg-blue-800 text-white"
                                    >
                                        {settingsSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Сохранить настройки
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <Card className={`${SURFACE_CARD_CLASS} h-fit`}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">История мемкоинов</CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchHistory}
                                    disabled={historyLoading}
                                    className="h-8 border-border/70 bg-card/70 hover:bg-accent"
                                >
                                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                                    Обновить
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Tabs value={historyTab} onValueChange={(value) => setHistoryTab(value as 'grants' | 'purchases')}>
                                <TabsList className="grid w-full grid-cols-2 h-8">
                                    <TabsTrigger value="grants" className="text-xs">Выдачи ({history.grants.length})</TabsTrigger>
                                    <TabsTrigger value="purchases" className="text-xs">Покупки ({history.purchases.length})</TabsTrigger>
                                </TabsList>
                                <TabsContent value="grants" className="mt-3">
                                    <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                                        {history.grants.length === 0 && (
                                            <p className="rounded-md border border-border/70 bg-card/60 px-3 py-4 text-xs text-muted-foreground">
                                                Выдач пока нет. Они появятся после команды `!givema` или ручной выдачи через кнопку «Выдать».
                                            </p>
                                        )}
                                        {history.grants.map((item, index) => (
                                            <div
                                                key={`${item.id || index}`}
                                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border/70 bg-card/60 px-3 py-2"
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
                                                    <p className="text-sm font-semibold text-emerald-300">+{formatAmount(item.amount)}</p>
                                                    <p className="text-[11px] text-muted-foreground">{item.type || 'grant'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                                <TabsContent value="purchases" className="mt-3">
                                    <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                                        {history.purchases.length === 0 && (
                                            <p className="rounded-md border border-border/70 bg-card/60 px-3 py-4 text-xs text-muted-foreground">
                                                Нет данных по покупкам.
                                            </p>
                                        )}
                                        {history.purchases.map((item, index) => (
                                            <div
                                                key={`${item.id || index}`}
                                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border/70 bg-card/60 px-3 py-2"
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
                                                    <p className="text-sm font-semibold text-violet-300">{formatAmount(item.amount)}</p>
                                                    <p className="text-[11px] text-muted-foreground">{item.type || 'purchase'}</p>
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
