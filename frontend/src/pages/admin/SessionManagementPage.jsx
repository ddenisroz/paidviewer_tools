import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Monitor, Clock, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const SessionManagementPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await botService.get('/api/admin/sessions');
      setSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast.error('Ошибка загрузки сессий');
    } finally {
      setLoading(false);
    }
  };

  const refreshSessions = async () => {
    try {
      setRefreshing(true);
      await loadSessions();
      toast.success('Список сессий обновлен');
    } catch (error) {
      console.error('Error refreshing sessions:', error);
      toast.error('Ошибка обновления сессий');
    } finally {
      setRefreshing(false);
    }
  };

  const terminateSession = async (session) => {
    try {
      if (session.session_type === 'active_user') {
        // Для пользовательских сессий используем новый endpoint
        await botService.delete(`/api/admin/sessions/user/${session.user_id}`);
      } else {
        // Для pending verifications используем старый endpoint
        await botService.delete(`/api/admin/sessions/${session.channel}`);
      }
      toast.success('Сессия завершена');
      await loadSessions();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Ошибка завершения сессии');
    }
  };

  const formatLastActivity = (timestamp) => {
    if (!timestamp) return 'Неизвестно';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    return `${diffDays} дн. назад`;
  };

  const getSessionTypeIcon = (session) => {
    if (session.device_info?.guest_channel) {
      return <Users className="w-4 h-4 text-blue-500" />;
    }
    return <Monitor className="w-4 h-4 text-green-500" />;
  };

  const getSessionTypeBadge = (session) => {
    if (session.device_info?.guest_channel) {
      return <Badge variant="outline" className="text-blue-600 border-blue-200">Гость</Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-200">Авторизован</Badge>;
  };

  useEffect(() => {
    loadSessions();
    
    // Автообновление каждые 30 секунд
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Фильтруем сессии по типу
  const activeUserSessions = sessions.filter(s => s.session_type === 'active_user');
  const pendingVerifications = sessions.filter(s => s.session_type === 'pending_verification');
  
  // Для обратной совместимости
  const activeSessions = activeUserSessions;
  const inactiveSessions = pendingVerifications;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-6 text-foreground flex items-center">
            <Monitor className="w-8 h-8 mr-3 text-blue-500" />
            Управление сессиями
          </h1>
          <p className="text-muted-foreground mt-2">
            Просмотр и управление активными пользовательскими сессиями
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button onClick={refreshSessions} disabled={refreshing} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-600/20 rounded-lg">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-slate-400">Активные сессии</p>
                <p className="text-2xl font-bold text-white">{activeSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-600/20 rounded-lg">
                <Monitor className="w-6 h-6 text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-slate-400">Всего сессий</p>
                <p className="text-2xl font-bold text-white">{sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-600/20 rounded-lg">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-slate-400">Неактивные</p>
                <p className="text-2xl font-bold text-white">{inactiveSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Активные сессии */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-green-400">Активные сессии ({activeSessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-500" />
              <p className="text-lg font-medium mb-2 text-white">Нет активных сессий</p>
              <p className="text-sm">Активные сессии будут отображаться здесь</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div key={session.user_id || session.channel} className="flex items-center justify-between p-4 border border-green-600/20 rounded-lg bg-green-900/10">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Users className="w-4 h-4 text-green-500" />
                      <span className="font-medium">
                        {session.display_name || session.channel || `User ${session.user_id}`}
                      </span>
                      {session.is_admin && (
                        <Badge variant="outline" className="text-purple-600 border-purple-200">
                          Админ
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        Активна
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                      <span>ID: {session.user_id || session.channel}</span>
                      <span>Создана: {new Date(session.created_at).toLocaleString('ru-RU')}</span>
                      <span>Активность: {formatLastActivity(session.last_activity)}</span>
                      {session.platforms && session.platforms.length > 0 && (
                        <div className="flex space-x-2">
                          {session.platforms.map((platform, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {platform.platform}: {platform.username}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => terminateSession(session)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Завершить
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Неактивные сессии */}
      {inactiveSessions.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-400">Неактивные сессии ({inactiveSessions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactiveSessions.slice(0, 10).map((session) => (
                <div key={session.session_id} className="flex items-center justify-between p-4 border border-slate-600/20 rounded-lg bg-slate-700/50">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      {getSessionTypeIcon(session)}
                      <span className="font-medium text-white">
                        {session.device_info?.guest_channel || `User ${session.user_id}`}
                      </span>
                      {getSessionTypeBadge(session)}
                      <Badge variant="outline" className="text-xs text-slate-400 border-slate-500">
                        Неактивна
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
                      <span>ID: {session.session_id.substring(0, 8)}...</span>
                      <span>Создана: {new Date(session.created_at).toLocaleString('ru-RU')}</span>
                      <span>Последняя активность: {formatLastActivity(session.last_activity)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {inactiveSessions.length > 10 && (
                <p className="text-center text-sm text-slate-400">
                  ... и еще {inactiveSessions.length - 10} неактивных сессий
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SessionManagementPage;