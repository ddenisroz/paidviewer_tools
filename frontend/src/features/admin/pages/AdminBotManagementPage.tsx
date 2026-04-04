import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  LogIn,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
import {
  AdminPageHeader,
  ADMIN_ACTION_BUTTON_CLASS,
  ADMIN_CARD_CLASS,
} from '@/features/admin/components/admin-ui';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';
import { getPlatformReleaseInfo } from '@/shared/utils/platformRelease';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';
import { formatBotAuthError } from '../utils/botAuthMessages';

type Platform = 'twitch' | 'vk';

interface BotTokenStatus {
  configured: boolean;
  bot_login?: string;
  days_left?: number | null;
  hours_left?: number | null;
  seconds_left?: number | null;
  needs_refresh?: boolean;
  has_refresh_token?: boolean;
}

interface PlatformBotRuntime {
  connected: boolean;
  channels: number;
  is_ready?: boolean;
  is_running?: boolean;
}

const PLATFORM_META: Record<Platform, { label: string; accent: string }> = {
  twitch: { label: 'Twitch', accent: '#9146ff' },
  vk: { label: 'VK Live', accent: '#0077ff' },
};

const TwitchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
  </svg>
);

const VkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.339-3.202-2.17-3.048-2.763-5.339-2.763-5.805 0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.864 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" />
  </svg>
);

const PlatformIcon: React.FC<{ platform: Platform; className?: string }> = ({ platform, className }) =>
  platform === 'twitch' ? <TwitchIcon className={className} /> : <VkIcon className={className} />;

const withBusy = async (
  setBusy: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  key: string,
  fn: () => Promise<void>,
): Promise<void> => {
  setBusy(prev => ({ ...prev, [key]: true }));
  try {
    await fn();
  } finally {
    setBusy(prev => ({ ...prev, [key]: false }));
  }
};

