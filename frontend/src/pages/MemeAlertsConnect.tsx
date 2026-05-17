import { useEffect, useMemo, useState } from 'react';

import apiClient from '@/services/api/client';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Loader } from '@/shared/components/ui/loader';

type MemeAlertsAuthProvider = 'google' | 'twitch' | 'vk';
type ConnectState = 'redirecting' | 'sign_in' | 'error';

const PROVIDER_LABELS: Record<MemeAlertsAuthProvider, string> = {
    google: 'Google',
    twitch: 'Twitch',
    vk: 'VK',
};

const normalizeProvider = (value: string | null): MemeAlertsAuthProvider => {
    if (value === 'google' || value === 'vk') return value;
    return 'twitch';
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

const MemeAlertsConnect = () => {
    const [status, setStatus] = useState<ConnectState>('redirecting');
    const [message, setMessage] = useState('Готовим окно авторизации...');

    const provider = useMemo(() => {
        return normalizeProvider(new URLSearchParams(window.location.search).get('provider'));
    }, []);

    useEffect(() => {
        notifyClients({
            type: 'memealerts_auth_state',
            provider,
            state: 'redirecting',
        });

        const start = async () => {
            try {
                const response = await apiClient.get('/api/memealerts/connect/start', {
                    params: { provider },
                });
                const data = response.data;
                const authUrl = String(data?.auth_url || data?.proxy_auth_url || '').trim();
                if (!authUrl) {
                    throw new Error('Не удалось подготовить вход MemeAlerts');
                }

                setStatus('sign_in');
                setMessage(`Открываем вход через ${PROVIDER_LABELS[provider]}...`);
                notifyClients({
                    type: 'memealerts_auth_state',
                    provider,
                    state: 'sign_in',
                });

                window.location.replace(authUrl);
            } catch (error) {
                const err = error as Error;
                const detail = err.message || 'Не удалось открыть окно входа MemeAlerts';
                setStatus('error');
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
                    source: 'frontend-connect-start',
                    detail,
                });
            }
        };

        void start();
    }, [provider]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <Card className="w-full max-w-sm border-border/70 bg-card/95 shadow-lg shadow-black/20">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">MemeAlerts · {PROVIDER_LABELS[provider]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {status === 'error' ? null : <Loader className="h-4 w-4" />}
                        <span>{message}</span>
                    </div>
                    {status === 'error' ? (
                        <Button
                            variant="outline"
                            onClick={() => {
                                window.location.href = '/dashboard/media?tab=memealerts';
                            }}
                        >
                            Вернуться
                        </Button>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
};

export default MemeAlertsConnect;
