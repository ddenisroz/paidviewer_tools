import React, { useState, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
    Users, 
    Search, 
    Shield, 
    Ban, 
    Trash2, 
    Edit, 
    Plus,
    Filter,
    Download,
    Upload,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertCircle,
    UserCheck,
    UserX,
    Twitch,
    MessageCircle,
    ChevronDown,
    ChevronUp,
    SortAsc,
    SortDesc,
    Eye,
    EyeOff,
    Settings,
    Monitor,
    Clock,
    Activity,
    Globe,
    Tv,
    Youtube,
    Wifi,
    WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { logger } from '../../utils/prodLogger';

const UserManagementPage = () => {
    const queryClient = useQueryClient();
    
    // Фильтры и поиск
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);  // ✅ Используем hook для debounce
    // ✅ Остальные фильтры УДАЛЕНЫ - они теперь на сервере!
    // Клиент только отправляет поиск, все остальное фильтрует backend
    
    // Пагинация
    const [page, setPage] = useState(1);  // ✅ Добавлена пагинация
    const [limit] = useState(50);  // ✅ Размер страницы
    
    // Сортировка
    const [sortField, setSortField] = useState('id');
    const [sortDirection, setSortDirection] = useState('asc');
    
    // Диалоги
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [whitelistDialogOpen, setWhitelistDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [editForm, setEditForm] = useState({
        is_admin: false
    });
    const [blockForm, setBlockForm] = useState({
        reason: ''
    });
    const [whitelistForm, setWhitelistForm] = useState({
        twitch_channel: '',
        vk_channel: ''
    });

    // ✅ Сброс на первую страницу при изменении поиска
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    // React Query: загружаем пользователей с СЕРВЕРНОЙ пагинацией
    const { data: usersResponse = { users: [], pagination: {} }, isLoading: usersLoading, refetch: loadUsers } = useQuery({
        queryKey: ['admin-users', page, debouncedSearch],  // ✅ Пересчитываем при изменении page/search
        queryFn: async () => {
            const response = await botService.get('/api/admin/users', {
                params: {
                    page,
                    limit,
                    search: debouncedSearch  // ✅ Отправляем поиск на сервер
                }
            });
            return response.data || { users: [], pagination: {} };
        },
        staleTime: 30 * 1000, // 30 секунд
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        onError: (error) => {
            logger.error('Error loading users:', error);
            toast.error('Ошибка загрузки пользователей');
        },
    });

    // ✅ Получаем данные из ответа
    const usersData = usersResponse.users || [];
    const pagination = usersResponse.pagination || {};

    // React Query: загружаем сессии
    const { data: sessionsData = [], isLoading: sessionsLoading } = useQuery({
        queryKey: ['admin-sessions'],
        queryFn: async () => {
            const response = await botService.get('/api/admin/sessions');
            return response.data?.sessions || [];
        },
        staleTime: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        onError: (error) => {
            logger.error('Error loading sessions:', error);
            toast.error('Ошибка загрузки сессий');
        },
    });

    // React Query: загружаем интеграции
    const { data: integrationsData = [], isLoading: integrationsLoading } = useQuery({
        queryKey: ['integrations'],
        queryFn: async () => {
            const response = await botService.get('/api/integrations');
            return response.data?.integrations || [];
        },
        staleTime: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        onError: (error) => {
            logger.error('Error loading integrations:', error);
            toast.error('Ошибка загрузки интеграций');
        },
    });

    // React Query мутации для операций с пользователями
    const updateUserMutation = useMutation({
        mutationFn: async ({ userId, data }) => {
            return await botService.put(`/api/admin/users/${userId}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Пользователь обновлен');
            setEditDialogOpen(false);
        },
        onError: (error) => {
            logger.error('Error updating user:', error);
            toast.error('Ошибка обновления пользователя');
        },
    });

    const blockUserMutation = useMutation({
        mutationFn: async ({ userId, reason }) => {
            return await botService.post(`/api/admin/users/${userId}/block`, { reason });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Пользователь заблокирован');
            setBlockDialogOpen(false);
        },
        onError: (error) => {
            logger.error('Error blocking user:', error);
            toast.error('Ошибка блокировки пользователя');
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (userId) => {
            return await botService.delete(`/api/admin/users/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Пользователь удален');
        },
        onError: (error) => {
            logger.error('Error deleting user:', error);
            toast.error('Ошибка удаления пользователя');
        },
    });

    const addToWhitelistMutation = useMutation({
        mutationFn: async ({ twitchChannel, vkChannel }) => {
            const results = [];
            const errors = [];
            
            // Добавляем Twitch канал если указан
            if (twitchChannel && twitchChannel.trim()) {
                try {
                    await botService.post('/api/admin/whitelist/add', { 
                        username: twitchChannel.trim(), 
                        platform: 'twitch' 
                    });
                    results.push(`Twitch: ${twitchChannel.trim()}`);
                } catch (err) {
                    const errorMsg = err.response?.data?.error || err.message || 'Ошибка добавления Twitch';
                    errors.push(`Twitch: ${errorMsg}`);
                    logger.error('Error adding Twitch to whitelist:', err);
                }
            }
            
            // Добавляем VK канал если указан
            if (vkChannel && vkChannel.trim()) {
                try {
                    await botService.post('/api/admin/whitelist/add', { 
                        username: vkChannel.trim(), 
                        platform: 'vk' 
                    });
                    results.push(`VK: ${vkChannel.trim()}`);
                } catch (err) {
                    const errorMsg = err.response?.data?.error || err.message || 'Ошибка добавления VK';
                    errors.push(`VK: ${errorMsg}`);
                    logger.error('Error adding VK to whitelist:', err);
                }
            }
            
            // Если ничего не было добавлено
            if (results.length === 0) {
                if (errors.length > 0) {
                    throw new Error(errors.join('; '));
                } else {
                    throw new Error('Укажите хотя бы один канал');
                }
            }
            
            return { success: true, platforms: results, errors: errors.length > 0 ? errors : null };
        },
        onSuccess: (data, variables) => {
            // Инвалидируем все связанные запросы после изменения whitelist
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['tts-status'] }); // Обновляем статус TTS
            queryClient.invalidateQueries({ queryKey: ['voices-whitelist-status'] }); // Обновляем whitelist статус для голосов
            
            // Отправляем событие для обновления компонентов, которые не используют React Query
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
            const errorMessage = error.response?.data?.error || error.message || 'Ошибка добавления в whitelist';
            toast.error(errorMessage);
        },
    });

    const toggleWhitelistMutation = useMutation({
        mutationFn: async ({ channelName, platform, isWhitelisted, addBoth = false }) => {
            if (isWhitelisted) {
                // Удаляем с указанной платформы или с обеих если нужно
                if (addBoth) {
                    // Удаляем с обеих платформ
                    const results = [];
                    try {
                        await botService.delete(`/api/admin/whitelist/${channelName}?platform=twitch`);
                        results.push('Twitch');
                    } catch (err) {
                        logger.warn('Error removing Twitch from whitelist:', err);
                    }
                    try {
                        await botService.delete(`/api/admin/whitelist/${channelName}?platform=vk`);
                        results.push('VK');
                    } catch (err) {
                        logger.warn('Error removing VK from whitelist:', err);
                    }
                    return { success: true, platforms: results };
                } else {
                    // Удаляем с одной платформы
                    return await botService.delete(`/api/admin/whitelist/${channelName}?platform=${platform}`);
                }
            } else {
                // Добавляем в whitelist
                if (addBoth) {
                    // Добавляем на обе платформы
                    const results = [];
                    try {
                        await botService.post('/api/admin/whitelist/add', { username: channelName, platform: 'twitch' });
                        results.push('Twitch');
                    } catch (err) {
                        logger.warn('Error adding Twitch to whitelist:', err);
                    }
                    try {
                        await botService.post('/api/admin/whitelist/add', { username: channelName, platform: 'vk' });
                        results.push('VK');
                    } catch (err) {
                        logger.warn('Error adding VK to whitelist:', err);
                    }
                    return { success: true, platforms: results };
                } else {
                    return await botService.post('/api/admin/whitelist/add', { username: channelName, platform });
                }
            }
        },
        onSuccess: (data, variables) => {
            // Инвалидируем все связанные запросы после изменения whitelist
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['tts-status'] }); // Обновляем статус TTS
            queryClient.invalidateQueries({ queryKey: ['voices-whitelist-status'] }); // Обновляем whitelist статус для голосов
            
            // Отправляем событие для обновления компонентов, которые не используют React Query
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

    // ✅ УПРОЩЕНО: Фильтрация уже происходит на сервере!
    // Клиент просто получает отфильтрованные данные и показывает их
    // Никаких useMemo больше не нужно!
    const filteredAndSortedUsers = usersData;

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Не указано';
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const getIntegrationIcon = (platform) => {
        switch (platform) {
            case 'twitch':
                return <Twitch className="w-4 h-4 text-purple-400" />;
            case 'vk':
                return <MessageCircle className="w-4 h-4 text-blue-400" />;
            default:
                return <Globe className="w-4 h-4 text-gray-400" />;
        }
    };

    const openEditDialog = (user) => {
        setCurrentUser(user);
        setEditForm({
            is_admin: user.is_admin
        });
        setEditDialogOpen(true);
    };

    const openBlockDialog = (user) => {
        setCurrentUser(user);
        setBlockForm({ reason: '' });
        setBlockDialogOpen(true);
    };

    const handleEditUser = async () => {
        if (!currentUser) return;
        updateUserMutation.mutate({ userId: currentUser.id, data: editForm });
    };

    const handleBlockUser = async () => {
        if (!currentUser) return;
        blockUserMutation.mutate({ userId: currentUser.id, reason: blockForm.reason });
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
        deleteUserMutation.mutate(userId);
    };

    const handleAddToWhitelist = async () => {
        if (!whitelistForm.twitch_channel.trim() && !whitelistForm.vk_channel.trim()) {
            toast.error('Введите хотя бы один канал (Twitch или VK Live)');
            return;
        }
        
        addToWhitelistMutation.mutate({
            twitchChannel: whitelistForm.twitch_channel,
            vkChannel: whitelistForm.vk_channel
        });
    };

    const handleToggleWhitelist = async (user) => {
        const channelName = user.twitch_username || user.vk_username;
        if (!channelName) {
            toast.error('У пользователя нет ника на платформах');
            return;
        }

        toggleWhitelistMutation.mutate({
            channelName,
            platform: user.twitch_username ? 'twitch' : 'vk',
            isWhitelisted: user.is_whitelisted
        });
    };

    useEffect(() => {
        // Данные обновятся автоматически через React Query
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
            {/* Заголовок и действия */}
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
                                    💡 Можно указать один или оба канала. Каналы добавляются независимо друг от друга.
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

            {/* Поиск по нику */}
            <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
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
                </CardContent>
            </Card>

            {/* Таблица пользователей */}
            <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>
                            Пользователи ({filteredAndSortedUsers.length})
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-slate-600 bg-slate-900/50">
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                                            <SelectTrigger className="h-8 w-32 bg-slate-700 border-slate-600">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">ID: Все</SelectItem>
                                                <SelectItem value="authenticated">🔑 Авториз.</SelectItem>
                                                <SelectItem value="guest">👤 Гости</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                                        <Select value={whitelistFilter} onValueChange={setWhitelistFilter}>
                                            <SelectTrigger className="h-8 bg-slate-700 border-slate-600">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Whitelist: Все</SelectItem>
                                                <SelectItem value="whitelisted">✓ В whitelist</SelectItem>
                                                <SelectItem value="not_whitelisted">✗ Не в whitelist</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </th>
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                                            <SelectTrigger className="h-8 bg-slate-700 border-slate-600">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Роль: Все</SelectItem>
                                                <SelectItem value="admin">👑 Админ</SelectItem>
                                                <SelectItem value="user">👤 Пользователь</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </th>
                                    <th className="text-left p-2 whitespace-nowrap">
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="h-8 bg-slate-700 border-slate-600">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Статус: Все</SelectItem>
                                                <SelectItem value="active">🟢 Активный</SelectItem>
                                                <SelectItem value="blocked">🔴 Заблокирован</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                                                <div className="flex items-center gap-2">
                                                    {user.is_guest ? (
                                                        <>
                                                            <Badge variant="outline" className="text-xs bg-orange-900/40 text-orange-300 border-orange-600 font-semibold">
                                                                👤 Гость
                                                            </Badge>
                                                            <span className="font-mono text-xs text-slate-500">
                                                                {user.session_id?.substring(0, 8) || 'N/A'}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Badge variant="outline" className="text-xs bg-green-900/40 text-green-300 border-green-600 font-semibold">
                                                                🔑 #{user.id}
                                                            </Badge>
                                                        </>
                                                    )}
                                                    {hasActiveSession && <Wifi className="w-3 h-3 text-blue-400" title="Онлайн" />}
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
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => openEditDialog(user)}
                                                                title="Редактировать"
                                                            >
                                                                <Edit className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => openBlockDialog(user)}
                                                                title={user.is_blocked ? "Разблокировать" : "Заблокировать"}
                                                            >
                                                                {user.is_blocked ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Ban className="w-3 h-3 text-red-400" />}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                title="Удалить"
                                                            >
                                                                <Trash2 className="w-3 h-3 text-red-500" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => handleToggleWhitelist(user)}
                                                        title={user.is_whitelisted ? "Удалить из whitelist" : "Добавить в whitelist"}
                                                    >
                                                        {user.is_whitelisted ? <UserX className="w-3 h-3 text-red-400" /> : <UserCheck className="w-3 h-3 text-green-400" />}
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

            {/* ✅ КОМПОНЕНТ ПАГИНАЦИИ */}
            {filteredAndSortedUsers.length > 0 && (
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
                        {Array.from({ length: Math.min(5, pagination.pages || 1) }).map((_, i) => {
                            const pageNum = i + 1;
                            return (
                                <Button
                                    key={pageNum}
                                    variant={pageNum === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setPage(pageNum)}
                                    disabled={usersLoading}
                                    className="w-8 h-8 p-0"
                                >
                                    {pageNum}
                                </Button>
                            );
                        })}
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

            {/* Диалог редактирования */}
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
                                onCheckedChange={(checked) => setEditForm({ ...editForm, is_admin: checked })}
                            />
                            <Label htmlFor="is_admin">Администратор</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button onClick={handleEditUser}>
                            Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Диалог блокировки */}
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
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Заблокировать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagementPage;