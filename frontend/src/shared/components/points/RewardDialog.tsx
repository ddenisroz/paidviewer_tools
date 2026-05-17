import React, { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import pointsApi from '@/services/pointsApi';
import { Button } from '@/shared/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { PlatformReward } from '@/types/points';

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

interface RewardDialogProps {
    open: boolean;
    onClose: () => void;
    reward: PlatformReward | null;
    platform: 'twitch' | 'vk';
    channelName?: string | null;
    onSuccess: () => void;
}

const DEFAULT_REWARD_FORM_DATA: RewardFormData = {
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
    should_redemptions_skip_request_queue: false,
};

const pickValue = <T,>(values: Array<T | null | undefined>, fallback: T): T => {
    for (const value of values) {
        if (value !== undefined && value !== null) return value;
    }
    return fallback;
};

const createInitialFormData = (reward: PlatformReward | null): RewardFormData => {
    if (!reward) return { ...DEFAULT_REWARD_FORM_DATA };

    return {
        title: pickValue([reward.title, reward.name], DEFAULT_REWARD_FORM_DATA.title),
        description: pickValue([reward.description, reward.prompt], DEFAULT_REWARD_FORM_DATA.description),
        cost: pickValue([reward.cost, reward.price], DEFAULT_REWARD_FORM_DATA.cost),
        repair_timeout: pickValue([reward.repair_timeout], DEFAULT_REWARD_FORM_DATA.repair_timeout),
        max_uses_count: pickValue([reward.max_uses_count], DEFAULT_REWARD_FORM_DATA.max_uses_count),
        max_uses_count_per_user: pickValue(
            [reward.max_uses_count_per_user],
            DEFAULT_REWARD_FORM_DATA.max_uses_count_per_user
        ),
        is_message_required: pickValue([reward.is_message_required], DEFAULT_REWARD_FORM_DATA.is_message_required),
        global_cooldown_seconds: pickValue(
            [reward.global_cooldown?.seconds, reward.global_cooldown_seconds],
            DEFAULT_REWARD_FORM_DATA.global_cooldown_seconds
        ),
        max_per_stream: pickValue([reward.max_per_stream], DEFAULT_REWARD_FORM_DATA.max_per_stream),
        max_per_user_per_stream: pickValue(
            [reward.max_per_user_per_stream],
            DEFAULT_REWARD_FORM_DATA.max_per_user_per_stream
        ),
        should_redemptions_skip_request_queue: pickValue(
            [reward.should_redemptions_skip_request_queue],
            DEFAULT_REWARD_FORM_DATA.should_redemptions_skip_request_queue
        ),
    };
};

const RewardDialog: React.FC<RewardDialogProps> = ({ open, onClose, reward, platform, channelName, onSuccess }) => {
    const [formData, setFormData] = useState<RewardFormData>(createInitialFormData(null));
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        setFormData(createInitialFormData(reward));
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
                platform,
                channel_name: channelName || '',
            };

            let rewardData: Record<string, unknown> = { ...baseData };

            if (platform === 'vk') {
                rewardData = {
                    ...rewardData,
                    repair_timeout: parseInt(String(formData.repair_timeout)) || 0,
                    max_uses_count: parseInt(String(formData.max_uses_count)) || 0,
                    max_uses_count_per_user: parseInt(String(formData.max_uses_count_per_user)) || 0,
                    is_message_required: formData.is_message_required,
                };
            }

            if (platform === 'twitch') {
                rewardData = {
                    ...rewardData,
                    global_cooldown_seconds: parseInt(String(formData.global_cooldown_seconds)) || 0,
                    max_per_stream: parseInt(String(formData.max_per_stream)) || 0,
                    max_per_user_per_stream: parseInt(String(formData.max_per_user_per_stream)) || 0,
                    should_redemptions_skip_request_queue: formData.should_redemptions_skip_request_queue,
                    is_enabled: true,
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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{reward ? 'Редактировать награду' : 'Создать награду'}</DialogTitle>
                    <DialogDescription>
                        {reward ? 'Измените параметры награды' : 'Заполните параметры новой награды'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="title" className="text-sm">
                            Название
                        </Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Например: Подписка"
                            className="h-9"
                        />
                    </div>

                    <div>
                        <Label htmlFor="description" className="text-sm">
                            Описание (опционально)
                        </Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Что делает эта награда или зачем ее покупать?"
                            rows={2}
                            className="text-sm resize-none"
                        />
                    </div>

                    <div>
                        <Label htmlFor="cost" className="text-sm">
                            Стоимость
                        </Label>
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
                                <Label htmlFor="repair_timeout" className="text-sm">
                                    Таймаут (секунды)
                                </Label>
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

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="max_uses_count" className="text-sm">
                                        Макс. использований
                                    </Label>
                                    <Input
                                        id="max_uses_count"
                                        type="number"
                                        min="0"
                                        value={formData.max_uses_count}
                                        onChange={(e) => setFormData({ ...formData, max_uses_count: e.target.value })}
                                        className="h-9"
                                        placeholder="0 = без лимита"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Всего (0 = без лимита)</p>
                                </div>

                                <div>
                                    <Label htmlFor="max_uses_count_per_user" className="text-sm">
                                        Макс. на зрителя
                                    </Label>
                                    <Input
                                        id="max_uses_count_per_user"
                                        type="number"
                                        min="0"
                                        value={formData.max_uses_count_per_user}
                                        onChange={(e) =>
                                            setFormData({ ...formData, max_uses_count_per_user: e.target.value })
                                        }
                                        className="h-9"
                                        placeholder="0 = без лимита"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">На 1 зрителя (0 = без лимита)</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_message_required"
                                    type="checkbox"
                                    checked={formData.is_message_required}
                                    onChange={(e) =>
                                        setFormData({ ...formData, is_message_required: e.target.checked })
                                    }
                                    className="w-4 h-4 rounded border-border"
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
                                <Label htmlFor="global_cooldown_seconds" className="text-sm">
                                    Глобальный кулдаун (сек)
                                </Label>
                                <Input
                                    id="global_cooldown_seconds"
                                    type="number"
                                    min="0"
                                    value={formData.global_cooldown_seconds}
                                    onChange={(e) =>
                                        setFormData({ ...formData, global_cooldown_seconds: e.target.value })
                                    }
                                    className="h-9"
                                    placeholder="0 = без кулдауна"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Время, после которого награда снова станет доступна (0 = без кулдауна)
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="max_per_stream" className="text-sm">
                                        Макс. за стрим
                                    </Label>
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
                                    <Label htmlFor="max_per_user_per_stream" className="text-sm">
                                        Макс. на зрителя за стрим
                                    </Label>
                                    <Input
                                        id="max_per_user_per_stream"
                                        type="number"
                                        min="0"
                                        value={formData.max_per_user_per_stream}
                                        onChange={(e) =>
                                            setFormData({ ...formData, max_per_user_per_stream: e.target.value })
                                        }
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
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            should_redemptions_skip_request_queue: e.target.checked,
                                        })
                                    }
                                    className="w-4 h-4 rounded border-border"
                                />
                                <Label
                                    htmlFor="should_redemptions_skip_request_queue"
                                    className="text-sm cursor-pointer"
                                >
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

export default RewardDialog;
