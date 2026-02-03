import React, { useCallback, useEffect, useState } from 'react';

import { CheckCircle2, Clock, Edit, Gift, Loader2, MessageCircle, Plus, Power, PowerOff, Trash2, XCircle } from 'lucide-react';

import { PLATFORM_COLORS } from '@/constants/uiConstants';
import { useIntegrations } from '@/context/IntegrationsContext';
import pointsApi from '@/services/pointsApi';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


import type { PlatformReward, RewardDemand } from '@/types/points';

interface RewardFormData {
    title: string;
    description: string;
    cost: number | string;
    repair_timeout: number | string;
    max_uses_count: number | string;
    max_uses_count_per_user: number | string;
    is_message_required: boolean;
    global_cooldown_seconds: number | string;
    max_per_stream: number | string;
    max_per_user_per_stream: number | string;
    should_redemptions_skip_request_queue: boolean;
}

interface RewardCardProps {
    reward: PlatformReward;
    platform: 'twitch' | 'vk';
    onEdit: () => void;
    onRefresh: () => void;
}

interface RewardDialogProps {
    open: boolean;
    onClose: () => void;
    reward: PlatformReward | null;
    platform: 'twitch' | 'vk';
    channelName?: string | null;
    onSuccess: () => void;
}

interface RedemptionQueueProps {
    platform: 'twitch' | 'vk';
}

