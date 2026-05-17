import React, { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { ADMIN_ACTION_BUTTON_CLASS, AdminPageHeader } from '@/features/admin/components/admin-ui';
import {
    BlockChannelCard,
    ChannelsLists,
    ChannelStatsGrid,
} from '@/features/admin/components/ops-center/ChannelsSections';
import { queryKeys } from '@/queries/queryKeys';
import { adminService } from '@/services/api/services/adminService';
import { Button } from '@/shared/components/ui/button';
import { toast } from '@/utils/toastManager';

import type { ChannelsPayload } from '@/features/admin/types/adminReadModels';

const AdminChannelsOpsScreen: React.FC = () => {
    const [channelName, setChannelName] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { data, isLoading, isFetching, refetch } = useQuery<ChannelsPayload>({
        queryKey: queryKeys.admin.channelsOverview(),
        queryFn: async () => {
            const response = await adminService.getChannelsOverview();
            const payload = response.data as { data?: ChannelsPayload };
            return payload.data ?? {};
        },
        refetchInterval: 20_000,
        refetchOnWindowFocus: false,
    });

    const activeChannels = useMemo(() => (data?.active_channels ?? []).slice(0, 8), [data?.active_channels]);

    const handleBlockChannel = async (): Promise<void> => {
        if (!channelName.trim()) {
            toast.error('Введите имя канала');
            return;
        }

        try {
            setIsSubmitting(true);
            await adminService.blockChannel({ channel_name: channelName.trim(), reason: reason.trim() || undefined });
            toast.success(`Канал ${channelName.trim()} заблокирован`);
            setChannelName('');
            setReason('');
            await refetch();
        } catch {
            toast.error('Не удалось заблокировать канал');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnblockChannel = async (channelId: number): Promise<void> => {
        try {
            await adminService.unblockChannel(channelId);
            toast.success('Канал разблокирован');
            await refetch();
        } catch {
            toast.error('Не удалось разблокировать канал');
        }
    };

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
                Загрузка каналов...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Channels"
                description="Контроль активных каналов и ручная блокировка проблемных площадок."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        className={ADMIN_ACTION_BUTTON_CLASS}
                        onClick={() => void refetch()}
                        disabled={isFetching}
                    >
                        {isFetching ? 'Обновляю...' : 'Обновить'}
                    </Button>
                }
            />
            <ChannelStatsGrid counts={data?.counts} />
            <BlockChannelCard
                channelName={channelName}
                reason={reason}
                isSubmitting={isSubmitting}
                onChannelNameChange={setChannelName}
                onReasonChange={setReason}
                onSubmit={() => void handleBlockChannel()}
            />
            <ChannelsLists
                activeChannels={activeChannels}
                blockedChannels={data?.blocked_channels ?? []}
                onUnblock={(channelId) => void handleUnblockChannel(channelId)}
            />
        </div>
    );
};

export default AdminChannelsOpsScreen;
