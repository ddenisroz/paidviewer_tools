import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Zap, RefreshCw, Filter, Loader, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { logger } from '../../utils/prodLogger';

const ErrorLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedModule, setSelectedModule] = useState('all');
  const [lines, setLines] = useState(100);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await botService.get(`/api/system/logs?lines=${lines}`);
      if (response.data?.success) {
        let filtered = response.data.logs || [];
        
        if (selectedLevel !== 'all') {
          filtered = filtered.filter(log => {
            const upper = log.toUpperCase();
            if (selectedLevel === 'error') return upper.includes('ERROR');
            if (selectedLevel === 'warning') return upper.includes('WARNING');
            if (selectedLevel === 'info') return upper.includes('INFO');
            return true;
          });
        }

        if (selectedModule !== 'all') {
          filtered = filtered.filter(log => log.includes(selectedModule));
        }

        setLogs(filtered);
      }
    } catch (error) {
      logger.error('Error loading logs:', error);
      toast.error('Ошибка загрузки логов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [lines, selectedLevel, selectedModule]);

  const getLevelBadge = (logLine) => {
    const upper = logLine.toUpperCase();
    if (upper.includes('ERROR')) {
      return { bg: 'bg-red-500/20', text: 'text-red-400', icon: '❌', label: 'ERROR' };
    }
    if (upper.includes('WARNING')) {
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '⚠️', label: 'WARNING' };
    }
    if (upper.includes('INFO')) {
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: 'ℹ️', label: 'INFO' };
    }
    return { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: '•', label: 'LOG' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⚠️ Ошибки и логи API</h1>
        <p className="text-slate-400 mt-2">Мониторинг ошибок системы и запросов API</p>
        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg text-sm">
          <p className="text-blue-300 mb-2"><strong>📖 Как работают логи:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-blue-200/80 ml-2">
            <li><strong>Источник:</strong> Логи записываются в файлы <code className="bg-slate-800 px-1 rounded">logs/app/bot_service.log</code> и <code className="bg-slate-800 px-1 rounded">logs/errors/bot_service_errors.log</code></li>
            <li><strong>Формат:</strong> Каждая строка содержит время, уровень (INFO/WARNING/ERROR), модуль и сообщение</li>
            <li><strong>Уровни:</strong> <span className="text-blue-400">INFO</span> - информация, <span className="text-yellow-400">WARNING</span> - предупреждения, <span className="text-red-400">ERROR</span> - ошибки</li>
            <li><strong>Фильтры:</strong> Используйте фильтры для поиска ошибок конкретного модуля или уровня важности</li>
            <li><strong>Обновление:</strong> Нажмите "Обновить" для загрузки последних логов из файлов</li>
          </ul>
        </div>
      </div>

      {/* Фильтры */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Уровень</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value="all">Все</option>
                <option value="error">Ошибки (ERROR)</option>
                <option value="warning">Предупреждения (WARNING)</option>
                <option value="info">Информация (INFO)</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block">Модуль</label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value="all">Все</option>
                <option value="API">API</option>
                <option value="AUTH">Аутентификация</option>
                <option value="TTS">TTS</option>
                <option value="DATABASE">БД</option>
                <option value="WEBSOCKET">WebSocket</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block">Строк</label>
              <select
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button onClick={loadLogs} disabled={loading} className="w-full">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Логи */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Системные логи ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Нет логов с выбранными фильтрами</p>
          ) : (
            <div className="space-y-1 font-mono text-xs overflow-auto max-h-96">
              {logs.map((log, idx) => {
                const badge = getLevelBadge(log);
                return (
                  <div
                    key={idx}
                    className={`${badge.bg} ${badge.text} px-3 py-2 rounded hover:bg-opacity-80 transition cursor-text`}
                  >
                    <span className="mr-2">{badge.icon}</span>
                    <span className="font-semibold">[{badge.label}]</span>
                    <span className="ml-2 break-all">{log}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-2">Ошибок</div>
            <div className="text-3xl font-bold text-red-400">
              {logs.filter(l => l.toUpperCase().includes('ERROR')).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-2">Предупреждений</div>
            <div className="text-3xl font-bold text-yellow-400">
              {logs.filter(l => l.toUpperCase().includes('WARNING')).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-2">Информационных</div>
            <div className="text-3xl font-bold text-blue-400">
              {logs.filter(l => l.toUpperCase().includes('INFO')).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Рекомендации */}
      <Card className="bg-red-900/20 border-red-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-300">
            <AlertTriangle className="w-4 h-4" />
            Важно
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-200 space-y-2">
          <p>• Регулярно проверяйте ошибки (ERROR)</p>
          <p>• Предупреждения (WARNING) требуют внимания в течение дня</p>
          <p>• Используйте фильтры для поиска конкретных проблем</p>
          <p>• Экспортируйте логи при обращении в поддержку</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorLogsPage;
