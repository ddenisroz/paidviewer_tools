import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { logger } from '../../utils/prodLogger';

const ErrorLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState('error'); // По умолчанию только ошибки

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await botService.get('/api/system/logs?lines=200');
      if (response.data?.success) {
        let filtered = response.data.logs || [];
        
        // Фильтруем по уровню
        if (filterLevel !== 'all') {
          filtered = filtered.filter(log => {
            const upper = log.toUpperCase();
            if (filterLevel === 'error') return upper.includes('ERROR');
            if (filterLevel === 'warning') return upper.includes('WARNING');
            return true;
          });
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
  }, [filterLevel]);

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

  // Парсим лог-строку для извлечения компонентов
  const parseLogLine = (logLine) => {
    // Формат: "2025-11-07 12:28:35 - INFO - сообщение"
    const match = logLine.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (\w+) - (.+)$/);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2],
        message: match[3]
      };
    }
    // Если не удалось распарсить, возвращаем как есть
    return {
      timestamp: null,
      level: null,
      message: logLine
    };
  };

  const errorCount = logs.filter(l => l.toUpperCase().includes('ERROR')).length;
  const warningCount = logs.filter(l => l.toUpperCase().includes('WARNING')).length;

  return (
    <div className="space-y-4">
      {/* Заголовок и фильтры */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            Ошибки
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {errorCount > 0 && <span className="text-red-400">{errorCount} ошибок</span>}
            {errorCount > 0 && warningCount > 0 && <span className="mx-2">•</span>}
            {warningCount > 0 && <span className="text-yellow-400">{warningCount} предупреждений</span>}
            {errorCount === 0 && warningCount === 0 && <span className="text-green-400">Ошибок не найдено</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="error">❌ Только ошибки</option>
            <option value="warning">⚠️ Предупреждения</option>
            <option value="all">📋 Все логи</option>
          </select>
          <Button onClick={loadLogs} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Логи */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Нет записей с выбранными фильтрами</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-auto max-h-[600px]">
              {logs.map((log, idx) => {
                const badge = getLevelBadge(log);
                const parsed = parseLogLine(log);
                return (
                  <div
                    key={idx}
                    className={`${badge.bg} border border-opacity-20 ${badge.text} px-4 py-3 rounded-lg hover:bg-opacity-80 transition cursor-text`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">{badge.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">{badge.label}</span>
                          {parsed.timestamp && (
                            <span className="text-xs opacity-60 font-mono">
                              {parsed.timestamp}
                            </span>
                          )}
                        </div>
                        <div className="text-sm break-words whitespace-pre-wrap">
                          {parsed.message || log}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorLogsPage;