const formatTokenTimeLeft = (status: BotTokenStatus): string => {
  if (typeof status.seconds_left !== 'number') {
    return 'Срок неизвестен';
  }
  if (status.seconds_left <= 0) {
    return 'Токен истёк';
  }

  const days = Math.floor(status.seconds_left / 86400);
  const hours = Math.floor((status.seconds_left % 86400) / 3600);
  const minutes = Math.floor((status.seconds_left % 3600) / 60);

  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${Math.max(minutes, 1)} мин`;
};

const formatChannelCount = (channels: number): string => {
  const lastDigit = channels % 10;
  const lastTwoDigits = channels % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) return `${channels} канал`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
    return `${channels} канала`;
  }

  return `${channels} каналов`;
};

const AdminBotManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [runtimeBots, setRuntimeBots] = useState<Record<Platform, PlatformBotRuntime>>({
    twitch: { connected: false, channels: 0 },
    vk: { connected: false, channels: 0 },
  });
  const [tokenStatus, setTokenStatus] = useState<Record<Platform, BotTokenStatus>>({
    twitch: { configured: false },
    vk: { configured: false },
  });
  const [oneTimeLink, setOneTimeLink] = useState<{ platform: Platform; url: string } | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const fetchRuntimeStatus = useCallback(async () => {
    const response = await adminService.getBotsStatus();
    const payload = response.data as { bots?: Record<Platform, PlatformBotRuntime> };

    if (payload.bots) {
      setRuntimeBots({
        twitch: payload.bots.twitch ?? { connected: false, channels: 0 },
        vk: payload.bots.vk ?? { connected: false, channels: 0 },
      });
    }
  }, []);

  const fetchTokenStatus = useCallback(async (platform: Platform) => {
    const response = await adminService.getBotTokenStatus(platform);
    const payload = response.data as unknown as BotTokenStatus;

    setTokenStatus(prev => ({
      ...prev,
      [platform]: {
        configured: Boolean(payload?.configured),
        bot_login: payload?.bot_login,
        days_left: payload?.days_left ?? null,
        hours_left: payload?.hours_left ?? null,
        seconds_left: payload?.seconds_left ?? null,
        needs_refresh: payload?.needs_refresh,
        has_refresh_token: payload?.has_refresh_token,
      },
    }));
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchRuntimeStatus(), fetchTokenStatus('twitch'), fetchTokenStatus('vk')]);
    } catch (error) {
      logger.error('Failed to refresh admin bot state', error);
      toast.error('Не удалось обновить состояние bot runtime');
    } finally {
      setLoading(false);
    }
  }, [fetchRuntimeStatus, fetchTokenStatus]);

  const handleRestartBotService = (): Promise<void> =>
    withBusy(setBusy, 'restart', async () => {
      try {
        await adminService.restartBotService();
        toast.success('Команда на перезапуск отправлена');
        await fetchRuntimeStatus();
      } catch {
        toast.error('Не удалось отправить команду на перезапуск');
      }
    });

  const handleAuthorize = (platform: Platform): void => {
    const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, `/auth/${platform}/bot/login`);
    if (!safeUrl) {
      logger.error('Blocked unsafe bot auth redirect', { platform, API_BASE_URL });
      toast.error('Некорректный URL авторизации');
      return;
    }

    window.location.href = safeUrl;
  };

  const handleCreateLink = (platform: Platform): Promise<void> =>
    withBusy(setBusy, `link-${platform}`, async () => {
      try {
        const response = await adminService.createBotLoginLink(platform);
        const payload = response.data as { url?: string };
        if (!payload.url) {
          toast.error('Backend не вернул ссылку');
          return;
        }
        setOneTimeLink({ platform, url: payload.url });
        toast.success(`Разовая ссылка для ${PLATFORM_META[platform].label} готова`);
      } catch {
        toast.error('Не удалось создать разовую ссылку');
      }
    });

  const handleCopyLink = async (): Promise<void> => {
    if (!oneTimeLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(oneTimeLink.url);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleRefreshToken = (platform: Platform): Promise<void> =>
    withBusy(setBusy, `refresh-${platform}`, async () => {
      try {
        const response = await adminService.refreshBotToken(platform);
        const payload = response.data as { success?: boolean; message?: string };
        if (!payload.success) {
          toast.error(payload.message || 'Обновление токена не удалось');
          return;
        }
        toast.success(payload.message || 'Токен обновлён');
        await Promise.all([fetchTokenStatus(platform), fetchRuntimeStatus()]);
      } catch {
        toast.error('Не удалось обновить токен');
      }
    });

  useEffect(() => {
    const success = searchParams.get('bot_auth_success');
    const errorCode = searchParams.get('bot_auth_error');
    const error = errorCode ? formatBotAuthError(errorCode, 'ru') : null;
    const platform = searchParams.get('platform');

    if (success === 'true') {
      toast.success(`${platform === 'vk' ? 'VK Live' : 'Twitch'} бот авторизован`);
      navigate('/dashboard/dolbaebadmintts?tab=bots', { replace: true });
    } else if (error) {
      toast.error(`Ошибка авторизации: ${error}`);
      navigate('/dashboard/dolbaebadmintts?tab=bots', { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const runtimeSummary = useMemo(() => {
    const twitchOnline = runtimeBots.twitch.connected && runtimeBots.twitch.is_ready !== false;
    const vkOnline = runtimeBots.vk.connected && runtimeBots.vk.is_running;
    const connectedCount = [twitchOnline, vkOnline].filter(Boolean).length;

    return `${connectedCount}/2 bot runtime подключены`;
  }, [runtimeBots]);

  const getBadge = (platform: Platform) => {
    const token = tokenStatus[platform];
    const runtime = runtimeBots[platform];

    if (!token.configured) return { label: 'Не настроен', variant: 'destructive' as const };
    if (runtime.connected && (runtime.is_ready !== false || runtime.is_running)) {
      return { label: 'Подключён', variant: 'default' as const };
    }
    if (token.needs_refresh) return { label: 'Нужно обновить', variant: 'secondary' as const };
    return { label: 'Готов', variant: 'outline' as const };
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bot runtime и OAuth"
        description="Управление токенами ботов Twitch и VK Live, проверка статуса и выпуск разовых ссылок авторизации."
        actions={
          <Button
            variant="outline"
            size="sm"
            className={ADMIN_ACTION_BUTTON_CLASS}
            onClick={() => void refreshAll()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        }
        meta={
          <Badge variant="outline" className="border-border/70 bg-background/60 text-muted-foreground">
            {runtimeSummary}
          </Badge>
        }
      />

      <Card className={ADMIN_CARD_CLASS}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Текущее состояние</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-2">
            {(['twitch', 'vk'] as Platform[]).map(platform => {
              const runtime = runtimeBots[platform];
              const online = runtime.connected && (runtime.is_ready !== false || runtime.is_running);

              return (
                <Badge key={platform} variant={online ? 'default' : 'secondary'} className="gap-2 px-3 py-1.5">
                  <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
                  <span>
                    {PLATFORM_META[platform].label}: {online ? formatChannelCount(runtime.channels || 0) : 'не в сети'}
                  </span>
                </Badge>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`md:ml-auto ${ADMIN_ACTION_BUTTON_CLASS}`}
            onClick={() => void handleRestartBotService()}
            disabled={busy.restart}
          >
            <Server className="mr-2 h-4 w-4" />
            Перезапустить runtime
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(['twitch', 'vk'] as Platform[]).map(platform => {
          const status = tokenStatus[platform];
          const badge = getBadge(platform);
          const meta = PLATFORM_META[platform];
          const releaseInfo = getPlatformReleaseInfo(platform);

          return (
            <Card key={platform} className={ADMIN_CARD_CLASS}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={platform} className="h-5 w-5" />
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base" style={{ color: meta.accent }}>
                        {meta.label}
                      </CardTitle>
                      {releaseInfo.badgeLabel ? (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
                          {releaseInfo.badgeLabel}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                {status.configured ? (
                  <CardDescription>
                    Аккаунт бота: <strong>{status.bot_login || 'неизвестно'}</strong>
                  </CardDescription>
                ) : (
                  <CardDescription>Токен ещё не подключён.</CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {status.configured ? (
                  <>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTokenTimeLeft(status)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Обновление токена: {status.has_refresh_token ? 'есть' : 'нет'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={ADMIN_ACTION_BUTTON_CLASS}
                        onClick={() => void handleRefreshToken(platform)}
                        disabled={busy[`refresh-${platform}`]}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${busy[`refresh-${platform}`] ? 'animate-spin' : ''}`} />
                        Обновить токен
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={ADMIN_ACTION_BUTTON_CLASS}
                        onClick={() => void handleCreateLink(platform)}
                        disabled={busy[`link-${platform}`]}
                      >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Разовая ссылка
                      </Button>
                      {oneTimeLink?.platform === platform ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className={ADMIN_ACTION_BUTTON_CLASS}
                          onClick={() => void handleCopyLink()}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Скопировать
                        </Button>
                      ) : null}
                    </div>

                    {oneTimeLink?.platform === platform ? (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-xs break-all text-muted-foreground">
                        {oneTimeLink.url}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Авторизуй бота под отдельной учётной записью. Токен сохранится в базе и будет использоваться runtime.
                    </p>
                    <Button
                      type="button"
                      onClick={() => handleAuthorize(platform)}
                      className="w-full"
                      style={{ backgroundColor: meta.accent, borderColor: meta.accent }}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Авторизовать бота
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={ADMIN_ACTION_BUTTON_CLASS}
                      onClick={() => void handleCreateLink(platform)}
                      disabled={busy[`link-${platform}`]}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Получить разовую ссылку
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminBotManagementPage;
