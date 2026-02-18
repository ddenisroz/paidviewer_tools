import { useEffect, useMemo, useState } from 'react';

import { API_BASE_URL } from '@/constants';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Loader } from '@/shared/components/ui/loader';

const extractTokenFromUrl = (): { accessToken?: string; refreshToken?: string } => {
  const parseParams = (raw: string) => {
    if (!raw) return {};

    const params = new URLSearchParams(raw.replace(/^[#?]/, ''));
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

  const fromQuery = parseParams(window.location.search || '');
  if (fromQuery.accessToken) return fromQuery;

  const fromHash = parseParams(window.location.hash || '');
  if (fromHash.accessToken) return fromHash;

  // Some providers put query string inside hash payload.
  const hash = (window.location.hash || '').replace(/^#/, '');
  const hashQueryIndex = hash.indexOf('?');
  if (hashQueryIndex >= 0) {
    const fromHashQuery = parseParams(hash.slice(hashQueryIndex + 1));
    if (fromHashQuery.accessToken) return fromHashQuery;
  }

  return {};
};

const notifyOpener = (data: Record<string, unknown>) => {
  if (!window.opener) return;
  try {
    window.opener.postMessage(data, '*');
  } catch {
    // no-op
  }
};

const MemeAlertsCallback = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Подключаем MemeAlerts...');

  const tokens = useMemo(() => extractTokenFromUrl(), []);

  useEffect(() => {
    const accessToken = tokens.accessToken || '';
    const refreshToken = tokens.refreshToken;

    if (!accessToken) {
      setStatus('error');
      setMessage('Токен не найден. Повторите подключение MemeAlerts.');
      notifyOpener({
        type: 'memealerts_proxy_result',
        ok: false,
        status: 0,
        source: 'frontend-callback-no-token'
      });
      return;
    }

    const connect = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/memealerts/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken
          })
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Не удалось подключить MemeAlerts');
        }

        setStatus('success');
        setMessage('MemeAlerts подключен. Окно можно закрыть.');

        notifyOpener({
          type: 'memealerts_token',
          access_token: accessToken,
          refresh_token: refreshToken
        });
        notifyOpener({
          type: 'memealerts_proxy_result',
          ok: true,
          status: response.status,
          source: 'frontend-callback'
        });

        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, '', cleanUrl);

        window.setTimeout(() => {
          window.close();
        }, 350);
      } catch (error) {
        const err = error as Error;
        setStatus('error');
        setMessage(err.message || 'Ошибка подключения MemeAlerts');
        notifyOpener({
          type: 'memealerts_proxy_result',
          ok: false,
          status: 0,
          source: 'frontend-callback-error'
        });
      }
    };

    void connect();
  }, [tokens]);

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
            Вернуться в панель
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemeAlertsCallback;

