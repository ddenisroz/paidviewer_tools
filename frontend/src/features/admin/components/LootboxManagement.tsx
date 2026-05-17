import React, { useEffect, useState } from 'react';

import { Edit, Gift, Plus, Trash2, Trophy } from 'lucide-react';

import { lootboxService } from '@/services/api/services/lootboxService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PageLoader } from '@/shared/components/ui/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';
import { getWsUrl } from '@/utils/urlUtils';

interface Lootbox {
    id: number;
    name: string;
    description: string;
    type: 'free' | 'paid';
    price?: number;
    rewards?: Reward[];
}

interface Reward {
    id: number;
    name: string;
    description: string;
    type: 'currency' | 'item' | 'special';
    value: string;
    weight: number;
    lootbox_id?: number;
}

interface Achievement {
    id: number;
    channel_name: string;
    name: string;
    description: string;
    type: 'daily_streak' | 'total_days' | 'total_messages' | 'total_donated' | 'longest_streak';
    requirement_value: number;
    reward_type: 'free_lootbox' | 'paid_lootbox' | 'special';
    reward_value: number;
}

interface LootboxForm {
    name: string;
    description: string;
    type: 'free' | 'paid';
    price: number;
}

interface RewardForm {
    lootbox_id: string;
    name: string;
    description: string;
    type: 'currency' | 'item' | 'special';
    value: string;
    weight: number;
}

interface AchievementForm {
    channel_name: string;
    name: string;
    description: string;
    type: 'daily_streak' | 'total_days' | 'total_messages' | 'total_donated' | 'longest_streak';
    requirement_value: number;
    reward_type: 'free_lootbox' | 'paid_lootbox' | 'special';
    reward_value: number;
}

type DialogType = 'lootbox' | 'reward' | 'achievement';

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 bg-background/60 text-foreground hover:bg-accent/70';
const READONLY_FIELD_CLASS = 'border-border/70 bg-muted/40 text-foreground';

