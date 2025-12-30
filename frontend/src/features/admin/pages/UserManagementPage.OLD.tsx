import React, { useEffect, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Ban, 
    CheckCircle, 
    Download, 
    Edit, 
    MessageCircle, 
    Plus, 
    RefreshCw,
    Search,
    Shield,
    SortAsc,
    SortDesc,
    Trash2,
    Twitch,
    UserCheck,
    Users,
    UserX,
    Wifi,
    XCircle
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TABLE_CLASSES } from '@/constants/designSystem';
import { toast } from '@/utils/toastManager';

import { useDebounce } from '../../../hooks/useDebounce';
import { adminService } from '../../../services/api/services/adminService';
import { integrationsService } from '../../../services/api/services/integrationsService';
import { logger } from '../../../utils/prodLogger';


import type { Integration, UserSession } from '../../../types/admin';
import type { User } from '../../../types/user';

// API Response type for users endpoint
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
    
    const [searchTerm, setSearchTerm] = useState<string>('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(50);
    
    const [sortField, setSortField] = useState<string>('id');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    
    // Filters
    const [filterRole, setFilterRole] = useState<string>('all'); // all, admin, user
    const [filterStatus, setFilterStatus] = useState<string>('all'); // all, active, blocked
    const [filterWhitelist, setFilterWhitelist] = useState<string>('all'); // all, whitelisted, not_whitelisted
    const [filterPlatform, setFilterPlatform] = useState<string>('all'); // all, twitch, vk, both
    
    // Bulk actions
    const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
    const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState<boolean>(false);
    const [bulkAction, setBulkAction] = useState<string>(''); // block, unblock, delete, whitelist, unwhitelist
    
    const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
    const [blockDialogOpen, setBlockDialogOpen] = useState<boolean>(false);
    const [whitelistDialogOpen, setWhitelistDialogOpen] = useState<boolean>(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<{ is_admin: boolean }>({
        is_admin: false
    });
    const [blockForm, setBlockForm] = useState<{ reason: string }>({
        reason: ''
    });
    const [whitelistForm, setWhitelistForm] = useState<{
        twitch_channel: string;
        vk_channel: string;
    }>({
        twitch_channel: '',
        vk_channel: ''
    });

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, filterRole, filterStatus, filterWhitelist, filterPlatform]);

    const { data: usersResponse = { users: [], pagination: {} }, isLoading: usersLoading, refetch: loadUsers } = useQuery<UsersApiResponse>({
        queryKey: ['admin-users', page, debouncedSearch],
        queryFn: async () => {
            const response = await adminService.getUsers({
                page,
                limit,
                search: debouncedSearch
            });
            return (response.data as unknown as UsersApiResponse) || { users: [], pagination: {} };
        },
        staleTime: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });
    
    const usersData = usersResponse.users || [];
    const pagination = usersResponse.pagination || {};

    const { data: sessionsData = [], isLoading: sessionsLoading } = useQuery<UserSession[]>({
        queryKey: ['admin-sessions'],
        queryFn: async () => {
            const response = await adminService.getSessions();
            const data = (response.data as { data?: { sessions?: UserSession[] }; sessions?: UserSession[] }).data || response.data;
            return (data as { sessions?: UserSession[] })?.sessions || [];
        },
        staleTime: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

    const { data: integrationsData = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
        queryKey: ['integrations'],
        queryFn: async () => {
            const response = await integrationsService.getIntegrations();
            const data = (response.data as { data?: { integrations?: Integration[] }; integrations?: Integration[] }).data || response.data;
            return (data as { integrations?: Integration[] })?.integrations || [];
        },
        staleTime: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

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
                    await adminService.addToWhitelist({ 
                        username: twitchChannel.trim(), 
                        platform: 'twitch' 
                    });
                    results.push(`Twitch: ${twitchChannel.trim()}`);
                } catch (err) {
                    const typedErr = err as { response?: { data?: { error?: string } }; message?: string };
                    const errorMsg = typedErr.response?.data?.error || typedErr.message || 'Ошибка добавления Twitch';
                    errors.push(`Twitch: ${errorMsg}`);
                    logger.error('Error adding Twitch to whitelist:', err);
                }
            }
            
            if (vkChannel && vkChannel.trim()) {
                try {
                    await adminService.addToWhitelist({ 
                        username: vkChannel.trim(), 
                        platform: 'vk' 
                    });
                    results.push(`VK: ${vkChannel.trim()}`);
                } catch (err) {
                    const typedErr = err as { response?: { data?: { error?: string } }; message?: string };
                    const errorMsg = typedErr.response?.data?.error || typedErr.message || 'Ошибка добавления VK';
                    errors.push(`VK: ${errorMsg}`);
                    logger.error('Error adding VK to whitelist:', err);
                }
            }
            
            if (results.length === 0) {
                if (errors.length > 0) {
                    throw new Error(errors.join('; '));
                } else {
                    throw new Error('Укажите хотя бы один канал');
                }
            }
            
            return { success: true, platforms: results, errors: errors.length > 0 ? errors : null };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            queryClient.invalidateQueries({ queryKey: ['voices-whitelist-status'] });
            
            window.dispatchEvent(new CustomEvent('whitelist-changed', { detail: { platforms: data.platforms } }));
            
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
            const errorMessage = typedErr.response?.data?.error || typedErr.message || 'Ошибка добавления в whitelist';
            toast.error(errorMessage);
        },
    });

    const toggleWhitelistMutation = useMutation({
        mutationFn: async ({ channelName, platform, isWhitelisted, addBoth = false }: { 
            channelName: string; 
            platform: 'twitch' | 'vk'; 
            isWhitelisted: boolean; 
            addBoth?: boolean;
        }): Promise<{ success: boolean; platforms: string[] }> => {
            if (isWhitelisted) {
                if (addBoth) {
                    const results: string[] = [];
                    try {
                        await adminService.removeFromWhitelist(channelName, 'twitch');
                        results.push('Twitch');
                    } catch (err) {
                        logger.warn('Error removing Twitch from whitelist:', err);
                    }
                    try {
                        await adminService.removeFromWhitelist(channelName, 'vk');
                        results.push('VK');
                    } catch (err) {
                        logger.warn('Error removing VK from whitelist:', err);
                    }
                    return { success: true, platforms: results };
                } else {
                    await adminService.removeFromWhitelist(channelName, platform);
                    return { success: true, platforms: [platform] };
                }
            } else {
                if (addBoth) {
                    const results: string[] = [];
                    try {
                        await adminService.addToWhitelist({ username: channelName, platform: 'twitch' });
                        results.push('Twitch');
                    } catch (err) {
                        logger.warn('Error adding Twitch to whitelist:', err);
                    }
                    try {
                        await adminService.addToWhitelist({ username: channelName, platform: 'vk' });
                        results.push('VK');
                    } catch (err) {
                        logger.warn('Error adding VK to whitelist:', err);
                    }
                    return { success: true, platforms: results };
                } else {
                    await adminService.addToWhitelist({ username: channelName, platform });
                    return { success: true, platforms: [platform] };
                }
            }
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['tts-status'] });
            queryClient.invalidateQueries({ queryKey: ['voices-whitelist-status'] });
            
            window.dispatchEvent(new CustomEvent('whitelist-changed', { 
                detail: { 
                    channelName: variables.channelName,
                    platform: variables.platform,
                    isWhitelisted: !variables.isWhitelisted
                } 
            }));
            
            if (variables.addBoth && data.platforms && data.platforms.length > 0) {
                toast.success(
                    variables.isWhitelisted 
                        ? `${variables.channelName} удален из whitelist на платформах: ${data.platforms.join(', ')}`
                        : `${variables.channelName} добавлен в whitelist на платформах: ${data.platforms.join(', ')}`
                );
            } else {
                toast.success(
                    variables.isWhitelisted 
                        ? `${variables.channelName} удален из whitelist (${variables.platform})`
                        : `${variables.channelName} добавлен в whitelist (${variables.platform})`
                );
            }
        },
        onError: (error) => {
            logger.error('Error toggling whitelist:', error);
        },
    });

    const users = usersData;
    const sessions = sessionsData;
    const integrations = integrationsData;
    const loading = usersLoading;

    // Apply filters
    const filteredAndSortedUsers = usersData.filter(user => {
        // Role filter
        if (filterRole === 'admin' && !user.is_admin) return false;
        if (filterRole === 'user' && user.is_admin) return false;
        
        // Status filter
        if (filterStatus === 'active' && user.is_blocked) return false;
        if (filterStatus === 'blocked' && !user.is_blocked) return false;
        
        // Whitelist filter
        if (filterWhitelist === 'whitelisted' && !user.is_whitelisted) return false;
        if (filterWhitelist === 'not_whitelisted' && user.is_whitelisted) return false;
        
        // Platform filter
        if (filterPlatform === 'twitch' && !user.integrations?.twitch?.connected) return false;
        if (filterPlatform === 'vk' && !user.integrations?.vk?.connected) return false;
        if (filterPlatform === 'both' && (!user.integrations?.twitch?.connected || !user.integrations?.vk?.connected)) return false;
        
        return true;
    });

    const handleSort = (field: string): void => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: string): React.ReactNode => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
    };

    const formatDate = (dateString: string | undefined): string => {
        if (!dateString) return 'Не указано';
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const getIntegrationIcon = (platform: string): React.ReactNode => {
        switch (platform) {
            case 'twitch':
                return <Twitch className="w-4 h-4 text-purple-400" />;
            case 'vk':
                return <MessageCircle className="w-4 h-4 text-blue-400" />;
            default:
                return null;
        }
    };

    const openEditDialog = (user: User): void => {
        setCurrentUser(user);
        setEditForm({
            is_admin: user.is_admin || false
        });
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

    const handleDeleteUser = async (userId: number): Promise<void> => {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
        deleteUserMutation.mutate(userId);
    };

    const handleAddToWhitelist = async (): Promise<void> => {
        if (!whitelistForm.twitch_channel.trim() && !whitelistForm.vk_channel.trim()) {
            toast.error('Введите хотя бы один канал (Twitch или VK Live)');
            return;
        }
        
        addToWhitelistMutation.mutate({
            twitchChannel: whitelistForm.twitch_channel,
            vkChannel: whitelistForm.vk_channel
        });
    };

    const handleToggleWhitelist = async (user: User): Promise<void> => {
        const channelName = user.twitch_username || user.vk_username;
        if (!channelName) {
            toast.error('У пользователя нет ника на платформах');
            return;
        }

        toggleWhitelistMutation.mutate({
            channelName,
            platform: user.twitch_username ? 'twitch' : 'vk',
            isWhitelisted: user.is_whitelisted || false
        });
    };

    // Bulk actions
    const handleSelectAll = (): void => {
        if (selectedUsers.size === filteredAndSortedUsers.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(filteredAndSortedUsers.map(u => u.id).filter(id => id !== undefined)));
        }
    };

    const handleSelectUser = (userId: number): void => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleBulkAction = async (action: string): Promise<void> => {
        if (selectedUsers.size === 0) {
            toast.error('Выберите хотя бы одного пользователя');
            return;
        }

        if (!confirm(`Вы уверены, что хотите выполнить действие "${action}" для ${selectedUsers.size} пользователей?`)) {
            return;
        }

        const userIds = Array.from(selectedUsers);
        let successCount = 0;
        let errorCount = 0;

        for (const userId of userIds) {
            try {
                switch (action) {
                    case 'block':
                        await adminService.blockUser(userId, { reason: 'Массовая блокировка' });
                        successCount++;
                        break;
                    case 'unblock':
                        await adminService.unblockUser(userId);
                        successCount++;
                        break;
                    case 'delete':
                        await adminService.deleteUser(userId);
                        successCount++;
                        break;
                    default:
                        break;
                }
            } catch (error) {
                logger.error(`Error performing bulk action ${action} on user ${userId}:`, error);
                errorCount++;
            }
        }

        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        setSelectedUsers(new Set());
        setBulkActionDialogOpen(false);

        if (errorCount === 0) {
            toast.success(`Действие выполнено для ${successCount} пользователей`);
        } else {
            toast.warning(`Выполнено: ${successCount}, ошибок: ${errorCount}`);
        }
    };

    const handleExportCSV = (): void => {
        const csvData = filteredAndSortedUsers.map(user => ({
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

    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
    }, []);

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-400" />
                        <p className="text-slate-400">Загрузка пользователей...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-sm">
                        Всего: {pagination.total || 0} пользователей
                        {pagination.total_users !== undefined && pagination.total_guests !== undefined && (
                            <span className="ml-2 text-xs text-slate-500">
                                (Авториз: {pagination.total_users}, Гостей: {pagination.total_guests})
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => loadUsers()} disabled={usersLoading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                    <Dialog open={whitelistDialogOpen} onOpenChange={setWhitelistDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Добавить в whitelist
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Добавить каналы в whitelist</DialogTitle>
                                <DialogDescription>
                                    Укажите Twitch и/или VK Live каналы для добавления в whitelist. Каналы добавляются независимо друг от друга.
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
                                    <p className="text-xs text-slate-400 mt-1">Оставьте пустым, если не нужно добавлять Twitch</p>
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
                                    <p className="text-xs text-slate-400 mt-1">Оставьте пустым, если не нужно добавлять VK Live</p>
                                </div>
                                <div className="text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
                                    [INFO] Можно указать один или оба канала. Каналы добавляются независимо друг от друга.
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

            <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6 space-y-4">
                    {/* Search */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Поиск по нику (Twitch, VK Live)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                            />
                        </div>
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSearchTerm('')}
                                className="text-slate-400 hover:text-white"
                            >
                                <XCircle className="w-4 h-4 mr-1" />
                                Очистить
                            </Button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label className="text-xs text-slate-400 mb-2">Роль</Label>
                            <Select value={filterRole} onValueChange={setFilterRole}>
                                <SelectTrigger className="bg-slate-900/50 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все</SelectItem>
                                    <SelectItem value="admin">Админы</SelectItem>
                                    <SelectItem value="user">Пользователи</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs text-slate-400 mb-2">Статус</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="bg-slate-900/50 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все</SelectItem>
                                    <SelectItem value="active">Активные</SelectItem>
                                    <SelectItem value="blocked">Заблокированные</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs text-slate-400 mb-2">Whitelist</Label>
                            <Select value={filterWhitelist} onValueChange={setFilterWhitelist}>
                                <SelectTrigger className="bg-slate-900/50 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все</SelectItem>
                                    <SelectItem value="whitelisted">В whitelist</SelectItem>
                                    <SelectItem value="not_whitelisted">Не в whitelist</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs text-slate-400 mb-2">Платформа</Label>
                            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                                <SelectTrigger className="bg-slate-900/50 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все</SelectItem>
                                    <SelectItem value="twitch">Twitch</SelectItem>
                                    <SelectItem value="vk">VK Live</SelectItem>
                                    <SelectItem value="both">Обе платформы</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Active filters indicator */}
                    {(filterRole !== 'all' || filterStatus !== 'all' || filterWhitelist !== 'all' || filterPlatform !== 'all') && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Активные фильтры:</span>
                            {filterRole !== 'all' && <Badge variant="outline" className="text-xs">Роль: {filterRole}</Badge>}
                            {filterStatus !== 'all' && <Badge variant="outline" className="text-xs">Статус: {filterStatus}</Badge>}
                            {filterWhitelist !== 'all' && <Badge variant="outline" className="text-xs">Whitelist: {filterWhitelist}</Badge>}
                            {filterPlatform !== 'all' && <Badge variant="outline" className="text-xs">Платформа: {filterPlatform}</Badge>}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setFilterRole('all');
                                    setFilterStatus('all');
                                    setFilterWhitelist('all');
                                    setFilterPlatform('all');
                                }}
                                className="text-xs h-6"
                            >
                                Сбросить все
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bulk actions panel */}
            {selectedUsers.size > 0 && (
                <Card className="bg-purple-900/20 border-purple-600">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium">
                                    Выбрано: {selectedUsers.size} пользователей
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedUsers(new Set())}
                                >
                                    Снять выделение
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setBulkAction('block');
                                        setBulkActionDialogOpen(true);
                                    }}
                                >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Заблокировать
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setBulkAction('unblock');
                                        handleBulkAction('unblock');
                                    }}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Разблокировать
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setBulkAction('delete');
                                        setBulkActionDialogOpen(true);
                                    }}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Удалить
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>
                            Пользователи ({filteredAndSortedUsers.length})
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleExportCSV}
                                disabled={filteredAndSortedUsers.length === 0}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Экспорт CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => loadUsers()} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-slate-600 bg-slate-900/50">
                                    <th className="text-left p-2 w-10">
                                        <Checkbox
                                            checked={selectedUsers.size === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <span className="text-sm font-semibold">ID / Тип</span>
                                    </th>
                                    <th className="text-left p-2">
                                        <button 
                                            onClick={() => handleSort('total_integrations')}
                                            className="flex items-center gap-1 hover:text-purple-400 font-semibold"
                                        >
                                            Интеграции {getSortIcon('total_integrations')}
                                        </button>
                                    </th>
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <span className="text-sm font-semibold">Whitelist</span>
                                    </th>
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <span className="text-sm font-semibold">Роль</span>
                                    </th>
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <span className="text-sm font-semibold">Статус</span>
                                    </th>
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <button 
                                            onClick={() => handleSort('created_at')}
                                            className="flex items-center gap-1 hover:text-purple-400 font-semibold"
                                        >
                                            Создан {getSortIcon('created_at')}
                                        </button>
                                    </th>
                                    <th className="text-left p-2">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedUsers.map((user) => {
                                    const sessionsArray = Array.isArray(sessions) ? sessions : [];
                                    const hasActiveSession = sessionsArray.some(session => 
                                        session.user_id === user.id && 
                                        session.session_type === 'active_user'
                                    );
                                    
                                    return (
                                        <tr key={user.id || user.session_id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                            <td className="p-2">
                                                {!user.is_guest && user.id && (
                                                    <Checkbox
                                                        checked={selectedUsers.has(user.id)}
                                                        onCheckedChange={() => handleSelectUser(user.id)}
                                                    />
                                                )}
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-2">
                                                    {user.is_guest ? (
                                                        <>
                                                            <Badge variant="outline" className="text-xs bg-orange-900/40 text-orange-300 border-orange-600 font-semibold">
                                                                [GUEST] Гость
                                                            </Badge>
                                                            <span className="font-mono text-xs text-slate-500">
                                                                {user.session_id?.substring(0, 8) || 'N/A'}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Badge variant="outline" className="text-xs bg-green-900/40 text-green-300 border-green-600 font-semibold">
                                                                [KEY] #{user.id}
                                                            </Badge>
                                                        </>
                                                    )}
                                                    {hasActiveSession && <Wifi className="w-3 h-3 text-blue-400" />}
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {user.integrations?.twitch?.connected && (
                                                        <Badge className="bg-purple-900/50 text-purple-200 text-xs">
                                                            <Twitch className="w-2.5 h-2.5 mr-1" />
                                                            <span title={`Канал: ${user.twitch_username}`}>
                                                                {user.integrations.twitch.username || 'N/A'}
                                                                {user.twitch_username && user.integrations.twitch.username !== user.twitch_username && 
                                                                    ` (${user.twitch_username})`
                                                                }
                                                            </span>
                                                        </Badge>
                                                    )}
                                                    {user.integrations?.vk?.connected && (
                                                        <Badge className="bg-blue-900/50 text-blue-200 text-xs">
                                                            <MessageCircle className="w-2.5 h-2.5 mr-1" />
                                                            <span title={`Канал: ${user.vk_channel_name}`}>
                                                                {user.integrations.vk.username || 'N/A'}
                                                                {user.vk_channel_name && user.integrations.vk.username !== user.vk_channel_name && 
                                                                    ` (${user.vk_channel_name})`
                                                                }
                                                            </span>
                                                        </Badge>
                                                    )}
                                                    {user.total_integrations === 0 && (
                                                        <span className="text-xs text-slate-500">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                {user.is_whitelisted && user.whitelisted_platforms && user.whitelisted_platforms.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {user.whitelisted_platforms.map((platform) => {
                                                            const channelName = user.whitelisted_channels?.[platform] || 
                                                                               (platform === 'twitch' ? user.twitch_username : user.vk_username);
                                                            return (
                                                                <Badge 
                                                                    key={platform}
                                                                    className="bg-green-900/50 text-green-200 text-xs w-fit"
                                                                >
                                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                                    {platform === 'twitch' ? 'Twitch' : 'VK'}: {channelName}
                                                                </Badge>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500">Нет</span>
                                                )}
                                            </td>
                                            <td className="p-2">
                                                {user.is_admin ? (
                                                    <Badge className="bg-purple-900/50 text-purple-200 text-xs">
                                                        <Shield className="w-3 h-3 mr-1" />
                                                        Админ
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Пользователь</span>
                                                )}
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-1">
                                                    {user.is_blocked ? (
                                                        <Badge className="bg-red-900/50 text-red-200 text-xs">
                                                            <Ban className="w-3 h-3 mr-1" />
                                                            Блок
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-green-900/50 text-green-200 text-xs">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            Актив
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-2 whitespace-nowrap text-xs text-slate-400">
                                                {formatDate(user.created_at)}
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-1">
                                                    {!user.is_guest && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className={TABLE_CLASSES.actionButton}
                                                                onClick={() => openEditDialog(user)}
                                                                title="Редактировать"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className={TABLE_CLASSES.actionButton}
                                                                onClick={() => openBlockDialog(user)}
                                                                title={user.is_blocked ? "Разблокировать" : "Заблокировать"}
                                                            >
                                                                {user.is_blocked ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Ban className="w-4 h-4 text-red-400" />}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className={TABLE_CLASSES.actionButton}
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                title="Удалить"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-500" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={TABLE_CLASSES.actionButton}
                                                        onClick={() => handleToggleWhitelist(user)}
                                                        title={user.is_whitelisted ? "Удалить из whitelist" : "Добавить в whitelist"}
                                                    >
                                                        {user.is_whitelisted ? <UserX className="w-4 h-4 text-red-400" /> : <UserCheck className="w-4 h-4 text-green-400" />}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredAndSortedUsers.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-semibold mb-2 text-slate-200">Пользователи не найдены</h3>
                                <p className="text-slate-500">
                                    {debouncedSearch ? 'Попробуйте изменить критерии поиска' : 'Пока нет зарегистрированных пользователей'}
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {filteredAndSortedUsers.length > 0 && (pagination.pages || 1) > 1 && (
                <div className="flex items-center justify-center gap-2 p-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1 || usersLoading}
                    >
                        ← Назад
                    </Button>
                    
                    <div className="flex items-center gap-1">
                        {(() => {
                            const totalPages = pagination.pages || 1;
                            const maxVisible = 5;
                            const pages: (number | string)[] = [];
                            
                            if (totalPages <= maxVisible) {
                                // Show all pages
                                for (let i = 1; i <= totalPages; i++) pages.push(i);
                            } else {
                                // Smart pagination
                                pages.push(1);
                                if (page > 3) pages.push('...');
                                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                                    pages.push(i);
                                }
                                if (page < totalPages - 2) pages.push('...');
                                pages.push(totalPages);
                            }
                            
                            return pages.map((pageNum, idx) => (
                                pageNum === '...' ? (
                                    <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                                ) : (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === page ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setPage(pageNum as number)}
                                        disabled={usersLoading}
                                        className="w-8 h-8 p-0"
                                    >
                                        {pageNum}
                                    </Button>
                                )
                            ));
                        })()}
                    </div>
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(pagination.pages || 1, page + 1))}
                        disabled={page >= (pagination.pages || 1) || usersLoading}
                    >
                        Вперед →
                    </Button>
                    
                    <span className="text-xs text-slate-400 ml-4">
                        Страница {page} из {pagination.pages || 1}
                    </span>
                </div>
            )}

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование пользователя</DialogTitle>
                        <DialogDescription>
                            Измените настройки пользователя
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

            <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Блокировка пользователя</DialogTitle>
                        <DialogDescription>
                            Заблокировать пользователя с указанием причины
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

            {/* Bulk Action Confirmation Dialog */}
            <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {bulkAction === 'block' && 'Массовая блокировка'}
                            {bulkAction === 'delete' && 'Массовое удаление'}
                        </DialogTitle>
                        <DialogDescription>
                            {bulkAction === 'block' && `Вы собираетесь заблокировать ${selectedUsers.size} пользователей`}
                            {bulkAction === 'delete' && `Вы собираетесь удалить ${selectedUsers.size} пользователей. Это действие необратимо!`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="bg-yellow-900/20 border border-yellow-600 rounded p-3 text-sm text-yellow-200">
                            ⚠️ Это действие будет применено ко всем выбранным пользователям
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkActionDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button 
                            onClick={() => handleBulkAction(bulkAction)}
                            className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                            Подтвердить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagementPage;



