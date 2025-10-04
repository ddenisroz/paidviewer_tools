// src/pages/ViewersPage.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, RefreshCw, Users, TrendingUp, TrendingDown, Activity, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';
import api from '../services/api';
import { toast } from 'sonner';

const ViewersPage = () => {
    const [viewersData, setViewersData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [currentViewers, setCurrentViewers] = useState({ twitch: 0, vk: 0 });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(null);

    // Загружаем реальные данные из API
    const loadViewersData = async () => {
        try {
            // Здесь будет реальный API вызов для загрузки данных зрителей
            // const response = await api.get('/api/analytics/viewers');
            // setViewersData(response.data);
            
            // Пока что показываем пустые данные
            setViewersData([]);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Error loading viewers data:', error);
            setViewersData([]);
        }
    };

    useEffect(() => {
        loadViewersData();
        fetchCurrentViewers();
    }, []);

    // Автообновление каждые 2 минуты
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                loadViewersData();
                fetchCurrentViewers();
            }, 120000); // 2 минуты
            setRefreshInterval(interval);
            return () => clearInterval(interval);
        } else if (refreshInterval) {
            clearInterval(refreshInterval);
            setRefreshInterval(null);
        }
    }, [autoRefresh]);

    const fetchCurrentViewers = async () => {
        try {
            const response = await api.get('/api/twitch/viewers');
            setCurrentViewers(prev => ({ ...prev, twitch: response.data }));
        } catch (error) {
            console.error('Error fetching current viewers:', error);
        }
    };

    const fetchViewersData = async () => {
        setIsLoading(true);
        try {
            // Обновляем текущих зрителей
            await fetchCurrentViewers();
            
            // Генерируем новые данные для графика
            const newData = generateMockData();
            setViewersData(newData);
            setLastUpdate(new Date());
            
            toast.success('Данные обновлены');
        } catch (error) {
            console.error('Error fetching viewers data:', error);
            toast.error('Ошибка загрузки данных');
        } finally {
            setIsLoading(false);
        }
    };

    const getTotalViewers = () => {
        return currentViewers.twitch + currentViewers.vk;
    };

    const getTrend = () => {
        if (viewersData.length < 2) return 0;
        const latest = viewersData[viewersData.length - 1];
        const previous = viewersData[viewersData.length - 2];
        const latestTotal = latest.total;
        const previousTotal = previous.total;
        return latestTotal - previousTotal;
    };

    const getAverageViewers = () => {
        if (viewersData.length === 0) return 0;
        const total = viewersData.reduce((sum, point) => sum + point.total, 0);
        return Math.round(total / viewersData.length);
    };

    const getPeakViewers = () => {
        if (viewersData.length === 0) return 0;
        return Math.max(...viewersData.map(point => point.total));
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-6 text-foreground">График зрителей</h1>
                    <p className="text-muted-foreground">
                        Мониторинг количества зрителей на Twitch и VK Live
                    </p>
                </div>
                <Button 
                    onClick={fetchViewersData} 
                    disabled={isLoading}
                    className="flex items-center gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Обновить
                </Button>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">Сейчас онлайн</p>
                                <p className="text-2xl font-bold">{getTotalViewers()}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    {getTrend() > 0 ? (
                                        <TrendingUp className="h-3 w-3 text-green-500" />
                                    ) : getTrend() < 0 ? (
                                        <TrendingDown className="h-3 w-3 text-red-500" />
                                    ) : null}
                                    <span className={`text-xs ${getTrend() > 0 ? 'text-green-600' : getTrend() < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                        {getTrend() > 0 ? `+${getTrend()}` : getTrend() < 0 ? getTrend() : '0'} за 10 мин
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-purple-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">Twitch</p>
                                <p className="text-2xl font-bold">{currentViewers.twitch}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {Math.round((currentViewers.twitch / getTotalViewers()) * 100) || 0}% от общего
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                            <div>
                                <p className="text-sm text-muted-foreground">VK Live</p>
                                <p className="text-2xl font-bold">{currentViewers.vk}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {Math.round((currentViewers.vk / getTotalViewers()) * 100) || 0}% от общего
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-green-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">Пик за 4 часа</p>
                                <p className="text-2xl font-bold">{getPeakViewers()}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Среднее: {getAverageViewers()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* График */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        График зрителей
                    </CardTitle>
                    {lastUpdate && (
                        <p className="text-sm text-muted-foreground">
                            Последнее обновление: {lastUpdate.toLocaleTimeString()}
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={viewersData}>
                                <defs>
                                    <linearGradient id="twitchGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="vkGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis 
                                    dataKey="time" 
                                    tick={{ fontSize: 12 }}
                                    axisLine={{ stroke: '#e0e0e0' }}
                                />
                                <YAxis 
                                    tick={{ fontSize: 12 }}
                                    axisLine={{ stroke: '#e0e0e0' }}
                                    label={{ value: 'Зрители', angle: -90, position: 'insideLeft' }}
                                />
                                <Legend 
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    formatter={(value) => value === 'twitch' ? 'Twitch' : 'VK Live'}
                                />
                                <Tooltip 
                                    contentStyle={{
                                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                                        color: 'white'
                                    }}
                                    formatter={(value, name) => [
                                        `${value} зрителей`, 
                                        name === 'twitch' ? 'Twitch' : 'VK Live'
                                    ]}
                                    labelFormatter={(label) => `Время: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="twitch"
                                    stackId="1"
                                    stroke="#8b5cf6"
                                    fill="url(#twitchGradient)"
                                    strokeWidth={2}
                                    name="twitch"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="vk"
                                    stackId="1"
                                    stroke="#3b82f6"
                                    fill="url(#vkGradient)"
                                    strokeWidth={2}
                                    name="vk"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Настройки автообновления */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Настройки мониторинга
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Автообновление каждые 2 минуты</p>
                            <p className="text-sm text-muted-foreground">
                                График будет автоматически обновляться с новыми данными
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={autoRefresh ? "default" : "secondary"}>
                                {autoRefresh ? "Включено" : "Выключено"}
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAutoRefresh(!autoRefresh)}
                            >
                                {autoRefresh ? "Выключить" : "Включить"}
                            </Button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{getPeakViewers()}</p>
                            <p className="text-sm text-muted-foreground">Максимум зрителей</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{getAverageViewers()}</p>
                            <p className="text-sm text-muted-foreground">Среднее за период</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ViewersPage;
