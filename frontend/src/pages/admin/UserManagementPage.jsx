import React, { useState, useEffect, useMemo } from 'react';
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
    const [users, setUsers] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [integrationsLoading, setIntegrationsLoading] = useState(false);
    
    // Фильтры и поиск
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [integrationFilter, setIntegrationFilter] = useState('all');
    const [whitelistFilter, setWhitelistFilter] = useState('all');
    
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
        channel_name: ''
    });

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await botService.get('/api/admin/users');
            setUsers(response.data?.users || []);
        } catch (error) {
            logger.error('Error loading users:', error);
            toast.error('Ошибка загрузки пользователей');
        } finally {
            setLoading(false);
        }
    };

    const loadSessions = async () => {
        try {
            setSessionsLoading(true);
            const response = await botService.get('/api/admin/sessions');
            setSessions(response.data?.sessions || []);
        } catch (error) {
            logger.error('Error loading sessions:', error);
            toast.error('Ошибка загрузки сессий');
        } finally {
            setSessionsLoading(false);
        }
    };

    const loadIntegrations = async () => {
        try {
            setIntegrationsLoading(true);
            const response = await botService.get('/api/integrations');
            setIntegrations(response.data?.integrations || []);
        } catch (error) {
            logger.error('Error loading integrations:', error);
            toast.error('Ошибка загрузки интеграций');
        } finally {
            setIntegrationsLoading(false);
        }
    };

    // Фильтрация и сортировка пользователей
    const filteredAndSortedUsers = useMemo(() => {
        const botsArray = Array.isArray(users) ? users : [];
        const sessionsArray = Array.isArray(sessions) ? sessions : [];
        const integrationsArray = Array.isArray(integrations) ? integrations : [];
        
        let filtered = botsArray.filter(user => {
            // Поиск по ID пользователя
            const matchesUserId = `User_${user.id}`.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Поиск по никнеймам платформ
            const matchesPlatformUsername = user.integrations ? 
                Object.values(user.integrations).some(integration => 
                    integration.username?.toLowerCase().includes(searchTerm.toLowerCase())
                ) : false;
            
            // Поиск по Twitch username
            const matchesTwitchUsername = user.twitch_username?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
            
            // Поиск по VK username
            const matchesVkUsername = user.vk_username?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
            
            const matchesSearch = matchesUserId || matchesPlatformUsername || matchesTwitchUsername || matchesVkUsername;
            
            // Фильтр по роли
            const matchesRole = roleFilter === 'all' || 
                (roleFilter === 'admin' && user.is_admin) ||
                (roleFilter === 'user' && !user.is_admin);
            
            // Фильтр по статусу
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && !user.is_blocked) ||
                (statusFilter === 'blocked' && user.is_blocked);
            
            // Фильтр по интеграциям
            const matchesIntegration = integrationFilter === 'all' ||
                (integrationFilter === 'twitch' && user.integrations?.twitch?.connected) ||
                (integrationFilter === 'vk' && user.integrations?.vk?.connected) ||
                (integrationFilter === 'none' && user.total_integrations === 0);
            
            // Фильтр по whitelist
            const matchesWhitelist = whitelistFilter === 'all' ||
                (whitelistFilter === 'whitelisted' && user.is_whitelisted) ||
                (whitelistFilter === 'not_whitelisted' && !user.is_whitelisted);
            
            return matchesSearch && matchesRole && matchesStatus && matchesIntegration && matchesWhitelist;
        });
        
        // Сортировка
        filtered.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];
            
            // Обработка специальных полей
            if (sortField === 'total_integrations') {
                aValue = a.total_integrations || 0;
                bValue = b.total_integrations || 0;
            } else if (sortField === 'created_at') {
                aValue = new Date(a.created_at || 0);
                bValue = new Date(b.created_at || 0);
            }
            
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }
            
            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
        
        return filtered;
    }, [users, sessions, integrations, searchTerm, roleFilter, statusFilter, integrationFilter, whitelistFilter, sortField, sortDirection]);

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
        try {
            await botService.put(`/api/admin/users/${currentUser.id}`, editForm);
            toast.success('Пользователь обновлен');
            setEditDialogOpen(false);
            loadUsers();
        } catch (error) {
            logger.error('Error updating user:', error);
            toast.error('Ошибка обновления пользователя');
        }
    };

    const handleBlockUser = async () => {
        try {
            await botService.post(`/api/admin/users/${currentUser.id}/block`, {
                reason: blockForm.reason
            });
            toast.success('Пользователь заблокирован');
            setBlockDialogOpen(false);
            loadUsers();
        } catch (error) {
            logger.error('Error blocking user:', error);
            toast.error('Ошибка блокировки пользователя');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
        
        try {
            await botService.delete(`/api/admin/users/${userId}`);
            toast.success('Пользователь удален');
            loadUsers();
        } catch (error) {
            logger.error('Error deleting user:', error);
            toast.error('Ошибка удаления пользователя');
        }
    };

    const handleAddToWhitelist = async () => {
        if (!whitelistForm.channel_name.trim()) {
            toast.error('Введите название канала');
            return;
        }
        
        try {
            await botService.post('/api/admin/whitelist/add', {
                username: whitelistForm.channel_name.trim(),
                platform: 'twitch' // По умолчанию Twitch, backend поддерживает оба
            });
            toast.success(`Канал ${whitelistForm.channel_name} добавлен в whitelist`);
            setWhitelistDialogOpen(false);
            setWhitelistForm({ channel_name: '' });
            loadUsers(); // Перезагружаем для обновления статуса whitelist
        } catch (error) {
            logger.error('Error adding to whitelist:', error);
            // Ошибка уже обрабатывается в apiClient
        }
    };

    const handleToggleWhitelist = async (user) => {
        const channelName = user.twitch_username || user.vk_username;
        if (!channelName) {
            toast.error('У пользователя нет ника на платформах');
            return;
        }

        try {
            if (user.is_whitelisted) {
                // Удаляем из whitelist
                await botService.delete(`/api/admin/whitelist/${channelName}`);
                toast.success(`${channelName} удален из whitelist`);
            } else {
                // Добавляем в whitelist
                await botService.post('/api/admin/whitelist/add', {
                    username: channelName,
                    platform: user.twitch_username ? 'twitch' : 'vk'
                });
                toast.success(`${channelName} добавлен в whitelist`);
            }
            loadUsers(); // Обновляем список
        } catch (error) {
            logger.error('Error toggling whitelist:', error);
            // Ошибка уже обрабатывается в apiClient
        }
    };

    useEffect(() => {
        loadUsers();
        loadSessions();
        loadIntegrations();
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
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Users className="w-8 h-8 text-purple-400" />
                        Управление пользователями
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Управление пользователями, их ролями и интеграциями
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadUsers} disabled={loading}>
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
                                <DialogTitle>Добавить канал в whitelist</DialogTitle>
                                <DialogDescription>
                                    Добавьте канал в whitelist для доступа к TTS
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="channel_name">Название канала</Label>
                                    <Input
                                        id="channel_name"
                                        value={whitelistForm.channel_name}
                                        onChange={(e) => setWhitelistForm({ ...whitelistForm, channel_name: e.target.value })}
                                        placeholder="Введите название канала..."
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
                                        <button 
                                            onClick={() => handleSort('id')}
                                            className="flex items-center gap-1 hover:text-purple-400 font-semibold"
                                        >
                                            ID {getSortIcon('id')}
                                        </button>
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
                                        <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                            <td className="p-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-xs">#{user.id}</span>
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
                                                {user.is_whitelisted ? (
                                                    <Badge className="bg-green-900/50 text-green-200 text-xs">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Да
                                                    </Badge>
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
                                                        onClick={() => handleToggleWhitelist(user)}
                                                        title={user.is_whitelisted ? "Удалить из whitelist" : "Добавить в whitelist"}
                                                    >
                                                        {user.is_whitelisted ? <UserX className="w-3 h-3 text-red-400" /> : <UserCheck className="w-3 h-3 text-green-400" />}
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
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredAndSortedUsers.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                Пользователи не найдены
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

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