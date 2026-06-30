import React from 'react';

import { AlertCircle, CheckCircle2, Clock, FileText, TerminalSquare, XCircle } from 'lucide-react';

import { ADMIN_CARD_CLASS, AdminEmptyState } from '@/features/admin/components/admin-ui';
import { logStatusBadgeClass } from '@/features/admin/types/adminReadModels';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { formatAppDateTime } from '@/shared/utils/dateTime';

import AdminMetricCard from './AdminMetricCard';

import type { AdminLogEntry, LogsOverviewPayload } from '@/features/admin/types/adminReadModels';

const logStatusIcon = (status: AdminLogEntry['status']): React.ReactNode => {
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertCircle className="h-4 w-4 text-amber-300" />;
};

export const LogsFiltersCard: React.FC<{
    data: LogsOverviewPayload;
    days: string;
    status: string;
    actionType: string;
    onDaysChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onActionTypeChange: (value: string) => void;
}> = ({ data, days, status, actionType, onDaysChange, onStatusChange, onActionTypeChange }) => (
    <Card className={ADMIN_CARD_CLASS}>
        <CardHeader>
            <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
            <Select value={days} onValueChange={onDaysChange}>
                <SelectTrigger className="border-border/70 bg-background/60">
                    <SelectValue placeholder="Период" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="7">7 дней</SelectItem>
                    <SelectItem value="30">30 дней</SelectItem>
                    <SelectItem value="90">90 дней</SelectItem>
                </SelectContent>
            </Select>
            <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger className="border-border/70 bg-background/60">
                    <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="success">Успех</SelectItem>
                    <SelectItem value="failed">Ошибка</SelectItem>
                    <SelectItem value="warning">Предупреждение</SelectItem>
                </SelectContent>
            </Select>
            <Select value={actionType} onValueChange={onActionTypeChange}>
                <SelectTrigger className="border-border/70 bg-background/60">
                    <SelectValue placeholder="Тип действия" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Все действия</SelectItem>
                    {(data.actions ?? []).map((action) => (
                        <SelectItem key={action} value={action}>
                            {action}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CardContent>
    </Card>
);

export const LogsStatsGrid: React.FC<{ data: LogsOverviewPayload; days: string }> = ({ data, days }) => (
    <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard title="Всего логов" value={data.stats?.total_logs ?? 0} />
        <AdminMetricCard title="Типов действий" value={data.stats?.actions_by_type?.length ?? 0} />
        <AdminMetricCard title="Период" value={`${data.stats?.days ?? Number(days)} дней`} />
    </div>
);

export const LogsContent: React.FC<{ data: LogsOverviewPayload; isLoading: boolean }> = ({ data, isLoading }) => (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <CardTitle className="text-base">Последние admin actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading ? <div className="text-sm text-muted-foreground">Загрузка логов...</div> : null}
                {!isLoading && (data.recent_admin_logs ?? []).length === 0 ? (
                    <AdminEmptyState
                        title="Логи не найдены"
                        description="Попробуйте изменить период или снять фильтры."
                        icon={FileText}
                        className="border-none bg-transparent shadow-none"
                    />
                ) : null}
                {!isLoading
                    ? (data.recent_admin_logs ?? []).map((log) => (
                          <div key={log.id} className="rounded-xl border border-border/70 bg-background/55 p-4">
                              <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 flex-1 gap-3">
                                      <div className="mt-0.5">{logStatusIcon(log.status)}</div>
                                      <div className="min-w-0">
                                          <p className="text-sm font-medium text-foreground">
                                              {log.description ?? 'Действие без описания'}
                                          </p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                              {log.admin_name ?? 'Неизвестный админ'}
                                              {log.target_user_name ? ` -> ${log.target_user_name}` : ''}
                                          </p>
                                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                              <Clock className="h-3 w-3" />
                                              {log.timestamp
                                                  ? formatAppDateTime(log.timestamp)
                                                  : 'время неизвестно'}
                                          </p>
                                          {log.error_message ? (
                                              <p className="mt-2 text-xs text-destructive">{log.error_message}</p>
                                          ) : null}
                                      </div>
                                  </div>
                                  <Badge variant="outline" className={logStatusBadgeClass(log.status)}>
                                      {log.status}
                                  </Badge>
                              </div>
                          </div>
                      ))
                    : null}
            </CardContent>
        </Card>
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <TerminalSquare className="h-4 w-4" />
                    System log preview
                </CardTitle>
            </CardHeader>
            <CardContent>
                {(data.system_logs_preview ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">Предпросмотр системных логов пуст.</div>
                ) : (
                    <div className="max-h-[420px] overflow-auto rounded-xl border border-border/70 bg-background/70 p-3">
                        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                            {(data.system_logs_preview ?? []).join('\n')}
                        </pre>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
);
