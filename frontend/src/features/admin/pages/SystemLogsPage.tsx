import React, { useEffect, useState } from 'react';

import {
  AlertCircle, BarChart3, CheckCircle, Clock, Download,
  Filter, Loader, RefreshCw, Target, User, XCircle
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/utils/toastManager';

import { adminService } from '../../../services/api/services/adminService';
import { logger } from '../../../utils/prodLogger';

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

const LogItem: React.FC<LogItemProps> = ({ log, formatTime, getStatusIcon, getStatusBg }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:bg-slate-700/30 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-1 flex-shrink-0">{getStatusIcon(log.status)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {log.action_type?.replace(/_/g, ' ') || 'Неизвестно'}
              </Badge>
              <span className="font-semibold text-white text-sm">
                {log.description || 'Операция'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400">
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
                  className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  {expanded ? 'Скрыть детали' : 'Показать детали'} {expanded ? '▲' : '▼'}
                </Button>
                {expanded && (
                  <div className="mt-2 p-3 bg-slate-900/50 rounded text-xs space-y-2 border border-slate-700">
                    {log.error_message && (
                      <div className="text-red-400">
                        <span className="font-semibold">Ошибка:</span> {log.error_message}
                      </div>
                    )}
                    {log.user_agent && (
                      <div className="text-slate-400 truncate">
                        <span className="font-semibold">User-Agent:</span> {log.user_agent}
                      </div>
                    )}
                    {log.target_resource && (
                      <div className="text-slate-300">
                        <span className="font-semibold">Ресурс:</span> {log.target_resource}
                      </div>
                    )}
                    {log.old_value && (
                      <div>
                        <span className="font-semibold text-yellow-400">Было:</span>
                        <pre className="mt-1 p-2 bg-slate-800 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.old_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_value && (
                      <div>
                        <span className="font-semibold text-green-400">Стало:</span>
                        <pre className="mt-1 p-2 bg-slate-800 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.details && (
                      <div>
                        <span className="font-semibold">Дополнительно:</span>
                        <pre className="mt-1 p-2 bg-slate-800 rounded text-xs overflow-x-auto">
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

  const loadLogs = async (actionType: string | null = null, status: string | null = null): Promise<void> => {
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
  };

  const loadStats = async (): Promise<void> => {
    try {
      const response = await adminService.getLogsStats(daysRange);
      const apiData = response.data as StatsApiResponse;
      if (apiData?.success) {
        setStats(apiData.data || null);
      }
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
  };

  const loadAvailableActions = async (): Promise<void> => {
    try {
      const response = await adminService.getLogsActions();
      const apiData = response.data as ActionsApiResponse;
      if (apiData?.success) {
        setAvailableActions(apiData.data || []);
      }
    } catch (error) {
      logger.error('Error loading actions:', error);
    }
  };

  useEffect(() => {
    loadAvailableActions();
  }, []);

  useEffect(() => {
    loadLogs(selectedActionType, selectedStatus);
    loadStats();
  }, [daysRange, pagination.offset, selectedActionType, selectedStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadLogs(selectedActionType, selectedStatus);
      loadStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedActionType, selectedStatus]);

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBg = (status: string): string => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-400';
      case 'failed':
        return 'bg-red-500/10 text-red-400';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
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
        <p className="text-slate-400 mt-2">Логирование всех действий администраторов системы</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-0">
              <div className="text-sm text-slate-400">Всего действий</div>
              <div className="text-2xl font-bold mt-2">{stats.total_logs}</div>
              <div className="text-xs text-slate-500 mt-1">за последние {stats.days} дней</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-0">
              <div className="text-sm text-slate-400">Типов действий</div>
              <div className="text-2xl font-bold mt-2">{stats.actions_by_type?.length || 0}</div>
              <div className="text-xs text-slate-500 mt-1">различных операций</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-0">
              <div className="text-sm text-slate-400">Активных админов</div>
              <div className="text-2xl font-bold mt-2">{stats.top_admins?.length || 0}</div>
              <div className="text-xs text-slate-500 mt-1">в этом периоде</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Период (дней)</label>
              <select
                value={daysRange}
                onChange={(e) => {
                  setDaysRange(Number(e.target.value));
                  setPagination({ ...pagination, offset: 0 });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value={1}>1 день</option>
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
                <option value={90}>90 дней</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block">Тип действия</label>
              <select
                value={selectedActionType || ''}
                onChange={(e) => {
                  setSelectedActionType(e.target.value || null);
                  setPagination({ ...pagination, offset: 0 });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
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
              <label className="text-sm text-slate-300 mb-2 block">Статус</label>
              <select
                value={selectedStatus || ''}
                onChange={(e) => {
                  setSelectedStatus(e.target.value || null);
                  setPagination({ ...pagination, offset: 0 });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value="">Все</option>
                <option value="success">Успешно</option>
                <option value="failed">Ошибка</option>
                <option value="warning">Предупреждение</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={() => loadLogs(selectedActionType, selectedStatus)} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button 
                variant="outline" 
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
                  const blob = new Blob([`\ufeff${  csvContent}`], { type: 'text/csv;charset=utf-8;' });
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

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Логи действий</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Нет логов за выбранный период</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
              <span className="text-sm text-slate-400">
                Страница {Math.floor(pagination.offset / pagination.limit) + 1} из {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
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
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Топ администраторов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_admins.map((admin, idx) => (
                <div key={admin.admin_id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                  <div>
                    <p className="font-semibold">{idx + 1}. {admin.admin_name}</p>
                  </div>
                  <Badge className="bg-purple-600">
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



