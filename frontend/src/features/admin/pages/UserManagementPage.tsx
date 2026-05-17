import React, { useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, MessageCircle, Plus, RefreshCw, Search, Twitch, UserCheck, UserX } from 'lucide-react';

import { AdminPageHeader } from '@/features/admin/components/admin-ui';
import { WhitelistChannelDialog } from '@/features/admin/components/UserManagementDialogs';
import { addChannelsToWhitelist } from '@/features/admin/utils/whitelistActions';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { User } from '@/types/user';

interface UsersApiResponse {
    users: User[];
    pagination: {
        total?: number;
        total_users?: number;
    };
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-none';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 shadow-none hover:bg-muted/60';
const ICON_BUTTON_CLASS = 'h-8 w-8 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground';

const getTwitchName = (user: User): string =>
    user.integrations?.twitch?.username || user.integrations?.twitch?.channel_name || user.twitch_username || '';

const getVkName = (user: User): string =>
    user.integrations?.vk?.username ||
    user.integrations?.vk?.channel_name ||
    user.vk_username ||
    user.vk_channel_name ||
    '';

const hasTwitchIntegration = (user: User): boolean =>
    Boolean(user.integrations?.twitch?.connected || getTwitchName(user));
const hasVkIntegration = (user: User): boolean => Boolean(user.integrations?.vk?.connected || getVkName(user));

const getDisplayName = (user: User): string =>
    user.username || getTwitchName(user) || getVkName(user) || `ID ${user.id}`;

const getWhitelistChannel = (user: User): { platform: 'twitch' | 'vk'; channelName: string } | null => {
    const twitchChannel = user.whitelisted_channels?.twitch || getTwitchName(user);
    const vkChannel = user.whitelisted_channels?.vk || getVkName(user);

    if (twitchChannel) return { platform: 'twitch', channelName: twitchChannel };
    if (vkChannel) return { platform: 'vk', channelName: vkChannel };
    return null;
};

const UserManagementPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'whitelisted' | 'not_whitelisted'>('all');
    const [whitelistDialogOpen, setWhitelistDialogOpen] = useState(false);
    const [whitelistForm, setWhitelistForm] = useState({ twitch_channel: '', vk_channel: '' });

