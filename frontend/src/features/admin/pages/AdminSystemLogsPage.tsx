import React, { useCallback, useEffect, useState } from 'react';

import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Download,
  Filter,
  Loader,
  RefreshCw,
  Target,
  User,
  XCircle,
} from 'lucide-react';

import {
  AdminEmptyState,
  AdminPageHeader,
  ADMIN_ACTION_BUTTON_CLASS,
  ADMIN_CARD_CLASS,
} from '@/features/admin/components/admin-ui';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

interface AdminLog {
  id: number;
  action_type?: string;
  description?: string;
  admin_name?: string;
  target_user_name?: string;
  timestamp?: string;
  status: 'success' | 'failed' | 'warning';
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  details?: Record<string, unknown>;
  error_message?: string;
  user_agent?: string;
  target_resource?: string;
}

interface LogStats {
  total_logs: number;
  days: number;
  actions_by_type?: string[];
  top_admins?: Array<{
    admin_id: number;
    admin_name: string;
    action_count: number;
  }>;
}

interface Pagination {
  limit: number;
  offset: number;
  pages: number;
  total: number;
}

interface LogsApiResponse {
  success?: boolean;
  data?: AdminLog[];
  pagination?: Pagination;
}

interface StatsApiResponse {
  success?: boolean;
  data?: LogStats;
}

interface ActionsApiResponse {
  success?: boolean;
  data?: string[];
}

const formatTime = (timestamp?: string): string =>
  timestamp ? new Date(timestamp).toLocaleString('ru-RU') : 'Неизвестно';

