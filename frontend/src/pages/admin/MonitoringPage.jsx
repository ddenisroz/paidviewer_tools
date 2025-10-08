// src/pages/admin/MonitoringPage.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    Minus,
    Database,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { botService, ttsService } from '../../services/microservices';

const MonitoringPage = () => {
    const [botStats, setBotStats] = useState(null);
    const [ttsStats, setTtsStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(5);
    
    // Database management states
    const [dbStats, setDbStats] = useState(null);
    const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [cleanupConfirmText, setCleanupConfirmText] = useState('');
    const [hasLoaded, setHasLoaded] = useState(false);

    const loadMonitoringData = async () => {
        try {
            setLoading(true);
            
            // Загружаем реальные данные мониторинга
            const [botResponse, ttsResponse] = await Promise.allSettled([
                botService.get('/api/admin/monitoring/current'),
                ttsService.get('/api/monitoring/current')
            ]);
            
            if (botResponse.status === 'fulfilled') {
                setBotStats(botResponse.value.data);
            } else {
                console.error('Bot monitoring error:', botResponse.reason);
                setBotStats({
                    uptime: 0,
                    cpu_percent: 0,
                    memory_bytes: 0,
                    num_threads: 0,
                    num_fds: 0,
                    num_connections: 0,
                    system_cpu_percent: 0,
                    system_memory_used: 0,
                    system_memory_total: 0,
                    system_memory_percent: 0,
                    disk_used: 0,
                    disk_total: 0,
                    disk_percent: 0,
                    gpu_percent: 0,
                    gpu_memory_bytes: 0,
                    gpu_temperature: 0,
                    status: 'error'
                });
            }
            
            if (ttsResponse.status === 'fulfilled') {
                setTtsStats(ttsResponse.value.data);
            } else {
                console.error('TTS monitoring error:', ttsResponse.reason);
                setTtsStats({
                    uptime: 0,
                    cpu_percent: 0,
                    memory_bytes: 0,
                    num_threads: 0,
                    num_fds: 0,
                    num_connections: 0,
                    system_cpu_percent: 0,
                    system_memory_used: 0,
                    system_memory_total: 0,
                    system_memory_percent: 0,
                    disk_used: 0,
                    disk_total: 0,
                    disk_percent: 0,
                    gpu_percent: 0,
                    gpu_memory_bytes: 0,
                    gpu_temperature: 0,
                    status: 'error'
                });
            }
            
        } catch (error) {
            console.error('Error loading monitoring data:', error);
            toast.error('Ошибка загрузки данных мониторинга');
        } finally {
            setLoading(false);
        }
    };

    const loadDatabaseStats = async () => {
        try {
            const response = await botService.get('/api/database/stats');
            setDbStats(response.data);
        } catch (error) {
            console.error('Error loading database stats:', error);
            toast.error('Ошибка загрузки статистики базы данных');
            // Fallback данные при ошибке
            setDbStats({
                total_users: 0,
                total_sessions: 0,
                total_voices: 0,
                total_channels: 0,
                database_size_mb: 0,
                last_cleanup: null,
                status: 'error'
            });
        }
    };

    const handleCleanupDatabase = async () => {
        if (cleanupConfirmText !== 'CLEANUP') {
            toast.error('Введите CLEANUP для подтверждения');
            return;
        }

        try {
            setCleanupLoading(true);
            const response = await botService.post('/api/database/cleanup');
            
            if (response.data.success) {
                toast.success('База данных успешно очищена');
                setCleanupDialogOpen(false);
                setCleanupConfirmText('');
                loadDatabaseStats(); // Перезагружаем статистику
            } else {
                toast.error('Ошибка при очистке базы данных');
            }
        } catch (error) {
            console.error('Error cleaning up database:', error);
            toast.error('Ошибка при очистке базы данных');
        } finally {
            setCleanupLoading(false);
        }
    };

    useEffect(() => {
        if (!hasLoaded) {
            setHasLoaded(true);
        loadMonitoringData();
        loadDatabaseStats();
        }
    }, [hasLoaded]);

    useEffect(() => {
        let interval;
        if (autoRefresh) {
            interval = setInterval(loadMonitoringData, refreshInterval * 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, refreshInterval]);

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const CompactMetricCard = ({ title, value, unit = '', icon: Icon, color }) => (
        <div className="flex items-center space-x-2 p-2 bg-slate-700/50 rounded border border-slate-600">
            <Icon className={`w-4 h-4 ${color}`} />
            <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-400 truncate">{title}</div>
                <div className="text-sm font-medium text-white truncate">
                    {value}{unit}
                </div>
            </div>
        </div>
    );

    const ServiceCard = ({ title, stats, color }) => {
        if (!stats) {
            return (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <div className="text-center text-slate-400 text-sm">
                        Нет данных для {title}
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${color}`}></div>
                        <span className="font-medium text-white text-sm">{title}</span>
                    </div>
                    <Badge variant="outline" className="text-xs bg-slate-700 text-slate-300 border-slate-600">
                        {formatUptime(stats.uptime)}
                    </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <CompactMetricCard
                        title="CPU"
                        value={stats.cpu_percent?.toFixed(1)}
                        unit="%"
                        icon={Cpu}
                        color="text-orange-400"
                    />
                    <CompactMetricCard
                        title="Память"
                        value={formatBytes(stats.memory_bytes)}
                        icon={MemoryStick}
                        color="text-blue-400"
                    />
                    <CompactMetricCard
                        title="Потоки"
                        value={stats.num_threads}
                        icon={Activity}
                        color="text-green-400"
                    />
                    <CompactMetricCard
                        title="Файлы"
                        value={stats.num_fds}
                        icon={HardDrive}
                        color="text-purple-400"
                    />
                </div>
                
                {/* GPU метрики для TTS */}
                {stats.gpu_percent !== undefined && (
                    <div className="mt-2 pt-2 border-t border-slate-600">
                        <div className="grid grid-cols-3 gap-2">
                            <CompactMetricCard
                                title="GPU"
                                value={stats.gpu_percent?.toFixed(1)}
                                unit="%"
                                icon={Thermometer}
                                color="text-red-400"
                            />
                            <CompactMetricCard
                                title="GPU память"
                                value={formatBytes(stats.gpu_memory_bytes)}
                                icon={MemoryStick}
                                color="text-red-400"
                            />
                            <CompactMetricCard
                                title="GPU темп."
                                value={stats.gpu_temperature?.toFixed(0)}
                                unit="°C"
                                icon={Thermometer}
                                color="text-red-400"
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Мониторинг ресурсов</h1>
                    <p className="text-sm text-slate-400">Отслеживание использования CPU, памяти и других ресурсов</p>
                </div>
                
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                        <label className="text-xs text-slate-400">Автообновление:</label>
                        <Button
                            variant={autoRefresh ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`text-xs h-7 ${autoRefresh ? 'bg-purple-600 hover:bg-purple-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                        >
                            {autoRefresh ? "Вкл" : "Выкл"}
                        </Button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        <label className="text-xs text-slate-400">Интервал:</label>
                        <select
                            value={refreshInterval}
                            onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            className="px-2 py-1 border rounded text-xs bg-slate-700 text-white border-slate-600 h-7"
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
                        className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                    >
                        {loading ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Обновить
                    </Button>
                </div>
            </div>

            {loading && !botStats && !ttsStats ? (
                <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">Загрузка данных мониторинга...</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <ServiceCard
                        title="Bot Service"
                        stats={botStats}
                        color="bg-purple-500"
                    />
                    
                    <ServiceCard
                        title="TTS Service"
                        stats={ttsStats}
                        color="bg-purple-500"
                    />
                </div>
            )}

            {/* Database Management Section */}
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center space-x-2 mb-3">
                    <Database className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-medium text-white">Управление базой данных</h3>
                </div>
                
                {dbStats ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="text-center p-2 bg-blue-900/20 rounded border border-blue-800">
                                <div className="text-lg font-bold text-blue-400">
                                    {dbStats.total_chat_messages?.toLocaleString() || 0}
                                </div>
                                <div className="text-xs text-slate-400">Сообщений</div>
                            </div>
                            <div className="text-center p-2 bg-green-900/20 rounded border border-green-800">
                                <div className="text-lg font-bold text-green-400">
                                    {dbStats.total_users?.toLocaleString() || 0}
                                </div>
                                <div className="text-xs text-slate-400">Пользователей</div>
                            </div>
                            <div className="text-center p-2 bg-purple-900/20 rounded border border-purple-800">
                                <div className="text-lg font-bold text-purple-400">
                                    {dbStats.total_psychology_analyses?.toLocaleString() || 0}
                                </div>
                                <div className="text-xs text-slate-400">Анализов</div>
                            </div>
                            <div className="text-center p-2 bg-orange-900/20 rounded border border-orange-800">
                                <div className="text-lg font-bold text-orange-400">
                                    {dbStats.estimated_db_size || '0 MB'}
                                </div>
                                <div className="text-xs text-slate-400">Размер БД</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-slate-600">
                            <div className="flex items-center space-x-2 text-xs text-slate-400">
                                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                <span>Очистка удалит старые данные навсегда</span>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setCleanupDialogOpen(true)}
                                className="flex items-center space-x-1 text-xs h-7"
                            >
                                <Trash2 className="w-3 h-3" />
                                <span>Очистить БД</span>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-xs text-gray-500">Загрузка статистики базы данных...</p>
                    </div>
                )}
            </div>

            {/* Cleanup Confirmation Dialog */}
            <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            <span>Подтверждение очистки базы данных</span>
                        </DialogTitle>
                        <DialogDescription>
                            Это действие необратимо! Будут удалены:
                            <ul className="mt-2 list-disc list-inside text-sm">
                                <li>Сообщения чата старше 90 дней</li>
                                <li>Избыточные сообщения (если больше 100,000)</li>
                                <li>Психологические анализы больше не хранятся в БД</li>
                            </ul>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="font-medium">Внимание!</span>
                            </div>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                Это действие удалит данные навсегда. Убедитесь, что у вас есть резервная копия.
                            </p>
                        </div>
                        
                        <div>
                            <Label htmlFor="confirm-text">
                                Введите <strong>CLEANUP</strong> для подтверждения:
                            </Label>
                            <Input
                                id="confirm-text"
                                value={cleanupConfirmText}
                                onChange={(e) => setCleanupConfirmText(e.target.value)}
                                placeholder="CLEANUP"
                                className="mt-1"
                            />
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCleanupDialogOpen(false);
                                setCleanupConfirmText('');
                            }}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCleanupDatabase}
                            disabled={cleanupConfirmText !== 'CLEANUP' || cleanupLoading}
                            className="flex items-center space-x-2"
                        >
                            {cleanupLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Очистка...</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    <span>Подтвердить очистку</span>
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MonitoringPage;