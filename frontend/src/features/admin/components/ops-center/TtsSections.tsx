import React from 'react';

import { ADMIN_CARD_CLASS } from '@/features/admin/components/admin-ui';
import { statusBadgeClass } from '@/features/admin/types/adminReadModels';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import AdminMetricCard from './AdminMetricCard';

import type { ProviderRecord, TtsPayload } from '@/features/admin/types/adminReadModels';

const capabilityEntries = (provider: ProviderRecord): Array<[string, boolean]> =>
    Object.entries(provider.capabilities ?? {}).filter(([, value]) => typeof value === 'boolean') as Array<
        [string, boolean]
    >;

const modeLabel = (mode: string): string => {
    if (mode === 'cloud') return 'Сервер';
    if (mode === 'self_host') return 'Локально';
    return mode;
};

const statusLabel = (health: ProviderRecord['health']): string => {
    if (health?.healthy) return 'отвечает';
    if (health?.error_code === 'provider_unreachable') return 'не отвечает';
    if (health?.status === 'unconfigured') return 'не настроен';
    return health?.status ?? 'нет данных';
};

const diagnosticsLabel = (health: ProviderRecord['health']): string => {
    if (health?.healthy) return 'Сервис отвечает.';
    if (health?.error_code === 'provider_unreachable')
        return 'Сервис не отвечает. Запустите локальный TTS или проверьте адрес.';
    return health?.message ?? 'Проверка сервиса не прошла.';
};

const routeLabel = (health: ProviderRecord['health']): string => {
    if (!health?.via) return 'Нет данных';
    return health.via === 'gateway' ? 'Через backend' : 'Напрямую';
};

const ProviderCard: React.FC<{ provider: string; record: ProviderRecord }> = ({ provider, record }) => {
    const health = record.health;
    const modes = (record.official_modes ?? ['cloud', 'self_host']).map(modeLabel).join(', ');
    const diagnostics = diagnosticsLabel(health);
    const status = statusLabel(health);

    return (
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base uppercase tracking-wide">{provider}</CardTitle>
                    <Badge variant="outline" className={statusBadgeClass(Boolean(health?.healthy))}>
                        {status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Маршрут</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{routeLabel(health)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{modes}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Диагностика</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{diagnostics}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {capabilityEntries(record).map(([capability, enabled]) => (
                        <Badge
                            key={capability}
                            variant="outline"
                            className={
                                enabled
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                    : 'border-border/70 bg-background/60 text-muted-foreground'
                            }
                        >
                            {capability}
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export const TtsProviderGrid: React.FC<{ data: TtsPayload }> = ({ data }) => (
    <div className="grid gap-4 xl:grid-cols-2">
        {Object.entries(data.providers ?? {}).map(([provider, providerData]) => (
            <ProviderCard key={provider} provider={provider} record={providerData} />
        ))}
    </div>
);

export const TtsFleetSummaryCard: React.FC<{ data: TtsPayload }> = ({ data }) => {
    const summary = data.workers?.summary;

    return (
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <CardTitle className="text-base">Локальные TTS-программы</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
                <AdminMetricCard title="Всего" value={summary?.total ?? 0} />
                <AdminMetricCard title="Работают" value={summary?.online ?? 0} />
                <AdminMetricCard title="Серверные" value={summary?.managed ?? 0} />
                <AdminMetricCard title="Локальные" value={summary?.self_hosted ?? 0} />
            </CardContent>
        </Card>
    );
};
