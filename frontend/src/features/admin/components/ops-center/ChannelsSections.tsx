import React from 'react';

import { Globe, Plus, ShieldAlert, Trash2 } from 'lucide-react';

import { ADMIN_CARD_CLASS, AdminEmptyState } from '@/features/admin/components/admin-ui';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';

import AdminMetricCard from './AdminMetricCard';

import type { ActiveChannel, BlockedChannel, ChannelsPayload } from '@/features/admin/types/adminReadModels';

export const ChannelStatsGrid: React.FC<{ counts: ChannelsPayload['counts'] }> = ({ counts }) => (
    <div className="grid gap-4 md:grid-cols-4">
        <AdminMetricCard title="Активные" value={counts?.active_total ?? 0} />
        <AdminMetricCard title="Twitch" value={counts?.active_twitch ?? 0} />
        <AdminMetricCard title="VK Live" value={counts?.active_vk ?? 0} />
        <AdminMetricCard title="Заблокировано" value={counts?.blocked_total ?? 0} />
    </div>
);

export const BlockChannelCard: React.FC<{
    channelName: string;
    reason: string;
    isSubmitting: boolean;
    onChannelNameChange: (value: string) => void;
    onReasonChange: (value: string) => void;
    onSubmit: () => void;
}> = ({ channelName, reason, isSubmitting, onChannelNameChange, onReasonChange, onSubmit }) => (
    <Card className={ADMIN_CARD_CLASS}>
        <CardHeader>
            <CardTitle className="text-base">Ручная блокировка</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
            <Input
                value={channelName}
                onChange={(event) => onChannelNameChange(event.target.value)}
                placeholder="Название канала"
            />
            <Textarea
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Причина блокировки (необязательно)"
                rows={3}
            />
            <div className="flex justify-end">
                <Button onClick={onSubmit} disabled={isSubmitting || !channelName.trim()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Сохраняю...' : 'Заблокировать'}
                </Button>
            </div>
        </CardContent>
    </Card>
);

const ActiveChannelRow: React.FC<{ channel: ActiveChannel }> = ({ channel }) => {
    const title = channel.channel_name ?? channel.vk_channel_name ?? 'Без имени';
    const platformLabel = channel.platform === 'twitch' ? 'Twitch' : 'VK Live';

    return (
        <div className="rounded-xl border border-border/70 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{platformLabel}</p>
                </div>
                <Badge
                    variant="outline"
                    className={
                        channel.tts_enabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-border/70 bg-background/60 text-muted-foreground'
                    }
                >
                    {channel.tts_enabled ? 'TTS on' : 'TTS off'}
                </Badge>
            </div>
        </div>
    );
};

const BlockedChannelRow: React.FC<{ channel: BlockedChannel; onUnblock: (id: number) => void }> = ({
    channel,
    onUnblock,
}) => (
    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{channel.channel_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{channel.reason ?? 'Без комментария'}</p>
            </div>
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onUnblock(channel.id)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    </div>
);

export const ChannelsLists: React.FC<{
    activeChannels: ActiveChannel[];
    blockedChannels: BlockedChannel[];
    onUnblock: (id: number) => void;
}> = ({ activeChannels, blockedChannels, onUnblock }) => (
    <div className="grid gap-4 xl:grid-cols-2">
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <CardTitle className="text-base">Активные каналы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {activeChannels.length === 0 ? (
                    <AdminEmptyState
                        title="Активных каналов пока нет"
                        description="После подключения Twitch/VK каналы появятся в этом списке."
                        icon={Globe}
                        className="border-none bg-transparent shadow-none"
                    />
                ) : (
                    activeChannels.map((channel) => (
                        <ActiveChannelRow key={`${channel.platform}-${channel.id}`} channel={channel} />
                    ))
                )}
            </CardContent>
        </Card>
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <CardTitle className="text-base">Заблокированные каналы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {blockedChannels.length === 0 ? (
                    <AdminEmptyState
                        title="Список блокировок пуст"
                        description="Сейчас нет каналов, которым вручную закрыт доступ."
                        icon={ShieldAlert}
                        className="border-none bg-transparent shadow-none"
                    />
                ) : (
                    blockedChannels.map((channel) => (
                        <BlockedChannelRow key={channel.id} channel={channel} onUnblock={onUnblock} />
                    ))
                )}
            </CardContent>
        </Card>
    </div>
);
