import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Gift, Plus, Edit, Trash2, Trophy, Coins } from 'lucide-react';
import api from '../../services/api';
import { logger } from '../../utils/prodLogger';
import { toast } from 'sonner';

const LootboxManagement = () => {
    const [lootboxes, setLootboxes] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [dialogType, setDialogType] = useState('lootbox'); // lootbox, reward, achievement

    // Формы
    const [lootboxForm, setLootboxForm] = useState({
        name: '',
        description: '',
        type: 'free',
        price: 0
    });

    const [rewardForm, setRewardForm] = useState({
        lootbox_id: '',
        name: '',
        description: '',
        type: 'currency',
        value: '{"amount": 100, "currency": "points"}',
        weight: 1
    });

    const [achievementForm, setAchievementForm] = useState({
        channel_name: '',
        name: '',
        description: '',
        type: 'daily_streak',
        requirement_value: 1,
        reward_type: 'free_lootbox',
        reward_value: 1
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            // Загружаем лутбоксы и достижения
            const [lootboxesResponse, achievementsResponse] = await Promise.all([
                api.get('/api/lootbox/admin/lootboxes'),
                api.get('/api/lootbox/admin/achievements')
            ]);
            
            setLootboxes(lootboxesResponse.data || []);
            setAchievements(achievementsResponse.data || []);
        } catch (error) {
            logger.error('Error loading lootbox management data:', error);
            // Устанавливаем пустые массивы в случае ошибки
            setLootboxes([]);
            setAchievements([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateLootbox = async () => {
        try {
            await api.post('/lootbox/admin/lootbox', lootboxForm);
            toast.success('Лутбокс создан!');
            setIsDialogOpen(false);
            setLootboxForm({ name: '', description: '', type: 'free', price: 0 });
            loadData();
        } catch (error) {
            logger.error('Error creating lootbox:', error);
            toast.error('Ошибка создания лутбокса');
        }
    };

    const handleCreateReward = async () => {
        try {
            await api.post('/lootbox/admin/lootbox/reward', rewardForm);
            toast.success('Награда создана!');
            setIsDialogOpen(false);
            setRewardForm({ lootbox_id: '', name: '', description: '', type: 'currency', value: '{"amount": 100, "currency": "points"}', weight: 1 });
            loadData();
        } catch (error) {
            logger.error('Error creating reward:', error);
            toast.error('Ошибка создания награды');
        }
    };

    const handleCreateAchievement = async () => {
        try {
            await api.post('/lootbox/admin/achievement', achievementForm);
            toast.success('Достижение создано!');
            setIsDialogOpen(false);
            setAchievementForm({ channel_name: '', name: '', description: '', type: 'daily_streak', requirement_value: 1, reward_type: 'free_lootbox', reward_value: 1 });
            loadData();
        } catch (error) {
            logger.error('Error creating achievement:', error);
            toast.error('Ошибка создания достижения');
        }
    };

    const openDialog = (type, item = null) => {
        setDialogType(type);
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    const renderDialog = () => {
        switch (dialogType) {
            case 'lootbox':
                return (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Название лутбокса</Label>
                            <Input
                                id="name"
                                value={lootboxForm.name}
                                onChange={(e) => setLootboxForm({ ...lootboxForm, name: e.target.value })}
                                placeholder="Например: Ежедневный лутбокс"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">Описание</Label>
                            <Textarea
                                id="description"
                                value={lootboxForm.description}
                                onChange={(e) => setLootboxForm({ ...lootboxForm, description: e.target.value })}
                                placeholder="Описание лутбокса"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">Тип</Label>
                            <Select value={lootboxForm.type} onValueChange={(value) => setLootboxForm({ ...lootboxForm, type: value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="free">Бесплатный</SelectItem>
                                    <SelectItem value="paid">Платный</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {lootboxForm.type === 'paid' && (
                            <div>
                                <Label htmlFor="price">Цена (руб.)</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    value={lootboxForm.price}
                                    onChange={(e) => setLootboxForm({ ...lootboxForm, price: parseFloat(e.target.value) })}
                                    placeholder="100"
                                />
                            </div>
                        )}
                        <Button onClick={handleCreateLootbox} className="w-full">
                            Создать лутбокс
                        </Button>
                    </div>
                );

            case 'reward':
                return (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="lootbox_id">Лутбокс</Label>
                            <Select value={rewardForm.lootbox_id} onValueChange={(value) => setRewardForm({ ...rewardForm, lootbox_id: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите лутбокс" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lootboxes.map((lootbox) => (
                                        <SelectItem key={lootbox.id} value={lootbox.id.toString()}>
                                            {lootbox.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="name">Название награды</Label>
                            <Input
                                id="name"
                                value={rewardForm.name}
                                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                                placeholder="Например: 100 очков"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">Описание</Label>
                            <Textarea
                                id="description"
                                value={rewardForm.description}
                                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                                placeholder="Описание награды"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">Тип награды</Label>
                            <Select value={rewardForm.type} onValueChange={(value) => setRewardForm({ ...rewardForm, type: value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="currency">Валюта</SelectItem>
                                    <SelectItem value="item">Предмет</SelectItem>
                                    <SelectItem value="special">Особое</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="value">Значение (JSON)</Label>
                            <Textarea
                                id="value"
                                value={rewardForm.value}
                                onChange={(e) => setRewardForm({ ...rewardForm, value: e.target.value })}
                                placeholder='{"amount": 100, "currency": "points"}'
                            />
                        </div>
                        <div>
                            <Label htmlFor="weight">Вес (вероятность)</Label>
                            <Input
                                id="weight"
                                type="number"
                                value={rewardForm.weight}
                                onChange={(e) => setRewardForm({ ...rewardForm, weight: parseInt(e.target.value) })}
                                placeholder="1"
                            />
                        </div>
                        <Button onClick={handleCreateReward} className="w-full">
                            Создать награду
                        </Button>
                    </div>
                );

            case 'achievement':
                return (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="channel_name">Канал</Label>
                            <Input
                                id="channel_name"
                                value={achievementForm.channel_name}
                                onChange={(e) => setAchievementForm({ ...achievementForm, channel_name: e.target.value })}
                                placeholder="yourchy"
                            />
                        </div>
                        <div>
                            <Label htmlFor="name">Название достижения</Label>
                            <Input
                                id="name"
                                value={achievementForm.name}
                                onChange={(e) => setAchievementForm({ ...achievementForm, name: e.target.value })}
                                placeholder="Например: Первая неделя"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">Описание</Label>
                            <Textarea
                                id="description"
                                value={achievementForm.description}
                                onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                                placeholder="Описание достижения"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">Тип достижения</Label>
                            <Select value={achievementForm.type} onValueChange={(value) => setAchievementForm({ ...achievementForm, type: value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily_streak">Серия дней</SelectItem>
                                    <SelectItem value="total_days">Всего дней</SelectItem>
                                    <SelectItem value="total_messages">Сообщения</SelectItem>
                                    <SelectItem value="total_donated">Донаты</SelectItem>
                                    <SelectItem value="longest_streak">Самая длинная серия</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="requirement_value">Требуемое значение</Label>
                            <Input
                                id="requirement_value"
                                type="number"
                                value={achievementForm.requirement_value}
                                onChange={(e) => setAchievementForm({ ...achievementForm, requirement_value: parseInt(e.target.value) })}
                                placeholder="7"
                            />
                        </div>
                        <div>
                            <Label htmlFor="reward_type">Тип награды</Label>
                            <Select value={achievementForm.reward_type} onValueChange={(value) => setAchievementForm({ ...achievementForm, reward_type: value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="free_lootbox">Бесплатный лутбокс</SelectItem>
                                    <SelectItem value="paid_lootbox">Платный лутбокс</SelectItem>
                                    <SelectItem value="special">Особое</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="reward_value">Количество наград</Label>
                            <Input
                                id="reward_value"
                                type="number"
                                value={achievementForm.reward_value}
                                onChange={(e) => setAchievementForm({ ...achievementForm, reward_value: parseInt(e.target.value) })}
                                placeholder="1"
                            />
                        </div>
                        <Button onClick={handleCreateAchievement} className="w-full">
                            Создать достижение
                        </Button>
                    </div>
                );

            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Управление лутбоксами</h2>
                <div className="flex space-x-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog('lootbox')} variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                Лутбокс
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Создать лутбокс</DialogTitle>
                                <DialogDescription>
                                    Создайте новый лутбокс для канала
                                </DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog('reward')} variant="outline">
                                <Gift className="w-4 h-4 mr-2" />
                                Награда
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Создать награду</DialogTitle>
                                <DialogDescription>
                                    Добавьте награду в лутбокс
                                </DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog('achievement')} variant="outline">
                                <Trophy className="w-4 h-4 mr-2" />
                                Достижение
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Создать достижение</DialogTitle>
                                <DialogDescription>
                                    Настройте достижение для пользователей
                                </DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="lootboxes" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="lootboxes">Лутбоксы</TabsTrigger>
                    <TabsTrigger value="achievements">Достижения</TabsTrigger>
                    <TabsTrigger value="settings">Настройки</TabsTrigger>
                </TabsList>

                <TabsContent value="lootboxes" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lootboxes.map((lootbox) => (
                            <Card key={lootbox.id} className="bg-gray-800 border-gray-700">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center justify-between">
                                        <span className="flex items-center">
                                            <Gift className="w-5 h-5 mr-2" />
                                            {lootbox.name}
                                        </span>
                                        <Badge variant={lootbox.type === 'free' ? 'default' : 'secondary'}>
                                            {lootbox.type === 'free' ? 'Бесплатный' : 'Платный'}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-gray-400">
                                        {lootbox.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {lootbox.type === 'paid' && (
                                            <p className="text-yellow-400 font-bold">
                                                {lootbox.price} ₽
                                            </p>
                                        )}
                                        <p className="text-sm text-gray-300">
                                            Наград: {lootbox.rewards?.length || 0}
                                        </p>
                                        <div className="flex space-x-2">
                                            <Button size="sm" variant="outline">
                                                <Edit className="w-4 h-4 mr-1" />
                                                Изменить
                                            </Button>
                                            <Button size="sm" variant="destructive">
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                Удалить
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="achievements" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {achievements.map((achievement) => (
                            <Card key={achievement.id} className="bg-gray-800 border-gray-700">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center">
                                        <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                                        {achievement.name}
                                    </CardTitle>
                                    <CardDescription className="text-gray-400">
                                        {achievement.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-300">
                                            Тип: {achievement.type}
                                        </p>
                                        <p className="text-sm text-gray-300">
                                            Требование: {achievement.requirement_value}
                                        </p>
                                        <p className="text-sm text-gray-300">
                                            Награда: {achievement.reward_type} x{achievement.reward_value}
                                        </p>
                                        <div className="flex space-x-2">
                                            <Button size="sm" variant="outline">
                                                <Edit className="w-4 h-4 mr-1" />
                                                Изменить
                                            </Button>
                                            <Button size="sm" variant="destructive">
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                Удалить
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                            <CardTitle className="text-white">OBS Интеграция</CardTitle>
                            <CardDescription className="text-gray-400">
                                Настройте интеграцию с OBS для анимаций
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="obs_url">WebSocket URL для OBS</Label>
                                <Input
                                    id="obs_url"
                                    value={`${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'}/ws/obs/lootbox_yourchy`}
                                    readOnly
                                    className="bg-gray-700"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Скопируйте этот URL в OBS WebSocket Source
                                </p>
                            </div>
                            <div>
                                <Label>Lua скрипт для OBS</Label>
                                <Textarea
                                    value={`-- Вставьте этот код в OBS Scripts
local websocket_url = "${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'}/ws/obs/lootbox_yourchy"
-- ... остальной код скрипта`}
                                    readOnly
                                    className="bg-gray-700 font-mono text-xs"
                                    rows={10}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default LootboxManagement;
