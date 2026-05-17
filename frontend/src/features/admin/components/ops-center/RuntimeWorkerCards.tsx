import React from 'react';

import { ADMIN_CARD_CLASS } from '@/features/admin/components/admin-ui';
import { statusBadgeClass } from '@/features/admin/types/adminReadModels';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import AdminMetricCard from './AdminMetricCard';

import type { RuntimePayload, RuntimeWorker } from '@/features/admin/types/adminReadModels';

const numberValue = (value: number | undefined): number => value ?? 0;

const WorkerRow: React.FC<{ worker: RuntimeWorker }> = ({ worker }) => {
    const isOnline = worker.status === 'online' || worker.status === 'busy';

    return (
        <div className="rounded-xl border border-border/70 bg-background/55 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-foreground">{worker.label ?? 'TTS Worker'}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{worker.worker_key}</p>
                </div>
                <Badge variant="outline" className={statusBadgeClass(isOnline)}>
                    {worker.status}
                </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="border-border/70 bg-background/70">
                    {worker.is_managed ? 'Серверная' : 'Локальная'}
                </Badge>
                {worker.supports_f5 ? <Badge variant="outline">F5</Badge> : null}
                {worker.runtime_metadata?.hostname ? (
                    <Badge variant="outline" className="border-border/70 bg-background/70">
                        {worker.runtime_metadata.hostname}
                    </Badge>
                ) : null}
            </div>
        </div>
    );
};

export const RuntimeWorkersCard: React.FC<{ data: RuntimePayload }> = ({ data }) => {
    const summary = data.workers?.summary;
    const items = (data.workers?.items ?? []).slice(0, 6);

    return (
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <CardTitle className="text-base">Локальные TTS-воркеры</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                    <AdminMetricCard title="Всего" value={numberValue(summary?.total)} />
                    <AdminMetricCard title="Онлайн" value={numberValue(summary?.online)} />
                    <AdminMetricCard title="Серверные" value={numberValue(summary?.managed)} />
                    <AdminMetricCard title="Локальные" value={numberValue(summary?.self_hosted)} />
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                    {items.map((worker) => (
                        <WorkerRow key={worker.worker_key} worker={worker} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
