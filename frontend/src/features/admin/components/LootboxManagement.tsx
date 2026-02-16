import React, { useEffect, useState } from 'react';

import { Edit, Gift, Plus, Trash2, Trophy } from 'lucide-react';

import { lootboxService } from '@/services/api/services/lootboxService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PageLoader } from '@/shared/components/ui/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


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

const LootboxManagement: React.FC = () => {
    const [lootboxes, setLootboxes] = useState<Lootbox[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [dialogType, setDialogType] = useState<DialogType>('lootbox');

    // �����
    const [lootboxForm, setLootboxForm] = useState<LootboxForm>({
        name: '',
        description: '',
        type: 'free',
        price: 0
    });

    const [rewardForm, setRewardForm] = useState<RewardForm>({
        lootbox_id: '',
        name: '',
        description: '',
        type: 'currency',
        value: '{"amount": 100, "currency": "points"}',
        weight: 1
    });

    const [achievementForm, setAchievementForm] = useState<AchievementForm>({
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

    const loadData = async (): Promise<void> => {
        try {
            setIsLoading(true);
            // ��������� �������� � ����������
            const [lootboxesResponse, achievementsResponse] = await Promise.all([
                lootboxService.getAdminLootboxes(),
                lootboxService.getAdminAchievements()
            ]);
            
            setLootboxes((lootboxesResponse.data?.data || lootboxesResponse.data || []) as Lootbox[]);
            setAchievements((achievementsResponse.data?.data || achievementsResponse.data || []) as Achievement[]);
        } catch (error) {
            logger.error('Error loading lootbox management data:', error);
            // ������������� ������ ������� � ������ ������
            setLootboxes([]);
            setAchievements([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateLootbox = async (): Promise<void> => {
        try {
            await lootboxService.createLootbox(lootboxForm as unknown as Record<string, unknown>);
            toast.success('������� ������!');
            setIsDialogOpen(false);
            setLootboxForm({ name: '', description: '', type: 'free', price: 0 });
            loadData();
        } catch (error) {
            logger.error('Error creating lootbox:', error);
            toast.error('������ �������� ��������');
        }
    };

    const handleCreateReward = async (): Promise<void> => {
        try {
            await lootboxService.createReward(rewardForm as unknown as Record<string, unknown>);
            toast.success('������� �������!');
            setIsDialogOpen(false);
            setRewardForm({ 
                lootbox_id: '', 
                name: '', 
                description: '', 
                type: 'currency', 
                value: '{"amount": 100, "currency": "points"}', 
                weight: 1 
            });
            loadData();
        } catch (error) {
            logger.error('Error creating reward:', error);
            toast.error('������ �������� �������');
        }
    };

    const handleCreateAchievement = async (): Promise<void> => {
        try {
            await lootboxService.createAchievement(achievementForm as unknown as Record<string, unknown>);
            toast.success('���������� �������!');
            setIsDialogOpen(false);
            setAchievementForm({ 
                channel_name: '', 
                name: '', 
                description: '', 
                type: 'daily_streak', 
                requirement_value: 1, 
                reward_type: 'free_lootbox', 
                reward_value: 1 
            });
            loadData();
        } catch (error) {
            logger.error('Error creating achievement:', error);
            toast.error('������ �������� ����������');
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
                            <Label htmlFor="name">�������� ��������</Label>
                            <Input
                                id="name"
                                value={lootboxForm.name}
                                onChange={(e) => setLootboxForm({ ...lootboxForm, name: e.target.value })}
                                placeholder="��������: ���������� �������"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">��������</Label>
                            <Textarea
                                id="description"
                                value={lootboxForm.description}
                                onChange={(e) => setLootboxForm({ ...lootboxForm, description: e.target.value })}
                                placeholder="�������� ��������"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">���</Label>
                            <Select 
                                value={lootboxForm.type} 
                                onValueChange={(value: 'free' | 'paid') => setLootboxForm({ ...lootboxForm, type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="free">����������</SelectItem>
                                    <SelectItem value="paid">�������</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {lootboxForm.type === 'paid' && (
                            <div>
                                <Label htmlFor="price">���� (���.)</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    value={lootboxForm.price}
                                    onChange={(e) => setLootboxForm({ ...lootboxForm, price: parseFloat(e.target.value) || 0 })}
                                    placeholder="100"
                                />
                            </div>
                        )}
                        <Button onClick={handleCreateLootbox} className="w-full">
                            ������� �������
                        </Button>
                    </div>
                );

            case 'reward':
                return (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="lootbox_id">�������</Label>
                            <Select 
                                value={rewardForm.lootbox_id} 
                                onValueChange={(value: string) => setRewardForm({ ...rewardForm, lootbox_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="�������� �������" />
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
                            <Label htmlFor="name">�������� �������</Label>
                            <Input
                                id="name"
                                value={rewardForm.name}
                                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                                placeholder="��������: 100 �����"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">��������</Label>
                            <Textarea
                                id="description"
                                value={rewardForm.description}
                                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                                placeholder="�������� �������"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">��� �������</Label>
                            <Select 
                                value={rewardForm.type} 
                                onValueChange={(value: 'currency' | 'item' | 'special') => setRewardForm({ ...rewardForm, type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="currency">������</SelectItem>
                                    <SelectItem value="item">�������</SelectItem>
                                    <SelectItem value="special">������</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="value">�������� (JSON)</Label>
                            <Textarea
                                id="value"
                                value={rewardForm.value}
                                onChange={(e) => setRewardForm({ ...rewardForm, value: e.target.value })}
                                placeholder='{"amount": 100, "currency": "points"}'
                            />
                        </div>
                        <div>
                            <Label htmlFor="weight">��� (�����������)</Label>
                            <Input
                                id="weight"
                                type="number"
                                value={rewardForm.weight}
                                onChange={(e) => setRewardForm({ ...rewardForm, weight: parseInt(e.target.value) || 1 })}
                                placeholder="1"
                            />
                        </div>
                        <Button onClick={handleCreateReward} className="w-full">
                            ������� �������
                        </Button>
                    </div>
                );

            case 'achievement':
                return (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="channel_name">�����</Label>
                            <Input
                                id="channel_name"
                                value={achievementForm.channel_name}
                                onChange={(e) => setAchievementForm({ ...achievementForm, channel_name: e.target.value })}
                                placeholder="yourchy"
                            />
                        </div>
                        <div>
                            <Label htmlFor="name">�������� ����������</Label>
                            <Input
                                id="name"
                                value={achievementForm.name}
                                onChange={(e) => setAchievementForm({ ...achievementForm, name: e.target.value })}
                                placeholder="��������: ������ ������"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">��������</Label>
                            <Textarea
                                id="description"
                                value={achievementForm.description}
                                onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                                placeholder="�������� ����������"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">��� ����������</Label>
                            <Select 
                                value={achievementForm.type} 
                                onValueChange={(value: AchievementForm['type']) => setAchievementForm({ ...achievementForm, type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily_streak">����� ����</SelectItem>
                                    <SelectItem value="total_days">����� ����</SelectItem>
                                    <SelectItem value="total_messages">���������</SelectItem>
                                    <SelectItem value="total_donated">������</SelectItem>
                                    <SelectItem value="longest_streak">����� ������� �����</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="requirement_value">��������� ��������</Label>
                            <Input
                                id="requirement_value"
                                type="number"
                                value={achievementForm.requirement_value}
                                onChange={(e) => setAchievementForm({ ...achievementForm, requirement_value: parseInt(e.target.value) || 1 })}
                                placeholder="7"
                            />
                        </div>
                        <div>
                            <Label htmlFor="reward_type">��� �������</Label>
                            <Select 
                                value={achievementForm.reward_type} 
                                onValueChange={(value: AchievementForm['reward_type']) => setAchievementForm({ ...achievementForm, reward_type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="free_lootbox">���������� �������</SelectItem>
                                    <SelectItem value="paid_lootbox">������� �������</SelectItem>
                                    <SelectItem value="special">������</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="reward_value">���������� ������</Label>
                            <Input
                                id="reward_value"
                                type="number"
                                value={achievementForm.reward_value}
                                onChange={(e) => setAchievementForm({ ...achievementForm, reward_value: parseInt(e.target.value) || 1 })}
                                placeholder="1"
                            />
                        </div>
                        <Button onClick={handleCreateAchievement} className="w-full">
                            ������� ����������
                        </Button>
                    </div>
                );

            default:
                return null;
        }
    };

    if (isLoading) {
        return <PageLoader message="�������� ���������..." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">���������� ����������</h2>
                <div className="flex space-x-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog('lootbox')} variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                �������
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>������� �������</DialogTitle>
                                <DialogDescription>
                                    �������� ����� ������� ��� ������
                                </DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog('reward')} variant="outline">
                                <Gift className="w-4 h-4 mr-2" />
                                �������
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>������� �������</DialogTitle>
                                <DialogDescription>
                                    �������� ������� � �������
                                </DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog('achievement')} variant="outline">
                                <Trophy className="w-4 h-4 mr-2" />
                                ����������
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>������� ����������</DialogTitle>
                                <DialogDescription>
                                    ��������� ���������� ��� �������������
                                </DialogDescription>
                            </DialogHeader>
                            {renderDialog()}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="lootboxes" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="lootboxes">��������</TabsTrigger>
                    <TabsTrigger value="achievements">����������</TabsTrigger>
                    <TabsTrigger value="settings">���������</TabsTrigger>
                </TabsList>

                <TabsContent value="lootboxes" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lootboxes.map((lootbox) => (
                            <Card key={lootbox.id} className="bg-muted border-border">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center justify-between">
                                        <span className="flex items-center">
                                            <Gift className="w-5 h-5 mr-2" />
                                            {lootbox.name}
                                        </span>
                                        <Badge variant={lootbox.type === 'free' ? 'default' : 'secondary'}>
                                            {lootbox.type === 'free' ? '����������' : '�������'}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {lootbox.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {lootbox.type === 'paid' && lootbox.price && (
                                            <p className="text-yellow-400 font-bold">
                                                {lootbox.price} ?
                                            </p>
                                        )}
                                        <p className="text-sm text-muted-foreground">
                                            ������: {lootbox.rewards?.length || 0}
                                        </p>
                                        <div className="flex space-x-2">
                                            <Button size="sm" variant="outline">
                                                <Edit className="w-4 h-4 mr-1" />
                                                ��������
                                            </Button>
                                            <Button size="sm" variant="destructive">
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                �������
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
                            <Card key={achievement.id} className="bg-muted border-border">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center">
                                        <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                                        {achievement.name}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {achievement.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            ���: {achievement.type}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            ����������: {achievement.requirement_value}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            �������: {achievement.reward_type} x{achievement.reward_value}
                                        </p>
                                        <div className="flex space-x-2">
                                            <Button size="sm" variant="outline">
                                                <Edit className="w-4 h-4 mr-1" />
                                                ��������
                                            </Button>
                                            <Button size="sm" variant="destructive">
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                �������
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card className="bg-muted border-border">
                        <CardHeader>
                            <CardTitle className="text-white">OBS ����������</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                ��������� ���������� � OBS ��� ��������
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="obs_url">WebSocket URL ��� OBS</Label>
                                <Input
                                    id="obs_url"
                                    value={`${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'}/ws/obs/lootbox_yourchy`}
                                    readOnly
                                    className="bg-gray-700"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    ���������� ���� URL � OBS WebSocket Source
                                </p>
                            </div>
                            <div>
                                <Label>Lua ������ ��� OBS</Label>
                                <Textarea
                                    value={`-- �������� ���� ��� � OBS Scripts
local websocket_url = "${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'}/ws/obs/lootbox_yourchy"
-- ... ��������� ��� �������`}
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



