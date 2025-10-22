import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Settings, Coins, Eye, EyeOff, Volume2, Gift, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useIntegrations } from '../../context/IntegrationsContext';
import { useNavigate } from 'react-router-dom';

const ChannelPointsPage = () => {
    const { integrations } = useIntegrations();
    const navigate = useNavigate();
    const [selectedPlatform, setSelectedPlatform] = useState('twitch');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [rewards, setRewards] = useState({
        twitch: [
        {
            id: '1',
                title: 'Звуковой эффект',
                description: 'Проигрывает забавный звук в стриме',
            cost: 500,
            enabled: true,
                category: 'Звуки',
                usageCount: 24,
                cooldown: 30
        },
        {
            id: '2', 
                title: 'Смена музыки',
                description: 'Переключает трек в плейлисте стримера',
            cost: 1000,
            enabled: true,
                category: 'Музыка',
                usageCount: 12,
                cooldown: 60
            },
            {
                id: '3',
                title: 'Сообщение на экране',
                description: 'Отображает ваше сообщение на экране стримера',
                cost: 750,
                enabled: false,
                category: 'Интерактив',
                usageCount: 8,
                cooldown: 45
            }
        ],
        vk: [
        {
            id: '1',
                title: 'Реакция стримера',
                description: 'Стример покажет эмоцию по вашему выбору',
            cost: 100,
            enabled: true,
                category: 'Реакции',
                usageCount: 45,
                cooldown: 15
            },
            {
                id: '2',
                title: 'Вопрос стримеру',
                description: 'Ваш вопрос будет зачитан в приоритете',
                cost: 200,
                enabled: true,
                category: 'Общение',
                usageCount: 18,
                cooldown: 20
            }
        ]
    });

    const [newReward, setNewReward] = useState({
        title: '',
        description: '',
        cost: 100,
        category: '',
        cooldown: 30,
        enabled: true
    });

    // Проверяем доступность функции на основе интеграций
    const hasTwitchIntegration = integrations.twitch?.enabled || false;
    const hasVkIntegration = integrations.vk?.enabled || false;
    const isFunctionEnabled = hasTwitchIntegration || hasVkIntegration;

    // Устанавливаем активную платформу по умолчанию
    useEffect(() => {
        if (hasTwitchIntegration && !hasVkIntegration) {
            setSelectedPlatform('twitch');
        } else if (hasVkIntegration && !hasTwitchIntegration) {
            setSelectedPlatform('vk');
        }
    }, [hasTwitchIntegration, hasVkIntegration]);

    const handleCreateReward = () => {
        if (!newReward.title || !newReward.description) return;

        const reward = {
            id: Date.now().toString(),
            ...newReward,
            usageCount: 0
        };

        setRewards(prev => ({
            ...prev,
            [selectedPlatform]: [...prev[selectedPlatform], reward]
        }));

        setNewReward({
            title: '',
            description: '',
            cost: 100,
            category: '',
            cooldown: 30,
            enabled: true
        });
        setShowCreateForm(false);
    };

    const handleToggleReward = (rewardId) => {
        setRewards(prev => ({
            ...prev,
            [selectedPlatform]: prev[selectedPlatform].map(reward =>
                reward.id === rewardId ? { ...reward, enabled: !reward.enabled } : reward
            )
        }));
    };

    const handleDeleteReward = (rewardId) => {
        setRewards(prev => ({
            ...prev,
            [selectedPlatform]: prev[selectedPlatform].filter(reward => reward.id !== rewardId)
        }));
    };

    const getStats = () => {
        const currentRewards = rewards[selectedPlatform] || [];
        return {
            total: currentRewards.length,
            active: currentRewards.filter(r => r.enabled).length,
            totalUsage: currentRewards.reduce((sum, r) => sum + r.usageCount, 0)
        };
    };

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

    const stats = getStats();

    return (
        <div className="space-y-6">
            {/* Заголовок и статистика */}
            <div className="space-y-4">
                <div>
                <h1 className="text-3xl font-bold mb-6 text-foreground">Управление баллами канала</h1>
                <p className="text-muted-foreground">
                        Создавайте и настраивайте награды за баллы канала для ваших зрителей
                </p>
            </div>

                {/* Компактная статистика */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        <span>Всего: {stats.total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-green-600" />
                        <span>Активных: {stats.active}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span>Использований: {stats.totalUsage}</span>
                    </div>
                </div>
                    </div>
                    
            {/* Переключатель платформ */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Платформа:</span>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        {hasTwitchIntegration && (
                            <button
                                onClick={() => setSelectedPlatform('twitch')}
                                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                                    selectedPlatform === 'twitch'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-background hover:bg-muted text-muted-foreground'
                                }`}
                            >
                                <div className="w-3 h-3 bg-purple-600 rounded"></div>
                                Twitch
                            </button>
                        )}
                        {hasVkIntegration && (
                            <button
                                onClick={() => setSelectedPlatform('vk')}
                                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                                    selectedPlatform === 'vk'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-background hover:bg-muted text-muted-foreground'
                                }`}
                            >
                                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                                VK Live
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1"></div>

                <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Создать награду
                </Button>
            </div>

            {/* Форма создания награды */}
            {showCreateForm && (
            <Card>
                <CardHeader>
                        <CardTitle>Новая награда</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                value={newReward.title}
                                onChange={(e) => setNewReward(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Название награды"
                            />
                            <Input
                                type="number"
                                value={newReward.cost}
                                onChange={(e) => setNewReward(prev => ({ ...prev, cost: parseInt(e.target.value) || 0 }))}
                                placeholder="Стоимость в баллах"
                                min="1"
                            />
                        </div>
                        
                        <Textarea
                            value={newReward.description}
                            onChange={(e) => setNewReward(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Что произойдет при активации награды?"
                            rows={2}
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={newReward.enabled}
                                    onCheckedChange={(checked) => setNewReward(prev => ({ ...prev, enabled: checked }))}
                                />
                                <span className="text-sm">Активна</span>
                                </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                                    Отмена
                                </Button>
                                <Button onClick={handleCreateReward}>
                                    Создать
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Список наград */}
            <div className="space-y-4">
                {rewards[selectedPlatform]?.length > 0 ? (
                    rewards[selectedPlatform].map((reward) => (
                        <Card key={reward.id} className={`transition-all ${!reward.enabled ? 'opacity-60' : ''}`}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold">{reward.title}</h3>
                                            <Badge variant={reward.enabled ? "default" : "secondary"} className="text-xs">
                                                {reward.enabled ? "Активна" : "Отключена"}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">{reward.description}</p>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Coins className="h-3 w-3" />
                                                {reward.cost.toLocaleString()}
                                            </span>
                                            <span>{reward.usageCount} использований</span>
                        </div>
                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleReward(reward.id)}
                                            className="h-8 w-8 p-0"
                                        >
                                            {reward.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteReward(reward.id)}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Награды не созданы</h3>
                            <p className="text-muted-foreground mb-4">
                                Создайте свою первую награду для платформы {selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}
                            </p>
                            <Button onClick={() => setShowCreateForm(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Создать награду
                            </Button>
                </CardContent>
            </Card>
                )}
            </div>
        </div>
    );
};

export default ChannelPointsPage;