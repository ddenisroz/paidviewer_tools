import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Shield, Users, Settings, Mic } from 'lucide-react';
import { toast } from 'sonner';
import api, { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VoiceManagement from '../components/admin/VoiceManagement';

const AdminPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated: isTwitchAuthenticated } = useAuth();
    const [channels, setChannels] = useState({ twitch: [], vk: [] });
    const [newChannel, setNewChannel] = useState('');
    const [newPlatform, setNewPlatform] = useState('twitch');
    const [activeTab, setActiveTab] = useState('channels'); // 'channels' или 'voices'

    useEffect(() => {
        // Загружаем данные при монтировании
        loadChannels();
    }, []);

    const loadChannels = async () => {
        try {
            const response = await api.get('/api/admin/whitelist');
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
            await api.post('/api/admin/whitelist/add', {
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
            await api.delete('/api/admin/whitelist/remove', {
                data: { username: channel }
            });
            // После успешного удаления перезагружаем актуальный список с бэкенда
            await loadChannels();
            
            toast.success(`Канал ${channel} удален из белого списка`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Ошибка удаления канала');
        }
    };

    const logout = () => {
        navigate('/login');
    };

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
                               <p className="text-slate-300 mt-1">Управление системой TTS</p>
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
                               Каналы
                           </Button>
                           <Button
                               variant={activeTab === 'voices' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('voices')}
                               className={`flex-1 ${activeTab === 'voices' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Mic className="h-4 w-4 mr-2" />
                               Голоса
                           </Button>
                       </div>

                {/* Контент по табам */}
                {activeTab === 'channels' ? (
                    <>
                        {/* Статистика */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-600/20 rounded-lg">
                                    <Users className="h-5 w-5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Twitch каналы</p>
                                    <p className="text-2xl font-bold text-white">{channels.twitch.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600/20 rounded-lg">
                                    <Users className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">VK каналы</p>
                                    <p className="text-2xl font-bold text-white">{channels.vk.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-600/20 rounded-lg">
                                    <Settings className="h-5 w-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Всего каналов</p>
                                    <p className="text-2xl font-bold text-white">{channels.twitch.length + channels.vk.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

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
                    </>
                ) : (
                    <VoiceManagement />
                )}
            </div>
        </div>
    );
};

export default AdminPage;
