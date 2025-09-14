import React, { useState } from 'react';
import { Upload, Play, Settings, Save, Volume2, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useIntegrations } from '../../hooks/useIntegrations';
import { useNavigate } from 'react-router-dom';

const ChannelPointsPage = () => {
    const { integrations } = useIntegrations();
    const navigate = useNavigate();
    const [twitchRewards, setTwitchRewards] = useState([
        {
            id: '1',
            name: 'Звуковой эффект',
            cost: 500,
            enabled: true,
            sound: 'airhorn.mp3',
            description: 'Проигрывает забавный звук'
        },
        {
            id: '2', 
            name: 'Смена музыки',
            cost: 1000,
            enabled: true,
            sound: null,
            description: 'Переключает трек в плейлисте'
        }
    ]);

    const [vkRewards, setVkRewards] = useState([
        {
            id: '1',
            name: 'Реакция стримера',
            cost: 100,
            enabled: true,
            sound: 'notification.mp3',
            description: 'Уведомление о донате'
        }
    ]);

    const [selectedPlatform, setSelectedPlatform] = useState('twitch');

    // Проверяем доступность функции на основе интеграций
    const hasTwitchIntegration = integrations.twitch_enabled;
    const hasVkIntegration = integrations.vk_enabled;
    const isFunctionEnabled = hasTwitchIntegration || hasVkIntegration;

    const handleSoundUpload = (rewardId, platform) => {
        // В реальной реализации здесь будет загрузка файла
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Здесь будет загрузка файла на сервер
                const rewards = platform === 'twitch' ? twitchRewards : vkRewards;
                const setRewards = platform === 'twitch' ? setTwitchRewards : setVkRewards;
                
                const updatedRewards = rewards.map(reward => 
                    reward.id === rewardId 
                        ? { ...reward, sound: file.name }
                        : reward
                );
                setRewards(updatedRewards);
            }
        };
        input.click();
    };

    const handlePlaySound = (soundFile) => {
        if (soundFile) {
            // В реальной реализации здесь будет воспроизведение звука
            console.log(`Playing sound: ${soundFile}`);
        }
    };

    const RewardCard = ({ reward, platform }) => (
        <Card key={reward.id} className="transition-all hover:shadow-md">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{reward.name}</CardTitle>
                    <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-yellow-500" />
                        <span className="font-bold">{reward.cost}</span>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">{reward.description}</p>
            </CardHeader>
            
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor={`enabled-${reward.id}`}>Включена</Label>
                    <Switch 
                        id={`enabled-${reward.id}`}
                        checked={reward.enabled}
                        onCheckedChange={(checked) => {
                            const rewards = platform === 'twitch' ? twitchRewards : vkRewards;
                            const setRewards = platform === 'twitch' ? setTwitchRewards : setVkRewards;
                            
                            const updated = rewards.map(r => 
                                r.id === reward.id ? { ...r, enabled: checked } : r
                            );
                            setRewards(updated);
                        }}
                    />
                </div>
                
                <div className="space-y-2">
                    <Label>Звуковой файл</Label>
                    <div className="flex gap-2">
                        <Input 
                            value={reward.sound || 'Не выбран'}
                            readOnly
                            className="flex-1"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSoundUpload(reward.id, platform)}
                        >
                            <Upload className="h-4 w-4" />
                        </Button>
                        {reward.sound && (
                            <Button
                                variant="outline" 
                                size="sm"
                                onClick={() => handlePlaySound(reward.sound)}
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor={`cost-${reward.id}`}>Стоимость</Label>
                    <Input 
                        id={`cost-${reward.id}`}
                        type="number"
                        value={reward.cost}
                        onChange={(e) => {
                            const rewards = platform === 'twitch' ? twitchRewards : vkRewards;
                            const setRewards = platform === 'twitch' ? setTwitchRewards : setVkRewards;
                            
                            const updated = rewards.map(r => 
                                r.id === reward.id ? { ...r, cost: parseInt(e.target.value) || 0 } : r
                            );
                            setRewards(updated);
                        }}
                    />
                </div>
            </CardContent>
        </Card>
    );

    // Если функция недоступна, показываем сообщение
    if (!isFunctionEnabled) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                        Интеграция с Twitch/VK отключена
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        Включите интеграцию с Twitch или VK в настройках, чтобы использовать управление баллами канала
                    </p>
                    <Button 
                        className="flex items-center gap-2 mx-auto"
                        onClick={() => navigate('/dashboard/settings')}
                    >
                        <Settings className="h-4 w-4" />
                        Открыть настройки интеграций
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2">Управление баллами канала</h1>
                <p className="text-muted-foreground">
                    Настройка наград за баллы канала для Twitch и VK Video Live
                </p>
            </div>

            <Tabs defaultValue="twitch" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="twitch" className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-purple-600 rounded"></div>
                        Twitch Channel Points
                    </TabsTrigger>
                    <TabsTrigger value="vk" className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-600 rounded"></div>
                        VK Баллы
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="twitch" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Награды Twitch</h2>
                        <Button>
                            <Settings className="h-4 w-4 mr-2" />
                            Добавить награду
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {twitchRewards.map(reward => 
                            <RewardCard key={reward.id} reward={reward} platform="twitch" />
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="vk" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Награды VK</h2>
                        <Button>
                            <Settings className="h-4 w-4 mr-2" />
                            Добавить награду  
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vkRewards.map(reward => 
                            <RewardCard key={reward.id} reward={reward} platform="vk" />
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle>Глобальные настройки</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="volume">Громкость звуков (%)</Label>
                            <div className="flex gap-2 items-center">
                                <Input id="volume" type="number" defaultValue="70" min="0" max="100" />
                                <Volume2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Настройки воспроизведения</Label>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Switch id="auto-play" defaultChecked />
                                    <Label htmlFor="auto-play">Автовоспроизведение</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch id="queue-sounds" />
                                    <Label htmlFor="queue-sounds">Очередь звуков</Label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end">
                        <Button>
                            <Save className="h-4 w-4 mr-2" />
                            Сохранить настройки
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ChannelPointsPage;
