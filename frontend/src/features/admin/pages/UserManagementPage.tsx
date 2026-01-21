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

import { adminService } from '@/services/api/services/adminService';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '@/shared/components';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
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
        total_guests?: number;
    };
}

const UserManagementPage: React.FC = () => {
    const queryClient = useQueryClient();

    // Dialogs state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [whitelistDialogOpen, setWhitelistDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
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
        },
        onError: (error: unknown) => {
            logger.error('Error deleting user:', error);
            toast.error('Ошибка удаления пользователя');
        },
    });

    const addToWhitelistMutation = useMutation({
        mutationFn: async ({ twitchChannel, vkChannel }: { twitchChannel: string; vkChannel: string }) => {
            const results: string[] = [];
            const errors: string[] = [];

            if (twitchChannel && twitchChannel.trim()) {
                try {
                    await adminService.addToWhitelist({ username: twitchChannel.trim(), platform: 'twitch' });
                    results.push(`Twitch: ${twitchChannel.trim()}`);
                } catch (err) {
                    const typedErr = err as { response?: { data?: { error?: string } }; message?: string };
                    errors.push(`Twitch: ${typedErr.response?.data?.error || typedErr.message || 'Ошибка'}`);
                }
            }

            if (vkChannel && vkChannel.trim()) {
                try {
                    await adminService.addToWhitelist({ username: vkChannel.trim(), platform: 'vk' });
                    results.push(`VK: ${vkChannel.trim()}`);
                } catch (err) {
                    const typedErr = err as { response?: { data?: { error?: string } }; message?: string };
                    errors.push(`VK: ${typedErr.response?.data?.error || typedErr.message || 'Ошибка'}`);
                }
            }

            if (results.length === 0) {
                throw new Error(errors.length > 0 ? errors.join('; ') : 'Укажите хотя бы один канал');
            }

            return { success: true, platforms: results, errors: errors.length > 0 ? errors : null };
        },
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
        setEditForm({ is_admin: user.is_admin || false });
        setEditDialogOpen(true);
    };

    const openBlockDialog = (user: User): void => {
        setCurrentUser(user);
        setBlockForm({ reason: '' });
        setBlockDialogOpen(true);
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
            'Admin': user.is_admin ? 'Да' : 'Нет',
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

    // DataTable columns definition
    const columns: DataTableColumn<User>[] = [
        {
            key: 'id',
            header: 'ID / Имя',
            accessor: (user) => {
                const sessionsArray = Array.isArray(sessionsData) ? sessionsData : [];
                const hasActiveSession = sessionsArray.some(session =>
                    session.user_id === user.id && session.session_type === 'active_user'
                );

                return (
                    <div className="flex items-center gap-2">
                        {user.is_guest ? (
                            <>
                                <Badge variant="outline" className="text-xs bg-orange-900/40 text-orange-300 border-orange-600">
                                    [GUEST]
                                </Badge>
                                <span className="font-mono text-xs text-slate-500">
                                    {user.session_id?.substring(0, 8) || 'N/A'}
                                </span>
                            </>
                        ) : (
                            <Badge variant="outline" className="text-xs bg-green-900/40 text-green-300 border-green-600">
                                [KEY] #{user.id}
                            </Badge>
                        )}
                        {hasActiveSession && <Wifi className="w-3 h-3 text-blue-400" />}
                    </div>
                );
            },
            sortable: true,
            searchable: false,
        },
        {
            key: 'integrations',
            header: 'Платформы',
            accessor: (user) => (
                <div className="flex flex-wrap gap-1">
                    {user.integrations?.twitch?.connected && (
                        <Badge className="bg-purple-900/50 text-purple-200 text-xs">
                            <Twitch className="w-2.5 h-2.5 mr-1" />
                            {user.integrations.twitch.username || 'N/A'}
                        </Badge>
                    )}
                    {user.integrations?.vk?.connected && (
                        <Badge className="bg-blue-900/50 text-blue-200 text-xs">
                            <MessageCircle className="w-2.5 h-2.5 mr-1" />
                            {user.integrations.vk.username || 'N/A'}
                        </Badge>
                    )}
                    {user.total_integrations === 0 && (
                        <span className="text-xs text-slate-500">-</span>
                    )}
                </div>
            ),
            sortable: true,
            searchable: true,
        },
        {
            key: 'whitelist',
            header: 'Whitelist',
            accessor: (user) => {
                if (user.is_whitelisted && user.whitelisted_platforms && user.whitelisted_platforms.length > 0) {
                    return (
                        <div className="flex flex-col gap-1">
                            {user.whitelisted_platforms.map((platform) => {
                                const channelName = user.whitelisted_channels?.[platform] ||
                                    (platform === 'twitch' ? user.twitch_username : user.vk_username);
                                return (
                                    <Badge key={platform} className="bg-green-900/50 text-green-200 text-xs w-fit">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        {platform === 'twitch' ? 'Twitch' : 'VK'}: {channelName}
                                    </Badge>
                                );
                            })}
                        </div>
                    );
                }
                return <span className="text-xs text-slate-500">Нет</span>;
            },
        },
        {
            key: 'role',
            header: 'Роль',
            accessor: (user) => {
                if (user.is_admin) {
                    return (
                        <Badge className="bg-purple-900/50 text-purple-200 text-xs">
                            <Shield className="w-3 h-3 mr-1" />
                            Админ
                        </Badge>
                    );
                }
                return <span className="text-xs text-slate-400">Пользователь</span>;
            },
            sortable: true,
        },
        {
            key: 'status',
            header: 'Статус',
            accessor: (user) => {
                if (user.is_blocked) {
                    return (
                        <Badge className="bg-red-900/50 text-red-200 text-xs">
                            <Ban className="w-3 h-3 mr-1" />
                            Бан
                        </Badge>
                    );
                }
                return (
                    <Badge className="bg-green-900/50 text-green-200 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Актив
                    </Badge>
                );
            },
            sortable: true,
        },
        {
            key: 'created_at',
            header: 'Создан',
            accessor: (user) => (
                <span className="text-xs text-slate-400 whitespace-nowrap">
                    {formatDate(user.created_at)}
                </span>
            ),
            sortable: true,
        },
        {
            key: 'actions',
            header: 'Действия',
            accessor: (user) => (
                <div className="flex items-center gap-1">
                    {!user.is_guest && (
                        <>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
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
                                className="h-8 w-8 p-0"
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
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : (
                                    <Ban className="w-4 h-4 text-red-400" />
                                )}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Вы уверены, что хотите удалить этого пользователя?')) {
                                        deleteUserMutation.mutate(user.id);
                                    }
                                }}
                                title="Удалить"
                            >
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                        </>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggleWhitelist(user);
                        }}
                        title={user.is_whitelisted ? "Удалить из whitelist" : "Добавить в whitelist"}
                    >
                        {user.is_whitelisted ? (
                            <UserX className="w-4 h-4 text-red-400" />
                        ) : (
                            <UserCheck className="w-4 h-4 text-green-400" />
                        )}
                    </Button>
                </div>
            ),
            align: 'right',
        },
    ];

    // DataTable filters
    const filters: DataTableFilter[] = [
        {
            key: 'role',
            label: 'Роль',
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
            options: [
                { value: 'all', label: 'Все' },
                { value: 'whitelisted', label: 'В whitelist' },
                { value: 'not_whitelisted', label: 'Не в whitelist' },
            ],
            defaultValue: 'all',
        },
        {
            key: 'platform',
            label: 'Платформа',
            options: [
                { value: 'all', label: 'Все' },
                { value: 'twitch', label: 'Twitch' },
                { value: 'vk', label: 'VK Live' },
                { value: 'both', label: 'Обе платформы' },
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
            <div className="container mx-auto p-6">
                <Card className="card-glass border-slate-700/50 p-6">
                    <div className="text-center text-red-400">
                        <p>Ошибка загрузки пользователей</p>
                        <Button onClick={() => refetch()} className="mt-4" variant="outline">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Повторить
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                        Управление пользователями
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Всего пользователей: <span className="text-foreground font-medium">{usersResponse.pagination.total || 0}</span>
                        {usersResponse.pagination.total_users !== undefined && usersResponse.pagination.total_guests !== undefined && (
                            <span className="ml-2 text-xs text-slate-500">
                                (Аккаунты: {usersResponse.pagination.total_users}, Гости: {usersResponse.pagination.total_guests})
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="hover:bg-primary/10">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                    <Button variant="outline" onClick={handleExportCSV} disabled={usersResponse.users.length === 0} className="hover:bg-primary/10">
                        Экспорт CSV
                    </Button>
                    <Dialog open={whitelistDialogOpen} onOpenChange={setWhitelistDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="font-semibold shadow-lg shadow-primary/20">
                                <Plus className="w-4 h-4 mr-2" />
                                Добавить в whitelist
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Добавить канал в whitelist</DialogTitle>
                                <DialogDescription>
                                    Укажите Twitch и/или VK Live канал для добавления в whitelist
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="twitch_channel">Twitch канал</Label>
                                    <Input
                                        id="twitch_channel"
                                        value={whitelistForm.twitch_channel}
                                        onChange={(e) => setWhitelistForm({ ...whitelistForm, twitch_channel: e.target.value })}
                                        placeholder="Введите название Twitch канала..."
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="vk_channel">VK Live канал</Label>
                                    <Input
                                        id="vk_channel"
                                        value={whitelistForm.vk_channel}
                                        onChange={(e) => setWhitelistForm({ ...whitelistForm, vk_channel: e.target.value })}
                                        placeholder="Введите название VK Live канала..."
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setWhitelistDialogOpen(false)}>
                                    Отмена
                                </Button>
                                <Button onClick={handleAddToWhitelist}>
                                    Добавить
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* DataTable */}
            <DataTable
                data={usersResponse.users}
                columns={columns}
                getRowId={(user) => String(user.id || user.session_id)}
                searchable
                searchPlaceholder="Поиск по имени (Twitch, VK Live)..."
                filterable
                filters={filters}
                sortable
                selectable
                bulkActions={bulkActions}
                pagination
                pageSize={50}
                pageSizeOptions={[10, 25, 50, 100]}
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
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            onClick={handleEditUser}
                            disabled={updateUserMutation.isPending}
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
                        <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            onClick={handleBlockUser}
                            disabled={blockUserMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {blockUserMutation.isPending ? 'Блокировка...' : 'Заблокировать'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagementPage;