const LootboxManagement: React.FC = () => {
    const [lootboxes, setLootboxes] = useState<Lootbox[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [dialogType, setDialogType] = useState<DialogType>('lootbox');

    // Формы
    const [lootboxForm, setLootboxForm] = useState<LootboxForm>({
        name: '',
        description: '',
        type: 'free',
        price: 0,
    });

    const [rewardForm, setRewardForm] = useState<RewardForm>({
        lootbox_id: '',
        name: '',
        description: '',
        type: 'currency',
        value: '{"amount": 100, "currency": "points"}',
        weight: 1,
    });

    const [achievementForm, setAchievementForm] = useState<AchievementForm>({
        channel_name: '',
        name: '',
        description: '',
        type: 'daily_streak',
        requirement_value: 1,
        reward_type: 'free_lootbox',
        reward_value: 1,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (): Promise<void> => {
        try {
            setIsLoading(true);
            // Загружаем лутбоксы и достижения
            const [lootboxesResponse, achievementsResponse] = await Promise.all([
                lootboxService.getAdminLootboxes(),
                lootboxService.getAdminAchievements(),
            ]);

            setLootboxes((lootboxesResponse.data?.data || lootboxesResponse.data || []) as Lootbox[]);
            setAchievements((achievementsResponse.data?.data || achievementsResponse.data || []) as Achievement[]);
        } catch (error) {
            logger.error('Error loading lootbox management data:', error);
            // Инициализируем пустые массивы в случае ошибки
            setLootboxes([]);
            setAchievements([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateLootbox = async (): Promise<void> => {
        try {
            await lootboxService.createLootbox(lootboxForm as unknown as Record<string, unknown>);
            toast.success('Лутбокс создан!');
            setIsDialogOpen(false);
            setLootboxForm({ name: '', description: '', type: 'free', price: 0 });
            loadData();
        } catch (error) {
            logger.error('Error creating lootbox:', error);
            toast.error('Ошибка создания лутбокса');
        }
    };

    const handleCreateReward = async (): Promise<void> => {
        try {
            await lootboxService.createReward(rewardForm as unknown as Record<string, unknown>);
            toast.success('Награда создана!');
            setIsDialogOpen(false);
            setRewardForm({
                lootbox_id: '',
                name: '',
                description: '',
                type: 'currency',
                value: '{"amount": 100, "currency": "points"}',
                weight: 1,
            });
            loadData();
        } catch (error) {
            logger.error('Error creating reward:', error);
            toast.error('Ошибка создания награды');
        }
    };

    const handleCreateAchievement = async (): Promise<void> => {
        try {
            await lootboxService.createAchievement(achievementForm as unknown as Record<string, unknown>);
            toast.success('Достижение создано!');
            setIsDialogOpen(false);
            setAchievementForm({
                channel_name: '',
                name: '',
                description: '',
                type: 'daily_streak',
                requirement_value: 1,
                reward_type: 'free_lootbox',
                reward_value: 1,
            });
            loadData();
        } catch (error) {
            logger.error('Error creating achievement:', error);
            toast.error('Ошибка создания достижения');
        }
    };

    const openDialog = (type: DialogType, _item: Lootbox | Reward | Achievement | null = null): void => {
        setDialogType(type);
        setIsDialogOpen(true);
    };

    const renderDialog = (): React.ReactElement | null => {
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
                                placeholder="Например: Базовый лутбокс"
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
                            <Select
                                value={lootboxForm.type}
                                onValueChange={(value: 'free' | 'paid') =>
                                    setLootboxForm({ ...lootboxForm, type: value })
                                }
                            >
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
                                    onChange={(e) =>
                                        setLootboxForm({ ...lootboxForm, price: parseFloat(e.target.value) || 0 })
                                    }
                                    placeholder="100"
                                />
                            </div>
                        )}
                        <Button onClick={handleCreateLootbox} className="h-9 w-full">
                            Создать лутбокс
                        </Button>
                    </div>
                );

            case 'reward':
                return (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="lootbox_id">Лутбокс</Label>
                            <Select
                                value={rewardForm.lootbox_id}
                                onValueChange={(value: string) => setRewardForm({ ...rewardForm, lootbox_id: value })}
                            >
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
                                placeholder="Например: 100 монет"
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
                            <Select
                                value={rewardForm.type}
                                onValueChange={(value: 'currency' | 'item' | 'special') =>
                                    setRewardForm({ ...rewardForm, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="currency">Валюта</SelectItem>
                                    <SelectItem value="item">Предмет</SelectItem>
                                    <SelectItem value="special">Специальная</SelectItem>
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
                                onChange={(e) =>
                                    setRewardForm({ ...rewardForm, weight: parseInt(e.target.value) || 1 })
                                }
                                placeholder="1"
                            />
                        </div>
                        <Button onClick={handleCreateReward} className="h-9 w-full">
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
                                onChange={(e) =>
                                    setAchievementForm({ ...achievementForm, channel_name: e.target.value })
                                }
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
                                onChange={(e) =>
                                    setAchievementForm({ ...achievementForm, description: e.target.value })
                                }
                                placeholder="Описание достижения"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">Тип достижения</Label>
                            <Select
                                value={achievementForm.type}
                                onValueChange={(value: AchievementForm['type']) =>
                                    setAchievementForm({ ...achievementForm, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily_streak">Серия дней</SelectItem>
                                    <SelectItem value="total_days">Всего дней</SelectItem>
                                    <SelectItem value="total_messages">Всего сообщений</SelectItem>
                                    <SelectItem value="total_donated">Всего донатов</SelectItem>
                                    <SelectItem value="longest_streak">Лучшая серия дней</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="requirement_value">Пороговое значение</Label>
                            <Input
                                id="requirement_value"
                                type="number"
                                value={achievementForm.requirement_value}
                                onChange={(e) =>
                                    setAchievementForm({
                                        ...achievementForm,
                                        requirement_value: parseInt(e.target.value) || 1,
                                    })
                                }
                                placeholder="7"
                            />
                        </div>
                        <div>
                            <Label htmlFor="reward_type">Тип награды</Label>
                            <Select
                                value={achievementForm.reward_type}
                                onValueChange={(value: AchievementForm['reward_type']) =>
                                    setAchievementForm({ ...achievementForm, reward_type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="free_lootbox">Бесплатный лутбокс</SelectItem>
                                    <SelectItem value="paid_lootbox">Платный лутбокс</SelectItem>
                                    <SelectItem value="special">Специальная</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="reward_value">Количество награды</Label>
                            <Input
                                id="reward_value"
                                type="number"
                                value={achievementForm.reward_value}
                                onChange={(e) =>
                                    setAchievementForm({
                                        ...achievementForm,
                                        reward_value: parseInt(e.target.value) || 1,
                                    })
                                }
                                placeholder="1"
                            />
                        </div>
                        <Button onClick={handleCreateAchievement} className="h-9 w-full">
                            Создать достижение
                        </Button>
                    </div>
                );

            default:
                return null;
        }
    };

    if (isLoading) {
        return <PageLoader message="Загрузка данных..." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">Управление лутбоксами</h2>
                <div className="flex flex-wrap gap-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                onClick={() => openDialog('lootbox')}
                                variant="outline"
                                className={ACTION_BUTTON_CLASS}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Лутбокс
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Создать лутбокс</DialogTitle>
                                <DialogDescription>Создайте новый лутбокс для канала</DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                onClick={() => openDialog('reward')}
                                variant="outline"
                                className={ACTION_BUTTON_CLASS}
                            >
                                <Gift className="w-4 h-4 mr-2" />
                                Награда
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Создать награду</DialogTitle>
                                <DialogDescription>Добавьте награду в выбранный лутбокс</DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                onClick={() => openDialog('achievement')}
                                variant="outline"
                                className={ACTION_BUTTON_CLASS}
                            >
                                <Trophy className="w-4 h-4 mr-2" />
                                Достижение
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Создать достижение</DialogTitle>
                                <DialogDescription>Добавьте достижение для пользователей</DialogDescription>
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
                            <Card key={lootbox.id} className={SURFACE_CARD_CLASS}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between text-foreground">
                                        <span className="flex items-center">
                                            <Gift className="w-5 h-5 mr-2" />
                                            {lootbox.name}
                                        </span>
                                        <Badge variant={lootbox.type === 'free' ? 'default' : 'secondary'}>
                                            {lootbox.type === 'free' ? 'Бесплатный' : 'Платный'}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {lootbox.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {lootbox.type === 'paid' && lootbox.price && (
                                            <p className="font-semibold text-amber-300">{lootbox.price} ₽</p>
                                        )}
                                        <p className="text-sm text-muted-foreground">
                                            Наград: {lootbox.rewards?.length || 0}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                            >
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
                            <Card key={achievement.id} className={SURFACE_CARD_CLASS}>
                                <CardHeader>
                                    <CardTitle className="flex items-center text-foreground">
                                        <Trophy className="w-5 h-5 mr-2 text-amber-300" />
                                        {achievement.name}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {achievement.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Тип: {achievement.type}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Условие: {achievement.requirement_value}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Награда: {achievement.reward_type} x{achievement.reward_value}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                            >
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
                    <Card className={SURFACE_CARD_CLASS}>
                        <CardHeader>
                            <CardTitle className="text-foreground">OBS интеграция</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Настройка интеграции с OBS для виджета
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="obs_url">WebSocket URL для OBS</Label>
                                <Input
                                    id="obs_url"
                                    value={`${getWsUrl()}/ws/obs/lootbox_yourchy`}
                                    readOnly
                                    className={READONLY_FIELD_CLASS}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Скопируйте этот URL в OBS WebSocket Source
                                </p>
                            </div>
                            <div>
                                <Label>Lua скрипт для OBS</Label>
                                <Textarea
                                    value={`-- Вставьте этот код в OBS Scripts
local websocket_url = "${getWsUrl()}/ws/obs/lootbox_yourchy"
-- ... настройте скрипт под проект`}
                                    readOnly
                                    className={`${READONLY_FIELD_CLASS} font-mono text-xs`}
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
