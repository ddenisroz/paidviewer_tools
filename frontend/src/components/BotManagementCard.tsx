// src/components/BotManagementCard.tsx
import React, { useEffect, useState } from 'react';

import { AlertCircle, Bot, CheckCircle, ExternalLink, Info, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/utils/toastManager';

import { API_BASE_URL } from '../constants';

interface BotTokenStatus {
  success: boolean;
  configured: boolean;
  bot_login?: string;
  bot_user_id?: string;
  expires_at?: string;
  days_left?: number;
  needs_refresh?: boolean;
  has_refresh_token?: boolean;
  message?: string;
}

export const BotManagementCard: React.FC = () => {
  const [tokenStatus, setTokenStatus] = useState<BotTokenStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTokenStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/bot/token-status`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTokenStatus(data);
      } else if (response.status === 403) {
        // Не админ - не показываем ошибку
        setTokenStatus(null);
      }
    } catch (error) {
      console.error('Error fetching bot token status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeBot = () => {
    // Открываем OAuth авторизацию в текущем окне
    window.location.href = `${API_BASE_URL}/auth/twitch/bot/login`;
  };

  const handleRefreshToken = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/bot/refresh-token`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Токен бота обновлён');
        await fetchTokenStatus();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Ошибка обновления токена');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error('Ошибка обновления токена');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokenStatus();
  }, []);

  // Если не админ или нет доступа - не показываем карточку
  if (tokenStatus === null && !loading) {
    return null;
  }

  const getDaysLeftColor = (days?: number): "default" | "destructive" | "secondary" | "outline" => {
    if (!days) return 'default';
    if (days < 7) return 'destructive';
    if (days < 30) return 'secondary'; // warning не существует, используем secondary
    return 'outline'; // success не существует, используем outline для положительного статуса
  };

  const getDaysLeftText = (days?: number) => {
    if (!days) return 'Неизвестно';
    if (days < 1) return 'Истекает сегодня!';
    if (days === 1) return '1 день';
    if (days < 7) return `${days} дней (обновите!)`;
    return `${days} дней`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <CardTitle>Управление ботом</CardTitle>
          </div>
          {tokenStatus?.configured && tokenStatus.has_refresh_token && (
            <Badge variant="outline" className="gap-1 border-green-500 text-green-500">
              <CheckCircle className="w-3 h-3" />
              Автообновление
            </Badge>
          )}
        </div>
        <CardDescription>
          OAuth авторизация бота с автоматическим обновлением токена
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : tokenStatus?.configured ? (
          <>
            {/* Информация о боте */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Бот:</span>
                <span className="font-medium">{tokenStatus.bot_login}</span>
              </div>
              
              {tokenStatus.days_left !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Токен истекает:</span>
                  <Badge variant={getDaysLeftColor(tokenStatus.days_left)}>
                    {getDaysLeftText(tokenStatus.days_left)}
                  </Badge>
                </div>
              )}

              {tokenStatus.has_refresh_token && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 mt-2">
                  <CheckCircle className="w-3 h-3" />
                  <span>Токен обновляется автоматически</span>
                </div>
              )}
            </div>

            {/* Действия */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshToken}
                disabled={refreshing}
                className="flex-1"
              >
                {refreshing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Обновление...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Обновить токен
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAuthorizeBot}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Переавторизовать
              </Button>
            </div>

            {/* Предупреждение если нужно обновить */}
            {tokenStatus.needs_refresh && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-yellow-600 dark:text-yellow-400">
                    Токен скоро истечёт
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Рекомендуется обновить токен сейчас
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Бот не настроен */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-blue-600 dark:text-blue-400 mb-2">
                    OAuth авторизация с автообновлением
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Токен обновляется автоматически</li>
                    <li>• Не требует ручного обслуживания</li>
                    <li>• Безопасное хранение в базе данных</li>
                  </ul>
                </div>
              </div>

              <Button
                onClick={handleAuthorizeBot}
                className="w-full"
                size="lg"
              >
                <Bot className="w-4 h-4 mr-2" />
                Авторизовать бота
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Вы будете перенаправлены на Twitch для авторизации бота
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
