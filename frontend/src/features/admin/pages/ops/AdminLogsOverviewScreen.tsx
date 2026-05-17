import React, { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { ADMIN_ACTION_BUTTON_CLASS, AdminPageHeader } from '@/features/admin/components/admin-ui';
import { LogsContent, LogsFiltersCard, LogsStatsGrid } from '@/features/admin/components/ops-center/LogsSections';
import { queryKeys } from '@/queries/queryKeys';
import { adminService } from '@/services/api/services/adminService';
import { Button } from '@/shared/components/ui/button';

import type { LogsOverviewPayload } from '@/features/admin/types/adminReadModels';

const AdminLogsOverviewScreen: React.FC = () => {
    const [days, setDays] = useState('30');
    const [status, setStatus] = useState('all');
    const [actionType, setActionType] = useState('all');
    const params = useMemo(
        () => ({
            days: Number(days),
            ...(status !== 'all' ? { status } : {}),
            ...(actionType !== 'all' ? { action_type: actionType } : {}),
        }),
        [actionType, days, status]
    );

    const { data, isLoading, isFetching, refetch } = useQuery<LogsOverviewPayload>({
        queryKey: queryKeys.admin.logsOverview(params),
        queryFn: async () => {
            const response = await adminService.getLogsOverview(params);
            const payload = response.data as { data?: LogsOverviewPayload };
            return payload.data ?? {};
        },
        refetchInterval: 20_000,
        refetchOnWindowFocus: false,
    });

    const logs = data ?? {};

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Logs"
                description="Админские действия и быстрый просмотр системного log-хвоста без перехода по служебным экранам."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        className={ADMIN_ACTION_BUTTON_CLASS}
                        onClick={() => void refetch()}
                        disabled={isFetching}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                }
            />
            <LogsFiltersCard
                data={logs}
                days={days}
                status={status}
                actionType={actionType}
                onDaysChange={setDays}
                onStatusChange={setStatus}
                onActionTypeChange={setActionType}
            />
            <LogsStatsGrid data={logs} days={days} />
            <LogsContent data={logs} isLoading={isLoading} />
        </div>
    );
};

export default AdminLogsOverviewScreen;
