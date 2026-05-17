import { useEffect, useMemo, useState } from 'react';

import { parseMemeAlertsTokenPayload } from '@/features/drops/utils/memealertsToken';
import apiClient from '@/services/api/client';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Loader } from '@/shared/components/ui/loader';

const extractTokenFromUrl = (): { accessToken?: string; refreshToken?: string; streamerId?: string } => {
    return parseMemeAlertsTokenPayload(window.location.href);
};

const normalizeProvider = (value: string | null): 'google' | 'twitch' | 'vk' => {
    if (value === 'google' || value === 'vk') return value;
    return 'twitch';
};

const providerLabel = (provider: 'google' | 'twitch' | 'vk') => {
    if (provider === 'google') return 'Google';
    if (provider === 'vk') return 'VK';
    return 'Twitch';
};

const notifyClients = (data: Record<string, unknown>) => {
    try {
        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('memealerts-auth');
            channel.postMessage(data);
            channel.close();
        }
    } catch {
        // no-op
    }

    try {
        if (window.opener) {
            window.opener.postMessage(data, window.location.origin);
        }
    } catch {
        // no-op
    }
};

const MemeAlertsCallback = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const provider = useMemo(() => normalizeProvider(new URLSearchParams(window.location.search).get('provider')), []);
    const [message, setMessage] = useState<string>(`Сохраняем вход ${providerLabel(provider)}...`);

    const tokens = useMemo(() => extractTokenFromUrl(), []);

    useEffect(() => {
        const accessToken = tokens.accessToken || '';
        const refreshToken = tokens.refreshToken;
        const streamerId = tokens.streamerId;

        notifyClients({
            type: 'memealerts_auth_state',
            provider,
            state: 'saving',
        });

        if (!accessToken) {
            setStatus('error');
            setMessage('Токен не найден. Повторите вход MemeAlerts.');
            notifyClients({
                type: 'memealerts_auth_state',
                provider,
                state: 'error',
                detail: 'Токен не найден. Повторите вход MemeAlerts.',
            });
            notifyClients({
                type: 'memealerts_proxy_result',
                ok: false,
                status: 0,
                source: 'frontend-callback-no-token',
                detail: 'Token not found',
            });
            return;
        }

        const connect = async () => {
            try {
                const response = await apiClient.post('/api/memealerts/connect', {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    streamer_id: streamerId,
                });

                const data = response.data;
                if (!data?.success || !data?.connected) {
                    throw new Error(data?.detail || data?.error || 'MemeAlerts не подтвердил подключение');
                }

                setStatus('success');
                setMessage('MemeAlerts подключен. Окно можно закрыть.');

                notifyClients({
                    type: 'memealerts_auth_state',
                    provider,
                    state: 'success',
                });
                notifyClients({
                    type: 'memealerts_proxy_result',
                    ok: true,
                    status: response.status,
                    source: 'frontend-callback',
                });

                const cleanUrl = `${window.location.origin}${window.location.pathname}?provider=${encodeURIComponent(provider)}`;
                window.history.replaceState({}, '', cleanUrl);

                window.setTimeout(() => {
                    if (window.opener) {
                        window.close();
                        return;
                    }
                    window.location.replace('/dashboard/media?tab=memealerts');
                }, 500);
            } catch (error) {
                const err = error as Error;
                setStatus('error');
                const detail = err.message || 'Не удалось подключить MemeAlerts';
                setMessage(detail);
                notifyClients({
                    type: 'memealerts_auth_state',
                    provider,
                    state: 'error',
                    detail,
                });
                notifyClients({
                    type: 'memealerts_proxy_result',
                    ok: false,
                    status: 0,
                    source: 'frontend-callback-error',
                    detail,
                });
            }
        };

        void connect();
    }, [provider, tokens]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md card-glass">
                <CardHeader>
                    <CardTitle>MemeAlerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status === 'loading' ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader className="h-4 w-4" />
                            <span>{message}</span>
                        </div>
                    ) : (
                        <p className={status === 'success' ? 'text-green-400' : 'text-red-400'}>{message}</p>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => {
                            window.location.href = '/dashboard/media?tab=memealerts';
                        }}
                    >
                        Вернуться
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default MemeAlertsCallback;
