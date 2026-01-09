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
import { logger } from '@/shared/utils/prodLogger';

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

const MonitoringPage: React.FC = () => {
    const queryClient = useQueryClient();
    
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
    
    // React Query v5: onError moved to useEffect
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
            <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Ошибка загрузки метрик</h3>
                <p className="text-gray-400 mb-4">{error}</p>
                <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] })} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Попробовать снова
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Мониторинг системы</h2>
                    <p className="text-gray-400">
                        {lastUpdate ? `Обновлено: ${lastUpdate.toLocaleTimeString()}` : 'Метрики не загружены'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['monitoring-metrics'] })} variant="outline" size="sm" disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                    <Button 
                        onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/metrics`, '_blank')} 
                        variant="outline" 
                        size="sm"
                    >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Prometheus
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Всего пользователей</CardTitle>
                        <Users className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {metrics?.users?.total || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Зарегистрировано</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Активные</CardTitle>
                        <Users className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {metrics?.users?.active || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Активных пользователей</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Заблокированные</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-400">
                            {metrics?.users?.blocked || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Заблокировано</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Сессии</CardTitle>
                        <Activity className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {metrics?.sessions?.active || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Активные сессии</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Сообщения за 24ч</CardTitle>
                        <MessageCircle className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {metrics?.messages?.last_24h || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Обработано сообщений</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Сообщения за час</CardTitle>
                        <Activity className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {metrics?.messages?.last_1h || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Активность в чате</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Активные интеграции</CardTitle>
                        <Users className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-400">
                            {metrics?.integrations?.active || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Подключений Twitch/VK</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Активные каналы</CardTitle>
                        <Tv className="h-4 w-4 text-cyan-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-cyan-400">
                            {metrics?.channels?.active || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Каналов с активным ботом</p>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Twitch:</span>
                                <span className="text-purple-400">{metrics?.channels?.twitch || 0}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">VK Live:</span>
                                <span className="text-blue-400">{metrics?.channels?.vk || 0}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">TTS запросы за 24ч</CardTitle>
                        <Volume2 className="h-4 w-4 text-yellow-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-400">
                            {metrics?.tts?.requests_24h || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Запросов синтеза речи</p>
                        {metrics?.tts?.enabled_channels && (
                            <div className="mt-2">
                                <span className="text-xs text-gray-400">
                                    Активных каналов с TTS: <span className="text-yellow-400">{metrics.tts.enabled_channels}</span>
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-white flex items-center">
                        <Activity className="h-5 w-5 mr-2" />
                        Информация о системе
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-400">Последнее обновление</p>
                            <p className="text-white">
                                {metrics?.timestamp 
                                    ? new Date(metrics.timestamp).toLocaleString('ru-RU')
                                    : 'Неизвестно'
                                }
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Статус</p>
                            <Badge variant="default" className="bg-green-600">
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