    const {
        data: usersResponse = { users: [], pagination: {} },
        isLoading,
        error,
        refetch,
    } = useQuery<UsersApiResponse>({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const response = await adminService.getUsers({ page: 1, limit: 1000 });
            return (response.data as unknown as UsersApiResponse) || { users: [], pagination: {} };
        },
        staleTime: 30 * 1000,
    });

    const addToWhitelistMutation = useMutation({
        mutationFn: async ({ twitchChannel, vkChannel }: { twitchChannel: string; vkChannel: string }) =>
            addChannelsToWhitelist(twitchChannel, vkChannel),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            if (data.errors) {
                toast.success(`Добавлено: ${data.platforms.join(', ')}. Ошибки: ${data.errors.join('; ')}`, {
                    duration: 5000,
                });
            } else {
                toast.success(`Добавлено в whitelist: ${data.platforms.join(', ')}`);
            }
            setWhitelistDialogOpen(false);
            setWhitelistForm({ twitch_channel: '', vk_channel: '' });
        },
        onError: (mutationError) => {
            logger.error('Error adding to whitelist:', mutationError);
            const typedError = mutationError as { response?: { data?: { error?: string } }; message?: string };
            toast.error(typedError.response?.data?.error || typedError.message || 'Ошибка добавления в whitelist');
        },
    });

    const toggleWhitelistMutation = useMutation({
        mutationFn: async ({
            channelName,
            platform,
            isWhitelisted,
        }: {
            channelName: string;
            platform: 'twitch' | 'vk';
            isWhitelisted: boolean;
        }) => {
            if (isWhitelisted) {
                await adminService.removeFromWhitelist(channelName, platform);
            } else {
                await adminService.addToWhitelist({ username: channelName, platform });
            }
            return { channelName, platform, isWhitelisted };
        },
        onSuccess: (variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success(
                variables.isWhitelisted
                    ? `${variables.channelName} удален из whitelist (${variables.platform})`
                    : `${variables.channelName} добавлен в whitelist (${variables.platform})`
            );
        },
        onError: (mutationError) => {
            logger.error('Error toggling whitelist:', mutationError);
            toast.error('Ошибка изменения whitelist');
        },
    });

    const filteredUsers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return usersResponse.users.filter((user) => {
            if (filter === 'whitelisted' && !user.is_whitelisted) return false;
            if (filter === 'not_whitelisted' && user.is_whitelisted) return false;
            if (!normalizedSearch) return true;

            return [user.id, getDisplayName(user), getTwitchName(user), getVkName(user)]
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch);
        });
    }, [filter, search, usersResponse.users]);

    const handleAddToWhitelist = async (): Promise<void> => {
        if (!whitelistForm.twitch_channel.trim() && !whitelistForm.vk_channel.trim()) {
            toast.error('Укажите хотя бы один канал');
            return;
        }

        addToWhitelistMutation.mutate({
            twitchChannel: whitelistForm.twitch_channel,
            vkChannel: whitelistForm.vk_channel,
        });
    };

    const handleToggleWhitelist = (user: User): void => {
        const target = getWhitelistChannel(user);

        if (!target) {
            toast.error('У пользователя нет Twitch или VK Live канала');
            return;
        }

        toggleWhitelistMutation.mutate({
            channelName: target.channelName,
            platform: target.platform,
            isWhitelisted: Boolean(user.is_whitelisted),
        });
    };

    if (error) {
        return (
            <Card className={`${SURFACE_CARD_CLASS} p-6`}>
                <div className="text-center text-destructive">
                    <p>Ошибка загрузки whitelist</p>
                    <Button onClick={() => refetch()} className={`mt-4 ${ACTION_BUTTON_CLASS}`} variant="outline">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Повторить
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Whitelist"
                description="Пользователи и каналы, которым разрешены функции бота и озвучки."
                meta={
                    <div className="text-sm text-muted-foreground">
                        Всего:{' '}
                        <span className="font-medium text-foreground">{usersResponse.pagination.total || 0}</span>
                    </div>
                }
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => refetch()}
                            disabled={isLoading}
                            className={ACTION_BUTTON_CLASS}
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Обновить
                        </Button>
                        <Button className="h-9" onClick={() => setWhitelistDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить
                        </Button>
                    </div>
                }
            />

            <Card className={SURFACE_CARD_CLASS}>
                <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Поиск по Twitch, VK Live или ID"
                                className="pl-9"
                            />
                        </div>
                        <div className="flex shrink-0 gap-2">
                            {[
                                ['all', 'Все'],
                                ['whitelisted', 'В whitelist'],
                                ['not_whitelisted', 'Не в whitelist'],
                            ].map(([value, label]) => (
                                <Button
                                    key={value}
                                    type="button"
                                    variant={filter === value ? 'default' : 'outline'}
                                    className={filter === value ? 'h-9' : ACTION_BUTTON_CLASS}
                                    onClick={() => setFilter(value as typeof filter)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border/70">
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_8rem] gap-3 border-b border-border/70 bg-background/45 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
                            <div>Пользователь</div>
                            <div>Платформы</div>
                            <div className="text-right">Whitelist</div>
                        </div>
                        {filteredUsers.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {isLoading ? 'Загрузка...' : 'Пользователи не найдены'}
                            </div>
                        ) : (
                            <div className="divide-y divide-border/70">
                                {filteredUsers.map((user) => {
                                    const twitchName = getTwitchName(user);
                                    const vkName = getVkName(user);
                                    const hasTwitch = hasTwitchIntegration(user);
                                    const hasVk = hasVkIntegration(user);

                                    return (
                                        <div
                                            key={user.id}
                                            className="grid grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_8rem] items-center gap-3 px-4 py-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-foreground">
                                                    {getDisplayName(user)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">ID #{user.id}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {hasTwitch ? (
                                                    <Badge className="border-violet-500/40 bg-violet-500/10 text-xs text-violet-200">
                                                        <Twitch className="mr-1 h-3 w-3" />
                                                        {twitchName || 'Twitch'}
                                                    </Badge>
                                                ) : null}
                                                {hasVk ? (
                                                    <Badge className="border-sky-500/40 bg-sky-500/10 text-xs text-sky-200">
                                                        <MessageCircle className="mr-1 h-3 w-3" />
                                                        {vkName || 'VK Live'}
                                                    </Badge>
                                                ) : null}
                                                {!hasTwitch && !hasVk ? (
                                                    <span className="text-xs text-muted-foreground">Нет платформ</span>
                                                ) : null}
                                            </div>
                                            <div className="flex justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className={ICON_BUTTON_CLASS}
                                                    onClick={() => handleToggleWhitelist(user)}
                                                    title={
                                                        user.is_whitelisted
                                                            ? 'Удалить из whitelist'
                                                            : 'Добавить в whitelist'
                                                    }
                                                >
                                                    {user.is_whitelisted ? (
                                                        <UserX className="h-4 w-4 text-destructive" />
                                                    ) : (
                                                        <UserCheck className="h-4 w-4 text-emerald-400" />
                                                    )}
                                                </Button>
                                                {user.is_whitelisted ? (
                                                    <CheckCircle className="ml-2 mt-2 h-4 w-4 text-emerald-400" />
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <WhitelistChannelDialog
                open={whitelistDialogOpen}
                twitchChannel={whitelistForm.twitch_channel}
                vkChannel={whitelistForm.vk_channel}
                onOpenChange={setWhitelistDialogOpen}
                onTwitchChange={(value) => setWhitelistForm({ ...whitelistForm, twitch_channel: value })}
                onVkChange={(value) => setWhitelistForm({ ...whitelistForm, vk_channel: value })}
                onSubmit={handleAddToWhitelist}
            />
        </div>
    );
};

export default UserManagementPage;
