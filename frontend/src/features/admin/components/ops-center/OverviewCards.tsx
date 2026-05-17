import React from 'react';

import { statusBadgeClass } from '@/features/admin/types/adminReadModels';
import { Badge } from '@/shared/components/ui/badge';

import { buildRuntimePlatformCardModel } from './OverviewCardsViewModel';

import type {
    AdminPlatform,
    OverviewPayload,
    PlatformConfig,
    ProviderHealth,
    RuntimeBotStatus,
    TokenStatus,
} from '@/features/admin/types/adminReadModels';

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

// eslint-disable-next-line react-refresh/only-export-components
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

const providerStatusLabel = (health: ProviderHealth): string => {
    if (health.healthy) return 'отвечает';
    if (health.error_code === 'provider_unreachable') return 'не отвечает';
    if (health.status === 'unconfigured') return 'не настроен';
    return health.status ?? 'ошибка';
};

const providerMessage = (health: ProviderHealth): string => {
    if (health.healthy) return 'Сервис отвечает.';
    if (health.error_code === 'provider_unreachable')
        return 'Сервис не отвечает. Запустите локальный TTS или проверьте адрес.';
    return health.message ?? 'Проверка сервиса не прошла.';
};

export const RuntimePlatformCard: React.FC<{
    platform: AdminPlatform;
    config: PlatformConfig;
    runtime?: RuntimeBotStatus;
    token?: TokenStatus;
}> = ({ platform, config, runtime, token }) => {
    const model = buildRuntimePlatformCardModel(config, runtime, token);
    const channelCount = numberValue(runtime?.channels);
    const displayName = model.displayName ?? platform.toUpperCase();

    return (
        <div className="rounded-xl border border-border/70 bg-background/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium text-foreground">{displayName}</p>
                    <p className="text-xs text-muted-foreground">
                        {channelCount} каналов, доступ {model.tokenLabel}
                    </p>
                </div>
                <Badge variant="outline" className={model.badgeClass}>
                    {model.badgeLabel}
                </Badge>
            </div>
            {model.tokenScopesMissing.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    Нет прав: {model.tokenScopesMissing.join(', ')}. Переавторизуйте бота.
                </div>
            ) : null}
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
        <p className="mt-2 text-sm text-muted-foreground">{providerMessage(health)}</p>
    </div>
);
