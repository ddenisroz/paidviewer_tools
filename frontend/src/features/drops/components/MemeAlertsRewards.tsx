import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AlertCircle, Coins, ExternalLink, Loader2, RefreshCw } from 'lucide-react';

import { logger } from '@/shared/utils/prodLogger';
import { toast } from 'sonner';

import { MemeAlertsLogo } from '@/shared/components/icons/MemeAlertsLogoV2';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';



const MEMEALERTS_API_BASE = '/api/memealerts';
const MEMEALERTS_LOGIN_URL = 'https://memealerts.com';
const POPUP_CHECK_INTERVAL = 1000; // Check every second
const POPUP_TIMEOUT = 300000; // 5 minutes max wait

export const MemeAlertsRewards: React.FC = () => {
    const [statusLoading, setStatusLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [grantUserId, setGrantUserId] = useState('');
    const [grantValue, setGrantValue] = useState<number>(10);
    const [granting, setGranting] = useState(false);
    const [manualAccessToken, setManualAccessToken] = useState('');
    const [manualRefreshToken, setManualRefreshToken] = useState('');
    const [manualSaving, setManualSaving] = useState(false);

    const popupRef = useRef<Window | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        checkStatus();
        return () => {
            // Cleanup on unmount
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
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

    const checkStatusSilent = async (): Promise<boolean> => {
        try {
            const response = await fetch(`${MEMEALERTS_API_BASE}/status`);
            const data = await response.json();
            if (data?.connected) {
                setIsConnected(true);
                return true;
            }
        } catch {
            // ignore
        }
        return false;
    };

    const saveTokenToBackend = async (accessToken: string, refreshToken?: string) => {
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
        } catch (error) {
            toast.error("Ошибка сети при сохранении токена");
            return false;
        }
    };

    const cleanupPopup = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
        }
        popupRef.current = null;
        setConnecting(false);
    }, []);

    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (!event?.data || typeof event.data !== 'object') return;
            const data = event.data as { access_token?: string; refresh_token?: string };
            if (!data.access_token) return;

            const success = await saveTokenToBackend(data.access_token, data.refresh_token);
            if (success) cleanupPopup();
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [cleanupPopup, saveTokenToBackend]);

    const handleConnect = useCallback(() => {
        // Open popup window
        const width = 500;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            MEMEALERTS_LOGIN_URL,
            'memealerts_auth',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        if (!popup) {
            toast.error("Не удалось открыть окно авторизации", {
                description: "Пожалуйста, разрешите всплывающие окна для этого сайта"
            });
            return;
        }

        popupRef.current = popup;
        setConnecting(true);

        toast.info("Авторизуйтесь в MemeAlerts", {
            description: "После входа окно закроется автоматически"
        });

        // Start polling for token
        intervalRef.current = setInterval(async () => {
            try {
                // Check if popup is closed
                if (!popupRef.current || popupRef.current.closed) {
                    cleanupPopup();
                    checkStatus();
                    toast.info("Auth window closed");
                    return;
                }

                const connected = await checkStatusSilent();
                if (connected) {
                    cleanupPopup();
                    return;
                }

                // Try to access popup's localStorage (only works when on same origin or after redirect)
                // Due to cross-origin restrictions, this may throw until the popup is on a same-origin page
                try {
                    const popupUrl = popupRef.current.location.href;

                    // Check if user is on dashboard/stickers (authenticated pages)
                    if (popupUrl.includes('memealerts.com/dashboard') ||
                        popupUrl.includes('memealerts.com/stickers') ||
                        popupUrl.includes('memealerts.com/settings')) {

                        // Try to get token from localStorage
                        const accessToken = popupRef.current.localStorage.getItem('accessToken');
                        const refreshToken = popupRef.current.localStorage.getItem('refreshToken');

                        if (accessToken) {
                            logger.log('[MemeAlerts] Token captured successfully');

                            // Save to backend
                            const success = await saveTokenToBackend(accessToken, refreshToken || undefined);

                            if (success) {
                                cleanupPopup();
                            }
                        }
                    }
                } catch (e) {
                    // Cross-origin error - popup is on different domain (e.g., Twitch OAuth)
                    // This is expected, continue polling
                }
            } catch (e) {
                // General error, continue polling
            }
        }, POPUP_CHECK_INTERVAL);

        // Set timeout to stop polling after max wait time
        timeoutRef.current = setTimeout(() => {
            if (popupRef.current) {
                cleanupPopup();
                toast.warning("Время авторизации истекло", {
                    description: "Попробуйте снова"
                });
            }
        }, POPUP_TIMEOUT);

    }, [cleanupPopup, checkStatus, checkStatusSilent, saveTokenToBackend]);

    const handleManualSave = async () => {
        const accessToken = manualAccessToken.trim();
        if (!accessToken) {
            toast.error("Вставьте access token для подключения");
            return;
        }

        setManualSaving(true);
        const success = await saveTokenToBackend(
            accessToken,
            manualRefreshToken.trim() || undefined
        );
        if (success) {
            setManualAccessToken('');
            setManualRefreshToken('');
        }
        setManualSaving(false);
    };

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
        if (!grantUserId || !grantValue) {
            toast.error("Укажите User ID и количество монет");
            return;
        }

        try {
            setGranting(true);
            const response = await fetch(`${MEMEALERTS_API_BASE}/grant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: grantUserId,
                    value: grantValue
                })
            });
            const data = await response.json();

            if (data.success) {
                toast.success(`Отправлено ${grantValue} монет пользователю ${grantUserId}`, {
                    description: "Монеты выданы!"
                });
            } else {
                toast.error(data.error || "Не удалось выдать монеты", {
                    description: "Ошибка"
                });
            }
        } catch (error) {
            toast.error("Ошибка связи с сервером");
        } finally {
            setGranting(false);
        }
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
                            <h4 className="font-semibold text-white">Авторизация через MemeAlerts</h4>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Подключите MemeAlerts для выдачи мемкоинов вашим зрителям.
                                После авторизации токен сохранится автоматически.
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
                                Авторизуйтесь в открывшемся окне через Twitch, Google или VK.
                            </p>
                        </div>
                    )}
                    <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                        <p className="text-xs text-gray-400">
                            Если автоматическое подключение не сработало, вставьте access token вручную.
                        </p>
                        <div className="space-y-2">
                            <Label>Access token</Label>
                            <Input
                                placeholder="accessToken"
                                value={manualAccessToken}
                                onChange={(e) => setManualAccessToken(e.target.value)}
                                className="bg-black/20 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Refresh token (optional)</Label>
                            <Input
                                placeholder="refreshToken"
                                value={manualRefreshToken}
                                onChange={(e) => setManualRefreshToken(e.target.value)}
                                className="bg-black/20 border-white/10"
                            />
                        </div>
                        <Button onClick={handleManualSave} disabled={manualSaving}>
                            {manualSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Сохранить токен
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 rounded-lg card-glass space-y-4">
                            <h4 className="font-semibold flex items-center gap-2 text-white">
                                <Coins className="h-4 w-4 text-yellow-500" />
                                Выдать монеты
                            </h4>
                            <div className="space-y-2">
                                <Label>User ID получателя</Label>
                                <Input
                                    placeholder="ID пользователя MemeAlerts"
                                    value={grantUserId}
                                    onChange={(e) => setGrantUserId(e.target.value)}
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
                </div>
            )}
        </div>
    );
};
