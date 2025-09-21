// src/components/StreamStatsCard.jsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, Circle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Loader } from '@/components/ui/loader';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="p-2 bg-background/90 border border-border/50 rounded-lg shadow-xl backdrop-blur-sm">
                <p className="label text-sm font-bold text-foreground">{`Время стрима: ${label}`}</p>
                <p className="intro text-sm" style={{ color: payload[0].stroke }}>
                    {`Зрители: ${data.viewers}`}
                </p>
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
    loading 
}) => {
    return (
        <Card className={`h-80 transition-all duration-300 ${integrations.twitch?.enabled ? 'border-green-500/50 bg-green-500/5 shadow-lg' : 'border-muted/30 bg-muted/20 opacity-60'}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className={`h-6 w-6 ${integrations.twitch?.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                    {currentViewers > 0 ? 'Онлайн' : 'Офлайн'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {integrations.twitch?.enabled ? (
                    <div className="h-full flex flex-col justify-between">
                        <div className="h-40 -ml-4 -mr-2 -mb-4">
                            {loading.history ? (
                                <div className="flex justify-center items-center h-full"><Loader /></div>
                            ) : streamHistory.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={preparedStreamHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <defs><linearGradient id="colorViewers" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8884d8" stopOpacity={0.6}/><stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/></linearGradient></defs>
                                        <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }}/>
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} allowDecimals={false} domain={[0, 'dataMax + 10']} tick={{ fill: 'hsl(var(--muted-foreground))' }}/>
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8884d8', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                                        <Area type="monotone" dataKey="viewers" stroke="#8884d8" strokeWidth={2} fillOpacity={1} fill="url(#colorViewers)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex justify-center items-center h-full text-muted-foreground text-sm">Нет данных для отображения. <br/> Сбор статистики начнется автоматически.</div>
                            )}
                        </div>
                        <div className="flex justify-between items-center mt-4">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-sm">T: {currentViewers}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <Circle className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Интеграция с Twitch отключена</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default StreamStatsCard;
