import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader, RefreshCw, AlertCircle, CheckCircle, XCircle,
  Zap, Clock, Database, Users, Activity, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { logger } from '../../utils/prodLogger';

const BotsManagementPage = () => {
  const [botStatus, setBotStatus] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadBotStatus = async () => {
    try {
      setLoading(true);
      const response = await botService.get('/api/bot/status');
      if (response.data?.success) {
        setBotStatus(response.data.data);
      }
    } catch (error) {
      logger.error('Error loading bot status:', error);
      toast.error('Ошибка загрузки статуса ботов');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const response = await botService.get('/api/status');
      if (response.data) {
        setSystemInfo(response.data);
      }
    } catch (error) {
      logger.error('Error loading system info:', error);
    }
  };

  useEffect(() => {
    loadBotStatus();
    loadSystemInfo();
    // Автоматически обновляем каждые 10 секунд
    const interval = setInterval(() => {
      loadBotStatus();
      loadSystemInfo();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return { bg: 'bg-green-500/20', text: 'text-green-400', label: '✅ Подключен' };
      case 'disconnected':
      case 'error':
        return { bg: 'bg-red-500/20', text: 'text-red-400', label: '❌ Ошибка' };
      case 'degraded':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '⚠️ Деградирован' };
      default:
        return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: '❓ Неизвестно' };
    }
  };

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'disconnected':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Activity className="w-5 h-5 text-slate-500" />;
    }
  };

  if (loading && !botStatus) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">🤖 Управление ботами</h1>
          <p className="text-slate-400 mt-2">Мониторинг статуса TTS сервера, вебсокетов и платформ</p>
        </div>
        <Button onClick={() => { loadBotStatus(); loadSystemInfo(); }} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {botStatus && (
        <>
          {/* TTS Server */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-5 h-5" />
                TTS Сервер
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-2">Статус</p>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={botStatus.tts?.status} />
                    <Badge className={`${getStatusBadge(botStatus.tts?.status).bg} ${getStatusBadge(botStatus.tts?.status).text}`}>
                      {getStatusBadge(botStatus.tts?.status).label}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Движок</p>
                  <p className="font-semibold">{botStatus.tts?.engine || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Очередь</p>
                  <p className="font-semibold">{botStatus.tts?.queue_length || 0} задач</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Ошибок</p>
                  <p className="font-semibold text-red-400">{botStatus.tts?.error_rate || '0%'}</p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm text-slate-400 mb-2">Последний синтез</p>
                  <p className="text-sm text-slate-300">{botStatus.tts?.last_synthesis || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WebSocket Connections */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5" />
                WebSocket Соединения
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-2">Активные соединения</p>
                  <p className="text-3xl font-bold">{botStatus.websocket?.active_connections || 0}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Использование памяти</p>
                  <p className="text-2xl font-bold">{botStatus.websocket?.memory_usage || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Аптайм</p>
                  <p className="text-xl font-semibold text-green-400">{botStatus.websocket?.uptime || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platforms */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Статус платформ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Twitch */}
                {botStatus.platforms?.twitch && (
                  <div className="border border-purple-600/30 rounded p-4 bg-purple-500/5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-purple-200">Twitch</h3>
                      <Badge className={`${getStatusBadge(botStatus.platforms.twitch.status).bg} ${getStatusBadge(botStatus.platforms.twitch.status).text}`}>
                        {botStatus.platforms.twitch.status === 'connected' ? '✅' : '❌'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-400">Bot: <span className="text-slate-200 font-semibold">@{botStatus.platforms.twitch.bot_username}</span></p>
                      <p className="text-slate-400">Каналов: <span className="text-slate-200 font-semibold">{botStatus.platforms.twitch.channels || 0}</span></p>
                      <p className="text-slate-400">Токен: <span className={botStatus.platforms.twitch.token_expires?.includes('days') ? 'text-green-400' : 'text-yellow-400'}>{botStatus.platforms.twitch.token_expires || 'N/A'}</span></p>
                    </div>
                  </div>
                )}

                {/* VK Live */}
                {botStatus.platforms?.vk && (
                  <div className="border border-blue-600/30 rounded p-4 bg-blue-500/5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-blue-200">VK Live</h3>
                      <Badge className={`${getStatusBadge(botStatus.platforms.vk.status).bg} ${getStatusBadge(botStatus.platforms.vk.status).text}`}>
                        {botStatus.platforms.vk.status === 'connected' ? '✅' : '❌'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-400">Статус: <span className="text-slate-200 font-semibold capitalize">{botStatus.platforms.vk.status}</span></p>
                      <p className="text-slate-400">Токен: <span className={botStatus.platforms.vk.token_expires?.includes('days') ? 'text-green-400' : 'text-yellow-400'}>{botStatus.platforms.vk.token_expires || 'N/A'}</span></p>
                    </div>
                  </div>
                )}

                {/* YouTube */}
                {botStatus.platforms?.youtube && (
                  <div className="border border-red-600/30 rounded p-4 bg-red-500/5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-red-200">YouTube</h3>
                      <Badge className={`${getStatusBadge(botStatus.platforms.youtube.status).bg} ${getStatusBadge(botStatus.platforms.youtube.status).text}`}>
                        {botStatus.platforms.youtube.status === 'connected' ? '✅' : '❌'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-400">Статус: <span className="text-slate-200 font-semibold capitalize">{botStatus.platforms.youtube.status}</span></p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Resources */}
          {botStatus.system && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Системные ресурсы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-2">CPU</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold">{botStatus.system.cpu_usage}</p>
                      <p className="text-sm text-slate-400">используется</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-2">Память</p>
                    <p className="text-lg font-semibold">{botStatus.system.memory_usage}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-2">Аптайм</p>
                    <p className="text-lg font-semibold text-green-400">{botStatus.system.uptime}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Recommendations */}
      <Card className="bg-blue-900/20 border-blue-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-blue-300">
            <AlertCircle className="w-4 h-4" />
            Рекомендации
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-200 space-y-2">
          <p>• Проверяйте статус ботов ежедневно</p>
          <p>• Следите за истечением токенов (обновите за 7 дней до истечения)</p>
          <p>• Контролируйте использование памяти (> 80% требует внимания)</p>
          <p>• Если ошибок  > 5%, проверьте логи и перезагрузите сервер</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotsManagementPage;
