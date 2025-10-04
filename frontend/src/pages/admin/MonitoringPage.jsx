// src/pages/admin/MonitoringPage.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Activity, 
    Cpu, 
    HardDrive, 
    MemoryStick, 
    Wifi, 
    Thermometer,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Minus
} from 'lucide-react';
import { toast } from 'sonner';
import { botService, ttsService } from '../../services/microservices';

const MonitoringPage = () => {
    const [botStats, setBotStats] = useState(null);
    const [ttsStats, setTtsStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(5);

    const loadMonitoringData = async () => {
        try {
            setLoading(true);
            
            // Загружаем данные параллельно
            const [botResponse, ttsResponse] = await Promise.all([
                botService.get('/api/admin/monitoring/current'),
                ttsService.get('/api/admin/monitoring/current')
            ]);

            // Преобразуем данные в нужный формат
            const transformData = (data) => {
                if (!data) return null;
                return {
                    uptime: data.uptime_seconds || 0,
                    cpu_percent: data.process?.cpu_percent || 0,
                    memory_bytes: (data.process?.memory_mb || 0) * 1024 * 1024,
                    num_threads: data.process?.threads || 0,
                    num_fds: data.process?.open_files || 0,
                    num_connections: data.process?.connections || 0,
                    system_cpu_percent: data.system?.cpu_percent || 0,
                    system_memory_used: (data.system?.memory_used_gb || 0) * 1024 * 1024 * 1024,
                    system_memory_total: (data.system?.memory_total_gb || 0) * 1024 * 1024 * 1024,
                    system_memory_percent: data.system?.memory_percent || 0,
                    disk_used: (data.system?.disk_used_gb || 0) * 1024 * 1024 * 1024,
                    disk_total: (data.system?.disk_total_gb || 0) * 1024 * 1024 * 1024,
                    disk_percent: data.system?.disk_percent || 0,
                    gpu_percent: data.gpu?.gpu_utilization_percent || 0,
                    gpu_memory_bytes: (data.gpu?.gpu_memory_used_mb || 0) * 1024 * 1024,
                    gpu_temperature: data.gpu?.gpu_temperature_c || 0,
                };
            };

            setBotStats(transformData(botResponse.data.data));
            setTtsStats(transformData(ttsResponse.data.data));
            
        } catch (error) {
            console.error('Error loading monitoring data:', error);
            toast.error('Ошибка загрузки данных мониторинга');
        } finally {
            setLoading(false);
        }
    };

    const loadSummaryData = async () => {
        try {
            const [botResponse, ttsResponse] = await Promise.all([
                botService.get('/api/admin/monitoring/summary'),
                ttsService.get('/api/admin/monitoring/summary')
            ]);

            return {
                bot: botResponse.data.data,
                tts: ttsResponse.data.data
            };
        } catch (error) {
            console.error('Error loading summary data:', error);
            return null;
        }
    };

    // Автообновление
    useEffect(() => {
        loadMonitoringData();
        
        if (autoRefresh) {
            const interval = setInterval(loadMonitoringData, refreshInterval * 1000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshInterval]);

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getTrendIcon = (current, previous) => {
        if (!previous) return <Minus className="w-4 h-4 text-gray-400" />;
        const diff = current - previous;
        if (diff > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
        if (diff < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
        return <Minus className="w-4 h-4 text-gray-400" />;
    };

    const MetricCard = ({ title, value, unit, icon: Icon, trend, color = "text-blue-600" }) => {
        // Проверяем на NaN и приводим к строке
        const safeValue = isNaN(value) ? '0' : String(value);
        const safeUnit = unit || '';
        
        return (
            <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Icon className={`w-5 h-5 ${color}`} />
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {safeValue}{safeUnit && <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{safeUnit}</span>}
                                </p>
                            </div>
                        </div>
                        {trend && (
                            <div className="flex items-center space-x-1">
                                {trend}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    const ServiceCard = ({ title, stats, color }) => {
        if (!stats) return null;

        return (
            <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-white">
                        <div className={`w-3 h-3 rounded-full ${color}`}></div>
                        <span>{title}</span>
                        <Badge variant="outline" className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                            {formatUptime(stats.uptime)}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            title="CPU"
                            value={stats.cpu_percent?.toFixed(1)}
                            unit="%"
                            icon={Cpu}
                            color="text-orange-600"
                        />
                        <MetricCard
                            title="Память"
                            value={formatBytes(stats.memory_bytes)}
                            icon={MemoryStick}
                            color="text-blue-600"
                        />
                        <MetricCard
                            title="Потоки"
                            value={stats.num_threads}
                            icon={Activity}
                            color="text-green-600"
                        />
                        <MetricCard
                            title="Файлы"
                            value={stats.num_fds}
                            icon={HardDrive}
                            color="text-purple-600"
                        />
                    </div>
                    
                    {/* GPU метрики для TTS */}
                    {stats.gpu_percent !== undefined && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">GPU метрики</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <MetricCard
                                    title="GPU"
                                    value={stats.gpu_percent?.toFixed(1)}
                                    unit="%"
                                    icon={Thermometer}
                                    color="text-red-600"
                                />
                                <MetricCard
                                    title="GPU память"
                                    value={formatBytes(stats.gpu_memory_bytes)}
                                    icon={MemoryStick}
                                    color="text-red-600"
                                />
                                <MetricCard
                                    title="GPU температура"
                                    value={stats.gpu_temperature?.toFixed(0)}
                                    unit="°C"
                                    icon={Thermometer}
                                    color="text-red-600"
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Мониторинг ресурсов</h1>
                    <p className="text-gray-600 dark:text-gray-400">Отслеживание использования CPU, памяти и других ресурсов</p>
                </div>
                
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400">Автообновление:</label>
                        <Button
                            variant={autoRefresh ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                        >
                            {autoRefresh ? "Включено" : "Выключено"}
                        </Button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400">Интервал:</label>
                        <select
                            value={refreshInterval}
                            onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                            disabled={!autoRefresh}
                        >
                            <option value={2}>2 сек</option>
                            <option value={5}>5 сек</option>
                            <option value={10}>10 сек</option>
                            <option value={30}>30 сек</option>
                        </select>
                    </div>
                    
                    <Button
                        onClick={loadMonitoringData}
                        disabled={loading}
                        size="sm"
                    >
                        {loading ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Обновить
                    </Button>
                </div>
            </div>

            {loading && !botStats && !ttsStats ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">Загрузка данных мониторинга...</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <ServiceCard
                        title="Bot Service"
                        stats={botStats}
                        color="bg-blue-500"
                    />
                    
                    <ServiceCard
                        title="TTS Service"
                        stats={ttsStats}
                        color="bg-green-500"
                    />
                    
                    {/* Сравнительная таблица */}
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardHeader>
                            <CardTitle className="text-gray-900 dark:text-white">Сравнение сервисов</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-2 text-gray-700 dark:text-gray-300">Метрика</th>
                                            <th className="text-right py-2 text-gray-700 dark:text-gray-300">Bot Service</th>
                                            <th className="text-right py-2 text-gray-700 dark:text-gray-300">TTS Service</th>
                                            <th className="text-right py-2 text-gray-700 dark:text-gray-300">Разница</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="py-2 font-medium text-gray-900 dark:text-white">CPU %</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{botStats?.cpu_percent?.toFixed(1) || '0.0'}%</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{ttsStats?.cpu_percent?.toFixed(1) || '0.0'}%</td>
                                            <td className="text-right py-2">
                                                {botStats && ttsStats && (
                                                    <span className={ttsStats.cpu_percent > botStats.cpu_percent ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                                        {(ttsStats.cpu_percent - botStats.cpu_percent).toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="py-2 font-medium text-gray-900 dark:text-white">Память</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{botStats ? formatBytes(botStats.memory_bytes) : '0 B'}</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{ttsStats ? formatBytes(ttsStats.memory_bytes) : '0 B'}</td>
                                            <td className="text-right py-2">
                                                {botStats && ttsStats && (
                                                    <span className={ttsStats.memory_bytes > botStats.memory_bytes ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                                        {formatBytes(ttsStats.memory_bytes - botStats.memory_bytes)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="py-2 font-medium text-gray-900 dark:text-white">Потоки</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{botStats?.num_threads || 0}</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{ttsStats?.num_threads || 0}</td>
                                            <td className="text-right py-2">
                                                {botStats && ttsStats && (
                                                    <span className={ttsStats.num_threads > botStats.num_threads ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                                        {ttsStats.num_threads - botStats.num_threads}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 font-medium text-gray-900 dark:text-white">Файлы</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{botStats?.num_fds || 0}</td>
                                            <td className="text-right py-2 text-gray-900 dark:text-white">{ttsStats?.num_fds || 0}</td>
                                            <td className="text-right py-2">
                                                {botStats && ttsStats && (
                                                    <span className={ttsStats.num_fds > botStats.num_fds ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                                        {ttsStats.num_fds - botStats.num_fds}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default MonitoringPage;