const RewardCard: React.FC<RewardCardProps> = ({ reward, platform, onEdit, onRefresh }) => {
    const [deleting, setDeleting] = useState<boolean>(false);
    const [toggling, setToggling] = useState<boolean>(false);

    const handleDelete = async (): Promise<void> => {
        if (!confirm('Вы уверены, что хотите удалить эту награду?')) return;

        setDeleting(true);
        try {
            if (platform === 'vk' && reward.is_enabled) {
                try {
                    logger.log(`[REFRESH] [DELETE] Attempting to disable VK reward ${reward.id} before deletion`);
                    await pointsApi.toggleReward(platform, String(reward.id), false);
                    await new Promise(resolve => setTimeout(resolve, 800));
                } catch (toggleErr) {
                    logger.warn('Toggle before delete failed (backend will handle it):', toggleErr);
                }
            }

            await pointsApi.deleteReward(platform, String(reward.id));
            toast.success('Награда удалена');
            onRefresh();
        } catch (err) {
            logger.error('Error deleting reward:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка удаления награды';
            toast.error(errorMessage);
        } finally {
            setDeleting(false);
        }
    };

    const handleToggle = async (): Promise<void> => {
        if (platform !== 'vk') return;

        setToggling(true);
        const newState = !reward.is_enabled;

        try {
            await pointsApi.toggleReward(platform, String(reward.id), newState);
            await onRefresh();
        } catch (err: unknown) {
            logger.error('Error toggling reward:', err);
        } finally {
            setToggling(false);
        }
    };

    const bgColor = reward.background_color || (platform === 'vk' ? PLATFORM_COLORS.VK_LIVE : PLATFORM_COLORS.TWITCH);

    return (
        <Card className="transition-all hover:ring-2 hover:ring-primary">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-1 line-clamp-2">{reward.title || reward.name}</h3>
                        {platform === 'vk' && (
                            <Badge variant={reward.is_enabled ? 'default' : 'secondary'} className="text-xs">
                                {reward.is_enabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </Badge>
                        )}
                    </div>
                    <div
                        className="font-mono text-xl font-extrabold flex-shrink-0 px-4 py-2 rounded-lg"
                        style={{
                            backgroundColor: `${bgColor}25`,
                            color: bgColor,
                        }}
                    >
                        {reward.cost || reward.price || 0}
                    </div>
                </div>

                {reward.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {reward.description}
                    </p>
                )}

                <div className="flex gap-2 pt-3 border-t border-border">
                    <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 h-9">
                        <Edit className="w-4 h-4 mr-2" />
                        Изменить
                    </Button>

                    {platform === 'vk' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggle}
                            disabled={toggling}
                            className="flex-1 h-9"
                        >
                            {toggling ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : reward.is_enabled ? (
                                <>
                                    <PowerOff className="w-4 h-4 mr-2" />
                                    Выкл
                                </>
                            ) : (
                                <>
                                    <Power className="w-4 h-4 mr-2" />
                                    Вкл
                                </>
                            )}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-shrink-0 h-9 px-3 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                        {deleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

const RewardDialog: React.FC<RewardDialogProps> = ({ open, onClose, reward, platform, channelName, onSuccess }) => {
    const [formData, setFormData] = useState<RewardFormData>({
        title: '',
        description: '',
        cost: 100,
        repair_timeout: 0,
        max_uses_count: 0,
        max_uses_count_per_user: 0,
        is_message_required: false,
        global_cooldown_seconds: 0,
        max_per_stream: 0,
        max_per_user_per_stream: 0,
        should_redemptions_skip_request_queue: false
    });
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        if (reward) {
            setFormData({
                title: reward.title || reward.name || '',
                description: reward.description || reward.prompt || '',
                cost: reward.cost || reward.price || 100,
                repair_timeout: reward.repair_timeout || 0,
                max_uses_count: reward.max_uses_count || 0,
                max_uses_count_per_user: reward.max_uses_count_per_user || 0,
                is_message_required: reward.is_message_required || false,
                global_cooldown_seconds: reward.global_cooldown?.seconds || reward.global_cooldown_seconds || 0,
                max_per_stream: reward.max_per_stream || 0,
                max_per_user_per_stream: reward.max_per_user_per_stream || 0,
                should_redemptions_skip_request_queue: reward.should_redemptions_skip_request_queue || false
            });
        } else {
            setFormData({
                title: '',
                description: '',
                cost: 100,
                repair_timeout: 0,
                max_uses_count: 0,
                max_uses_count_per_user: 0,
                is_message_required: false,
                global_cooldown_seconds: 0,
                max_per_stream: 0,
                max_per_user_per_stream: 0,
                should_redemptions_skip_request_queue: false
            });
        }
    }, [reward, platform]);

    const handleSubmit = async (): Promise<void> => {
        if (!formData.title.trim()) {
            toast.error('Введите название награды');
            return;
        }

        setSaving(true);
        try {
            const baseData = {
                title: formData.title,
                description: formData.description,
                cost: parseInt(String(formData.cost)),
                is_user_input_required: formData.is_message_required,
                platform: platform,
                channel_name: channelName || ''
            };

            let rewardData: Record<string, unknown> = { ...baseData };

            if (platform === 'vk') {
                rewardData = {
                    ...rewardData,
                    repair_timeout: parseInt(String(formData.repair_timeout)) || 0,
                    max_uses_count: parseInt(String(formData.max_uses_count)) || 0,
                    max_uses_count_per_user: parseInt(String(formData.max_uses_count_per_user)) || 0,
                    is_message_required: formData.is_message_required
                };
            }

            if (platform === 'twitch') {
                rewardData = {
                    ...rewardData,
                    global_cooldown_seconds: parseInt(String(formData.global_cooldown_seconds)) || 0,
                    max_per_stream: parseInt(String(formData.max_per_stream)) || 0,
                    max_per_user_per_stream: parseInt(String(formData.max_per_user_per_stream)) || 0,
                    should_redemptions_skip_request_queue: formData.should_redemptions_skip_request_queue,
                    is_enabled: true
                };
            }

            if (reward) {
                await pointsApi.updateReward(platform, String(reward.id), rewardData);
                toast.success('Награда обновлена');
            } else {
                await pointsApi.createReward(platform, rewardData);
                toast.success('Награда создана');
            }

            onSuccess();
        } catch (err: unknown) {
            logger.error('Error saving reward:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{reward ? 'Редактировать награду' : 'Создать награду'}</DialogTitle>
                    <DialogDescription>
                        {reward ? 'Измените параметры награды' : 'Заполните параметры новой награды'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="title" className="text-sm">Название</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Например: Подписка"
                            className="h-9"
                        />
                    </div>

                    <div>
                        <Label htmlFor="description" className="text-sm">Описание (опционально)</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Что делает эта награда или зачем её покупать?"
                            rows={2}
                            className="text-sm resize-none"
                        />
                    </div>

                    <div>
                        <Label htmlFor="cost" className="text-sm">Стоимость</Label>
                        <Input
                            id="cost"
                            type="number"
                            min="1"
                            value={formData.cost}
                            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                            className="h-9"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {platform === 'twitch' ? 'Channel Points' : 'Баллы VK Live'}
                        </p>
                    </div>

                    {platform === 'vk' && (
                        <>
                            <div>
                                <Label htmlFor="repair_timeout" className="text-sm">Таймаут (секунды)</Label>
                                <Input
                                    id="repair_timeout"
                                    type="number"
                                    min="0"
                                    value={formData.repair_timeout}
                                    onChange={(e) => setFormData({ ...formData, repair_timeout: e.target.value })}
                                    className="h-9"
                                    placeholder="0 = без таймаута"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Время до повторного использования награды (0 = без таймаута)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="max_uses_count" className="text-sm">Макс. использований</Label>
                                    <Input
                                        id="max_uses_count"
                                        type="number"
                                        min="0"
                                        value={formData.max_uses_count}
                                        onChange={(e) => setFormData({ ...formData, max_uses_count: e.target.value })}
                                        className="h-9"
                                        placeholder="0 = без лимита"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Всего (0 = без лимита)
                                    </p>
                                </div>

                                <div>
                                    <Label htmlFor="max_uses_count_per_user" className="text-sm">Макс. на зрителя</Label>
                                    <Input
                                        id="max_uses_count_per_user"
                                        type="number"
                                        min="0"
                                        value={formData.max_uses_count_per_user}
                                        onChange={(e) => setFormData({ ...formData, max_uses_count_per_user: e.target.value })}
                                        className="h-9"
                                        placeholder="0 = без лимита"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        На 1 зрителя (0 = без лимита)
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_message_required"
                                    type="checkbox"
                                    checked={formData.is_message_required}
                                    onChange={(e) => setFormData({ ...formData, is_message_required: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <Label htmlFor="is_message_required" className="text-sm cursor-pointer">
                                    Требуется сообщение от пользователя
                                </Label>
                            </div>
                        </>
                    )}

                    {platform === 'twitch' && (
                        <>
                            <div>
                                <Label htmlFor="global_cooldown_seconds" className="text-sm">Глобальный кулдаун (сек)</Label>
                                <Input
                                    id="global_cooldown_seconds"
                                    type="number"
                                    min="0"
                                    value={formData.global_cooldown_seconds}
                                    onChange={(e) => setFormData({ ...formData, global_cooldown_seconds: e.target.value })}
                                    className="h-9"
                                    placeholder="0 = без кулдауна"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Время, после которого награда снова станет доступна (0 = без кулдауна)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="max_per_stream" className="text-sm">Макс. за стрим</Label>
                                    <Input
                                        id="max_per_stream"
                                        type="number"
                                        min="0"
                                        value={formData.max_per_stream}
                                        onChange={(e) => setFormData({ ...formData, max_per_stream: e.target.value })}
                                        className="h-9"
                                        placeholder="0 = без лимита"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Всего за стрим (0 = без лимита)
                                    </p>
                                </div>

                                <div>
                                    <Label htmlFor="max_per_user_per_stream" className="text-sm">Макс. на зрителя за стрим</Label>
                                    <Input
                                        id="max_per_user_per_stream"
                                        type="number"
                                        min="0"
                                        value={formData.max_per_user_per_stream}
                                        onChange={(e) => setFormData({ ...formData, max_per_user_per_stream: e.target.value })}
                                        className="h-9"
                                        placeholder="0 = без лимита"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        На 1 зрителя за стрим (0 = без лимита)
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="should_redemptions_skip_request_queue"
                                    type="checkbox"
                                    checked={formData.should_redemptions_skip_request_queue}
                                    onChange={(e) => setFormData({ ...formData, should_redemptions_skip_request_queue: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <Label htmlFor="should_redemptions_skip_request_queue" className="text-sm cursor-pointer">
                                    Автоматически выполнять (без очереди)
                                </Label>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Отмена
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {reward ? 'Сохранить' : 'Создать'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Типы для API ответов
interface RewardsResponse {
    rewards?: PlatformReward[];
}

interface DemandsResponse {
    demands?: RewardDemand[] | {
        items?: RewardDemand[];
        demands?: RewardDemand[];
        [key: string]: unknown;
    };
}

const RedemptionQueue: React.FC<RedemptionQueueProps> = ({ platform }) => {
    const [redemptions, setRedemptions] = useState<RewardDemand[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [processing, setProcessing] = useState<Set<string>>(new Set());
    const [rewardsMap, setRewardsMap] = useState<Map<string, PlatformReward>>(new Map());
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [filterType, setFilterType] = useState<'all' | 'tts' | 'other'>('all');

    const loadRedemptions = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            if (platform === 'vk') {
                const rewardsData = await pointsApi.getRewards('vk') as RewardsResponse;
                const map = new Map<string, PlatformReward>();
                if (rewardsData.rewards) {
                    rewardsData.rewards.forEach((reward: PlatformReward) => {
                        map.set(String(reward.id), reward);
                    });
                }
                setRewardsMap(map);

                const data = await pointsApi.getVKDemands() as DemandsResponse;

                let demands: RewardDemand[] = [];
                if (Array.isArray(data.demands)) {
                    demands = data.demands;
                } else if (data.demands && typeof data.demands === 'object') {
                    const demandsObj = data.demands as { items?: RewardDemand[]; demands?: RewardDemand[] };
                    if (demandsObj.items && Array.isArray(demandsObj.items)) {
                        demands = demandsObj.items;
                    } else if (demandsObj.demands && Array.isArray(demandsObj.demands)) {
                        demands = demandsObj.demands;
                    } else {
                        const values = Object.values(data.demands);
                        if (values.length === 1 && Array.isArray(values[0])) {
                            demands = values[0] as RewardDemand[];
                        } else {
                            demands = values as RewardDemand[];
                        }
                    }
                }

                setRedemptions(demands);
            } else {
                setRedemptions([]);
            }
        } catch (err) {
            logger.error('Error loading redemptions:', err);
            toast.error('Не удалось загрузить награды');
            setRedemptions([]);
        } finally {
            setLoading(false);
        }
    }, [platform]);

    useEffect(() => {
        loadRedemptions();
    }, [loadRedemptions]);

    const handleAccept = async (redemptionId: string): Promise<void> => {
        setProcessing(prev => new Set(prev).add(redemptionId));
        try {
            await pointsApi.processVKDemands('accept', [redemptionId]);
            toast.success('Награда принята');
            setRedemptions(prev => prev.filter(d => d.id !== redemptionId));
            setSelectedItems(prev => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        } catch (err: unknown) {
            logger.error('Error accepting redemption:', err);
            toast.error('Ошибка принятия награды');
        } finally {
            setProcessing(prev => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        }
    };

    const handleReject = async (redemptionId: string): Promise<void> => {
        setProcessing(prev => new Set(prev).add(redemptionId));
        try {
            await pointsApi.processVKDemands('reject', [redemptionId]);
            toast.success('Награда отклонена');
            setRedemptions(prev => prev.filter(d => d.id !== redemptionId));
            setSelectedItems(prev => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        } catch (err: unknown) {
            logger.error('Error rejecting redemption:', err);
            toast.error('Ошибка отклонения награды');
        } finally {
            setProcessing(prev => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        }
    };

    const handleBulkAccept = async (): Promise<void> => {
        if (selectedItems.size === 0) return;

        const ids = Array.from(selectedItems);
        setProcessing(prev => new Set([...prev, ...ids]));
        try {
            await pointsApi.processVKDemands('accept', ids);
            toast.success(`Принято наград: ${ids.length}`);
            setRedemptions(prev => prev.filter(d => !ids.includes(d.id)));
            setSelectedItems(new Set());
        } catch (err: unknown) {
            logger.error('Error bulk accepting:', err);
            toast.error('Ошибка принятия наград');
        } finally {
            setProcessing(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
        }
    };

    const handleBulkReject = async (): Promise<void> => {
        if (selectedItems.size === 0) return;

        const ids = Array.from(selectedItems);
        setProcessing(prev => new Set([...prev, ...ids]));
        try {
            await pointsApi.processVKDemands('reject', ids);
            toast.success(`Отклонено наград: ${ids.length}`);
            setRedemptions(prev => prev.filter(d => !ids.includes(d.id)));
            setSelectedItems(new Set());
        } catch (err: unknown) {
            logger.error('Error bulk rejecting:', err);
            toast.error('Ошибка отклонения наград');
        } finally {
            setProcessing(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
        }
    };

    const filteredRedemptions = redemptions.filter((demand) => {
        if (filterType === 'all') return true;

        const rewardData = rewardsMap.get(demand.reward?.id || '');
        const rewardTitle = (rewardData?.name || rewardData?.title || '').toLowerCase();

        if (filterType === 'tts') {
            return rewardTitle.includes('голос') || rewardTitle.includes('tts') || rewardTitle.includes('озвучка');
        } else {
            return !rewardTitle.includes('голос') && !rewardTitle.includes('tts') && !rewardTitle.includes('озвучка');
        }
    });

    if (loading) {
        return (
            <div className="flex justify-center py-12 min-h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (redemptions.length === 0) {
        return (
            <div className="min-h-[400px]">
                <Card>
                    <CardContent className="py-12 text-center">
                        <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">
                            Нет активных запросов
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Когда зрители активируют награды, они появятся здесь
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-[400px] space-y-4">
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium whitespace-nowrap">Фильтр:</Label>
                                <Select value={filterType} onValueChange={(value) => setFilterType(value as 'all' | 'tts' | 'other')}>
                                    <SelectTrigger className="w-[160px] h-9">
                                        <SelectValue placeholder="Выберите фильтр" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Все награды</SelectItem>
                                        <SelectItem value="tts">TTS награды</SelectItem>
                                        <SelectItem value="other">Прочие</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {filteredRedemptions.length > 0 && (
                                <>
                                    <div className="h-6 w-px bg-gray-700" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                                            Найдено: <span className="font-semibold text-foreground">{filteredRedemptions.length}</span>
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                const allSelected = filteredRedemptions.every(d => selectedItems.has(d.id));
                                                if (allSelected) {
                                                    setSelectedItems(new Set());
                                                } else {
                                                    setSelectedItems(new Set(filteredRedemptions.map(d => d.id)));
                                                }
                                            }}
                                            className="whitespace-nowrap"
                                        >
                                            {filteredRedemptions.every(d => selectedItems.has(d.id)) ? 'Снять все' : 'Выбрать все'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>

                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                                    <span className="text-sm font-medium text-primary">Выбрано: {selectedItems.size}</span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={handleBulkAccept}
                                    disabled={Array.from(selectedItems).some(id => processing.has(id))}
                                    className="whitespace-nowrap"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    Принять ({selectedItems.size})
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={handleBulkReject}
                                    disabled={Array.from(selectedItems).some(id => processing.has(id))}
                                    className="whitespace-nowrap"
                                >
                                    <XCircle className="w-4 h-4 mr-1.5" />
                                    Отклонить ({selectedItems.size})
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {Array.isArray(filteredRedemptions) && filteredRedemptions.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">
                            Нет запросов по выбранному фильтру
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredRedemptions.map((demand, index) => {
                        const rewardData = rewardsMap.get(demand.reward?.id || '');
                        const rewardTitle = rewardData?.name || rewardData?.title || 'Неизвестная награда';
                        const rewardCost = rewardData?.price || rewardData?.cost || 0;
                        const isTtsReward = rewardTitle.toLowerCase().includes('голос') || rewardTitle.toLowerCase().includes('tts') || rewardTitle.toLowerCase().includes('озвучка');

                        let message = '';
                        if (Array.isArray(demand.message_parts) && demand.message_parts.length > 0) {
                            message = demand.message_parts.map(part => {
                                if (typeof part === 'string') return part;
                                if (typeof part === 'object' && part !== null) {
                                    const p = part as { text?: { content: string }; mention?: { nick: string }; link?: { content: string }; smile?: { name: string }; content?: string };
                                    if (p.text?.content) return p.text.content;
                                    if (p.mention?.nick) return `@${p.mention.nick}`;
                                    if (p.link?.content) return p.link.content;
                                    if (p.smile?.name) return p.smile.name;
                                    if (p.content) return p.content;
                                    return JSON.stringify(part);
                                }
                                return String(part);
                            }).join(' ').trim();
                        } else if (typeof demand.message === 'string') {
                            message = demand.message;
                        } else if (demand.message && typeof demand.message === 'object') {
                            const msg = demand.message as { text?: string; content?: string };
                            message = msg.text || msg.content || JSON.stringify(demand.message);
                        }

                        const isSelected = selectedItems.has(demand.id);
                        const isProcessing = processing.has(demand.id);
                        const userName = demand.user?.nick || demand.user?.name || 'Пользователь';
                        const timestamp = demand.created_at ? new Date(typeof demand.created_at === 'number' ? demand.created_at * 1000 : new Date(demand.created_at).getTime()).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        }) : 'Неизвестно';

                        return (
                            <Card
                                key={demand.id || index}
                                className={`transition-all hover:shadow-lg ${isSelected ? 'ring-2 ring-primary border-primary/50' : 'border-gray-700/50'} ${isProcessing ? 'opacity-60' : ''}`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    setSelectedItems(prev => {
                                                        const next = new Set(prev);
                                                        if (e.target.checked) {
                                                            next.add(demand.id);
                                                        } else {
                                                            next.delete(demand.id);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                disabled={isProcessing}
                                                className="w-4 h-4 rounded border-gray-600 bg-background cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-primary"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                                                            <span className="text-xs font-bold text-primary">
                                                                {(userName[0] || 'U').toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <span className="font-semibold text-sm truncate">{userName}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                <Badge
                                                    variant={isTtsReward ? "default" : "outline"}
                                                    className={`text-xs font-medium ${isTtsReward ? 'bg-purple-600/20 text-purple-300 border-purple-600/30' : 'bg-gray-800/50'}`}
                                                >
                                                    {rewardTitle}
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs font-mono bg-blue-600/20 text-blue-300 border-blue-600/30">
                                                    {rewardCost} баллов
                                                </Badge>
                                            </div>

                                            {message && (
                                                <div className="mb-3 p-3 rounded-md bg-gray-800/50 border border-gray-700/50">
                                                    <div className="flex items-start gap-2">
                                                        <MessageCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                        <p className="text-sm text-foreground break-words flex-1 leading-relaxed">
                                                            {message}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{timestamp}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 flex-shrink-0">
                                            <Button
                                                size="sm"
                                                variant="default"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAccept(demand.id);
                                                }}
                                                disabled={isProcessing}
                                                className="min-w-[100px] h-9"
                                            >
                                                {isProcessing ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                                        Принять
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReject(demand.id);
                                                }}
                                                disabled={isProcessing}
                                                className="min-w-[100px] h-9"
                                            >
                                                <XCircle className="w-4 h-4 mr-1.5" />
                                                Отклонить
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const PointsManagementPage: React.FC = () => {
    // useAuth unused
    const { integrations } = useIntegrations();

    // Если нет прав или не авторизован то сразу return
    const [selectedPlatform, setSelectedPlatform] = useState<'twitch' | 'vk'>('twitch');
    const [activeTab, setActiveTab] = useState<'rewards' | 'queue'>('rewards');
    const [rewards, setRewards] = useState<PlatformReward[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
    const [editingReward, setEditingReward] = useState<PlatformReward | null>(null);

    const twitchEnabled = integrations?.twitch?.enabled || false;
    const vkEnabled = integrations?.vk?.enabled || false;

    useEffect(() => {
        if (twitchEnabled && selectedPlatform === 'twitch') {
            return;
        } else if (vkEnabled && selectedPlatform === 'vk') {
            return;
        } else if (twitchEnabled) {
            setSelectedPlatform('twitch');
        } else if (vkEnabled) {
            setSelectedPlatform('vk');
        }
    }, [twitchEnabled, vkEnabled, selectedPlatform]);

    const loadRewards = async (showLoader: boolean = true): Promise<void> => {
        try {
            if (showLoader) {
                setLoading(true);
            }
            const data = await pointsApi.getRewards(selectedPlatform) as RewardsResponse;

            const sortedRewards = (data.rewards || []).sort((a: PlatformReward, b: PlatformReward) => {
                if (a.is_enabled === b.is_enabled) return 0;
                return a.is_enabled ? -1 : 1;
            });

            setRewards(sortedRewards);
        } catch (err) {
            logger.error('Error loading rewards:', err);
            const apiError = err as { message?: string; status?: number };
            const errorMessage = apiError.message || 'Неизвестная ошибка';

            if (apiError.status === 404) {
                toast.error('Настройки не загружены. Попробуйте снова позднее', { duration: 5000 });
            } else if (apiError.status === 403 || errorMessage.includes('партнёр или аффилейт') || errorMessage.includes('partner or affiliate')) {
                toast.error('Аккаунт Twitch должен быть подключен для партнёров и аффилейтов', { duration: 5000 });
            } else {
                toast.error('Настройки не загружены. Попробуйте снова позднее', { duration: 5000 });
            }
            setRewards([]);
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        loadRewards(true);
    }, [selectedPlatform]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Загрузка данных...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between border-b border-border">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('rewards')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'rewards'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Награды
                        </button>
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'queue'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Очередь запросов
                        </button>
                    </div>

                    {(twitchEnabled || vkEnabled) && (
                        <div className="flex bg-muted rounded-lg p-1">
                            {twitchEnabled && (
                                <Button
                                    variant={selectedPlatform === 'twitch' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setSelectedPlatform('twitch')}
                                    className={`gap-1.5 h-8 ${selectedPlatform === 'twitch'
                                        ? 'bg-[#9146FF] text-white hover:bg-[#7d3cff]'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    <TwitchIcon className="w-3.5 h-3.5" />
                                    Twitch
                                </Button>
                            )}
                            {vkEnabled && (
                                <Button
                                    variant={selectedPlatform === 'vk' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setSelectedPlatform('vk')}
                                    className={`gap-1.5 h-8 ${selectedPlatform === 'vk'
                                        ? 'bg-[#FF4444] text-white hover:bg-[#e03a3a]'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    <VKIcon className="w-3.5 h-3.5" />
                                    VK Live
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="min-h-[400px]">
                <div className="mb-6 h-10">
                    {activeTab === 'rewards' && (
                        <Button onClick={() => setShowCreateDialog(true)} className="w-full h-10" variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            Создать награду
                        </Button>
                    )}
                </div>

                <div>
                    {activeTab === 'rewards' ? (
                        <div>
                            {rewards.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                                        <p className="text-sm text-muted-foreground font-medium">Нет наград</p>
                                        <p className="text-xs text-muted-foreground mt-1">Создайте первую награду для зрителей!</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {rewards.map((reward) => (
                                        <RewardCard
                                            key={reward.id}
                                            reward={reward}
                                            platform={selectedPlatform}
                                            onEdit={() => setEditingReward(reward)}
                                            onRefresh={() => loadRewards(false)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <RedemptionQueue platform={selectedPlatform} />
                    )}
                </div>
            </div>

            <RewardDialog
                open={showCreateDialog || !!editingReward}
                onClose={() => {
                    setShowCreateDialog(false);
                    setEditingReward(null);
                }}
                reward={editingReward}
                platform={selectedPlatform}
                channelName={selectedPlatform === 'vk' ? integrations.vk?.username : integrations.twitch?.username}
                onSuccess={() => {
                    setShowCreateDialog(false);
                    setEditingReward(null);
                    loadRewards(false);
                }}
            />
        </div>
    );
};

export default PointsManagementPage;
