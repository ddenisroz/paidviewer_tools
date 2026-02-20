import React, { useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Tv,
  Users,
  Volume2
} from 'lucide-react';

import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageLoader } from '@/shared/components/ui/loader';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';
import { getApiUrl } from '@/utils/urlUtils';

interface Metrics {
  users?: {
    total?: number;
    active?: number;
    blocked?: number;
  };
  sessions?: {
    active?: number;
  };
  messages?: {
    last_24h?: number;
    last_1h?: number;
  };
  integrations?: {
    active?: number;
  };
  channels?: {
    active?: number;
    twitch?: number;
    vk?: number;
  };
  tts?: {
    requests_24h?: number;
    enabled_channels?: number;
  };
  timestamp?: string;
}

interface ApiResponse {
  metrics?: Metrics;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75 backdrop-blur-sm shadow-none';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 hover:bg-muted/60 shadow-none';

const MonitoringPage: React.FC = () => {
  const queryClient = useQueryClient();
  const handleOpenPrometheus = (): void => {
    const metricsUrl = `${getApiUrl()}/metrics`;
    const safeUrl = getSafeNavigationUrl(metricsUrl);
    if (!safeUrl) {
      logger.warn('Blocked unsafe Prometheus URL', { metricsUrl });
      return;
    }
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
  };

  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useQuery<Metrics | null>({
    queryKey: ['monitoring-metrics'],
    queryFn: async () => {
      const response = await adminService.getMonitoringMetrics();
      return (response.data as ApiResponse).metrics || null;
    },
    staleTime: 5 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (metricsError) {
      logger.error('Error fetching metrics:', metricsError);
    }
  }, [metricsError]);

  const metrics = metricsData;
  const loading = metricsLoading;
  const error = metricsError?.message || null;
  const lastUpdate = metricsData ? new Date() : null;

  if (loading && !metrics) {
    return <PageLoader message="Загрузка метрик..." />;
  }

  if (error) {
    return (
      <Card className={SURFACE_CARD_CLASS}>
        <CardContent className="py-10 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">Ошибка загрузки метрик</h3>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <Button
            className={ACTION_BUTTON_CLASS}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] })}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Попробовать снова
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-foreground">Мониторинг системы</h2>
          <p className="text-sm text-muted-foreground">
            {lastUpdate ? `Обновлено: ${lastUpdate.toLocaleTimeString()}` : 'Метрики не загружены'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] })}
            variant="outline"
            size="sm"
            className={ACTION_BUTTON_CLASS}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          <Button
            onClick={handleOpenPrometheus}
            variant="outline"
            size="sm"
            className={ACTION_BUTTON_CLASS}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Prometheus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{metrics?.users?.total || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Зарегистрировано</p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активные</CardTitle>
            <Users className="h-4 w-4 text-emerald-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-300">{metrics?.users?.active || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Активных пользователей</p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Заблокированные</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{metrics?.users?.blocked || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Заблокировано</p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сессии</CardTitle>
            <Activity className="h-4 w-4 text-sky-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-sky-300">{metrics?.sessions?.active || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Активные сессии</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сообщения за 24ч</CardTitle>
            <MessageCircle className="h-4 w-4 text-sky-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-sky-300">{metrics?.messages?.last_24h || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Обработано сообщений</p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сообщения за час</CardTitle>
            <Activity className="h-4 w-4 text-emerald-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-300">{metrics?.messages?.last_1h || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Активность в чате</p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активные интеграции</CardTitle>
            <Users className="h-4 w-4 text-violet-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-violet-300">{metrics?.integrations?.active || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Подключений Twitch/VK</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активные каналы</CardTitle>
            <Tv className="h-4 w-4 text-cyan-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-cyan-300">{metrics?.channels?.active || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Каналов с активным ботом</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Twitch:</span>
                <span className="text-violet-300">{metrics?.channels?.twitch || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">VK Live:</span>
                <span className="text-sky-300">{metrics?.channels?.vk || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TTS запросы за 24ч</CardTitle>
            <Volume2 className="h-4 w-4 text-amber-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-amber-300">{metrics?.tts?.requests_24h || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Запросов синтеза речи</p>
            {metrics?.tts?.enabled_channels && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">
                  Активных каналов с TTS: <span className="text-amber-300">{metrics.tts.enabled_channels}</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-semibold text-foreground">
            <Activity className="mr-2 h-5 w-5" />
            Информация о системе
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Последнее обновление</p>
              <p className="text-foreground">
                {metrics?.timestamp
                  ? new Date(metrics.timestamp).toLocaleString('ru-RU')
                  : 'Неизвестно'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Статус</p>
              <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                Работает
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringPage;
