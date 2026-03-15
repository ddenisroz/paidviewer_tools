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
  Volume2,
} from 'lucide-react';

import {
  AdminPageHeader,
  ADMIN_ACTION_BUTTON_CLASS,
  ADMIN_CARD_CLASS,
} from '@/features/admin/components/admin-ui';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageLoader } from '@/shared/components/ui/loader';
import { getSafeNavigationUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';
import { getApiBaseUrl } from '@/shared/utils/urlUtils';

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

interface MetricsPayload {
  metrics?: Metrics;
}

const AdminMonitoringPage: React.FC = () => {
  const queryClient = useQueryClient();

  const handleOpenMetrics = (): void => {
    const metricsUrl = `${getApiBaseUrl()}/metrics`;
    const safeUrl = getSafeNavigationUrl(metricsUrl);

    if (!safeUrl) {
      logger.warn('Blocked unsafe metrics URL', { metricsUrl });
      return;
    }

    window.open(safeUrl, '_blank', 'noopener,noreferrer');
  };

  const { data: metricsData, isLoading, error } = useQuery<Metrics | null>({
    queryKey: ['monitoring-metrics'],
    queryFn: async () => {
      const response = await adminService.getMonitoringMetrics();
      return (response.data as MetricsPayload).metrics || null;
    },
    staleTime: 5 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (error) {
      logger.error('Error fetching metrics', error);
    }
  }, [error]);

  if (isLoading && !metricsData) {
    return <PageLoader message="Загрузка метрик..." />;
  }

  if (error) {
    return (
      <Card className={ADMIN_CARD_CLASS}>
        <CardContent className="py-10 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">Не удалось загрузить метрики</h3>
          <p className="mb-4 text-sm text-muted-foreground">{error.message}</p>
          <Button
            className={ADMIN_ACTION_BUTTON_CLASS}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] })}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metrics = metricsData;
  const lastUpdate = metrics ? new Date() : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Мониторинг"
        description="Сводка по пользователям, активности, каналам и текущей нагрузке на TTS."
        actions={
          <>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] })}
              variant="outline"
              size="sm"
              className={ADMIN_ACTION_BUTTON_CLASS}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            <Button
              onClick={handleOpenMetrics}
              variant="outline"
              size="sm"
              className={ADMIN_ACTION_BUTTON_CLASS}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Открыть `/metrics`
            </Button>
          </>
        }
        meta={
          <Badge variant="outline" className="border-border/70 bg-background/60 text-muted-foreground">
            {lastUpdate ? `Обновлено в ${lastUpdate.toLocaleTimeString('ru-RU')}` : 'Нет свежих данных'}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Пользователи</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{metrics?.users?.total || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Всего аккаунтов</p>
          </CardContent>
        </Card>

        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активные</CardTitle>
            <Users className="h-4 w-4 text-emerald-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-300">{metrics?.users?.active || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">С недавней активностью</p>
          </CardContent>
        </Card>

        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Заблокированы</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{metrics?.users?.blocked || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">С ограниченным доступом</p>
          </CardContent>
        </Card>

        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сессии</CardTitle>
            <Activity className="h-4 w-4 text-sky-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-sky-300">{metrics?.sessions?.active || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Активных веб-сессий</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сообщения за 24 часа</CardTitle>
            <MessageCircle className="h-4 w-4 text-sky-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-sky-300">{metrics?.messages?.last_24h || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Обработано ботом</p>
          </CardContent>
        </Card>

        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сообщения за час</CardTitle>
            <Activity className="h-4 w-4 text-emerald-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-300">{metrics?.messages?.last_1h || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Текущая активность</p>
          </CardContent>
        </Card>

        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Интеграции</CardTitle>
            <Users className="h-4 w-4 text-violet-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-violet-300">{metrics?.integrations?.active || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Подключений Twitch и VK</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Каналы</CardTitle>
            <Tv className="h-4 w-4 text-cyan-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-cyan-300">{metrics?.channels?.active || 0}</div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Twitch</span>
                <span className="text-violet-300">{metrics?.channels?.twitch || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>VK Live</span>
                <span className="text-sky-300">{metrics?.channels?.vk || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={ADMIN_CARD_CLASS}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TTS за 24 часа</CardTitle>
            <Volume2 className="h-4 w-4 text-amber-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-amber-300">{metrics?.tts?.requests_24h || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Запросов синтеза</p>
            {metrics?.tts?.enabled_channels ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Активных каналов с TTS: <span className="text-amber-300">{metrics.tts.enabled_channels}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMonitoringPage;
