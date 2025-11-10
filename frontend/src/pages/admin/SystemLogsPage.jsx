import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  History, Filter, RefreshCw, BarChart3, AlertCircle,
  CheckCircle, XCircle, Clock, User, Target, Loader
} from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../services/api/services/adminService';
import { logger } from '../../utils/prodLogger';

// Компонент для отдельного лога
const LogItem = ({ log, formatTime, getStatusIcon, getStatusBg }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:bg-slate-700/30 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-1 flex-shrink-0">{getStatusIcon(log.status)}</div>
          <div className="flex-1 min-w-0">
            {/* Заголовок */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {log.action_type?.replace(/_/g, ' ') || 'Неизвестно'}
              </Badge>
              <span className="font-semibold text-white text-sm">
                {log.description || 'Операция'}
              </span>
            </div>
            
            {/* Основная информация */}
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
            
            {/* Детали (раскрываемые) */}
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

const SystemLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedActionType, setSelectedActionType] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [availableActions, setAvailableActions] = useState([]);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, pages: 0, total: 0 });
  const [daysRange, setDaysRange] = useState(30);

  // Загрузка логов
  const loadLogs = async (actionType = null, status = null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit,
        offset: pagination.offset,
        days: daysRange,
        ...(actionType && { action_type: actionType }),
        ...(status && { status: status })
      });

      const response = await adminService.getAdminLogs({
        page,
        limit,
        days: daysRange,
        ...(actionType && { action_type: actionType }),
        ...(status && { status: status })
      });
      if (response.data?.success) {
        setLogs(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      logger.error('Error loading logs:', error);
      toast.error('Ошибка загрузки логов');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка статистики
  const loadStats = async () => {
    try {
      const response = await adminService.getLogsStats(daysRange);
      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
  };

  // Загрузка доступных действий
  const loadAvailableActions = async () => {
    try {
      const response = await adminService.getLogsActions();
      if (response.data?.success) {
        setAvailableActions(response.data.data);
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

  // Автообновление логов каждые 10 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      loadLogs(selectedActionType, selectedStatus);
      loadStats();
    }, 10000); // 10 секунд

    return () => clearInterval(interval);
  }, [selectedActionType, selectedStatus]);

  const getStatusIcon = (status) => {
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

  const getStatusBg = (status) => {
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

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📋 История действий</h1>
        <p className="text-slate-400 mt-2">Логирование всех действий администраторов системы</p>
      </div>

      {/* Статистика */}
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

      {/* Фильтры */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Диапазон дней */}
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

            {/* Тип действия */}
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

            {/* Статус */}
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

            {/* Обновить */}
            <div className="flex items-end">
              <Button onClick={() => loadLogs(selectedActionType, selectedStatus)} disabled={loading} className="w-full">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Таблица логов */}
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

          {/* Пагинация */}
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

      {/* Топ админов */}
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
