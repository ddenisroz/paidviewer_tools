import React from 'react';

import { Copy, Link as LinkIcon, LogIn, RefreshCw } from 'lucide-react';

import { ADMIN_ACTION_BUTTON_CLASS, ADMIN_CARD_CLASS } from '@/features/admin/components/admin-ui';
import type { AdminPlatform, RuntimePayload, RuntimeWorker, TokenStatus } from '@/features/admin/types/adminReadModels';
import { formatTokenLifetime, PLATFORM_META, statusBadgeClass } from '@/features/admin/types/adminReadModels';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import AdminMetricCard from './AdminMetricCard';

const numberValue = (value: number | undefined): number => value ?? 0;

const tokenLoginLabel = (token?: TokenStatus): string => token?.bot_login ?? 'Бот ещё не авторизован';
const tokenLifetimeLabel = (token?: TokenStatus): string => token?.configured ? formatTokenLifetime(token.seconds_left) : 'OAuth нужен перед запуском';
const runtimeReady = (connected?: boolean, isReady?: boolean, isRunning?: boolean): boolean => Boolean(connected && (isReady !== false || isRunning));
const channelSummary = (channels: number, configured: boolean): string => `${channels} каналов, token ${configured ? 'настроен' : 'отсутствует'}`;
const linkVisible = (platform: AdminPlatform, link: { platform: AdminPlatform; url: string } | null): boolean => link?.platform === platform;

const TokenSummary: React.FC<{ token?: TokenStatus; ready: boolean }> = ({ token, ready }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Токен</p>
      <p className="mt-2 text-sm font-medium text-foreground">{tokenLoginLabel(token)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{tokenLifetimeLabel(token)}</p>
    </div>
    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Состояние</p>
      <p className="mt-2 text-sm font-medium text-foreground">{ready ? 'Подключён и готов' : 'Требует внимания'}</p>
      <p className="mt-1 text-xs text-muted-foreground">refresh token: {token?.has_refresh_token ? 'есть' : 'нет'}</p>
    </div>
  </div>
);

const RuntimeActions: React.FC<{
  platform: AdminPlatform;
  configured: boolean;
  accent: string;
  busy: Record<string, boolean>;
  showCopy: boolean;
  onAuthorize: (platform: AdminPlatform) => void;
  onRefreshToken: (platform: AdminPlatform) => Promise<void>;
  onCreateLink: (platform: AdminPlatform) => Promise<void>;
  onCopyLink: () => Promise<void>;
}> = ({ platform, configured, accent, busy, showCopy, onAuthorize, onRefreshToken, onCreateLink, onCopyLink }) => (
  <div className="flex flex-wrap gap-2">
    {configured ? (
      <Button variant="outline" size="sm" className={ADMIN_ACTION_BUTTON_CLASS} onClick={() => void onRefreshToken(platform)} disabled={busy[`refresh-${platform}`]}>
        <RefreshCw className={`mr-2 h-4 w-4 ${busy[`refresh-${platform}`] ? 'animate-spin' : ''}`} />
        Обновить токен
      </Button>
    ) : (
      <Button size="sm" onClick={() => onAuthorize(platform)} style={{ backgroundColor: accent, borderColor: accent }}>
        <LogIn className="mr-2 h-4 w-4" />
        Авторизовать бота
      </Button>
    )}
    <Button variant="outline" size="sm" className={ADMIN_ACTION_BUTTON_CLASS} onClick={() => void onCreateLink(platform)} disabled={busy[`link-${platform}`]}>
      <LinkIcon className="mr-2 h-4 w-4" />
      Разовая ссылка
    </Button>
    {showCopy ? (
      <Button variant="outline" size="sm" className={ADMIN_ACTION_BUTTON_CLASS} onClick={() => void onCopyLink()}>
        <Copy className="mr-2 h-4 w-4" />
        Скопировать
      </Button>
    ) : null}
  </div>
);

const WorkerRow: React.FC<{ worker: RuntimeWorker }> = ({ worker }) => {
  const isOnline = worker.status === 'online' || worker.status === 'busy';

  return (
    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{worker.label ?? 'TTS Worker'}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{worker.worker_key}</p>
        </div>
        <Badge variant="outline" className={statusBadgeClass(isOnline)}>{worker.status}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-border/70 bg-background/70">{worker.is_managed ? 'managed' : 'self-host'}</Badge>
        {worker.supports_f5 ? <Badge variant="outline">F5</Badge> : null}
        {worker.supports_qwen ? <Badge variant="outline">Qwen</Badge> : null}
        {worker.runtime_metadata?.hostname ? <Badge variant="outline" className="border-border/70 bg-background/70">{worker.runtime_metadata.hostname}</Badge> : null}
      </div>
    </div>
  );
};

export const RuntimePlatformCard: React.FC<{
  platform: AdminPlatform;
  data: RuntimePayload;
  busy: Record<string, boolean>;
  oneTimeLink: { platform: AdminPlatform; url: string } | null;
  onAuthorize: (platform: AdminPlatform) => void;
  onRefreshToken: (platform: AdminPlatform) => Promise<void>;
  onCreateLink: (platform: AdminPlatform) => Promise<void>;
  onCopyLink: () => Promise<void>;
}> = ({ platform, data, busy, oneTimeLink, onAuthorize, onRefreshToken, onCreateLink, onCopyLink }) => {
  const runtime = data.bots?.[platform];
  const token = data.tokens?.[platform];
  const meta = PLATFORM_META[platform];
  const ready = runtimeReady(runtime?.connected, runtime?.is_ready, runtime?.is_running);
  const configured = Boolean(token?.configured);
  const channels = numberValue(runtime?.channels);
  const hasCopyLink = linkVisible(platform, oneTimeLink);

  return (
    <Card className={ADMIN_CARD_CLASS}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base" style={{ color: meta.accent }}>{meta.label}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{channelSummary(channels, configured)}</p>
          </div>
          <Badge variant="outline" className={statusBadgeClass(ready)}>{ready ? 'runtime ready' : 'runtime degraded'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TokenSummary token={token} ready={ready} />
        <RuntimeActions
          platform={platform}
          configured={configured}
          accent={meta.accent}
          busy={busy}
          showCopy={hasCopyLink}
          onAuthorize={onAuthorize}
          onRefreshToken={onRefreshToken}
          onCreateLink={onCreateLink}
          onCopyLink={onCopyLink}
        />
        {hasCopyLink ? <div className="rounded-xl border border-border/70 bg-background/55 p-3 text-xs break-all text-muted-foreground">{oneTimeLink?.url}</div> : null}
      </CardContent>
    </Card>
  );
};

export const RuntimeWorkersCard: React.FC<{ data: RuntimePayload }> = ({ data }) => {
  const summary = data.workers?.summary;
  const items = (data.workers?.items ?? []).slice(0, 6);

  return (
    <Card className={ADMIN_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">Worker-agent контур</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <AdminMetricCard title="Всего" value={numberValue(summary?.total)} />
          <AdminMetricCard title="Online" value={numberValue(summary?.online)} />
          <AdminMetricCard title="Managed" value={numberValue(summary?.managed)} />
          <AdminMetricCard title="Self-host" value={numberValue(summary?.self_hosted)} />
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map(worker => <WorkerRow key={worker.worker_key} worker={worker} />)}
        </div>
      </CardContent>
    </Card>
  );
};
