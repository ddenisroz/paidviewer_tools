import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Shield, Users, Settings, Mic, Activity, AlertCircle, MessageCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { useAuth } from '../../context/AuthContext';
import VoiceManagement from '../../components/admin/VoiceManagement';
import UserManagementPage from './UserManagementPage';
import BotManagementPage from './BotManagementPage';
import MonitoringPage from './MonitoringPage';
import SupportTicketsPage from './SupportTicketsPage';

const AdminPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated: isTwitchAuthenticated } = useAuth();
    
    const [channels, setChannels] = useState({ twitch: [], vk: [] });
    const [newChannel, setNewChannel] = useState('');
    const [newPlatform, setNewPlatform] = useState('twitch');
    const [activeTab, setActiveTab] = useState('channels'); // 'channels' или 'voices'
    const [blockedChannels, setBlockedChannels] = useState([]);
    const [newBlockedChannel, setNewBlockedChannel] = useState('');
    const [addingBlockedChannel, setAddingBlockedChannel] = useState(false);

    useEffect(() => {
        // Загружаем данные при монтировании
        loadChannels();
        loadBlockedChannels();
    }, []);

    const loadChannels = async () => {
        try {
            const response = await botService.get('/api/admin/whitelist');
            // Адаптируем под новый формат ответа
            setChannels({ twitch: response.data.whitelist_users || [], vk: [] });
        } catch (error) {
            console.error('Ошибка загрузки каналов:', error);
            toast.error('Не удалось загрузить список каналов');
        }
    };

    const addChannel = async () => {
        if (!newChannel.trim()) {
            toast.error('Введите название канала');
            return;
        }

        try {
            await botService.post('/api/admin/whitelist/add', {
                username: newChannel.trim(),
            });
            // После успешного добавления перезагружаем актуальный список с бэкенда
            await loadChannels();
            
            setNewChannel('');
            toast.success(`Канал ${newChannel} добавлен в белый список`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Ошибка добавления канала');
        }
    };

    const removeChannel = async (channel, platform) => {
        try {
            // Внимание: axios.delete передает тело запроса в поле `data`
            await botService.delete('/api/admin/whitelist/remove', {
                data: { username: channel }
            });
            // После успешного удаления перезагружаем актуальный список с бэкенда
            await loadChannels();
            
            toast.success(`Канал ${channel} удален из белого списка`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Ошибка удаления канала');
        }
    };

    const loadBlockedChannels = async () => {
        try {
            const response = await botService.get('/api/admin/blocked-channels');
            setBlockedChannels(response.data.blocked_channels || []);
        } catch (error) {
            console.error('Ошибка загрузки заблокированных каналов:', error);
            toast.error('Не удалось загрузить список заблокированных каналов');
        }
    };

    const addBlockedChannel = async () => {
        if (!newBlockedChannel.trim()) {
            toast.error('Введите название канала');
            return;
        }

        try {
            setAddingBlockedChannel(true);
            await botService.post('/api/admin/blocked-channels', {
                channel_name: newBlockedChannel.trim(),
                reason: 'Заблокировано администратором'
            });
            
            toast.success('Канал заблокирован');
            setNewBlockedChannel('');
            await loadBlockedChannels();
        } catch (error) {
            console.error('Error adding blocked channel:', error);
            toast.error('Ошибка блокировки канала');
        } finally {
            setAddingBlockedChannel(false);
        }
    };

    const removeBlockedChannel = async (channelId) => {
        try {
            await botService.delete(`/api/admin/blocked-channels/${channelId}`);
            toast.success('Канал разблокирован');
            await loadBlockedChannels();
        } catch (error) {
            console.error('Error removing blocked channel:', error);
            toast.error('Ошибка разблокировки канала');
        }
    };

    const logout = () => {
        navigate('/login');
    };

    // Проверяем права администратора
    if (!user?.is_admin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">Доступ запрещен</h1>
                    <p className="text-gray-300 mb-4">У вас нет прав для доступа к админ панели</p>
                    <Button onClick={() => navigate('/dashboard')} variant="outline" className="text-white border-slate-600">
                        Вернуться на главную
                    </Button>
                </div>
            </div>
        );
    }

    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="max-w-6xl mx-auto space-y-6">
                       {/* Заголовок */}
                       <div className="flex items-center justify-between">
                           <div>
                               <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                   <Shield className="h-8 w-8 text-purple-400" />
                                   Админ панель
                               </h1>
                           </div>
                           <Button onClick={logout} variant="outline" className="text-white border-slate-600">
                               Выйти
                           </Button>
                       </div>

                       {/* Табы */}
                       <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg">
                           <Button
                               variant={activeTab === 'channels' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('channels')}
                               className={`flex-1 ${activeTab === 'channels' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Users className="h-4 w-4 mr-2" />
                               TTS whitelist
                           </Button>
                           <Button
                               variant={activeTab === 'voices' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('voices')}
                               className={`flex-1 ${activeTab === 'voices' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Mic className="h-4 w-4 mr-2" />
                               Голоса
                           </Button>
                           <Button
                               variant={activeTab === 'users' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('users')}
                               className={`flex-1 ${activeTab === 'users' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Users className="h-4 w-4 mr-2" />
                               Пользователи
                           </Button>
                           <Button
                               variant={activeTab === 'bots' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('bots')}
                               className={`flex-1 ${activeTab === 'bots' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Settings className="h-4 w-4 mr-2" />
                               Боты
                           </Button>
                           <Button
                               variant={activeTab === 'tickets' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('tickets')}
                               className={`flex-1 ${activeTab === 'tickets' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <MessageCircle className="h-4 w-4 mr-2" />
                               Тикеты
                           </Button>
                           <Button
                               variant={activeTab === 'monitoring' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('monitoring')}
                               className={`flex-1 ${activeTab === 'monitoring' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <BarChart3 className="h-4 w-4 mr-2" />
                               Мониторинг
                           </Button>
                       </div>

                {/* Контент по табам */}
                {activeTab === 'channels' ? (
                    <>
                        {/* Статистика */}
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-purple-600/20 rounded">
                                                <Users className="h-4 w-4 text-purple-400" />
                                            </div>
                                            <span className="text-sm text-slate-400">Twitch:</span>
                                            <span className="text-lg font-bold text-white">{channels.twitch.length}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-blue-600/20 rounded">
                                                <Users className="h-4 w-4 text-blue-400" />
                                            </div>
                                            <span className="text-sm text-slate-400">VK:</span>
                                            <span className="text-lg font-bold text-white">{channels.vk.length}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-red-600/20 rounded">
                                                <Shield className="h-4 w-4 text-red-400" />
                                            </div>
                                            <span className="text-sm text-slate-400">Заблокированы:</span>
                                            <span className="text-lg font-bold text-white">{blockedChannels.length}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-green-600/20 rounded">
                                                <Settings className="h-4 w-4 text-green-400" />
                                            </div>
                                            <span className="text-sm text-slate-400">Всего:</span>
                                            <span className="text-lg font-bold text-white">{channels.twitch.length + channels.vk.length}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                {/* Добавление нового канала */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Добавить канал
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <Label htmlFor="channel">Название канала</Label>
                                <Input
                                    id="channel"
                                    value={newChannel}
                                    onChange={(e) => setNewChannel(e.target.value)}
                                    placeholder="Введите название канала"
                                    className="mt-1"
                                />
                            </div>
                            <div className="w-32">
                                <Label htmlFor="platform">Платформа</Label>
                                <Select value={newPlatform} onValueChange={setNewPlatform}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="twitch">Twitch</SelectItem>
                                        <SelectItem value="vk">VK</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button onClick={addChannel} className="bg-purple-600 hover:bg-purple-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Добавить
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Список каналов */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Twitch каналы */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                Twitch каналы ({channels.twitch.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {channels.twitch.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">Нет каналов в белом списке</p>
                            ) : (
                                <div className="space-y-2">
                                    {channels.twitch.map((channel, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                                                    Twitch
                                                </Badge>
                                                <span className="text-white font-mono">{channel.channel_name}</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => removeChannel(channel.channel_name, 'twitch')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* VK каналы */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                VK каналы ({channels.vk.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {channels.vk.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">Нет каналов в белом списке</p>
                            ) : (
                                <div className="space-y-2">
                                    {channels.vk.map((channel, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="secondary" className="bg-blue-600/20 text-blue-300">
                                                    VK
                                                </Badge>
                                                <span className="text-white font-mono">{channel.channel_name}</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => removeChannel(channel.channel_name, 'vk')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Управление заблокированными каналами */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Shield className="h-5 w-5 text-red-400" />
                            Заблокированные каналы ({blockedChannels.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Форма добавления заблокированного канала */}
                        <div className="mb-6">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Введите название канала для блокировки"
                                    value={newBlockedChannel}
                                    onChange={(e) => setNewBlockedChannel(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && addBlockedChannel()}
                                    className="flex-1"
                                />
                                <Button 
                                    onClick={addBlockedChannel}
                                    disabled={addingBlockedChannel || !newBlockedChannel.trim()}
                                    variant="destructive"
                                >
                                    {addingBlockedChannel ? 'Блокируем...' : 'Заблокировать'}
                                </Button>
                            </div>
                        </div>

                        {/* Список заблокированных каналов */}
                        {blockedChannels.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                                <p className="text-lg font-medium mb-2">Нет заблокированных каналов</p>
                                <p className="text-sm">Заблокированные каналы будут отображаться здесь</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {blockedChannels.map((channel) => (
                                    <div key={channel.id} className="flex items-center justify-between p-4 border border-red-600/20 rounded-lg bg-red-900/10">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                <span className="font-medium text-white">{channel.channel_name}</span>
                                                {channel.reason && (
                                                    <Badge variant="outline" className="text-xs border-red-600 text-red-400">
                                                        {channel.reason}
                                                    </Badge>
                                                )}
                                            </div>
                                            {channel.created_at && (
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Заблокировано: {new Date(channel.created_at).toLocaleString('ru-RU')}
                                                </p>
                                            )}
                                        </div>
                                        
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => removeBlockedChannel(channel.id)}
                                            className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Разблокировать
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                    </>
                ) : activeTab === 'voices' ? (
                    <VoiceManagement />
                ) : activeTab === 'users' ? (
                    <UserManagementPage />
                ) : activeTab === 'bots' ? (
                    <BotManagementPage />
                ) : activeTab === 'tickets' ? (
                    <SupportTicketsPage />
                ) : activeTab === 'monitoring' ? (
                    <MonitoringPage />
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500">Выберите раздел для управления</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
