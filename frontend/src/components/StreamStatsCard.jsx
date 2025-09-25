// src/components/StreamStatsCard.jsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, Circle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Loader } from '@/components/ui/loader';
import { TwitchIcon, VKIcon } from './PlatformIcons';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="p-2 bg-background/90 border border-border/50 rounded-lg shadow-xl backdrop-blur-sm">
                <p className="label text-sm font-bold text-foreground">{`Время стрима: ${label}`}</p>
                {payload.map((entry, index) => {
                    if (entry.dataKey === 'twitchViewers' && entry.value > 0) {
                        return (
                            <p key={index} className="intro text-sm" style={{ color: '#8884d8' }}>
                                {`Twitch: ${entry.value} зрителей`}
                            </p>
                        );
                    }
                    if (entry.dataKey === 'vkViewers' && entry.value > 0) {
                        return (
                            <p key={index} className="intro text-sm" style={{ color: '#82ca9d' }}>
                                {`VK Live: ${entry.value} зрителей`}
                            </p>
                        );
                    }
                    if (entry.dataKey === 'viewers') {
                        return (
                            <p key={index} className="intro text-sm" style={{ color: entry.stroke }}>
                                {`Зрители: ${entry.value}`}
                            </p>
                        );
                    }
                    return null;
                })}
                {data.category && (
                    <p className="desc text-xs text-muted-foreground">{`Категория: ${data.category}`}</p>
                )}
            </div>
        );
    }
    return null;
};

const StreamStatsCard = ({ 
    integrations, 
    currentViewers, 
    streamHistory, 
    preparedStreamHistory, 
    loading,
    // Добавляем поддержку VK данных
    vkViewers = 0,
    vkStreamHistory = [],
    preparedVkStreamHistory = []
}) => {
    // Определяем активные платформы
    const twitchEnabled = integrations.twitch?.enabled || false;
    const vkEnabled = integrations.vk?.enabled || false;
    const hasAnyIntegration = twitchEnabled || vkEnabled;
    
    // Суммарное количество зрителей
    const totalViewers = (currentViewers || 0) + (vkViewers || 0);
    
    // Объединяем данные для графика
    const combinedData = React.useMemo(() => {
        if (!hasAnyIntegration) return [];
        
        // Создаем объединенные данные по времени
        const timeMap = new Map();
        
        // Добавляем данные Twitch
        preparedStreamHistory?.forEach(item => {
            timeMap.set(item.time, {
                time: item.time,
                twitchViewers: item.viewers || 0,
                vkViewers: 0,
                category: item.category
            });
        });
        
        // Добавляем данные VK
        preparedVkStreamHistory?.forEach(item => {
            const existing = timeMap.get(item.time);
            if (existing) {
                existing.vkViewers = item.viewers || 0;
            } else {
                timeMap.set(item.time, {
                    time: item.time,
                    twitchViewers: 0,
                    vkViewers: item.viewers || 0,
                    category: item.category
                });
            }
        });
        
        return Array.from(timeMap.values()).sort((a, b) => 
            new Date(a.time) - new Date(b.time)
        );
    }, [preparedStreamHistory, preparedVkStreamHistory, hasAnyIntegration]);

    return (
        <Card className={`h-full transition-all duration-300 ${hasAnyIntegration ? 'border-green-500/50 bg-green-500/5 shadow-lg' : 'border-red-500/50 bg-red-500/5 opacity-60'}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className={`h-6 w-6 ${hasAnyIntegration ? 'text-green-500' : 'text-red-500'}`} />
                    {totalViewers > 0 ? 'Онлайн' : 'Офлайн'}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col h-full">
                {hasAnyIntegration ? (
                    <div className="flex flex-col space-y-6">
                        <div className="h-40">
                            {loading?.streamData ? (
                                <div className="flex justify-center items-center h-full"><Loader /></div>
                            ) : combinedData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={combinedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorTwitchViewers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.6}/>
                                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                                            </linearGradient>
                                            <linearGradient id="colorVkViewers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.6}/>
                                                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.1}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }}/>
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} allowDecimals={false} domain={[0, 'dataMax + 10']} tick={{ fill: 'hsl(var(--muted-foreground))' }}/>
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8884d8', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                                        
                                        {twitchEnabled && (
                                            <Area 
                                                type="monotone" 
                                                dataKey="twitchViewers" 
                                                stroke="#8884d8" 
                                                strokeWidth={2} 
                                                fillOpacity={1} 
                                                fill="url(#colorTwitchViewers)"
                                                stackId="1"
                                            />
                                        )}
                                        
                                        {vkEnabled && (
                                            <Area 
                                                type="monotone" 
                                                dataKey="vkViewers" 
                                                stroke="#82ca9d" 
                                                strokeWidth={2} 
                                                fillOpacity={1} 
                                                fill="url(#colorVkViewers)"
                                                stackId="1"
                                            />
                                        )}
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex justify-center items-center h-full text-muted-foreground text-sm">Нет данных для отображения. <br/> Сбор статистики начнется автоматически.</div>
                            )}
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <div className="flex gap-4">
                                {twitchEnabled && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                        <TwitchIcon width="16" height="16" />
                                        <span className="text-sm">{currentViewers || 0}</span>
                                    </div>
                                )}
                                {vkEnabled && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <VKIcon width="16" height="16" />
                                        <span className="text-sm">{vkViewers || 0}</span>
                                    </div>
                                )}
                            </div>
                            {hasAnyIntegration && (
                                <div className="text-sm font-medium">
                                    Всего: {totalViewers}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center text-red-400">
                        <div className="text-center">
                            <Circle className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Интеграции с платформами отключены</p>
                            <p className="text-xs text-muted-foreground mt-1">Подключите Twitch или VK Live для просмотра статистики</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default StreamStatsCard;
