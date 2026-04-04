import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Info,
  LogIn,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
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

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75 backdrop-blur-sm shadow-none';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 hover:bg-muted/60 shadow-none';

const PLATFORM_META: Record<Platform, { label: string; color: string }> = {
  twitch: { label: 'Twitch', color: '#9146ff' },
  vk: { label: 'VK Live', color: '#0077ff' },
};

/** SVG icons */
const TwitchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
  </svg>
);

const VKIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.339-3.202-2.17-3.048-2.763-5.339-2.763-5.805 0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.864 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" />
  </svg>
);

const PlatformIcon: React.FC<{ platform: Platform; className?: string }> = ({ platform, className }) =>
  platform === 'twitch' ? <TwitchIcon className={className} /> : <VKIcon className={className} />;

/* ─── helpers ─── */
const withBusy = async (
  setBusy: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  key: string,
  fn: () => Promise<void>,
) => {
  setBusy(prev => ({ ...prev, [key]: true }));
  try { await fn(); } finally { setBusy(prev => ({ ...prev, [key]: false })); }
};

const formatTokenTimeLeft = (status: BotTokenStatus): string => {
  if (typeof status.seconds_left !== 'number') {
    return `${status.days_left ?? '?'} days left`;
  }

  if (status.seconds_left <= 0) return 'expired';

  const days = Math.floor(status.seconds_left / 86400);
  const hours = Math.floor((status.seconds_left % 86400) / 3600);
  const minutes = Math.floor((status.seconds_left % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(minutes, 1)}m left`;
};

/* ─── component ─── */
const BotManagementPage: React.FC = () => {
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

  /* ─── data fetching ─── */
  const fetchRuntimeStatus = useCallback(async () => {
    const response = await adminService.getBotsStatus();
    const data = response.data as { bots?: Record<Platform, PlatformBotRuntime> };
    if (data.bots) {
      setRuntimeBots({
        twitch: data.bots.twitch ?? { connected: false, channels: 0 },
        vk: data.bots.vk ?? { connected: false, channels: 0 },
      });
    }
  }, []);

  const fetchTokenStatus = useCallback(async (platform: Platform) => {
    const response = await adminService.getBotTokenStatus(platform);
    const data = response.data as unknown as BotTokenStatus;
    setTokenStatus(prev => ({
      ...prev,
      [platform]: {
        configured: Boolean(data?.configured),
        bot_login: data?.bot_login,
        days_left: data?.days_left ?? null,
        hours_left: data?.hours_left ?? null,
        seconds_left: data?.seconds_left ?? null,
        needs_refresh: data?.needs_refresh,
        has_refresh_token: data?.has_refresh_token,
      },
    }));
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchRuntimeStatus(), fetchTokenStatus('twitch'), fetchTokenStatus('vk')]);
    } catch (error) {
      logger.error('Failed to refresh bot management data', error);
      toast.error('Failed to refresh bot status');
    } finally {
      setLoading(false);
    }
  }, [fetchRuntimeStatus, fetchTokenStatus]);

  /* ─── actions ─── */
  const handleRestartBotService = () =>
    withBusy(setBusy, 'restart', async () => {
      try {
        await adminService.restartBotService();
        toast.success('Bot service restarted');
        await fetchRuntimeStatus();
      } catch {
        toast.error('Failed to restart bot service');
      }
    });

  const handleAuthorize = (platform: Platform) => {
    const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, `/auth/${platform}/bot/login`);
    if (!safeUrl) {
      logger.error('Blocked unsafe bot OAuth redirect URL', { platform, API_BASE_URL });
      toast.error('Некорректный URL авторизации бота');
      return;
    }
    window.location.href = safeUrl;
  };

  const handleCreateLink = (platform: Platform) =>
    withBusy(setBusy, `link-${platform}`, async () => {
      try {
        const response = await adminService.createBotLoginLink(platform);
        const data = response.data as { url?: string };
        if (!data.url) { toast.error('Backend did not return login URL'); return; }
        setOneTimeLink({ platform, url: data.url });
        toast.success(`${PLATFORM_META[platform].label} one-time link created`);
      } catch {
        toast.error(`Failed to create ${PLATFORM_META[platform].label} link`);
      }
    });

  const handleCopyLink = async () => {
    if (!oneTimeLink) return;
    try {
      await navigator.clipboard.writeText(oneTimeLink.url);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleRefreshToken = (platform: Platform) =>
    withBusy(setBusy, `refresh-${platform}`, async () => {
      try {
        const response = await adminService.refreshBotToken(platform);
        const data = response.data as { success?: boolean; message?: string };
        if (!data.success) { toast.error(data.message || 'Refresh failed'); return; }
        toast.success(data.message || `${PLATFORM_META[platform].label} token refreshed`);
        await Promise.all([fetchTokenStatus(platform), fetchRuntimeStatus()]);
      } catch {
        toast.error(`Failed to refresh ${PLATFORM_META[platform].label} token`);
      }
    });

  /* ─── OAuth return feedback ─── */
  useEffect(() => {
    const success = searchParams.get('bot_auth_success');
    const error = searchParams.get('bot_auth_error');
    const platform = searchParams.get('platform');

    if (success === 'true') {
      toast.success(`${platform === 'vk' ? 'VK' : 'Twitch'} bot authorized`);
      navigate('/dashboard/dolbaebadmintts?tab=bots', { replace: true });
    } else if (error) {
      toast.error(`Bot auth failed: ${formatBotAuthError(error, 'en')}`);
      navigate('/dashboard/dolbaebadmintts?tab=bots', { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  /* ─── derived state ─── */
  const formatChannelCount = (count: number) => `${count} ${count === 1 ? 'channel' : 'channels'}`;

  const runtimeSummary = useMemo(() => {
    const twitchOk = runtimeBots.twitch.connected && (runtimeBots.twitch.is_ready !== false);
    const vkOk = runtimeBots.vk.connected && runtimeBots.vk.is_running;
    const count = [twitchOk, vkOk].filter(Boolean).length;
    if (count === 0) return 'No active bot runtimes';
    return `${count}/2 runtimes online`;
  }, [runtimeBots]);

  const getBadge = (platform: Platform) => {
    const token = tokenStatus[platform];
    const runtime = runtimeBots[platform];
    if (!token.configured) return { label: 'Not configured', variant: 'destructive' as const };
    if (runtime.connected && (runtime.is_ready !== false || runtime.is_running))
      return { label: 'Connected', variant: 'default' as const };
    if (token.needs_refresh) return { label: 'Needs refresh', variant: 'secondary' as const };
    return { label: 'Ready', variant: 'outline' as const };
  };

  /* ─── render ─── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bot Connect</h2>
          <p className="text-sm text-muted-foreground">Manage dedicated bot OAuth tokens for Twitch and VK Live</p>
        </div>
        <Button variant="outline" size="sm" className={ACTION_BUTTON_CLASS} onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Runtime card */}
      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Bot runtime</CardTitle>
            <span className="text-xs text-muted-foreground">{runtimeSummary}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {(['twitch', 'vk'] as Platform[]).map(p => {
                const rt = runtimeBots[p];
                const online = rt.connected && (rt.is_ready !== false || rt.is_running);
                return (
                  <Badge key={p} variant={online ? 'default' : 'secondary'} className="gap-1.5">
                    <PlatformIcon platform={p} className="h-3 w-3" />
                    {PLATFORM_META[p].label}: {online ? formatChannelCount(rt.channels || 0) : 'offline'}
                  </Badge>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`ml-auto ${ACTION_BUTTON_CLASS}`}
              onClick={handleRestartBotService}
              disabled={busy['restart']}
            >
              <Server className="h-3.5 w-3.5 mr-1.5" />
              Restart
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {(['twitch', 'vk'] as Platform[]).map(platform => {
          const status = tokenStatus[platform];
          const badge = getBadge(platform);
          const meta = PLATFORM_META[platform];
          const releaseInfo = getPlatformReleaseInfo(platform);

          return (
            <Card key={platform} className={SURFACE_CARD_CLASS}>
              <CardHeader className="py-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={platform} className="h-5 w-5" />
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base" style={{ color: meta.color }}>
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
                {status.configured && (
                  <CardDescription className="mt-1">
                    Bot: <strong>{status.bot_login || 'unknown'}</strong>
                  </CardDescription>
                )}
                {!status.configured && releaseInfo.helperText ? (
                  <CardDescription className="mt-1">
                    {releaseInfo.helperText}
                  </CardDescription>
                ) : null}
              </CardHeader>

              <CardContent className="pt-0 pb-4 space-y-3">
                {status.configured ? (
                  <>
                    {/* Token details */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTokenTimeLeft(status)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Refresh: {status.has_refresh_token ? 'yes' : 'no'}
                      </span>
                    </div>

                    {/* Actions for configured bot */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-border/70 hover:bg-muted/60"
                        onClick={() => handleRefreshToken(platform)}
                        disabled={busy[`refresh-${platform}`]}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${busy[`refresh-${platform}`] ? 'animate-spin' : ''}`} />
                        Refresh token
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-border/70 hover:bg-muted/60"
                        onClick={() => handleCreateLink(platform)}
                        disabled={busy[`link-${platform}`]}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        One-time link
                      </Button>
                      {oneTimeLink?.platform === platform && (
                        <Button variant="outline" size="sm" className="h-8 border-border/70 hover:bg-muted/60" onClick={handleCopyLink}>
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Copy link
                        </Button>
                      )}
                    </div>

                    {/* One-time link display */}
                    {oneTimeLink?.platform === platform && (
                      <div className="rounded border border-border/70 bg-card/60 p-2 text-xs break-all">
                        <span className="text-muted-foreground">Link: </span>
                        {oneTimeLink.url}
                      </div>
                    )}
                  </>
                ) : (
                  /* Not configured — setup card */
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/70 border-dashed bg-card/60 p-3">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-foreground">First-time setup</p>
                          <ol className="list-decimal list-inside space-y-0.5 text-xs text-muted-foreground">
                            <li>Click <strong>Authorize bot</strong> below</li>
                            <li>Log in with the <strong>bot account</strong> on {meta.label}</li>
                            <li>Token is saved — bot starts automatically</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleAuthorize(platform)}
                      className="w-full"
                      style={{ backgroundColor: meta.color, borderColor: meta.color }}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Authorize bot
                    </Button>

                    <p className="text-[11px] text-center text-muted-foreground">
                      Or use a{' '}
                      <button
                        className="underline hover:text-foreground"
                        onClick={() => handleCreateLink(platform)}
                        disabled={busy[`link-${platform}`]}
                      >
                        one-time link
                      </button>{' '}
                      to authorize from another browser
                    </p>
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

export default BotManagementPage;
