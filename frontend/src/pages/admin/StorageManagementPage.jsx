import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  HardDrive, 
  Trash2, 
  RotateCcw, 
  Download, 
  AlertCircle,
  CheckCircle,
  Loader,
  RefreshCw,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { logger } from '../../utils/prodLogger';

const StorageManagementPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await botService.get('/api/database/stats');
      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      logger.error('Error loading storage stats:', error);
      toast.error('Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async (type) => {
    const typeNames = {
      logs: 'Логи',
      cache: 'Кеш',
      backup: 'Резервная копия',
      restore: 'Восстановление',
      all: 'Все компоненты'
    };
    
    const typeName = typeNames[type] || type;
    
    try {
      setCleaning(true);
      const response = await botService.post('/api/database/cleanup', {
        cleanup_type: type
      });
      
      if (response.data?.success) {
        const data = response.data.data || {};
        let message = `✅ ${typeName} обработан успешно`;
        
        // Добавляем детали если есть
        if (type === 'logs' && data.logs) {
          const deleted = data.logs.messages_deleted || 0;
          const oldDeleted = data.logs.old_messages_deleted || 0;
          const limitDeleted = data.logs.limit_based_deleted || 0;
          
          if (deleted > 0) {
            message += `\n🗑️ Удалено записей: ${deleted.toLocaleString()}`;
            if (oldDeleted > 0) {
              message += `\n   └─ Старше 30 дней: ${oldDeleted.toLocaleString()}`;
            }
            if (limitDeleted > 0) {
              message += `\n   └─ По лимитам: ${limitDeleted.toLocaleString()}`;
            }
          } else {
            message += `\n✅ Нет записей для удаления (все записи новее 30 дней и в пределах лимитов)`;
          }
          
          if (data.logs.error) {
            message += `\n⚠️ Ошибка: ${data.logs.error}`;
          }
        } else if (type === 'voices' && data.voices) {
          const freed = formatBytes(data.voices.freed_bytes || 0);
          message += `\nОсвобождено: ${freed}`;
          if (data.voices.deleted_files) {
            message += `, удалено файлов: ${data.voices.deleted_files}`;
          }
        } else if (type === 'cache' && data.cache) {
          const freed = formatBytes(data.cache.freed_bytes || 0);
          message += `\nОсвобождено: ${freed}`;
          if (data.cache.deleted_files) {
            message += `, удалено файлов: ${data.cache.deleted_files}`;
          }
        } else if (type === 'backup' && data.backup) {
          message += `\nФайл: ${data.backup.backup_file?.split(/[/\\]/).pop() || 'создан'}`;
          if (data.backup.size_bytes) {
            message += ` (${formatBytes(data.backup.size_bytes)})`;
          }
        }
        
        toast.success(message, { duration: 5000 });
        await loadStats();
        if (type === 'backup') {
          await loadBackups();
        }
      } else {
        const errorMsg = response.data?.error || response.data?.message || 'Неизвестная ошибка';
        toast.error(`Ошибка обработки ${typeName}:\n${errorMsg}`, { duration: 6000 });
      }
    } catch (error) {
      logger.error(`Error cleaning ${type}:`, error);
      const errorMsg = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
      toast.error(`Ошибка при обработке ${typeName}:\n${errorMsg}`, { duration: 6000 });
    } finally {
      setCleaning(false);
    }
  };

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const response = await botService.get('/api/database/backups');
      if (response.data?.success && response.data.data?.backups) {
        setBackups(response.data.data.backups);
      }
    } catch (error) {
      logger.error('Error loading backups:', error);
      toast.error('Ошибка загрузки списка бэкапов');
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!confirm(`Вы уверены, что хотите удалить бэкап "${filename}"?`)) return;
    
    try {
      const response = await botService.delete(`/api/database/backups/${filename}`);
      if (response.data?.success) {
        toast.success(`Бэкап ${filename} удален`);
        await loadBackups();
        await loadStats();
      }
    } catch (error) {
      logger.error('Error deleting backup:', error);
      toast.error(error.response?.data?.detail || 'Ошибка удаления бэкапа');
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!confirm(`⚠️ ВНИМАНИЕ: Это действие восстановит базу данных из бэкапа "${filename}".\n\nТекущее состояние будет сохранено автоматически, но операция необратима.\n\nПродолжить?`)) return;
    
    try {
      const response = await botService.post(`/api/database/backups/${filename}/restore`);
      if (response.data?.success) {
        toast.success(response.data.message || `База данных восстановлена из ${filename}`);
        await loadBackups();
        await loadStats();
        // Предупреждаем что нужно перезагрузить страницу
        setTimeout(() => {
          toast.info('Рекомендуется перезагрузить страницу для применения изменений');
        }, 2000);
      }
    } catch (error) {
      logger.error('Error restoring backup:', error);
      toast.error(error.response?.data?.detail || 'Ошибка восстановления бэкапа');
    }
  };

  useEffect(() => {
    loadStats();
    loadBackups();
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getHealthStatus = (used, total) => {
    if (!total) return 'unknown';
    const percent = (used / total) * 100;
    if (percent > 90) return { status: 'critical', color: 'bg-red-500', text: 'text-red-500' };
    if (percent > 70) return { status: 'warning', color: 'bg-yellow-500', text: 'text-yellow-500' };
    return { status: 'healthy', color: 'bg-green-500', text: 'text-green-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <p className="text-slate-400">Не удалось загрузить статистику</p>
          <Button onClick={loadStats} className="mt-4">
            Попробовать еще раз
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dbHealth = getHealthStatus(
    stats.database_size_bytes || 0,
    (stats.database_size_bytes || 0) * 2
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📦 Управление хранилищем</h1>
        <p className="text-slate-400 mt-2">Мониторинг и управление размером БД, логов и кеша</p>
      </div>

      {/* Обзор общего использования */}
      <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Общая статистика
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-2">Размер базы данных</p>
              <p className="text-2xl font-bold text-white">
                {formatBytes(stats.database_size_bytes)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Записей: {stats.total_records?.toLocaleString() || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-2">Состояние</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${dbHealth.color}`}></div>
                <span className="text-lg font-semibold capitalize">
                  {dbHealth.status === 'healthy' && '✅ Здорово'}
                  {dbHealth.status === 'warning' && '⚠️ Требует внимания'}
                  {dbHealth.status === 'critical' && '🚨 Критично'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Детальная информация */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Логи */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">📝 Логи</CardTitle>
            <CardDescription>Системные и API логи</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-300">Использовано</span>
                <span className="text-sm font-semibold">
                  {formatBytes(stats.logs_size_bytes || 0)}
                </span>
              </div>
              <Progress 
                value={Math.min(((stats.logs_size_bytes || 0) / 1024 / 1024) / 500 * 100, 100)}
                className="h-2"
              />
            </div>
            <p className="text-xs text-slate-500">
              Записей: {stats.log_entries?.toLocaleString() || 'N/A'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => handleCleanup('logs')}
              disabled={cleaning}
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Очистить логи старше 30 дней
            </Button>
          </CardContent>
        </Card>

        {/* Голоса */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">🎙️ Голоса</CardTitle>
            <CardDescription>Загруженные пользовательские голоса</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-300">Использовано</span>
                <span className="text-sm font-semibold">
                  {formatBytes(stats.voices_size_bytes || 0)}
                </span>
              </div>
              <Progress 
                value={Math.min(((stats.voices_size_bytes || 0) / 1024 / 1024) / 500 * 100, 100)}
                className="h-2"
              />
            </div>
            <p className="text-xs text-slate-500">
              Голосов: {stats.voices_count?.toLocaleString() || 'N/A'}
            </p>
          </CardContent>
        </Card>

        {/* Кеш */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">💾 Кеш</CardTitle>
            <CardDescription>Временные файлы и кеш</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-300">Использовано</span>
                <span className="text-sm font-semibold">
                  {formatBytes(stats.cache_size_bytes || 0)}
                </span>
              </div>
              <Progress 
                value={Math.min(((stats.cache_size_bytes || 0) / 1024 / 1024) / 500 * 100, 100)}
                className="h-2"
              />
            </div>
            <p className="text-xs text-slate-500">
              Кеш файлов: {stats.cache_files?.toLocaleString() || 'N/A'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => handleCleanup('cache')}
              disabled={cleaning}
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Очистить весь кеш
            </Button>
          </CardContent>
        </Card>

        {/* Резервные копии */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base">🔐 Резервные копии</CardTitle>
                <CardDescription>Управление бэкапами БД</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { loadBackups(); loadStats(); }}
                disabled={loadingBackups}
              >
                <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Статистика */}
            <div className="bg-slate-900/50 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">Всего бэкапов</span>
                <Badge variant="outline">{backups.length}</Badge>
              </div>
              {stats && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Последний бэкап</span>
                  <span className="text-sm font-semibold">
                    {stats.last_backup_time ? new Date(stats.last_backup_time).toLocaleString('ru-RU') : 'Нет'}
                  </span>
                </div>
              )}
            </div>

            {/* Кнопка создания бэкапа */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => handleCleanup('backup').then(() => loadBackups())}
              disabled={cleaning}
            >
              <Download className="w-3 h-3 mr-2" />
              Создать резервную копию
            </Button>

            {/* Список бэкапов */}
            {loadingBackups ? (
              <div className="flex justify-center py-4">
                <Loader className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-4 text-sm text-slate-500">
                Бэкапы не найдены
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {backups.map((backup, idx) => (
                  <div 
                    key={backup.filename || idx}
                    className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {backup.filename.replace('backup_', '').replace('.db', '')}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(backup.created_at).toLocaleString('ru-RU')}
                          </span>
                          <span>{formatBytes(backup.size_bytes)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestoreBackup(backup.filename)}
                          className="h-7 px-2 text-xs"
                          title="Восстановить из этого бэкапа"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBackup(backup.filename)}
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          title="Удалить бэкап"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Кнопка обновления */}
      <div className="flex justify-end">
        <Button 
          onClick={loadStats}
          disabled={loading}
          variant="outline"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Обновить статистику
        </Button>
      </div>
    </div>
  );
};

export default StorageManagementPage;
