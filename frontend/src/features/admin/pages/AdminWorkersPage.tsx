import React from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Cpu, HardDrive, RefreshCw, Server } from 'lucide-react';

import {
  AdminEmptyState,
  AdminPageHeader,
  ADMIN_ACTION_BUTTON_CLASS,
  ADMIN_CARD_CLASS,
} from '@/features/admin/components/admin-ui';
import { queryKeys } from '@/queries/queryKeys';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageLoader } from '@/shared/components/ui/loader';
import { logger } from '@/shared/utils/prodLogger';

interface AdminWorker {
  id: number;
  worker_key: string;
  label: string;
  owner_user_id: number | null;
  is_active: boolean;
  is_managed: boolean;
  status: string;
  supports_f5: boolean;
  supports_qwen: boolean;
  runtime_metadata?: {
    hostname?: string;
    platform?: string;
    platform_release?: string;
    python_version?: string;
    [key: string]: unknown;
  };
  capabilities?: {
    runtime?: string;
    [key: string]: unknown;
  };
  last_seen_at?: string | null;
  last_error?: string | null;
}

interface AdminWorkersResponse {
  workers?: AdminWorker[];
}

const STATUS_STYLES: Record<string, string> = {
  online: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  busy: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  offline: 'border-border/70 bg-background/60 text-muted-foreground',
  disabled: 'border-red-500/30 bg-red-500/10 text-red-300',
  deleted: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ru-RU');
};

const getStatusClassName = (status: string): string => STATUS_STYLES[status] || STATUS_STYLES.offline;

const sortWorkers = (workers: AdminWorker[]): AdminWorker[] => {
  const statusOrder: Record<string, number> = {
    online: 0,
    busy: 1,
    offline: 2,
    disabled: 3,
    deleted: 4,
  };

  return [...workers].sort((left, right) => {
    const statusDelta = (statusOrder[left.status] ?? 99) - (statusOrder[right.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;

    const leftSeen = left.last_seen_at ? new Date(left.last_seen_at).getTime() : 0;
    const rightSeen = right.last_seen_at ? new Date(right.last_seen_at).getTime() : 0;
    return rightSeen - leftSeen;
  });
};

const AdminWorkersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    data: workers = [],
    isLoading,
    isFetching,
    error,
  } = useQuery<AdminWorker[]>({
    queryKey: queryKeys.admin.workers(),
    queryFn: async () => {
      const response = await adminService.getTtsWorkers();
      const payload = response.data as AdminWorkersResponse;
      return sortWorkers(payload.workers || []);
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (error) {
      logger.error('Error loading admin workers', error);
    }
  }, [error]);

  const onlineCount = workers.filter((worker) => worker.status === 'online' || worker.status === 'busy').length;

  if (isLoading && workers.length === 0) {
    return <PageLoader message="Загрузка воркеров..." />;
  }

  if (error) {
    return (
      <Card className={ADMIN_CARD_CLASS}>
        <CardContent className="py-10 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">Не удалось загрузить воркеры</h3>
          <p className="mb-4 text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Неизвестная ошибка'}</p>
          <Button
            variant="outline"
            className={ADMIN_ACTION_BUTTON_CLASS}
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.admin.workers() })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Воркеры"
        description="Подключенные worker-agent инстансы для F5 и Qwen."
        actions={(
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.admin.workers() })}
            variant="outline"
            size="sm"
            className={ADMIN_ACTION_BUTTON_CLASS}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        )}
        meta={(
          <>
            <Badge variant="outline" className="border-border/70 bg-background/60 text-muted-foreground">
              Всего: {workers.length}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Онлайн: {onlineCount}
            </Badge>
          </>
        )}
      />

      {workers.length === 0 ? (
        <AdminEmptyState
          title="Нет подключенных воркеров"
          description="После активации worker-agent он появится в этом разделе."
          icon={Server}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {workers.map((worker) => {
            const hostname = typeof worker.runtime_metadata?.hostname === 'string'
              ? worker.runtime_metadata.hostname
              : '-';
            const platform = [worker.runtime_metadata?.platform, worker.runtime_metadata?.platform_release]
              .filter(Boolean)
              .join(' ');
            const runtime = typeof worker.capabilities?.runtime === 'string'
              ? worker.capabilities.runtime
              : '-';

            return (
              <Card key={worker.worker_key} className={ADMIN_CARD_CLASS}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base font-semibold text-foreground">
                        {worker.label || 'TTS Worker'}
                      </CardTitle>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{worker.worker_key}</p>
                    </div>
                    <Badge variant="outline" className={getStatusClassName(worker.status)}>
                      {worker.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-border/70 bg-background/60 text-muted-foreground">
                      {worker.is_managed ? 'managed' : 'self-hosted'}
                    </Badge>
                    {worker.supports_f5 ? (
                      <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-300">
                        F5
                      </Badge>
                    ) : null}
                    {worker.supports_qwen ? (
                      <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300">
                        Qwen
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Владелец</p>
                      <p className="text-sm text-foreground">
                        {worker.is_managed ? 'Managed pool' : worker.owner_user_id ? `User #${worker.owner_user_id}` : '-'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Последний пинг</p>
                      <p className="text-sm text-foreground">{formatDateTime(worker.last_seen_at)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <HardDrive className="h-3.5 w-3.5" />
                        Хост
                      </div>
                      <p className="text-sm text-foreground">{hostname}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{platform || '-'}</p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Cpu className="h-3.5 w-3.5" />
                        Runtime
                      </div>
                      <p className="text-sm text-foreground">{runtime}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Python {worker.runtime_metadata?.python_version || '-'}
                      </p>
                    </div>
                  </div>

                  {worker.last_error ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                      {worker.last_error}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminWorkersPage;
