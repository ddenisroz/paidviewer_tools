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
  CheckCircle,
  Loader,
  RefreshCw,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../services/api/services/adminService';
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
      const response = await adminService.getDatabaseStats();
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
      backup: 'Резервная копия'
    };
    
    const typeName = typeNames[type] || type;
    
    try {
      setCleaning(true);
      const response = await adminService.cleanupDatabase({
        cleanup_type: type
      });
      
      if (response.data?.success) {
        toast.success(`${typeName} обработан успешно`);
        await loadStats();
        if (type === 'backup') {
          await loadBackups();
        }
      } else {
        const errorMsg = response.data?.error || response.data?.message || 'Неизвестная ошибка';
        toast.error(`Ошибка: ${errorMsg}`);
      }
    } catch (error) {
      logger.error(`Error cleaning ${type}:`, error);
      const errorMsg = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
      toast.error(`Ошибка: ${errorMsg}`);
    } finally {
      setCleaning(false);
    }
  };

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const response = await adminService.getBackups();
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
    if (!confirm(`Удалить бэкап "${filename}"?`)) return;
    
    try {
      const response = await adminService.deleteBackup(filename);
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
    if (!confirm(`⚠️ ВНИМАНИЕ: Восстановить БД из "${filename}"?\n\nТекущее состояние будет сохранено автоматически, но операция необратима.\n\nПродолжить?`)) return;
    
    try {
      const response = await adminService.restoreBackup(filename);
      if (response.data?.success) {
        toast.success(`База данных восстановлена из ${filename}`);
        await loadBackups();
        await loadStats();
        setTimeout(() => {
          toast.info('Рекомендуется перезагрузить страницу');
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
        <CardContent className="pt-0">
          <p className="text-slate-400">Не удалось загрузить статистику</p>
          <Button onClick={loadStats} className="mt-4">
            Попробовать еще раз
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-purple-400" />
            Хранилище
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Мониторинг и управление размером БД, логов и кеша
          </p>
        </div>
        <Button onClick={() => { loadStats(); loadBackups(); }} variant="outline" size="sm" disabled={loading || loadingBackups}>
          <RefreshCw className={`w-4 h-4 mr-2 ${(loading || loadingBackups) ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Общая статистика */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Общая статистика
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Размер базы данных</p>
              <p className="text-2xl font-bold text-white">
                {formatBytes(stats.database_size_bytes)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Записей: {stats.total_records?.toLocaleString() || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Состояние</p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-lg font-semibold text-green-400">Здорово</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Основные разделы */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Логи */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Логи</CardTitle>
            <CardDescription className="text-xs">Системные и API логи</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
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

        {/* Кеш */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Кеш</CardTitle>
            <CardDescription className="text-xs">Временные файлы и кеш</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
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

        {/* Голоса */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Голоса</CardTitle>
            <CardDescription className="text-xs">Загруженные пользовательские голоса</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
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

        {/* Резервные копии - главное */}
        <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Download className="w-5 h-5 text-purple-400" />
                  Резервные копии
                </CardTitle>
                <CardDescription className="text-xs">Управление бэкапами БД</CardDescription>
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
            {/* Статистика бэкапов */}
            <div className="bg-slate-900/50 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">Всего бэкапов</span>
                <Badge variant="outline" className="text-purple-400 border-purple-400">
                  {backups.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Последний бэкап</span>
                <span className="text-sm font-semibold text-slate-200">
                  {stats.last_backup_time ? new Date(stats.last_backup_time).toLocaleString('ru-RU') : 'Нет'}
                </span>
              </div>
            </div>

            {/* Кнопка создания бэкапа - главная */}
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={() => handleCleanup('backup').then(() => loadBackups())}
              disabled={cleaning}
            >
              <Download className="w-4 h-4 mr-2" />
              {cleaning ? 'Создание...' : 'Создать резервную копию'}
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
              <div className="space-y-2 max-h-64 overflow-y-auto">
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
                          title="Восстановить"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBackup(backup.filename)}
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          title="Удалить"
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
    </div>
  );
};

export default StorageManagementPage;
