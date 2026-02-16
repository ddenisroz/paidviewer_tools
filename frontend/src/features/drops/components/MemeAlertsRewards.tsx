import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, Coins, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { MemeAlertsLogo } from '@/shared/components/icons/MemeAlertsLogoV2';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
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

export const MemeAlertsRewards: React.FC = () => {
    const [statusLoading, setStatusLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [grantTarget, setGrantTarget] = useState('');
    const [grantValue, setGrantValue] = useState<number>(10);
    const [granting, setGranting] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState<{
        grants: MemeAlertsHistoryItem[];
        purchases: MemeAlertsHistoryItem[];
        unknown: MemeAlertsHistoryItem[];
    }>({
        grants: [],
        purchases: [],
        unknown: []
    });

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const response = await fetch(`${MEMEALERTS_API_BASE}/status`);
            const data = await response.json();
            setIsConnected(data.connected);
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
                if (success) {
                    setConnecting(false);
                }
            } else if (data.access_token && !data.type) {
                // Legacy format — keep backward compat.
                const success = await saveTokenToBackend(data.access_token, data.refresh_token);
                if (success) setConnecting(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [saveTokenToBackend]);

    useEffect(() => {
        if (isConnected) {
            fetchHistory();
        }
    }, [isConnected]);

    const handleConnect = useCallback(() => {
        // Open MemeAlerts through our reverse-proxy so the token stays on our origin.
        const proxyUrl = `${window.location.origin}/api/memealerts/proxy/`;
        const popup = window.open(proxyUrl, '_blank', 'width=500,height=700,scrollbars=yes');
        if (!popup) {
            toast.error("Не удалось открыть окно", {
                description: "Разрешите всплывающие окна в настройках браузера"
            });
            return;
        }
        setConnecting(true);
        toast.info("Авторизуйтесь в MemeAlerts", {
            description: "После входа токен сохранится автоматически"
        });
    }, []);

    const handleDisconnect = async () => {
        try {
            setConnecting(true);
            const response = await fetch(`${MEMEALERTS_API_BASE}/disconnect`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                setIsConnected(false);
                toast.success("MemeAlerts отключен");
            }
        } catch (error) {
            logger.error('Disconnect error', error);
        } finally {
            setConnecting(false);
        }
    };

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

    const formatTimestamp = (value?: string) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString('ru-RU', { hour12: false });
    };

    if (statusLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header with logo and status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <MemeAlertsLogo className="h-10 w-auto" />
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${isConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    {isConnected ? 'Подключено' : 'Не подключено'}
                </div>
            </div>

            {!isConnected ? (
                <div className="rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 p-6 space-y-5">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-purple-400" />
                        </div>
                        <div className="space-y-1.5">
                            <h4 className="font-semibold text-white">Подключение MemeAlerts</h4>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Нажмите кнопку ниже — откроется окно MemeAlerts.
                                Авторизуйтесь, и токен сохранится автоматически.
                            </p>
                        </div>
                    </div>

                    <Button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
                        size="lg"
                    >
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

                    {connecting && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-400 flex-shrink-0" />
                            <p className="text-xs text-blue-300">
                                Авторизуйтесь в открытом окне. После входа токен будет передан автоматически.
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg card-glass space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 text-white">
                                    <Coins className="h-4 w-4 text-yellow-500" />
                                    Выдать мемкоины
                                </h4>
                                <div className="space-y-2">
                                    <Label>Никнейм или ID</Label>
                                    <Input
                                        placeholder="nickname или 12345"
                                        value={grantTarget}
                                        onChange={(e) => setGrantTarget(e.target.value)}
                                        className="bg-black/20 border-white/10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Количество</Label>
                                    <Input
                                        type="number"
                                        placeholder="10"
                                        value={grantValue}
                                        onChange={(e) => setGrantValue(Number(e.target.value))}
                                        className="bg-black/20 border-white/10"
                                    />
                                </div>
                                <Button onClick={handleGrant} disabled={granting} className="w-full">
                                    {granting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Выдать монеты
                                </Button>
                            </div>

                            <div className="p-4 rounded-lg card-glass space-y-4">
                                <h4 className="font-semibold text-white">Статус подключения</h4>
                                <p className="text-sm text-green-400 font-medium">✓ Активно</p>
                                <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={connecting}>
                                    {connecting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                    Отключить
                                </Button>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg card-glass space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-white">История мемкоинов</h4>
                                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading}>
                                    {historyLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                    Обновить
                                </Button>
                            </div>
                            <Tabs defaultValue="grants">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="grants">Выдачи</TabsTrigger>
                                    <TabsTrigger value="purchases">Покупки</TabsTrigger>
                                </TabsList>
                                <TabsContent value="grants">
                                    <div className="max-h-72 overflow-y-auto space-y-2">
                                        {history.grants.length === 0 && (
                                            <p className="text-sm text-muted-foreground">Нет данных по выдачам.</p>
                                        )}
                                        {history.grants.map((item, index) => (
                                            <div key={`${item.id || index}`} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm">
                                                <div>
                                                    <p className="text-white font-medium">{item.user_name || item.user_id || 'Пользователь'}</p>
                                                    <p className="text-xs text-muted-foreground">{formatTimestamp(item.created_at)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-green-400 font-semibold">+{item.amount || 0}</p>
                                                    <p className="text-xs text-muted-foreground">{item.type || 'grant'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                                <TabsContent value="purchases">
                                    <div className="max-h-72 overflow-y-auto space-y-2">
                                        {history.purchases.length === 0 && (
                                            <p className="text-sm text-muted-foreground">Нет данных по покупкам.</p>
                                        )}
                                        {history.purchases.map((item, index) => (
                                            <div key={`${item.id || index}`} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm">
                                                <div>
                                                    <p className="text-white font-medium">{item.user_name || item.user_id || 'Пользователь'}</p>
                                                    <p className="text-xs text-muted-foreground">{formatTimestamp(item.created_at)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-purple-400 font-semibold">{item.amount || 0}</p>
                                                    <p className="text-xs text-muted-foreground">{item.type || 'purchase'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
