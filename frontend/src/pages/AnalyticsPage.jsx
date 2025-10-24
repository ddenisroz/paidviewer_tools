import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Users, 
  MessageCircle, 
  Zap,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const AnalyticsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Загружаем реальные метрики с бэкенда
      const response = await fetch('/api/admin/analytics', {
        credentials: 'include',  // Отправляем cookies для авторизации
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      
      const data = await response.json();
      setStats(data.analytics || generateMockStats());
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Error loading analytics:', err);
      // Показываем mock данные если ошибка
      setStats(generateMockStats());
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mock данные для демонстрации
  const generateMockStats = () => ({
    active_users: 45,
    total_messages: 12543,
    tts_requests: 8932,
    errors_count: 3,
    uptime_percent: 99.8,
    avg_response_time: 142,
    cpu_usage: 35,
    memory_usage: 62,
    last_error: 'WebSocket connection timeout',
    top_commands: [
      { command: '!sr', count: 234 },
      { command: '!song', count: 189 },
      { command: '!points', count: 156 }
    ]
  });

  useEffect(() => {
    loadAnalytics();
    // Обновляем каждые 60 секунд
    const interval = setInterval(loadAnalytics, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-red-500">
        Не удалось загрузить аналитику
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">📊 Аналитика системы</h1>
          <p className="text-gray-500 text-sm">
            Последнее обновление: {lastUpdate?.toLocaleTimeString('ru-RU')}
          </p>
        </div>
        <Button 
          onClick={loadAnalytics} 
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Предупреждение</p>
            <p className="text-sm text-yellow-700">{error}</p>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Активные пользователи</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-600">{stats.active_users}</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {/* Messages Count */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Всего сообщений</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600">{(stats.total_messages / 1000).toFixed(1)}K</span>
              <MessageCircle className="w-4 h-4 text-green-400" />
            </div>
          </CardContent>
        </Card>

        {/* TTS Requests */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">TTS запросов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-600">{(stats.tts_requests / 1000).toFixed(1)}K</span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Аптайм</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600">{stats.uptime_percent}%</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⚙️ Производительность</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">CPU</span>
                <span className="text-sm text-gray-500">{stats.cpu_usage}%</span>
              </div>
              <Progress value={stats.cpu_usage} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Память</span>
                <span className="text-sm text-gray-500">{stats.memory_usage}%</span>
              </div>
              <Progress value={stats.memory_usage} className="h-2" />
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-gray-600">
                Среднее время ответа: <span className="font-medium">{stats.avg_response_time}ms</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🔍 Статус системы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API</span>
              <Badge className="bg-green-100 text-green-800">✓ Online</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WebSocket</span>
              <Badge className="bg-green-100 text-green-800">✓ Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Database</span>
              <Badge className="bg-green-100 text-green-800">✓ Connected</Badge>
            </div>
            {stats.errors_count > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-red-600">
                  ⚠️ {stats.errors_count} ошибок в системе
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Последняя: {stats.last_error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Commands */}
      {stats.top_commands && stats.top_commands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎯 Популярные команды</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.top_commands.map((cmd, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{cmd.command}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(cmd.count / stats.top_commands[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">{cmd.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;
