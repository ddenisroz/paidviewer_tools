/**
 * UserManagementPage - Migrated to DataTable
 * 
 * Changes:
 * - Replaced custom table (~300 lines) with DataTable component
 * - Removed custom pagination (~100 lines)
 * - Simplified code while keeping all functionality
 * - Total reduction: ~400 lines
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Ban, CheckCircle, Edit, MessageCircle, Plus, RefreshCw, Shield,
    Trash2, Twitch, UserCheck, UserX, Wifi
} from 'lucide-react';

import { AdminPageHeader } from '@/features/admin/components/admin-ui';
import { UserDeleteDialog, WhitelistChannelDialog } from '@/features/admin/components/UserManagementDialogs';
import { addChannelsToWhitelist } from '@/features/admin/utils/whitelistActions';
import { adminService } from '@/services/api/services/adminService';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '@/shared/components';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


import type { UserSession } from '@/types/admin';
import type { User } from '@/types/user';

interface UsersApiResponse {
    users: User[];
    pagination: {
        page?: number;
        pages?: number;
        total?: number;
        total_users?: number;
    };
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75 backdrop-blur-sm shadow-none';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 hover:bg-muted/60 shadow-none';
const TABLE_ICON_BUTTON_CLASS =
    'h-8 w-8 p-0 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground';

const isAdminUser = (user: User): boolean => user.role === 'admin' || user.is_admin === true;

const UserManagementPage: React.FC = () => {
    const queryClient = useQueryClient();

    // Dialogs state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [whitelistDialogOpen, setWhitelistDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<{ is_admin: boolean }>({ is_admin: false });
    const [blockForm, setBlockForm] = useState<{ reason: string }>({ reason: '' });
    const [whitelistForm, setWhitelistForm] = useState<{
        twitch_channel: string;
        vk_channel: string;
    }>({ twitch_channel: '', vk_channel: '' });

    // Queries
    const { data: usersResponse = { users: [], pagination: {} }, isLoading, error, refetch } = useQuery<UsersApiResponse>({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const response = await adminService.getUsers({ page: 1, limit: 1000 });
            return (response.data as unknown as UsersApiResponse) || { users: [], pagination: {} };
        },
        staleTime: 30 * 1000,
    });

    const { data: sessionsData = [] } = useQuery<UserSession[]>({
        queryKey: ['admin-sessions'],
        queryFn: async () => {
            const response = await adminService.getSessions();
            const data = (response.data as { data?: { sessions?: UserSession[] }; sessions?: UserSession[] }).data || response.data;
            return (data as { sessions?: UserSession[] })?.sessions || [];
        },
        staleTime: 30 * 1000,
    });

    // Mutations
    const updateUserMutation = useMutation({
        mutationFn: async ({ userId, data }: { userId: number; data: { is_admin: boolean } }) => {
            return await adminService.updateUser(userId, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Пользователь обновлен');
            setEditDialogOpen(false);
        },
        onError: (error: unknown) => {
            logger.error('Error updating user:', error);
            toast.error('Ошибка обновления пользователя');
        },
    });

    const blockUserMutation = useMutation({
        mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
            return await adminService.blockUser(userId, { reason });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Пользователь заблокирован');
            setBlockDialogOpen(false);
        },
        onError: (error: unknown) => {
            logger.error('Error blocking user:', error);
            toast.error('Ошибка блокировки пользователя');
        },
    });

    const unblockUserMutation = useMutation({
        mutationFn: async (userId: number) => {
            return await adminService.unblockUser(userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Пользователь разблокирован');
        },
        onError: (error: unknown) => {
            logger.error('Error unblocking user:', error);
            toast.error('Ошибка разблокировки');
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (userId: number) => {
            return await adminService.deleteUser(userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Пользователь удален');
            setDeleteDialogOpen(false);
            setUserToDelete(null);
        },
        onError: (error: unknown) => {
            logger.error('Error deleting user:', error);
            toast.error('Ошибка удаления пользователя');
        },
    });

    const addToWhitelistMutation = useMutation({
        mutationFn: async ({ twitchChannel, vkChannel }: { twitchChannel: string; vkChannel: string }) =>
            addChannelsToWhitelist(twitchChannel, vkChannel),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            if (data.errors) {
                toast.success(`Добавлено: ${data.platforms.join(', ')}. Ошибки: ${data.errors.join('; ')}`, { duration: 5000 });
            } else {
                toast.success(`Добавлено в whitelist: ${data.platforms.join(', ')}`);
            }
            setWhitelistDialogOpen(false);
            setWhitelistForm({ twitch_channel: '', vk_channel: '' });
        },
        onError: (error) => {
            logger.error('Error adding to whitelist:', error);
            const typedErr = error as { response?: { data?: { error?: string } }; message?: string };
            toast.error(typedErr.response?.data?.error || typedErr.message || 'Ошибка добавления в whitelist');
        },
    });

    const toggleWhitelistMutation = useMutation({
        mutationFn: async ({ channelName, platform, isWhitelisted }: {
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
        onError: (error) => {
            logger.error('Error toggling whitelist:', error);
            toast.error('Ошибка изменения whitelist');
        },
    });

    // Helper functions
    const formatDate = (dateString: string | undefined): string => {
        if (!dateString) return 'Не указано';
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const openEditDialog = (user: User): void => {
        setCurrentUser(user);
        setEditForm({ is_admin: isAdminUser(user) });
        setEditDialogOpen(true);
    };

    const openBlockDialog = (user: User): void => {
        setCurrentUser(user);
        setBlockForm({ reason: '' });
        setBlockDialogOpen(true);
    };

    const openDeleteDialog = (user: User): void => {
        setUserToDelete(user);
        setDeleteDialogOpen(true);
    };

    const handleEditUser = async (): Promise<void> => {
        if (!currentUser) return;
        updateUserMutation.mutate({ userId: currentUser.id, data: editForm });
    };

    const handleBlockUser = async (): Promise<void> => {
        if (!currentUser) return;
        blockUserMutation.mutate({ userId: currentUser.id, reason: blockForm.reason });
    };

    const handleToggleWhitelist = async (user: User): Promise<void> => {
        const channelName = user.twitch_username || user.vk_username;
        if (!channelName) {
            toast.error('У пользователя нет имени ни на одной платформе');
            return;
        }
        toggleWhitelistMutation.mutate({
            channelName,
            platform: user.twitch_username ? 'twitch' : 'vk',
            isWhitelisted: user.is_whitelisted || false
        });
    };

    const handleAddToWhitelist = async (): Promise<void> => {
        if (!whitelistForm.twitch_channel.trim() && !whitelistForm.vk_channel.trim()) {
            toast.error('Укажите хотя бы один канал');
            return;
        }
        addToWhitelistMutation.mutate({
            twitchChannel: whitelistForm.twitch_channel,
            vkChannel: whitelistForm.vk_channel
        });
    };

    const handleExportCSV = (): void => {
        const csvData = usersResponse.users.map(user => ({
            ID: user.id || '',
            'Twitch': user.twitch_username || '',
            'VK': user.vk_username || '',
            'VK Channel': user.vk_channel_name || '',
            'Admin': isAdminUser(user) ? 'Да' : 'Нет',
            'Blocked': user.is_blocked ? 'Да' : 'Нет',
            'Whitelisted': user.is_whitelisted ? 'Да' : 'Нет',
            'Created': user.created_at || ''
        }));

        const headers = Object.keys(csvData[0] || {});
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        toast.success(`Экспортировано ${csvData.length} пользователей`);
    };

    const getTwitchName = (user: User): string => {
        return user.integrations?.twitch?.username || user.integrations?.twitch?.channel_name || user.twitch_username || '';
    };

    const getVkName = (user: User): string => {
        return user.integrations?.vk?.username || user.integrations?.vk?.channel_name || user.vk_username || user.vk_channel_name || '';
    };

    const hasTwitchIntegration = (user: User): boolean => {
        return Boolean(user.integrations?.twitch?.connected || getTwitchName(user));
    };

    const hasVkIntegration = (user: User): boolean => {
        return Boolean(user.integrations?.vk?.connected || getVkName(user));
    };

    const getPlatformFilterValue = (user: User): string => {
        const hasTwitch = hasTwitchIntegration(user);
        const hasVk = hasVkIntegration(user);
        if (hasTwitch && hasVk) return 'both';
        if (hasTwitch) return 'twitch';
        if (hasVk) return 'vk';
        return 'none';
    };

    // DataTable columns definition
    const columns: DataTableColumn<User>[] = [
        {
            key: 'id',
            header: 'ID / Аккаунт',
            width: '180px',
            align: 'center',
            accessor: (user) => {
                const sessionsArray = Array.isArray(sessionsData) ? sessionsData : [];
                const hasActiveSession = sessionsArray.some(session =>
                    session.user_id === user.id && session.session_type === 'active_user'
                );
                const displayName = user.username || getTwitchName(user) || getVkName(user) || 'Без имени';

                return (
                    <div className="flex flex-col items-center justify-center gap-1">
                        <Badge variant="outline" className="text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                            ID #{user.id}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{displayName}</span>
                        {hasActiveSession && <Wifi className="w-3 h-3 text-sky-300" />}
                    </div>
                );
            },
            searchable: true,
            searchValue: (user) => [
                user.id,
                user.username || '',
                user.twitch_username || '',
                user.vk_username || '',
                user.vk_channel_name || '',
            ].join(' ').toLowerCase(),
            sortValue: (user) => Number(user.id || 0),
            sortable: true,
        },
        {
            key: 'integrations',
            header: 'Платформы',
            width: '220px',
            align: 'center',
            accessor: (user) => {
                const twitchName = getTwitchName(user);
                const vkName = getVkName(user);
                const hasTwitch = hasTwitchIntegration(user);
                const hasVk = hasVkIntegration(user);

                if (!hasTwitch && !hasVk) {
                    return <span className="text-xs text-muted-foreground">Не подключено</span>;
                }

                return (
                    <div className="flex flex-wrap justify-center gap-1">
                        {hasTwitch && (
                            <Badge className="border-violet-500/40 bg-violet-500/10 text-xs text-violet-200">
                                <Twitch className="w-2.5 h-2.5 mr-1" />
                                {twitchName || 'Twitch'}
                            </Badge>
                        )}
                        {hasVk && (
                            <Badge className="border-sky-500/40 bg-sky-500/10 text-xs text-sky-200">
                                <MessageCircle className="w-2.5 h-2.5 mr-1" />
                                {vkName || 'VK Live'}
                            </Badge>
                        )}
                    </div>
                );
            },
            searchable: true,
            searchValue: (user) => [getTwitchName(user), getVkName(user)].join(' ').toLowerCase(),
            sortValue: (user) => getPlatformFilterValue(user),
            filterValue: (user) => getPlatformFilterValue(user),
            sortable: true,
        },
        {
            key: 'whitelist',
            header: 'Whitelist',
            width: '130px',
            align: 'center',
            accessor: (user) => {
                if (user.is_whitelisted && user.whitelisted_platforms && user.whitelisted_platforms.length > 0) {
                    return (
                        <div className="flex flex-col items-center gap-1">
                            {user.whitelisted_platforms.map((platform) => {
                                const channelName = user.whitelisted_channels?.[platform] ||
                                    (platform === 'twitch' ? user.twitch_username : user.vk_username);
                                return (
                                    <Badge key={platform} className="w-fit border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-200">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        {platform === 'twitch' ? 'Twitch' : 'VK'}: {channelName}
                                    </Badge>
                                );
                            })}
                        </div>
                    );
                }
                return <span className="text-xs text-muted-foreground">Нет</span>;
            },
            filterValue: (user) => user.is_whitelisted ? 'whitelisted' : 'not_whitelisted',
            sortValue: (user) => user.is_whitelisted ? 1 : 0,
            searchable: true,
            searchValue: (user) => user.is_whitelisted ? 'whitelisted' : 'not_whitelisted',
            sortable: true,
        },
        {
            key: 'role',
            header: 'Роль',
            width: '120px',
            align: 'center',
            accessor: (user) => {
                if (isAdminUser(user)) {
                    return (
                        <Badge className="border-violet-500/40 bg-violet-500/10 text-xs text-violet-200">
                            <Shield className="w-3 h-3 mr-1" />
                            Админ
                        </Badge>
                    );
                }
                return <span className="text-xs text-muted-foreground">Пользователь</span>;
            },
            filterValue: (user) => isAdminUser(user) ? 'admin' : 'user',
            sortValue: (user) => isAdminUser(user) ? 1 : 0,
            searchable: true,
            searchValue: (user) => isAdminUser(user) ? 'admin' : 'user',
            sortable: true,
        },
        {
            key: 'status',
            header: 'Статус',
            width: '120px',
            align: 'center',
            accessor: (user) => {
                if (user.is_blocked) {
                    return (
                        <Badge className="border-destructive/40 bg-destructive/10 text-xs text-destructive">
                            <Ban className="w-3 h-3 mr-1" />
                            Бан
                        </Badge>
                    );
                }
                return (
                    <Badge className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Актив
                    </Badge>
                );
            },
            filterValue: (user) => user.is_blocked ? 'blocked' : 'active',
            sortValue: (user) => user.is_blocked ? 0 : 1,
            searchable: true,
            searchValue: (user) => user.is_blocked ? 'blocked' : 'active',
            sortable: true,
        },
        {
            key: 'created_at',
            header: 'Создан',
            width: '150px',
            align: 'center',
            accessor: (user) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(user.created_at)}
                </span>
            ),
            sortValue: (user) => Date.parse(user.created_at || '') || 0,
            searchable: true,
            searchValue: (user) => user.created_at || '',
            sortable: true,
        },
        {
            key: 'actions',
            header: 'Действия',
            width: '150px',
            align: 'center',
            accessor: (user) => (
                <div className="flex items-center justify-center gap-1 rounded-md border border-border/60 bg-card/50 p-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        className={TABLE_ICON_BUTTON_CLASS}
                        onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(user);
                        }}
                        title="Редактировать"
                    >
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={TABLE_ICON_BUTTON_CLASS}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (user.is_blocked) {
                                unblockUserMutation.mutate(user.id);
                            } else {
                                openBlockDialog(user);
                            }
                        }}
                        title={user.is_blocked ? "Разблокировать" : "Заблокировать"}
                    >
                        {user.is_blocked ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <Ban className="w-4 h-4 text-destructive" />
                        )}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={TABLE_ICON_BUTTON_CLASS}
                        onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(user);
                        }}
                        title="Удалить"
                    >
                        <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={TABLE_ICON_BUTTON_CLASS}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggleWhitelist(user);
                        }}
                        title={user.is_whitelisted ? "Удалить из whitelist" : "Добавить в whitelist"}
                    >
                        {user.is_whitelisted ? (
                            <UserX className="w-4 h-4 text-destructive" />
                        ) : (
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                        )}
                    </Button>
                </div>
            ),
        },
    ];

    // DataTable filters
    const filters: DataTableFilter[] = [
        {
            key: 'role',
            label: 'Роль',
            width: '140px',
            options: [
                { value: 'all', label: 'Все' },
                { value: 'admin', label: 'Админ' },
                { value: 'user', label: 'Пользователь' },
            ],
            defaultValue: 'all',
        },
        {
            key: 'status',
            label: 'Статус',
            width: '140px',
            options: [
                { value: 'all', label: 'Все' },
                { value: 'active', label: 'Активен' },
                { value: 'blocked', label: 'Заблокирован' },
            ],
            defaultValue: 'all',
        },
        {
            key: 'whitelist',
            label: 'Whitelist',
            width: '140px',
            options: [
                { value: 'all', label: 'Все' },
                { value: 'whitelisted', label: 'В whitelist' },
                { value: 'not_whitelisted', label: 'Не в whitelist' },
            ],
            defaultValue: 'all',
        },
        {
            key: 'integrations',
            label: 'Платформа',
            width: '150px',
            options: [
                { value: 'all', label: 'Все' },
                { value: 'twitch', label: 'Twitch' },
                { value: 'vk', label: 'VK Live' },
                { value: 'both', label: 'Обе платформы' },
                { value: 'none', label: 'Без платформ' },
            ],
            defaultValue: 'all',
        },
    ];

    // DataTable bulk actions
    const bulkActions: DataTableBulkAction[] = [
        {
            key: 'block',
            label: 'Заблокировать',
            icon: <Ban className="h-4 w-4 mr-2" />,
            variant: 'destructive',
            onClick: async (ids) => {
                for (const id of ids) {
                    try {
                        await adminService.blockUser(Number(id), { reason: 'Массовая блокировка' });
                    } catch (error) {
                        logger.error(`Error blocking user ${id}:`, error);
                    }
                }
                queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                toast.success(`Пользователи заблокированы: ${ids.length}`);
            },
            confirmMessage: 'Вы уверены что хотите заблокировать выбранных пользователей?',
        },
        {
            key: 'unblock',
            label: 'Разблокировать',
            icon: <CheckCircle className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: async (ids) => {
                for (const id of ids) {
                    try {
                        await adminService.unblockUser(Number(id));
                    } catch (error) {
                        logger.error(`Error unblocking user ${id}:`, error);
                    }
                }
                queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                toast.success(`Пользователи разблокированы: ${ids.length}`);
            },
        },
        {
            key: 'delete',
            label: 'Удалить',
            icon: <Trash2 className="h-4 w-4 mr-2" />,
            variant: 'destructive',
            onClick: async (ids) => {
                for (const id of ids) {
                    try {
                        await adminService.deleteUser(Number(id));
                    } catch (error) {
                        logger.error(`Error deleting user ${id}:`, error);
                    }
                }
                queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                toast.success(`Удалено пользователей: ${ids.length}`);
            },
            confirmMessage: 'Вы уверены? Это действие нельзя отменить!',
        },
    ];

    if (error) {
        return (
            <div className="space-y-6">
                <Card className={`${SURFACE_CARD_CLASS} p-6`}>
                    <div className="text-center text-destructive">
                        <p>Ошибка загрузки пользователей</p>
                        <Button onClick={() => refetch()} className={`mt-4 ${ACTION_BUTTON_CLASS}`} variant="outline">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Повторить
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Пользователи"
                description="Управление ролями, блокировками и whitelist по всем подключённым аккаунтам."
                meta={
                    <div className="text-sm text-muted-foreground">
                        Всего пользователей: <span className="font-medium text-foreground">{usersResponse.pagination.total || 0}</span>
                        {usersResponse.pagination.total_users !== undefined && (
                            <span className="ml-2">Аккаунтов: {usersResponse.pagination.total_users}</span>
                        )}
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
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExportCSV}
                        disabled={usersResponse.users.length === 0}
                        className={ACTION_BUTTON_CLASS}
                    >
                        Экспорт CSV
                    </Button>
                    <Dialog open={whitelistDialogOpen} onOpenChange={setWhitelistDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-9">
                                <Plus className="w-4 h-4 mr-2" />
                                Добавить в whitelist
                            </Button>
                        </DialogTrigger>
                    </Dialog>
                    </div>
                }
            />

            {/* DataTable */}
            <DataTable
                data={usersResponse.users}
                columns={columns}
                getRowId={(user) => String(user.id)}
                searchable
                searchPlaceholder="Поиск по имени (Twitch, VK Live)..."
                filterable
                filters={filters}
                sortable
                selectable
                bulkActions={bulkActions}
                pagination
                pageSize={25}
                pageSizeOptions={[10, 25, 50]}
                emptyMessage="Пользователи не найдены"
            />

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование пользователя</DialogTitle>
                        <DialogDescription>
                            Изменение настроек пользователя
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_admin"
                                checked={editForm.is_admin}
                                onCheckedChange={(checked) => setEditForm({ ...editForm, is_admin: checked as boolean })}
                            />
                            <Label htmlFor="is_admin">Администратор</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className={ACTION_BUTTON_CLASS}
                            onClick={() => setEditDialogOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={handleEditUser}
                            disabled={updateUserMutation.isPending}
                            className="h-9"
                        >
                            {updateUserMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Block Dialog */}
            <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Блокировка пользователя</DialogTitle>
                        <DialogDescription>
                            Заблокировать пользователя и запретить доступ
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="reason">Причина блокировки</Label>
                            <Textarea
                                id="reason"
                                value={blockForm.reason}
                                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                                placeholder="Укажите причину блокировки..."
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className={ACTION_BUTTON_CLASS}
                            onClick={() => setBlockDialogOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={handleBlockUser}
                            disabled={blockUserMutation.isPending}
                            className="h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {blockUserMutation.isPending ? 'Блокировка...' : 'Заблокировать'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <WhitelistChannelDialog
                open={whitelistDialogOpen}
                twitchChannel={whitelistForm.twitch_channel}
                vkChannel={whitelistForm.vk_channel}
                onOpenChange={setWhitelistDialogOpen}
                onTwitchChange={(value) => setWhitelistForm({ ...whitelistForm, twitch_channel: value })}
                onVkChange={(value) => setWhitelistForm({ ...whitelistForm, vk_channel: value })}
                onSubmit={handleAddToWhitelist}
            />
            <UserDeleteDialog
                open={deleteDialogOpen}
                user={userToDelete}
                isPending={deleteUserMutation.isPending}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) {
                        setUserToDelete(null);
                    }
                }}
                onDelete={() => {
                    if (userToDelete) {
                        deleteUserMutation.mutate(userToDelete.id);
                    }
                }}
            />
        </div>
    );
};

export default UserManagementPage;

