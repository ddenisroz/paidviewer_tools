import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    Activity, 
    Cpu, 
    HardDrive, 
    MemoryStick, 
    Users, 
    MessageCircle, 
    AlertTriangle,
    RefreshCw,
    ExternalLink
} from 'lucide-react';

const MonitoringPage = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/monitoring/metrics', {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to fetch metrics');
            }
            const data = await response.json();
            setMetrics(data.metrics);
            setLastUpdate(new Date());
            setError(null);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching metrics:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        // Обновляем каждые 30 секунд
        const interval = setInterval(fetchMetrics, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (value, thresholds = { warning: 70, critical: 90 }) => {
        if (value >= thresholds.critical) return 'text-red-500';
        if (value >= thresholds.warning) return 'text-yellow-500';
        return 'text-green-500';
    };

    const getStatusBadge = (value, thresholds = { warning: 70, critical: 90 }) => {
        if (value >= thresholds.critical) return <Badge variant="destructive">Critical</Badge>;
        if (value >= thresholds.warning) return <Badge variant="secondary">Warning</Badge>;
        return <Badge variant="default">Healthy</Badge>;
    };

    if (loading && !metrics) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-300">Загрузка метрик...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Ошибка загрузки метрик</h3>
                <p className="text-gray-400 mb-4">{error}</p>
                <Button onClick={fetchMetrics} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Попробовать снова
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Мониторинг системы</h2>
                    <p className="text-gray-400">
                        {lastUpdate ? `Обновлено: ${lastUpdate.toLocaleTimeString()}` : 'Метрики не загружены'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchMetrics} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
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

            {/* Метрики приложения */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Всего пользователей */}
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

                {/* Активные пользователи */}
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

                {/* Заблокированные */}
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

                {/* Активные сессии */}
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

            {/* Статистика сообщений */}
            <div className="grid grid-cols-1 gap-4">
                {/* Сообщения за 24 часа */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Сообщения за 24 часа</CardTitle>
                        <MessageCircle className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {metrics?.messages?.last_24h || 0}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Сообщений обработано</p>
                    </CardContent>
                </Card>
            </div>

            {/* Информация о системе */}
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
