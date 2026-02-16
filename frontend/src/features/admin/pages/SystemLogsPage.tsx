import React, { useEffect, useState } from 'react';

import {
  AlertCircle, BarChart3, CheckCircle, Clock, Download,
  Filter, Loader, RefreshCw, Target, User, XCircle
} from 'lucide-react';

import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
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

interface LogItemProps {
  log: AdminLog;
  formatTime: (timestamp: string | undefined) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBg: (status: string) => string;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75 backdrop-blur-sm shadow-none';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 hover:bg-muted/60 shadow-none';

const LogItem: React.FC<LogItemProps> = ({ log, formatTime, getStatusIcon, getStatusBg }) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-4 transition-colors hover:bg-card/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-1 flex-shrink-0">{getStatusIcon(log.status)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {log.action_type?.replace(/_/g, ' ') || 'Неизвестно'}
              </Badge>
              <span className="text-sm font-semibold text-foreground">
                {log.description || 'Операция'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate">Админ: {log.admin_name || 'Неизвестно'}</span>
              </div>
              {log.target_user_name && (
                <div className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span className="truncate">Цель: {log.target_user_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatTime(log.timestamp)}</span>
              </div>
            </div>

            {(log.old_value || log.new_value || log.details || log.error_message || log.user_agent) && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  {expanded ? 'Скрыть детали' : 'Показать детали'} {expanded ? '▲' : '▼'}
                </Button>
                {expanded && (
                  <div className="mt-2 space-y-2 rounded border border-border/70 bg-card/75 p-3 text-xs">
                    {log.error_message && (
                      <div className="text-destructive">
                        <span className="font-semibold">Ошибка:</span> {log.error_message}
                      </div>
                    )}
                    {log.user_agent && (
                      <div className="truncate text-muted-foreground">
                        <span className="font-semibold">User-Agent:</span> {log.user_agent}
                      </div>
                    )}
                    {log.target_resource && (
                      <div className="text-foreground/85">
                        <span className="font-semibold">Ресурс:</span> {log.target_resource}
                      </div>
                    )}
                    {log.old_value && (
                      <div>
                        <span className="font-semibold text-amber-300">Было:</span>
                        <pre className="mt-1 overflow-x-auto rounded border border-border/60 bg-card/80 p-2 text-xs">
                          {JSON.stringify(log.old_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_value && (
                      <div>
                        <span className="font-semibold text-emerald-300">Стало:</span>
                        <pre className="mt-1 overflow-x-auto rounded border border-border/60 bg-card/80 p-2 text-xs">
                          {JSON.stringify(log.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.details && (
                      <div>
                        <span className="font-semibold">Дополнительно:</span>
                        <pre className="mt-1 overflow-x-auto rounded border border-border/60 bg-card/80 p-2 text-xs">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <Badge className={`${getStatusBg(log.status)} mb-2 block`}>
            {log.status === 'success'
              ? 'Успех'
              : log.status === 'failed'
                ? 'Ошибка'
                : 'Предупреждение'}
          </Badge>
        </div>
      </div>
    </div>
  );
};

const SystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedActionType, setSelectedActionType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ limit: 50, offset: 0, pages: 0, total: 0 });
  const [daysRange, setDaysRange] = useState<number>(30);

  const loadLogs = React.useCallback(async (actionType: string | null = null, status: string | null = null): Promise<void> => {
    try {
      setLoading(true);
      const response = await adminService.getAdminLogs({
        limit: pagination.limit,
        offset: pagination.offset,
        days: daysRange,
        ...(actionType && { action_type: actionType }),
        ...(status && { status: status })
      });
      const apiData = response.data as LogsApiResponse;
      if (apiData?.success) {
        setLogs(apiData.data || []);
        if (apiData.pagination) {
          setPagination(apiData.pagination);
        }
      }
    } catch (error) {
      logger.error('Error loading logs:', error);
      toast.error('Ошибка загрузки логов');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset, daysRange]);

  const loadStats = React.useCallback(async (): Promise<void> => {
    try {
      const response = await adminService.getLogsStats(daysRange);
      const apiData = response.data as StatsApiResponse;
      if (apiData?.success) {
        setStats(apiData.data || null);
      }
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
  }, [daysRange]);

  const loadAvailableActions = React.useCallback(async (): Promise<void> => {
    try {
      const response = await adminService.getLogsActions();
      const apiData = response.data as ActionsApiResponse;
      if (apiData?.success) {
        setAvailableActions(apiData.data || []);
      }
    } catch (error) {
      logger.error('Error loading actions:', error);
    }
  }, []);

  useEffect(() => {
    loadAvailableActions();
  }, [loadAvailableActions]);

  useEffect(() => {
    loadLogs(selectedActionType, selectedStatus);
    loadStats();
  }, [selectedActionType, selectedStatus, loadLogs, loadStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadLogs(selectedActionType, selectedStatus);
      loadStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedActionType, selectedStatus, loadLogs, loadStats]);

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-400" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBg = (status: string): string => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
      case 'failed':
        return 'bg-destructive/10 text-destructive border border-destructive/30';
      case 'warning':
        return 'bg-amber-500/10 text-amber-300 border border-amber-500/30';
      default:
        return 'bg-muted/40 text-muted-foreground border border-border/60';
    }
  };

  const formatTime = (timestamp: string | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">[LIST] История действий</h1>
        <p className="mt-2 text-sm text-muted-foreground">Логирование действий администраторов системы</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={SURFACE_CARD_CLASS}>
            <CardContent className="pt-0">
              <div className="text-sm text-muted-foreground">Всего действий</div>
              <div className="text-2xl font-bold mt-2">{stats.total_logs}</div>
              <div className="mt-1 text-xs text-muted-foreground">за последние {stats.days} дней</div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS}>
            <CardContent className="pt-0">
              <div className="text-sm text-muted-foreground">Типов действий</div>
              <div className="text-2xl font-bold mt-2">{stats.actions_by_type?.length || 0}</div>
              <div className="mt-1 text-xs text-muted-foreground">различных операций</div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS}>
            <CardContent className="pt-0">
              <div className="text-sm text-muted-foreground">Активных админов</div>
              <div className="text-2xl font-bold mt-2">{stats.top_admins?.length || 0}</div>
              <div className="mt-1 text-xs text-muted-foreground">в этом периоде</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="mb-2 block text-sm text-muted-foreground">Период (дней)</label>
              <select
                value={daysRange}
                onChange={(e) => {
                  setDaysRange(Number(e.target.value));
                  setPagination({ ...pagination, offset: 0 });
                }}
                className="h-9 w-full rounded-md border border-border/70 bg-card/60 px-3 text-sm text-foreground"
              >
                <option value={1}>1 день</option>
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
                <option value={90}>90 дней</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-muted-foreground">Тип действия</label>
              <select
                value={selectedActionType || ''}
                onChange={(e) => {
                  setSelectedActionType(e.target.value || null);
                  setPagination({ ...pagination, offset: 0 });
                }}
                className="h-9 w-full rounded-md border border-border/70 bg-card/60 px-3 text-sm text-foreground"
              >
                <option value="">Все</option>
                {availableActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-muted-foreground">Статус</label>
              <select
                value={selectedStatus || ''}
                onChange={(e) => {
                  setSelectedStatus(e.target.value || null);
                  setPagination({ ...pagination, offset: 0 });
                }}
                className="h-9 w-full rounded-md border border-border/70 bg-card/60 px-3 text-sm text-foreground"
              >
                <option value="">Все</option>
                <option value="success">Успешно</option>
                <option value="failed">Ошибка</option>
                <option value="warning">Предупреждение</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                className="h-9"
                onClick={() => loadLogs(selectedActionType, selectedStatus)}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button
                variant="outline"
                className={ACTION_BUTTON_CLASS}
                onClick={() => {
                  if (logs.length === 0) {
                    toast.error('Нет данных для экспорта');
                    return;
                  }
                  const headers = ['ID', 'Тип', 'Описание', 'Админ', 'Цель', 'Статус', 'Дата'];
                  const csvContent = [
                    headers.join(','),
                    ...logs.map(log => [
                      log.id,
                      `"${(log.action_type || '').replace(/"/g, '""')}"`,
                      `"${(log.description || '').replace(/"/g, '""')}"`,
                      `"${(log.admin_name || '').replace(/"/g, '""')}"`,
                      `"${(log.target_user_name || '').replace(/"/g, '""')}"`,
                      log.status,
                      log.timestamp || ''
                    ].join(','))
                  ].join('\n');
                  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `admin_logs_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                  toast.success('Логи экспортированы в CSV');
                }}
                disabled={logs.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-base">Логи действий</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Нет логов за выбранный период</p>
          ) : (
            <div className="space-y-2 max-h-[min(600px,70vh)] overflow-y-auto">
              {logs.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  formatTime={formatTime}
                  getStatusIcon={getStatusIcon}
                  getStatusBg={getStatusBg}
                />
              ))}
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border/70 hover:bg-muted/60"
                disabled={pagination.offset === 0}
                onClick={() =>
                  setPagination({
                    ...pagination,
                    offset: Math.max(0, pagination.offset - pagination.limit)
                  })
                }
              >
                ← Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {Math.floor(pagination.offset / pagination.limit) + 1} из {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border/70 hover:bg-muted/60"
                disabled={pagination.offset + pagination.limit >= pagination.total}
                onClick={() =>
                  setPagination({
                    ...pagination,
                    offset: pagination.offset + pagination.limit
                  })
                }
              >
                Вперед →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {stats?.top_admins && stats.top_admins.length > 0 && (
        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Топ администраторов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_admins.map((admin, idx) => (
                <div key={admin.admin_id} className="flex items-center justify-between rounded border border-border/60 bg-card/60 p-2">
                  <div>
                    <p className="font-semibold">{idx + 1}. {admin.admin_name}</p>
                  </div>
                  <Badge className="border-primary/30 bg-primary/15 text-primary">
                    {admin.action_count} действ{admin.action_count % 10 === 1 && admin.action_count % 100 !== 11
                      ? 'ие'
                      : admin.action_count % 10 >= 2 &&
                        admin.action_count % 10 <= 4 &&
                        (admin.action_count % 100 < 10 || admin.action_count % 100 >= 20)
                        ? 'ия'
                        : 'ий'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SystemLogsPage;



