import React from 'react';

import { AlertTriangle, Bot, CheckCircle2, Layers3, ShieldCheck, Users } from 'lucide-react';

import { ADMIN_CARD_CLASS, AdminEmptyState } from '@/features/admin/components/admin-ui';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import AdminMetricCard from './AdminMetricCard';
import { buildOverviewStats, ProviderHealthCard, RuntimePlatformCard } from './OverviewCards';

import type { AdminPlatform, OverviewPayload, PlatformConfig } from '@/features/admin/types/adminReadModels';

export const OverviewStatsGrid: React.FC<{ data: OverviewPayload }> = ({ data }) => {
    const stats = buildOverviewStats(data);

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
                title="Пользователи"
                value={stats.totalUsers}
                caption={`${stats.activeToday} активны сегодня`}
                icon={Users}
            />
            <AdminMetricCard
                title="TTS сегодня"
                value={stats.requestsToday}
                caption="запросов синтеза за текущие сутки"
                icon={Layers3}
            />
            <AdminMetricCard
                title="Self Hosted TTS"
                value={stats.totalWorkers}
                caption={`${stats.onlineWorkers} работают, ${stats.offlineWorkers} не отвечают`}
                icon={Bot}
            />
            <AdminMetricCard
                title="Белый список"
                value={stats.whitelistTotal}
                caption={`${stats.activeChannels} активных каналов в системе`}
                icon={ShieldCheck}
            />
        </div>
    );
};

export const OverviewAlertsCard: React.FC<{
    alerts: NonNullable<OverviewPayload['alerts']>;
    isFetching: boolean;
    onRefresh: () => void;
}> = ({ alerts, isFetching, onRefresh }) => (
    <Card className={ADMIN_CARD_CLASS}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Критические сигналы</CardTitle>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
                {isFetching ? 'Обновляю...' : 'Обновить'}
            </Button>
        </CardHeader>
        <CardContent className="space-y-3">
            {alerts.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    Важных сигналов сейчас нет.
                </div>
            ) : (
                alerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                                <p className="text-sm text-muted-foreground">{alert.message}</p>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </CardContent>
    </Card>
);

export const OverviewPlatformsCard: React.FC<{ data: OverviewPayload }> = ({ data }) => {
    const bots = data.runtime?.bots ?? {};
    const tokens = data.runtime?.tokens ?? {};
    const platforms = Object.entries(data.platforms ?? {}) as Array<[AdminPlatform, PlatformConfig]>;

    return (
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <CardTitle className="text-base">Платформы и боты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {platforms.map(([platform, config]) => (
                    <RuntimePlatformCard
                        key={platform}
                        platform={platform}
                        config={config}
                        runtime={bots[platform]}
                        token={tokens[platform]}
                    />
                ))}
            </CardContent>
        </Card>
    );
};

export const OverviewTtsAndReadiness: React.FC<{ data: OverviewPayload }> = ({ data }) => {
    const providers = Object.entries(data.tts?.providers ?? {});
    const errors24h = data.stats?.system?.errors_24h ?? 0;
    const blockedChannels = data.channels?.blocked_total ?? 0;

    return (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            <Card className={ADMIN_CARD_CLASS}>
                <CardHeader>
                    <CardTitle className="text-base">TTS контур</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                    {providers.map(([provider, health]) => (
                        <ProviderHealthCard key={provider} provider={provider} health={health} />
                    ))}
                </CardContent>
            </Card>
            <Card className={ADMIN_CARD_CLASS}>
                <CardHeader>
                    <CardTitle className="text-base">Быстрая готовность</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <AdminMetricCard title="Ошибки 24ч" value={errors24h} />
                    <AdminMetricCard title="Заблокированные каналы" value={blockedChannels} />
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4" />
                            <span>
                                Админ-центр получает состояние из backend и показывает конкретную причину проблемы в
                                карточках выше.
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export const OverviewEmptyState: React.FC = () => (
    <AdminEmptyState
        title="Платформенные конфиги не загружены"
        description="Проверь backend admin overview contract и registry платформ."
        icon={AlertTriangle}
    />
);
