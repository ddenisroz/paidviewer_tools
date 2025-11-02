import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, MessageSquare, Calendar, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

const DropsStats = () => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/drops/stats');
            const data = await response.json();
            setStats(data);
        } catch (error) {
            logger.error('Error loading stats:', error);
            toast.error('Ошибка загрузки статистики');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    if (!stats) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-gray-500">
                        Загрузка статистики...
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Статистика дропов</h2>
                <Button onClick={loadStats} disabled={isLoading} variant="outline">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Обновить
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Текущий стрик
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <span className="text-2xl font-bold">
                                {stats.stats.streak_days || 0}
                            </span>
                            <span className="text-sm text-gray-500">дней</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Сообщений сегодня
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            <span className="text-2xl font-bold">
                                {stats.stats.messages_today || 0}
                            </span>
                            <span className="text-sm text-gray-500">шт</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Последний визит
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm">
                            {stats.stats.last_seen ? 
                                new Date(stats.stats.last_seen).toLocaleString() :
                                'Никогда'
                            }
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Статус
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            <Badge variant="outline">
                                {stats.stats.streak_days >= 7 ? 'Активный' : 'Новичок'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Достижения</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Trophy className="h-6 w-6 text-yellow-500" />
                            <div>
                                <div className="font-semibold">Стрик 7 дней</div>
                                <div className="text-sm text-gray-500">
                                    {stats.stats.streak_days >= 7 ? '✅ Выполнено' : '❌ Не выполнено'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Trophy className="h-6 w-6 text-yellow-500" />
                            <div>
                                <div className="font-semibold">100 сообщений</div>
                                <div className="text-sm text-gray-500">
                                    {stats.stats.messages_today >= 100 ? '✅ Выполнено' : '❌ Не выполнено'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Trophy className="h-6 w-6 text-yellow-500" />
                            <div>
                                <div className="font-semibold">Стрик 30 дней</div>
                                <div className="text-sm text-gray-500">
                                    {stats.stats.streak_days >= 30 ? '✅ Выполнено' : '❌ Не выполнено'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Trophy className="h-6 w-6 text-yellow-500" />
                            <div>
                                <div className="font-semibold">500 сообщений</div>
                                <div className="text-sm text-gray-500">
                                    {stats.stats.messages_today >= 500 ? '✅ Выполнено' : '❌ Не выполнено'}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DropsStats;
