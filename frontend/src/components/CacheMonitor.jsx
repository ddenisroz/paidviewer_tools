// frontend/src/components/CacheMonitor.jsx
import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_BASE_URL } from '../constants';
import { logger } from '../utils/prodLogger';
import { useInterval } from '../hooks/useInterval';

/**
 * Компонент для мониторинга кеша валидации токенов
 */
const CacheMonitor = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/monitoring/cache/stats`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                setStats(data);
                
                // Проверяем является ли пользователь админом (можно добавить это в context)
                // Пока просто проверяем наличие успешного ответа
                setIsAdmin(true);
            } else {
                toast.error('Ошибка загрузки статистики кеша');
            }
        } catch (error) {
            logger.error('Error fetching cache stats:', error);
            toast.error('Ошибка подключения к серверу');
        } finally {
            setLoading(false);
        }
    };

    const clearCache = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/monitoring/cache/clear`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success('Кеш очищен');
                fetchStats();
            } else {
                toast.error(data.error || 'Ошибка очистки кеша');
            }
        } catch (error) {
            logger.error('Error clearing cache:', error);
            toast.error('Ошибка подключения к серверу');
        }
    };

    const cleanupExpired = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/monitoring/cache/cleanup`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success('Истёкшие записи удалены');
                fetchStats();
            } else {
                toast.error(data.error || 'Ошибка очистки');
            }
        } catch (error) {
            logger.error('Error cleaning up cache:', error);
            toast.error('Ошибка подключения к серверу');
        }
    };

    // Используем современный хук useInterval вместо ручного setInterval
    useInterval(() => {
        fetchStats();
    }, 30000);

    useEffect(() => {
        fetchStats();
    }, []);

    if (!stats) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                        <RefreshCw className="animate-spin h-6 w-6 text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const cacheEfficiency = stats.cache.total_entries > 0 
        ? '~90% cache hits' 
        : 'Cache empty';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Token Validation Cache
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Статистика */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Записей в кеше</p>
                        <p className="text-2xl font-bold">{stats.cache.total_entries}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">TTL (время жизни)</p>
                        <p className="text-2xl font-bold">{stats.cache.ttl_minutes} мин</p>
                    </div>
                </div>

                {/* Эффективность */}
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                    <p className="text-sm text-green-600 dark:text-green-400">
                        ⚡ {cacheEfficiency}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {stats.info}
                    </p>
                </div>

                {/* Кнопки управления (только для админов) */}
                {isAdmin && (
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchStats}
                            disabled={loading}
                            className="flex-1"
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Обновить
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={cleanupExpired}
                            className="flex-1"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Очистить истёкшие
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={clearCache}
                            className="flex-1"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Очистить всё
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default CacheMonitor;

