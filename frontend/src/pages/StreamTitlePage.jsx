// src/pages/StreamTitlePage.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Edit3, Save, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';

const StreamTitlePage = () => {
    const [twitchTitle, setTwitchTitle] = useState('');
    const [twitchDescription, setTwitchDescription] = useState('');
    const [vkTitle, setVkTitle] = useState('');
    const [vkDescription, setVkDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [status, setStatus] = useState({ twitch: 'idle', vk: 'idle' });

    // Загрузка данных при монтировании
    useEffect(() => {
        loadStreamInfo();
    }, []);

    // Загружаем информацию о текущем стриме
    const loadStreamInfo = async () => {
        try {
            const response = await api.get('/api/twitch/stream-info');
            const data = response.data;
            
            if (data.title) {
                setTwitchTitle(data.title);
            }
            
            // VK данные пока моковые
            setVkTitle('VK Live: Играем вместе!');
            setVkDescription('Присоединяйтесь к стриму на VK Live');
        } catch (error) {
            console.error('Error loading stream info:', error);
            // Fallback на моковые данные при ошибке
            setTwitchTitle('Мой крутой стрим!');
            setTwitchDescription('Играю в интересную игру и общаюсь с чатом');
            setVkTitle('VK Live: Играем вместе!');
            setVkDescription('Присоединяйтесь к стриму на VK Live');
        }
    };

    const updateTwitchTitle = async () => {
        setIsLoading(true);
        setStatus(prev => ({ ...prev, twitch: 'loading' }));
        
        try {
            const response = await api.post('/api/twitch/stream/title', {
                title: twitchTitle
            });
            
            if (response.data.success) {
                setStatus(prev => ({ ...prev, twitch: 'success' }));
                setLastUpdate(new Date());
                toast.success(response.data.message || 'Название стрима обновлено');
            } else {
                throw new Error(response.data.message || 'Ошибка обновления');
            }
            
            // Сброс статуса через 3 секунды
            setTimeout(() => {
                setStatus(prev => ({ ...prev, twitch: 'idle' }));
            }, 3000);
        } catch (error) {
            console.error('Error updating Twitch title:', error);
            setStatus(prev => ({ ...prev, twitch: 'error' }));
            toast.error(error.response?.data?.message || 'Ошибка обновления названия');
        } finally {
            setIsLoading(false);
        }
    };

    const updateVkTitle = async () => {
        setIsLoading(true);
        setStatus(prev => ({ ...prev, vk: 'loading' }));
        
        try {
            // Здесь будет реальный API вызов к VK Live API
            await new Promise(resolve => setTimeout(resolve, 1500));
            setStatus(prev => ({ ...prev, vk: 'success' }));
            setLastUpdate(new Date());
            
            // Сброс статуса через 3 секунды
            setTimeout(() => {
                setStatus(prev => ({ ...prev, vk: 'idle' }));
            }, 3000);
        } catch (error) {
            console.error('Error updating VK title:', error);
            setStatus(prev => ({ ...prev, vk: 'error' }));
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = (platform) => {
        const statusValue = status[platform];
        switch (statusValue) {
            case 'loading':
                return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusText = (platform) => {
        const statusValue = status[platform];
        switch (statusValue) {
            case 'loading':
                return 'Обновление...';
            case 'success':
                return 'Успешно обновлено';
            case 'error':
                return 'Ошибка обновления';
            default:
                return 'Готово к обновлению';
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-6 text-foreground">Смена названия стрима</h1>
                    <p className="text-muted-foreground">
                        Управление названием и описанием стрима на Twitch и VK Live
                    </p>
                </div>
                {lastUpdate && (
                    <p className="text-sm text-muted-foreground">
                        Последнее обновление: {lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Twitch */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-xs">T</span>
                        </div>
                        Twitch
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="twitch-title">Название стрима</Label>
                        <Input
                            id="twitch-title"
                            value={twitchTitle}
                            onChange={(e) => setTwitchTitle(e.target.value)}
                            placeholder="Введите название стрима"
                            maxLength={140}
                        />
                        <p className="text-xs text-muted-foreground">
                            {twitchTitle.length}/140 символов
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="twitch-description">Описание стрима</Label>
                        <Textarea
                            id="twitch-description"
                            value={twitchDescription}
                            onChange={(e) => setTwitchDescription(e.target.value)}
                            placeholder="Введите описание стрима"
                            rows={3}
                            maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground">
                            {twitchDescription.length}/500 символов
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {getStatusIcon('twitch')}
                            <span className="text-sm">{getStatusText('twitch')}</span>
                        </div>
                        <Button 
                            onClick={updateTwitchTitle}
                            disabled={isLoading || !twitchTitle.trim()}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Обновить на Twitch
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* VK Live */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-xs">V</span>
                        </div>
                        VK Live
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="vk-title">Название стрима</Label>
                        <Input
                            id="vk-title"
                            value={vkTitle}
                            onChange={(e) => setVkTitle(e.target.value)}
                            placeholder="Введите название стрима"
                            maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground">
                            {vkTitle.length}/100 символов
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="vk-description">Описание стрима</Label>
                        <Textarea
                            id="vk-description"
                            value={vkDescription}
                            onChange={(e) => setVkDescription(e.target.value)}
                            placeholder="Введите описание стрима"
                            rows={3}
                            maxLength={300}
                        />
                        <p className="text-xs text-muted-foreground">
                            {vkDescription.length}/300 символов
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {getStatusIcon('vk')}
                            <span className="text-sm">{getStatusText('vk')}</span>
                        </div>
                        <Button 
                            onClick={updateVkTitle}
                            disabled={isLoading || !vkTitle.trim()}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Обновить на VK Live
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Быстрые действия */}
            <Card>
                <CardHeader>
                    <CardTitle>Быстрые действия</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setTwitchTitle('Играю в новую игру!');
                                setTwitchDescription('Присоединяйтесь к стриму!');
                            }}
                            className="flex items-center gap-2"
                        >
                            <Edit3 className="h-4 w-4" />
                            Шаблон для игр
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setTwitchTitle('Общаемся с чатом');
                                setTwitchDescription('Просто общение и разговоры');
                            }}
                            className="flex items-center gap-2"
                        >
                            <Edit3 className="h-4 w-4" />
                            Шаблон для общения
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StreamTitlePage;
