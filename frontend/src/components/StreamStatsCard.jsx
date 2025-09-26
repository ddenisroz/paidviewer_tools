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
    preparedVkStreamHistory = [],
    // Новые пропы для аналитики
    peakInfo = null,
    peakViewers = 0,
    avgViewers = 0,
    categories = []
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

                        {/* Блок статистики пиков */}
                        {combinedData.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    {/* Пиковый онлайн */}
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500 mb-1">Пик за стрим</div>
                                        <div className="text-lg font-bold text-blue-600">{peakViewers.toLocaleString()}</div>
                                    </div>
                                    
                                    {/* Средний онлайн */}
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500 mb-1">Средний онлайн</div>
                                        <div className="text-lg font-bold text-green-600">{avgViewers.toLocaleString()}</div>
                                    </div>
                                    
                                    {/* Текущий онлайн */}
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500 mb-1">Сейчас</div>
                                        <div className="text-lg font-bold text-purple-600">{totalViewers.toLocaleString()}</div>
                                    </div>
                                </div>

                                {/* Сообщение о прайме */}
                                {peakInfo && (
                                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <span className="text-2xl">{peakInfo.emoji}</span>
                                            <div>
                                                <div className="text-sm font-semibold text-gray-800">
                                                    {peakInfo.message}
                                                </div>
                                                {peakInfo.highest_recent && (
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        Последний пик: {peakInfo.highest_recent.viewers.toLocaleString()} зрителей
                                                        {peakInfo.highest_recent.days_ago > 0 && 
                                                            ` (${peakInfo.highest_recent.days_ago} дн. назад)`
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Детали пиков */}
                                        {peakInfo.peaks && (
                                            <div className="mt-2 flex flex-wrap justify-center gap-1 text-xs">
                                                {peakInfo.peaks.weekly && (
                                                    <div className="bg-white/60 rounded px-2 py-1">
                                                        Неделя: {peakInfo.peaks.weekly.viewers.toLocaleString()}
                                                    </div>
                                                )}
                                                {peakInfo.peaks.monthly && (
                                                    <div className="bg-white/60 rounded px-2 py-1">
                                                        Месяц: {peakInfo.peaks.monthly.viewers.toLocaleString()}
                                                    </div>
                                                )}
                                                {peakInfo.peaks.all_time && (
                                                    <div className="bg-white/60 rounded px-2 py-1">
                                                        Рекорд: {peakInfo.peaks.all_time.viewers.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Популярные категории */}
                                {categories && categories.length > 0 && (
                                    <div className="mt-3">
                                        <div className="text-xs text-gray-500 mb-2">Категории сегодня:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {categories.slice(0, 5).map((category, index) => (
                                                <span 
                                                    key={index}
                                                    className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-700"
                                                >
                                                    {category}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full min-h-[300px]">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto flex items-center justify-center">
                                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="text-sm text-muted-foreground px-4">Авторизуйтесь для полного функционала</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default StreamStatsCard;
