import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, RefreshCw, Users, Clock, Shield } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

const SessionManagementPage = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/admin/sessions');
            setSessions(response.data.sessions || []);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
            toast.error('Не удалось загрузить список сессий');
        } finally {
            setLoading(false);
        }
    };

    const clearSession = async (channel) => {
        try {
            setClearing(true);
            await api.delete(`/api/admin/sessions/${channel}`);
            toast.success(`Сессия для канала ${channel} очищена`);
            await fetchSessions();
        } catch (error) {
            console.error('Failed to clear session:', error);
            toast.error('Не удалось очистить сессию');
        } finally {
            setClearing(false);
        }
    };

    const clearAllSessions = async () => {
        if (!window.confirm('Вы уверены, что хотите очистить все активные сессии?')) {
            return;
        }

        try {
            setClearing(true);
            const response = await api.delete('/api/admin/sessions');
            toast.success(`Очищено ${response.data.cleared_count} сессий`);
            await fetchSessions();
        } catch (error) {
            console.error('Failed to clear all sessions:', error);
            toast.error('Не удалось очистить все сессии');
        } finally {
            setClearing(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        
        // Обновляем каждые 30 секунд
        const interval = setInterval(fetchSessions, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Неизвестно';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('ru-RU');
    };

    const getStatusBadge = (isVerified) => {
        return isVerified ? (
            <Badge variant="default" className="bg-green-500">
                <Shield className="h-3 w-3 mr-1" />
                Верифицирована
            </Badge>
        ) : (
            <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                Ожидает верификации
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Загрузка сессий...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Управление сессиями</h1>
                    <p className="text-slate-400 mt-1">Мониторинг и управление активными гостевыми сессиями</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={fetchSessions}
                        variant="outline"
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                    <Button
                        onClick={clearAllSessions}
                        variant="destructive"
                        disabled={clearing || sessions.length === 0}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Очистить все
                    </Button>
                </div>
            </div>

            {sessions.length === 0 ? (
                <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>
                        Активных сессий не найдено
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-4">
                    {sessions.map((session, index) => (
                        <Card key={index} className="bg-slate-800/50 border-slate-700">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CardTitle className="text-lg text-white">
                                            {session.channel}
                                        </CardTitle>
                                        {getStatusBadge(session.is_verified)}
                                    </div>
                                    <Button
                                        onClick={() => clearSession(session.channel)}
                                        variant="destructive"
                                        size="sm"
                                        disabled={clearing}
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Очистить
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-400">Код верификации:</span>
                                        <div className="font-mono text-white bg-slate-700 px-2 py-1 rounded mt-1">
                                            {session.code}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Создана:</span>
                                        <div className="text-white mt-1">
                                            {formatTimestamp(session.timestamp)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Статус:</span>
                                        <div className="text-white mt-1">
                                            {session.is_verified ? 'Активна' : 'Ожидает'}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="text-sm text-slate-400">
                Всего активных сессий: {sessions.length}
            </div>
        </div>
    );
};

export default SessionManagementPage;
