import React from 'react';

import type { AdminPlatform, OverviewPayload, PlatformConfig, ProviderHealth, RuntimeBotStatus, TokenStatus } from '@/features/admin/types/adminReadModels';
import { statusBadgeClass } from '@/features/admin/types/adminReadModels';
import { Badge } from '@/shared/components/ui/badge';

export interface OverviewStatsModel {
  totalUsers: number;
  activeToday: number;
  requestsToday: number;
  totalWorkers: number;
  onlineWorkers: number;
  offlineWorkers: number;
  whitelistTotal: number;
  activeChannels: number;
}

const numberValue = (value: number | undefined): number => value ?? 0;

export const buildOverviewStats = (data: OverviewPayload): OverviewStatsModel => {
  const workers = data.runtime?.workers?.summary;

  return {
    totalUsers: numberValue(data.stats?.users?.total),
    activeToday: numberValue(data.stats?.users?.active_today),
    requestsToday: numberValue(data.stats?.tts?.requests_today),
    totalWorkers: numberValue(workers?.total),
    onlineWorkers: numberValue(workers?.online),
    offlineWorkers: numberValue(workers?.offline),
    whitelistTotal: numberValue(data.accounts?.whitelist_total),
    activeChannels: numberValue(data.channels?.active_total),
  };
};

const providerStatusLabel = (health: ProviderHealth): string => health.healthy ? 'healthy' : (health.status ?? 'offline');

export const RuntimePlatformCard: React.FC<{
  platform: AdminPlatform;
  config: PlatformConfig;
  runtime?: RuntimeBotStatus;
  token?: TokenStatus;
}> = ({ platform, config, runtime, token }) => {
  const ready = Boolean(runtime?.connected && (runtime?.is_ready !== false || runtime?.is_running));
  const channelCount = numberValue(runtime?.channels);
  const displayName = config.display_name ?? platform.toUpperCase();
  const tokenLabel = token?.configured ? 'подключён' : 'не настроен';

  return (
    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{channelCount} каналов, token {tokenLabel}</p>
        </div>
        <Badge variant="outline" className={statusBadgeClass(ready)}>
          {ready ? 'runtime ready' : 'runtime degraded'}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(config.capabilities ?? {}).map(([capability, enabled]) => (
          <Badge key={capability} variant="outline" className={statusBadgeClass(Boolean(enabled))}>
            {capability}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export const ProviderHealthCard: React.FC<{ provider: string; health: ProviderHealth }> = ({ provider, health }) => (
  <div className="rounded-xl border border-border/70 bg-background/55 p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium uppercase tracking-wide text-foreground">{provider}</p>
      <Badge variant="outline" className={statusBadgeClass(Boolean(health.healthy))}>
        {providerStatusLabel(health)}
      </Badge>
    </div>
    <p className="mt-2 text-sm text-muted-foreground">{health.message ?? 'Cloud healthcheck проходит без ошибок.'}</p>
  </div>
);
