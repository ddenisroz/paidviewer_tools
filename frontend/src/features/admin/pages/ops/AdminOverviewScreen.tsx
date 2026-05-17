import React from 'react';

import { useQuery } from '@tanstack/react-query';

import {
    OverviewAlertsCard,
    OverviewEmptyState,
    OverviewPlatformsCard,
    OverviewStatsGrid,
    OverviewTtsAndReadiness,
} from '@/features/admin/components/ops-center/OverviewSections';
import { queryKeys } from '@/queries/queryKeys';
import { adminService } from '@/services/api/services/adminService';
import { PageLoader } from '@/shared/components/ui/loader';

import type { OverviewPayload } from '@/features/admin/types/adminReadModels';

const AdminOverviewScreen: React.FC = () => {
    const { data, isLoading, isFetching, refetch } = useQuery<OverviewPayload>({
        queryKey: queryKeys.admin.overview(),
        queryFn: async () => {
            const response = await adminService.getOverview();
            const payload = response.data as { data?: OverviewPayload };
            return payload.data ?? {};
        },
        refetchInterval: 30_000,
        refetchOnWindowFocus: false,
    });

    if (isLoading) {
        return <PageLoader message="Загрузка сводки админ-центра..." />;
    }

    const overview = data ?? {};

    return (
        <div className="space-y-6">
            <OverviewStatsGrid data={overview} />
            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                <OverviewAlertsCard
                    alerts={overview.alerts ?? []}
                    isFetching={isFetching}
                    onRefresh={() => void refetch()}
                />
                <OverviewPlatformsCard data={overview} />
            </div>
            <OverviewTtsAndReadiness data={overview} />
            {Object.keys(overview.platforms ?? {}).length === 0 ? <OverviewEmptyState /> : null}
        </div>
    );
};

export default AdminOverviewScreen;
