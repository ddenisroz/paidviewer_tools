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

export const RewardFormDialog: React.FC<RewardFormDialogProps> = ({
  open,
  onClose,
  reward,
  platform,
  onSuccess,
}) => {
  const [saving, setSaving] = React.useState(false);
  const [key, setKey] = React.useState(0);

  // Reset form when dialog opens/closes or reward changes
  useEffect(() => {
    if (open) {
      setKey(prev => prev + 1);
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
        label: '��������',
        type: 'text',
        placeholder: '��������: �����������',
      },
      {
        name: 'description',
        label: '�������� (�����������)',
        type: 'textarea',
        placeholder: '��� ������� ������� �� ��� �������?',
        rows: 2,
      },
      {
        name: 'cost',
        label: '���������',
        type: 'number',
        min: 1,
        description: platform === 'twitch' ? 'Channel Points' : '����� VK Live',
      },
    ];

    if (platform === 'vk') {
      return [
        ...commonFields,
        {
          name: 'repair_timeout',
          label: '������� (�������)',
          type: 'number',
          min: 0,
          placeholder: '0 = ��� ��������',
          description: '����� �������������� ������� (0 = ��� �����������)',
        },
        {
          name: 'max_uses_count',
          label: '����. �������������',
          type: 'number',
          min: 0,
          placeholder: '0 = ��� ������',
          description: '����� (0 = ?)',
        },
        {
          name: 'max_uses_count_per_user',
          label: '����. �� �����',
          type: 'number',
          min: 0,
          placeholder: '0 = ��� ������',
          description: '�� 1 �������� (0 = ?)',
        },
        {
          name: 'is_message_required',
          label: '��������� ��������� �� �������',
          type: 'checkbox',
        },
      ];
    }

    // Twitch fields
    return [
      ...commonFields,
      {
        name: 'global_cooldown_seconds',
        label: '���������� ������� (�������)',
        type: 'number',
        min: 0,
        placeholder: '0 = ��� ��������',
        description: '����� ����� ��������������� ������� ����� ���������',
      },
      {
        name: 'max_per_stream',
        label: '����. �� �����',
        type: 'number',
        min: 0,
        placeholder: '0 = ��� ������',
        description: '����� (0 = ?)',
      },
      {
        name: 'max_per_user_per_stream',
        label: '����. �� ����� �� �����',
        type: 'number',
        min: 0,
        placeholder: '0 = ��� ������',
        description: '�� 1 �������� (0 = ?)',
      },
      {
        name: 'should_redemptions_skip_request_queue',
        label: '���������� ������� ���������',
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
        platform: platform,
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
        toast.success('������� ���������');
      } else {
        await pointsApi.createReward(platform, rewardData);
        toast.success('������� �������');
      }

      onSuccess();
      onClose();
    } catch (err) {
      logger.error('Error saving reward:', err);
      const errorMessage = err instanceof Error ? err.message : '������ ���������� �������';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reward ? '������������� �������' : '������� �������'}</DialogTitle>
          <DialogDescription>
            {reward ? '�������� ��������� �������' : '������� ��������� ����� �������'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <FormBuilder
            key={key}
            schema={rewardSchema}
            fields={fields}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            submitLabel={reward ? '���������' : '�������'}
            cancelLabel="������"
            onCancel={onClose}
            showCancelButton
            loading={saving}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
