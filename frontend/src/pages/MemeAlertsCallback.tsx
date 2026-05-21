import { useEffect, useMemo, useRef, useState } from 'react';

import { parseMemeAlertsTokenPayload } from '@/features/drops/utils/memealertsToken';
import { MemeAlertsCallbackStatus } from '@/pages/MemeAlertsCallbackStatus';
import apiClient from '@/services/api/client';

const extractTokenFromUrl = (href: string): { accessToken?: string; refreshToken?: string; streamerId?: string } => {
    return parseMemeAlertsTokenPayload(href);
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

const readCallbackState = () => {
    const href = window.location.href;
    const url = new URL(href);
    const provider = normalizeProvider(url.searchParams.get('provider'));
    const tokens = extractTokenFromUrl(href);

    if (tokens.accessToken || tokens.refreshToken) {
        const cleanUrl = `${window.location.origin}${window.location.pathname}?provider=${encodeURIComponent(provider)}`;
        window.history.replaceState({}, '', cleanUrl);
    }

    return { provider, tokens };
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
    const initialState = useMemo(() => readCallbackState(), []);
    const hasPostedRef = useRef(false);
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const provider = initialState.provider;
    const tokens = initialState.tokens;
    const [message, setMessage] = useState<string>(`Сохраняем вход ${providerLabel(provider)}...`);

    useEffect(() => {
        if (hasPostedRef.current) {
            return;
        }
        hasPostedRef.current = true;

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
                    auth_provider: provider,
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

    return <MemeAlertsCallbackStatus status={status} message={message} />;
};

export default MemeAlertsCallback;
