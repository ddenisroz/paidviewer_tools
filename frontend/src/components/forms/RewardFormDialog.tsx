import React, { useEffect, useMemo } from 'react';

import { z } from 'zod';

import pointsApi from '@/services/pointsApi';
import { type FieldConfig, FormBuilder } from '@/shared/components';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { logger } from '@/utils/prodLogger';
import { toast } from '@/utils/toastManager';
import { rewardSchema } from '@/utils/validationSchemas';

import type { PlatformReward } from '@/types/points';

type RewardFormData = z.infer<typeof rewardSchema>;

interface RewardFormDialogProps {
    open: boolean;
    onClose: () => void;
    reward: PlatformReward | null;
    platform: 'twitch' | 'vk';
    onSuccess: () => void;
}

export const RewardFormDialog: React.FC<RewardFormDialogProps> = ({ open, onClose, reward, platform, onSuccess }) => {
    const [saving, setSaving] = React.useState(false);
    const [key, setKey] = React.useState(0);

    useEffect(() => {
        if (open) {
            setKey((prev) => prev + 1);
        }
    }, [open, reward]);

    const defaultValues = useMemo(() => {
        if (reward) {
            return {
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
                should_redemptions_skip_request_queue: reward.should_redemptions_skip_request_queue || false,
            };
        }
        return {
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
    }, [reward]);

    const fields = useMemo((): FieldConfig<RewardFormData>[] => {
        const commonFields: FieldConfig<RewardFormData>[] = [
            {
                name: 'title',
                label: 'Название',
                type: 'text',
                placeholder: 'Например: выбрать испытание',
            },
            {
                name: 'description',
                label: 'Описание',
                type: 'textarea',
                placeholder: 'Что произойдет после активации?',
                rows: 2,
            },
            {
                name: 'cost',
                label: 'Стоимость',
                type: 'number',
                min: 1,
                description: platform === 'twitch' ? 'Channel Points' : 'Баллы VK Live',
            },
        ];

        if (platform === 'vk') {
            return [
                ...commonFields,
                {
                    name: 'repair_timeout',
                    label: 'Кулдаун',
                    type: 'number',
                    min: 0,
                    placeholder: '0 = без ограничений',
                    description: 'Секунды до повторной покупки',
                },
                {
                    name: 'max_uses_count',
                    label: 'Лимит активаций',
                    type: 'number',
                    min: 0,
                    placeholder: '0 = без лимита',
                    description: 'Общий лимит награды',
                },
                {
                    name: 'max_uses_count_per_user',
                    label: 'Лимит на зрителя',
                    type: 'number',
                    min: 0,
                    placeholder: '0 = без лимита',
                    description: 'Сколько раз один зритель может купить награду',
                },
                {
                    name: 'is_message_required',
                    label: 'Требовать сообщение',
                    type: 'checkbox',
                },
            ];
        }

        return [
            ...commonFields,
            {
                name: 'global_cooldown_seconds',
                label: 'Глобальный кулдаун',
                type: 'number',
                min: 0,
                placeholder: '0 = без ограничений',
                description: 'Секунды до следующей активации',
            },
            {
                name: 'max_per_stream',
                label: 'Лимит за стрим',
                type: 'number',
                min: 0,
                placeholder: '0 = без лимита',
                description: 'Общий лимит на один стрим',
            },
            {
                name: 'max_per_user_per_stream',
                label: 'Лимит на зрителя',
                type: 'number',
                min: 0,
                placeholder: '0 = без лимита',
                description: 'Сколько раз один зритель может активировать награду за стрим',
            },
            {
                name: 'should_redemptions_skip_request_queue',
                label: 'Пропускать очередь запросов',
                type: 'checkbox',
            },
        ];
    }, [platform]);

    const onSubmit = async (data: RewardFormData) => {
        setSaving(true);
        try {
            let rewardData: Record<string, unknown> = {
                title: data.title,
                description: data.description,
                cost: data.cost,
                is_user_input_required: data.is_message_required,
                platform,
                channel_name: '',
            };

            if (platform === 'vk') {
                rewardData = {
                    ...rewardData,
                    repair_timeout: data.repair_timeout,
                    max_uses_count: data.max_uses_count,
                    max_uses_count_per_user: data.max_uses_count_per_user,
                    is_message_required: data.is_message_required,
                };
            }

            if (platform === 'twitch') {
                rewardData = {
                    ...rewardData,
                    global_cooldown_seconds: data.global_cooldown_seconds,
                    max_per_stream: data.max_per_stream,
                    max_per_user_per_stream: data.max_per_user_per_stream,
                    should_redemptions_skip_request_queue: data.should_redemptions_skip_request_queue,
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
            onClose();
        } catch (err) {
            logger.error('Error saving reward:', err);
            const errorMessage = err instanceof Error ? err.message : 'Не удалось сохранить награду';
            toast.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{reward ? 'Редактирование награды' : 'Создание награды'}</DialogTitle>
                    <DialogDescription>
                        {platform === 'twitch' ? 'Twitch Channel Points' : 'VK Live баллы'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    <FormBuilder
                        key={key}
                        schema={rewardSchema}
                        fields={fields}
                        defaultValues={defaultValues}
                        onSubmit={onSubmit}
                        submitLabel={reward ? 'Сохранить' : 'Создать'}
                        cancelLabel="Отмена"
                        onCancel={onClose}
                        showCancelButton
                        loading={saving}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};