const pluralizeActions = (value: number): string => {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return `${value} действие`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${value} действия`;
  return `${value} действий`;
};

const statusBadgeClass = (status: AdminLog['status']): string => {
  if (status === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'failed') return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
};

const statusIcon = (status: AdminLog['status']): React.ReactNode => {
  if (status === 'success') return <CheckCircle className="h-4 w-4 text-emerald-300" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertCircle className="h-4 w-4 text-amber-300" />;
};

const LogCard: React.FC<{ log: AdminLog }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="mt-0.5">{statusIcon(log.status)}</div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border/70 bg-background/60">
                {(log.action_type || 'unknown').replace(/_/g, ' ')}
              </Badge>
              <p className="truncate text-sm font-medium text-foreground">{log.description || 'Действие без описания'}</p>
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="truncate">Админ: {log.admin_name || 'Неизвестно'}</span>
              </div>
              {log.target_user_name ? (
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  <span className="truncate">Цель: {log.target_user_name}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime(log.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>
        <Badge className={statusBadgeClass(log.status)}>
          {log.status === 'success' ? 'Успех' : log.status === 'failed' ? 'Ошибка' : 'Внимание'}
        </Badge>
      </div>

      {log.old_value || log.new_value || log.details || log.error_message || log.user_agent ? (
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => setExpanded(prev => !prev)}
          >
            {expanded ? 'Скрыть детали' : 'Показать детали'}
          </Button>

          {expanded ? (
            <div className="mt-3 space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 text-xs">
              {log.error_message ? (
                <div className="text-destructive">
                  <span className="font-semibold">Ошибка:</span> {log.error_message}
                </div>
              ) : null}
              {log.user_agent ? (
                <div className="break-all text-muted-foreground">
                  <span className="font-semibold text-foreground">User-Agent:</span> {log.user_agent}
                </div>
              ) : null}
              {log.target_resource ? (
                <div className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Ресурс:</span> {log.target_resource}
                </div>
              ) : null}
              {log.old_value ? (
                <div>
                  <p className="font-semibold text-amber-300">Было</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-2">
                    {JSON.stringify(log.old_value, null, 2)}
                  </pre>
                </div>
              ) : null}
              {log.new_value ? (
                <div>
                  <p className="font-semibold text-emerald-300">Стало</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-2">
                    {JSON.stringify(log.new_value, null, 2)}
                  </pre>
                </div>
              ) : null}
              {log.details ? (
                <div>
                  <p className="font-semibold text-foreground">Дополнительно</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-2">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const AdminSystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [daysRange, setDaysRange] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ limit: 50, offset: 0, pages: 0, total: 0 });

  const loadLogs = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await adminService.getAdminLogs({
        limit: pagination.limit,
        offset: pagination.offset,
        days: daysRange,
        ...(selectedActionType !== 'all' && { action_type: selectedActionType }),
        ...(selectedStatus !== 'all' && { status: selectedStatus }),
      });

      const payload = response.data as LogsApiResponse;
      if (payload.success) {
        setLogs(payload.data || []);
        if (payload.pagination) {
          setPagination(payload.pagination);
        }
      }
    } catch (error) {
      logger.error('Error loading admin logs', error);
      toast.error('Не удалось загрузить логи');
    } finally {
      setLoading(false);
    }
  }, [daysRange, pagination.limit, pagination.offset, selectedActionType, selectedStatus]);

  const loadStats = useCallback(async (): Promise<void> => {
    try {
      const response = await adminService.getLogsStats(daysRange);
      const payload = response.data as StatsApiResponse;
      if (payload.success) {
        setStats(payload.data || null);
      }
    } catch (error) {
      logger.error('Error loading log stats', error);
    }
  }, [daysRange]);

  const loadActions = useCallback(async (): Promise<void> => {
    try {
      const response = await adminService.getLogsActions();
      const payload = response.data as ActionsApiResponse;
      if (payload.success) {
        setAvailableActions(payload.data || []);
      }
    } catch (error) {
      logger.error('Error loading log actions', error);
    }
  }, []);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  useEffect(() => {
    void loadLogs();
    void loadStats();
  }, [loadLogs, loadStats]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadLogs();
      void loadStats();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [loadLogs, loadStats]);

  const handleExportCsv = (): void => {
    if (logs.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const headers = ['ID', 'Тип', 'Описание', 'Админ', 'Цель', 'Статус', 'Дата'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log =>
        [
          log.id,
          `"${(log.action_type || '').replace(/"/g, '""')}"`,
          `"${(log.description || '').replace(/"/g, '""')}"`,
          `"${(log.admin_name || '').replace(/"/g, '""')}"`,
          `"${(log.target_user_name || '').replace(/"/g, '""')}"`,
          log.status,
          log.timestamp || '',
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSV выгружен');
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Логи админки"
        description="История действий администраторов, фильтрация по типу операции и статусу результата."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className={ADMIN_ACTION_BUTTON_CLASS}
              onClick={() => void loadLogs()}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            <Button
              type="button"
              variant="outline"
              className={ADMIN_ACTION_BUTTON_CLASS}
              onClick={handleExportCsv}
              disabled={logs.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </>
        }
      />

      {stats ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={ADMIN_CARD_CLASS}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Всего действий</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.total_logs}</p>
              <p className="mt-1 text-xs text-muted-foreground">За последние {stats.days} дней</p>
            </CardContent>
          </Card>
          <Card className={ADMIN_CARD_CLASS}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Типов действий</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.actions_by_type?.length || 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">Различных операций</p>
            </CardContent>
          </Card>
          <Card className={ADMIN_CARD_CLASS}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Активных админов</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.top_admins?.length || 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">В этом периоде</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className={ADMIN_CARD_CLASS}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Период</p>
            <Select
              value={String(daysRange)}
              onValueChange={value => {
                setDaysRange(Number(value));
                setPagination(prev => ({ ...prev, offset: 0 }));
              }}
            >
              <SelectTrigger className="h-9 border-border/70 bg-background/60">
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 день</SelectItem>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="30">30 дней</SelectItem>
                <SelectItem value="90">90 дней</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Тип действия</p>
            <Select
              value={selectedActionType}
              onValueChange={value => {
                setSelectedActionType(value);
                setPagination(prev => ({ ...prev, offset: 0 }));
              }}
            >
              <SelectTrigger className="h-9 border-border/70 bg-background/60">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {availableActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Статус</p>
            <Select
              value={selectedStatus}
              onValueChange={value => {
                setSelectedStatus(value);
                setPagination(prev => ({ ...prev, offset: 0 }));
              }}
            >
              <SelectTrigger className="h-9 border-border/70 bg-background/60">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="success">Успех</SelectItem>
                <SelectItem value="failed">Ошибка</SelectItem>
                <SelectItem value="warning">Предупреждение</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className={ADMIN_CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-base">Список событий</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <AdminEmptyState
              icon={AlertCircle}
              className="border-none bg-transparent shadow-none"
              title="Логи не найдены"
              description="Попробуйте изменить период или сбросить фильтры."
            />
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <LogCard key={log.id} log={log} />
              ))}
            </div>
          )}

          {pagination.pages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                className={ADMIN_ACTION_BUTTON_CLASS}
                disabled={pagination.offset === 0}
                onClick={() =>
                  setPagination(prev => ({
                    ...prev,
                    offset: Math.max(0, prev.offset - prev.limit),
                  }))
                }
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {Math.floor(pagination.offset / pagination.limit) + 1} из {pagination.pages}
              </span>
              <Button
                type="button"
                variant="outline"
                className={ADMIN_ACTION_BUTTON_CLASS}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                onClick={() =>
                  setPagination(prev => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }))
                }
              >
                Вперёд
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {stats?.top_admins?.length ? (
        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Самые активные администраторы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.top_admins.map((admin, index) => (
              <div
                key={admin.admin_id}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 px-4 py-3"
              >
                <p className="font-medium text-foreground">
                  {index + 1}. {admin.admin_name}
                </p>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {pluralizeActions(admin.action_count)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default AdminSystemLogsPage;
