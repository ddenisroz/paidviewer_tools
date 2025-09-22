import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Trash2, RefreshCw, Ban, Shield, Plus, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

const BlockedChannelsPage = () => {
    const [blockedChannels, setBlockedChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unblocking, setUnblocking] = useState(false);
    const [showBlockDialog, setShowBlockDialog] = useState(false);
    const [newChannel, setNewChannel] = useState('');
    const [blockReason, setBlockReason] = useState('');
    const [blocking, setBlocking] = useState(false);

    const fetchBlockedChannels = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/admin/blocked-channels');
            setBlockedChannels(response.data.blocked_channels || []);
        } catch (error) {
            console.error('Failed to fetch blocked channels:', error);
            toast.error('Не удалось загрузить список заблокированных каналов');
        } finally {
            setLoading(false);
        }
    };

    const blockChannel = async () => {
        if (!newChannel.trim()) {
            toast.error('Введите название канала');
            return;
        }

        try {
            setBlocking(true);
            await api.post('/api/admin/blocked-channels', {
                channel_name: newChannel.trim(),
                reason: blockReason.trim() || 'Заблокировано администратором',
                blocked_by: 'admin'
            });
            
            toast.success(`Канал ${newChannel} заблокирован`);
            setNewChannel('');
            setBlockReason('');
            setShowBlockDialog(false);
            await fetchBlockedChannels();
        } catch (error) {
            console.error('Failed to block channel:', error);
            if (error.response?.status === 400) {
                toast.error('Канал уже заблокирован');
            } else {
                toast.error('Не удалось заблокировать канал');
            }
        } finally {
            setBlocking(false);
        }
    };

    const unblockChannel = async (channelName) => {
        if (!window.confirm(`Вы уверены, что хотите разблокировать канал ${channelName}?`)) {
            return;
        }

        try {
            setUnblocking(true);
            await api.delete(`/api/admin/blocked-channels/${channelName}`);
            toast.success(`Канал ${channelName} разблокирован`);
            await fetchBlockedChannels();
        } catch (error) {
            console.error('Failed to unblock channel:', error);
            toast.error('Не удалось разблокировать канал');
        } finally {
            setUnblocking(false);
        }
    };

    useEffect(() => {
        fetchBlockedChannels();
        
        // Обновляем каждые 60 секунд
        const interval = setInterval(fetchBlockedChannels, 60000);
        return () => clearInterval(interval);
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return 'Неизвестно';
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU');
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Загрузка заблокированных каналов...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Заблокированные каналы</h1>
                    <p className="text-slate-400 mt-1">Управление каналами, к которым бот не может подключаться</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={fetchBlockedChannels}
                        variant="outline"
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                    <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Заблокировать канал
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Заблокировать канал</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="channel">Название канала</Label>
                                    <Input
                                        id="channel"
                                        value={newChannel}
                                        onChange={(e) => setNewChannel(e.target.value)}
                                        placeholder="Введите название канала"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="reason">Причина блокировки (необязательно)</Label>
                                    <Textarea
                                        id="reason"
                                        value={blockReason}
                                        onChange={(e) => setBlockReason(e.target.value)}
                                        placeholder="Укажите причину блокировки"
                                        className="mt-1"
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowBlockDialog(false)}
                                    disabled={blocking}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    onClick={blockChannel}
                                    disabled={blocking || !newChannel.trim()}
                                >
                                    {blocking ? 'Блокировка...' : 'Заблокировать'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {blockedChannels.length === 0 ? (
                <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                        Заблокированных каналов не найдено
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-4">
                    {blockedChannels.map((channel) => (
                        <Card key={channel.id} className="bg-slate-800/50 border-slate-700">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CardTitle className="text-lg text-white">
                                            {channel.channel_name}
                                        </CardTitle>
                                        <Badge variant="destructive">
                                            <Ban className="h-3 w-3 mr-1" />
                                            Заблокирован
                                        </Badge>
                                    </div>
                                    <Button
                                        onClick={() => unblockChannel(channel.channel_name)}
                                        variant="outline"
                                        size="sm"
                                        disabled={unblocking}
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Разблокировать
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-400">Причина:</span>
                                        <div className="text-white mt-1">
                                            {channel.reason || 'Не указана'}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Заблокировал:</span>
                                        <div className="text-white mt-1">
                                            {channel.blocked_by || 'Неизвестно'}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Дата блокировки:</span>
                                        <div className="text-white mt-1">
                                            {formatDate(channel.created_at)}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="text-sm text-slate-400">
                Всего заблокированных каналов: {blockedChannels.length}
            </div>
        </div>
    );
};

export default BlockedChannelsPage;
