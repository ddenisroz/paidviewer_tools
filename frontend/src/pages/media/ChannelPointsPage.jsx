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
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { API_BASE_URL } from '../../constants';
import { logger } from '../../utils/prodLogger';

const ChannelPointsPage = () => {
    const { integrations } = useIntegrations();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [selectedPlatform, setSelectedPlatform] = useState('twitch');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [rewards, setRewards] = useState({
        twitch: [],
        vk: []
    });
    const [loading, setLoading] = useState(true);

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

    // Загрузка наград с API
    const loadRewards = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/points/rewards`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Группируем награды по платформам
                    const groupedRewards = {
                        twitch: data.rewards.filter(r => r.platform === 'twitch'),
                        vk: data.rewards.filter(r => r.platform === 'vk')
                    };
                    setRewards(groupedRewards);
                }
            }
        } catch (error) {
            logger.error('Error loading rewards:', error);
            toast.error('Ошибка загрузки наград');
        } finally {
            setLoading(false);
        }
    };

    // Устанавливаем активную платформу по умолчанию и загружаем данные
    useEffect(() => {
        if (hasTwitchIntegration && !hasVkIntegration) {
            setSelectedPlatform('twitch');
        } else if (hasVkIntegration && !hasTwitchIntegration) {
            setSelectedPlatform('vk');
        }
        
        if (isFunctionEnabled) {
            loadRewards();
        }
    }, [hasTwitchIntegration, hasVkIntegration, isFunctionEnabled]);

    const handleCreateReward = async () => {
        if (!newReward.title || !newReward.description) {
            toast.error('Заполните название и описание');
            return;
        }

        try {
            const channelName = selectedPlatform === 'twitch' 
                ? user?.twitch_name 
                : user?.vk_username;
            
            if (!channelName) {
                toast.error('Не удалось определить имя канала');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/points/rewards/create`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: selectedPlatform,
                    channel_name: channelName,
                    title: newReward.title,
                    description: newReward.description,
                    cost: newReward.cost,
                    background_color: '#3B82F6',
                    reward_type: newReward.category || 'custom'
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    toast.success('Награда создана успешно!');
                    loadRewards(); // Перезагружаем награды
                    setNewReward({
                        title: '',
                        description: '',
                        cost: 100,
                        category: '',
                        cooldown: 30,
                        enabled: true
                    });
                    setShowCreateForm(false);
                } else {
                    toast.error(data.error || 'Ошибка создания награды');
                }
            } else {
                toast.error('Ошибка создания награды');
            }
        } catch (error) {
            logger.error('Error creating reward:', error);
            toast.error('Ошибка создания награды');
        }
    };

    const handleToggleReward = async (rewardId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/points/rewards/${rewardId}/toggle`, {
                method: 'PATCH',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    toast.success(data.message);
                    // Обновляем локальное состояние
                    setRewards(prev => ({
                        ...prev,
                        [selectedPlatform]: prev[selectedPlatform].map(reward =>
                            reward.id === rewardId ? { ...reward, enabled: !reward.enabled } : reward
                        )
                    }));
                } else {
                    toast.error(data.error || 'Ошибка переключения награды');
                }
            } else {
                toast.error('Ошибка переключения награды');
            }
        } catch (error) {
            logger.error('Error toggling reward:', error);
            toast.error('Ошибка переключения награды');
        }
    };

    const handleDeleteReward = async (rewardId) => {
        if (!window.confirm('Вы уверены, что хотите удалить эту награду?')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/points/rewards/${rewardId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    toast.success(data.message);
                    // Удаляем из локального состояния
                    setRewards(prev => ({
                        ...prev,
                        [selectedPlatform]: prev[selectedPlatform].filter(reward => reward.id !== rewardId)
                    }));
                } else {
                    toast.error(data.error || 'Ошибка удаления награды');
                }
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail || 'Ошибка удаления награды');
            }
        } catch (error) {
            logger.error('Error deleting reward:', error);
            toast.error('Ошибка удаления награды');
        }
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Загрузка наград...</p>
                </div>
            </div>
        );
    }

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