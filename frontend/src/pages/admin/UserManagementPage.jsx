import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
    Users, 
    Edit, 
    Trash2, 
    Shield, 
    ShieldOff, 
    Search,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Monitor,
    Clock,
    Activity,
    Globe,
    Tv,
    Youtube,
    Settings,
    Filter,
    Eye,
    EyeOff,
    Wifi,
    WifiOff,
    UserCheck,
    UserX,
    Ban,
    Unlock,
    MoreVertical,
    ChevronDown,
    ChevronRight,
    Plus,
    List,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [integrationsLoading, setIntegrationsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' или 'sessions'
    
    // Whitelist states
    const [whitelistChannels, setWhitelistChannels] = useState({ twitch: [], vk: [] });
    const [newChannel, setNewChannel] = useState('');
    const [newPlatform, setNewPlatform] = useState('twitch');
    const [whitelistLoading, setWhitelistLoading] = useState(false);
    
    // Фильтры
    const [filters, setFilters] = useState({
        role: 'all', // all, admin, user, blocked
        status: 'all', // all, active, inactive, blocked
        platform: 'all', // all, twitch, vk, youtube
        hasIntegrations: 'all' // all, yes, no
    });
    
    // Состояние развернутых карточек
    const [expandedUsers, setExpandedUsers] = useState(new Set());
    
    // Формы
    const [editForm, setEditForm] = useState({
        is_admin: false
    });
    const [blockForm, setBlockForm] = useState({
        reason: ''
    });

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await botService.get('/api/admin/users');
            setUsers(response.data || []);
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Ошибка загрузки пользователей');
        } finally {
            setLoading(false);
        }
    };

    const loadSessions = async () => {
        try {
            setSessionsLoading(true);
            const response = await botService.get('/api/admin/sessions');
            setSessions(response.data.sessions || []);
        } catch (error) {
            console.error('Error loading sessions:', error);
            toast.error('Ошибка загрузки сессий');
        } finally {
            setSessionsLoading(false);
        }
    };

    const loadIntegrations = async () => {
        try {
            setIntegrationsLoading(true);
            const response = await botService.get('/api/integrations');
            setIntegrations(response.data || []);
        } catch (error) {
            console.error('Error loading integrations:', error);
            toast.error('Ошибка загрузки интеграций');
        } finally {
            setIntegrationsLoading(false);
        }
    };

    const loadWhitelist = async () => {
        try {
            setWhitelistLoading(true);
            const response = await botService.get('/api/admin/whitelist');
            setWhitelistChannels({ twitch: response.data.whitelist_users || [], vk: [] });
        } catch (error) {
            console.error('Error loading whitelist:', error);
            toast.error('Ошибка загрузки белого списка');
        } finally {
            setWhitelistLoading(false);
        }
    };

    const addToWhitelist = async () => {
        if (!newChannel.trim()) {
            toast.error('Введите название канала');
            return;
        }

        try {
            await botService.post('/api/admin/whitelist/add', {
                username: newChannel.trim(),
            });
            await loadWhitelist();
            setNewChannel('');
            toast.success(`Канал ${newChannel} добавлен в белый список`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Ошибка добавления канала');
        }
    };

    const removeFromWhitelist = async (channel) => {
        try {
            await botService.delete('/api/admin/whitelist/remove', {
                data: { username: channel }
            });
            await loadWhitelist();
            toast.success(`Канал ${channel} удален из белого списка`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Ошибка удаления канала');
        }
    };

    // Функции для управления фильтрами
    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            role: 'all',
            status: 'all',
            platform: 'all',
            hasIntegrations: 'all'
        });
    };

    // Функции для управления развернутыми карточками
    const toggleUserExpansion = (userId) => {
        const newExpanded = new Set(expandedUsers);
        if (newExpanded.has(userId)) {
            newExpanded.delete(userId);
        } else {
            newExpanded.add(userId);
        }
        setExpandedUsers(newExpanded);
    };


    const updateUser = async () => {
        try {
            await botService.put(`/api/admin/users/${currentUser.id}`, editForm);
            toast.success('Пользователь обновлен');
            setEditDialogOpen(false);
            setCurrentUser(null);
            await loadUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error(error.response?.data?.error || 'Ошибка обновления пользователя');
        }
    };

    const deleteUser = async (userId) => {
        if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }

        try {
            await botService.delete(`/api/admin/users/${userId}`);
            toast.success('Пользователь удален');
            await loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error(error.response?.data?.error || 'Ошибка удаления пользователя');
        }
    };

    const blockUser = async () => {
        try {
            await botService.post(`/api/admin/users/${currentUser.id}/block`, blockForm);
            toast.success('Пользователь заблокирован');
            setBlockDialogOpen(false);
            setCurrentUser(null);
            setBlockForm({ reason: '' });
            await loadUsers();
        } catch (error) {
            console.error('Error blocking user:', error);
            toast.error(error.response?.data?.error || 'Ошибка блокировки пользователя');
        }
    };

    const unblockUser = async (userId) => {
        try {
            await botService.post(`/api/admin/users/${userId}/unblock`);
            toast.success('Пользователь разблокирован');
            await loadUsers();
        } catch (error) {
            console.error('Error unblocking user:', error);
            toast.error(error.response?.data?.error || 'Ошибка разблокировки пользователя');
        }
    };

    const terminateSession = async (session) => {
        try {
            if (session.session_type === 'active_user') {
                await botService.delete(`/api/admin/sessions/user/${session.user_id}`);
            } else {
                await botService.delete(`/api/admin/sessions/${session.channel}`);
            }
            toast.success('Сессия завершена');
            await loadSessions();
        } catch (error) {
            console.error('Error terminating session:', error);
            toast.error('Ошибка завершения сессии');
        }
    };

    const formatLastActivity = (timestamp) => {
        if (!timestamp) return 'Неизвестно';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Только что';
        if (diffMins < 60) return `${diffMins} мин. назад`;
        if (diffHours < 24) return `${diffHours} ч. назад`;
        return `${diffDays} дн. назад`;
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

    const formatDate = (dateString) => {
        if (!dateString) return 'Не указано';
        return new Date(dateString).toLocaleString('ru-RU');
    };

    // Расширенная фильтрация пользователей
    const filteredUsers = users.filter(user => {
        const matchesSearch = `User_${user.id}`.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Фильтр по роли
        const matchesRole = filters.role === 'all' || 
            (filters.role === 'admin' && user.is_admin) ||
            (filters.role === 'user' && !user.is_admin) ||
            (filters.role === 'blocked' && user.is_blocked);
        
        // Фильтр по статусу
        const userSessions = sessions.filter(session => session.user_id === user.id);
        const isActive = userSessions.length > 0;
        const matchesStatus = filters.status === 'all' ||
            (filters.status === 'active' && isActive) ||
            (filters.status === 'inactive' && !isActive) ||
            (filters.status === 'blocked' && user.is_blocked);
        
        // Фильтр по платформе
        const userPlatforms = userSessions.map(session => session.platform).filter(Boolean);
        const matchesPlatform = filters.platform === 'all' ||
            userPlatforms.includes(filters.platform);
        
        // Фильтр по интеграциям
        const userIntegrations = integrations.filter(integration => integration.user_id === user.id);
        const hasIntegrations = userIntegrations.length > 0;
        const matchesIntegrations = filters.hasIntegrations === 'all' ||
            (filters.hasIntegrations === 'yes' && hasIntegrations) ||
            (filters.hasIntegrations === 'no' && !hasIntegrations);
        
        return matchesSearch && matchesRole && matchesStatus && matchesPlatform && matchesIntegrations;
    });

    useEffect(() => {
        loadUsers();
        loadSessions();
        loadIntegrations();
        loadWhitelist();
    }, []);

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
                    <span className="ml-2 text-lg">Загрузка пользователей...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-6 text-foreground flex items-center">
                        <Users className="w-8 h-8 mr-3 text-purple-500" />
                        Управление пользователями
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Редактирование и блокировка пользователей системы
                    </p>
                </div>
                
                <div className="flex items-center space-x-4">
                    <Button onClick={activeSubTab === 'users' ? loadUsers : loadSessions} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Обновить
                    </Button>
                </div>
            </div>

            {/* Подтабы */}
            <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg mb-6">
                <Button
                    variant={activeSubTab === 'users' ? 'default' : 'ghost'}
                    onClick={() => setActiveSubTab('users')}
                    className={`flex-1 ${activeSubTab === 'users' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                >
                    <Users className="h-4 w-4 mr-2" />
                    Пользователи
                </Button>
                <Button
                    variant={activeSubTab === 'sessions' ? 'default' : 'ghost'}
                    onClick={() => setActiveSubTab('sessions')}
                    className={`flex-1 ${activeSubTab === 'sessions' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                >
                    <Activity className="h-4 w-4 mr-2" />
                    Сессии
                </Button>
                <Button
                    variant={activeSubTab === 'whitelist' ? 'default' : 'ghost'}
                    onClick={() => setActiveSubTab('whitelist')}
                    className={`flex-1 ${activeSubTab === 'whitelist' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                >
                    <List className="h-4 w-4 mr-2" />
                    TTS Whitelist
                </Button>
            </div>


            {/* Контент в зависимости от активного подтаба */}
            {activeSubTab === 'users' ? (
                <>
                    {/* Поиск и фильтры */}
                    <div className="space-y-4">
                        {/* Поиск */}
                        <div className="flex items-center space-x-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="Поиск пользователей..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button variant="outline" onClick={clearFilters}>
                                <Filter className="w-4 h-4 mr-2" />
                                Сбросить фильтры
                            </Button>
                        </div>

                        {/* Панель фильтров */}
                        <Card className="bg-slate-800/50">
                            <CardContent className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {/* Фильтр по роли */}
                                    <div>
                                        <Label className="text-sm font-medium mb-2 block">Роль</Label>
                                        <Select value={filters.role} onValueChange={(value) => updateFilter('role', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Все роли" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все роли</SelectItem>
                                                <SelectItem value="admin">Администраторы</SelectItem>
                                                <SelectItem value="user">Пользователи</SelectItem>
                                                <SelectItem value="blocked">Заблокированные</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Фильтр по статусу */}
                                    <div>
                                        <Label className="text-sm font-medium mb-2 block">Статус</Label>
                                        <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Все статусы" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все статусы</SelectItem>
                                                <SelectItem value="active">Активные</SelectItem>
                                                <SelectItem value="inactive">Неактивные</SelectItem>
                                                <SelectItem value="blocked">Заблокированные</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Фильтр по платформе */}
                                    <div>
                                        <Label className="text-sm font-medium mb-2 block">Платформа</Label>
                                        <Select value={filters.platform} onValueChange={(value) => updateFilter('platform', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Все платформы" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все платформы</SelectItem>
                                                <SelectItem value="twitch">Twitch</SelectItem>
                                                <SelectItem value="vk">VK Live</SelectItem>
                                                <SelectItem value="youtube">YouTube</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Фильтр по интеграциям */}
                                    <div>
                                        <Label className="text-sm font-medium mb-2 block">Интеграции</Label>
                                        <Select value={filters.hasIntegrations} onValueChange={(value) => updateFilter('hasIntegrations', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Все" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все</SelectItem>
                                                <SelectItem value="yes">С интеграциями</SelectItem>
                                                <SelectItem value="no">Без интеграций</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Список пользователей */}
                    <div className="grid gap-4">
                        {filteredUsers.map((user) => {
                            const userSessions = sessions.filter(session => session.user_id === user.id);
                            const userIntegrations = integrations.filter(integration => integration.user_id === user.id);
                            const isExpanded = expandedUsers.has(user.id);
                            const isActive = userSessions.length > 0;
                            
                            return (
                                <Card key={user.id} className={`${user.is_blocked ? 'border-red-500/50 bg-red-900/20' : 'border-slate-700'} transition-all duration-200 hover:border-purple-500/50`}>
                                    <CardContent className="p-6">
                                        {/* Основная информация */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="flex-shrink-0">
                                                    {user.is_admin ? (
                                                        <Shield className="w-8 h-8 text-purple-500" />
                                                    ) : (
                                                        <Users className="w-8 h-8 text-gray-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3">
                                                        <h3 className="text-lg font-semibold flex items-center space-x-2">
                                                            <span>User_{user.id}</span>
                                                            {user.is_admin && (
                                                                <Badge variant="default" className="bg-purple-600">Админ</Badge>
                                                            )}
                                                            {user.is_blocked && (
                                                                <Badge variant="destructive">Заблокирован</Badge>
                                                            )}
                                                            {isActive && (
                                                                <Badge variant="outline" className="border-green-500 text-green-400">
                                                                    <Wifi className="w-3 h-3 mr-1" />
                                                                    Активен
                                                                </Badge>
                                                            )}
                                                        </h3>
                                                    </div>
                                                    <p className="text-sm text-gray-400 mt-1">
                                                        ID: {user.id} • Создан: {formatDate(user.created_at)}
                                                    </p>
                                                    {user.is_blocked && (
                                                        <p className="text-sm text-red-400 mt-1">
                                                            Причина: {user.blocked_reason || 'Не указана'} • 
                                                            Заблокирован: {formatDate(user.blocked_at)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => toggleUserExpansion(user.id)}
                                                >
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </Button>
                                                
                                                <div className="flex items-center space-x-1">
                                                    {user.is_blocked ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => unblockUser(user.id)}
                                                            className="text-green-400 border-green-500 hover:bg-green-500/20"
                                                        >
                                                            <Unlock className="w-4 h-4 mr-1" />
                                                            Разблокировать
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openBlockDialog(user)}
                                                            className="text-red-400 border-red-500 hover:bg-red-500/20"
                                                        >
                                                            <Ban className="w-4 h-4 mr-1" />
                                                            Заблокировать
                                                        </Button>
                                                    )}
                                                    
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openEditDialog(user)}
                                                        className="text-blue-400 border-blue-500 hover:bg-blue-500/20"
                                                    >
                                                        <Edit className="w-4 h-4 mr-1" />
                                                        Редактировать
                                                    </Button>
                                                    
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => deleteUser(user.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-1" />
                                                        Удалить
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Развернутая информация */}
                                        {isExpanded && (
                                            <div className="mt-6 pt-6 border-t border-slate-700">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    {/* Активные сессии */}
                                                    <div>
                                                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
                                                            <Activity className="w-4 h-4 mr-2" />
                                                            Активные сессии ({userSessions.length})
                                                        </h4>
                                                        {userSessions.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {userSessions.map((session, index) => (
                                                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                                                        <div className="flex items-center space-x-3">
                                                                            {session.platform === 'twitch' && <Tv className="w-4 h-4 text-purple-400" />}
                                                                            {session.platform === 'vk' && <Globe className="w-4 h-4 text-blue-400" />}
                                                                            {session.platform === 'youtube' && <Youtube className="w-4 h-4 text-red-400" />}
                                                                            <div>
                                                                                <p className="text-sm font-medium">
                                                                                    {session.platform === 'twitch' && 'Twitch'}
                                                                                    {session.platform === 'vk' && 'VK Live'}
                                                                                    {session.platform === 'youtube' && 'YouTube'}
                                                                                </p>
                                                                                <p className="text-xs text-gray-400">
                                                                                    Подключен: {formatDate(session.connected_at)}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => {
                                                                                // TODO: Завершить сессию
                                                                                toast.info('Функция завершения сессии будет добавлена');
                                                                            }}
                                                                            className="text-red-400 border-red-500 hover:bg-red-500/20"
                                                                        >
                                                                            <WifiOff className="w-3 h-3 mr-1" />
                                                                            Завершить
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-500 italic">Нет активных сессий</p>
                                                        )}
                                                    </div>

                                                    {/* Интеграции */}
                                                    <div>
                                                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
                                                            <Settings className="w-4 h-4 mr-2" />
                                                            Интеграции ({userIntegrations.length})
                                                        </h4>
                                                        {userIntegrations.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {userIntegrations.map((integration, index) => (
                                                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                                                        <div className="flex items-center space-x-3">
                                                                            {integration.platform === 'twitch' && <Tv className="w-4 h-4 text-purple-400" />}
                                                                            {integration.platform === 'vk' && <Globe className="w-4 h-4 text-blue-400" />}
                                                                            {integration.platform === 'youtube' && <Youtube className="w-4 h-4 text-red-400" />}
                                                                            <div>
                                                                                <p className="text-sm font-medium">
                                                                                    {integration.platform === 'twitch' && 'Twitch'}
                                                                                    {integration.platform === 'vk' && 'VK Live'}
                                                                                    {integration.platform === 'youtube' && 'YouTube'}
                                                                                </p>
                                                                                <p className="text-xs text-gray-400">
                                                                                    {integration.is_active ? 'Активна' : 'Неактивна'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => {
                                                                                // TODO: Управление интеграцией
                                                                                toast.info('Функция управления интеграциями будет добавлена');
                                                                            }}
                                                                            className="text-blue-400 border-blue-500 hover:bg-blue-500/20"
                                                                        >
                                                                            <Settings className="w-3 h-3 mr-1" />
                                                                            Управление
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-500 italic">Нет подключенных интеграций</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    {/* Статистика сессий */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <div className="p-3 bg-green-600/20 rounded-lg">
                                        <Users className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm text-slate-400">Активные сессии</p>
                                        <p className="text-2xl font-bold text-white">
                                            {sessions.filter(s => s.session_type === 'active_user').length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <div className="p-3 bg-blue-600/20 rounded-lg">
                                        <Monitor className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm text-slate-400">Всего сессий</p>
                                        <p className="text-2xl font-bold text-white">{sessions.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <div className="p-3 bg-purple-600/20 rounded-lg">
                                        <Clock className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm text-slate-400">Неактивные</p>
                                        <p className="text-2xl font-bold text-white">
                                            {sessions.filter(s => s.session_type === 'pending_verification').length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Список сессий */}
                    <div className="space-y-4">
                        {sessionsLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
                                <span className="ml-2 text-lg">Загрузка сессий...</span>
                            </div>
                        ) : sessions.length === 0 ? (
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardContent className="p-8 text-center">
                                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                                    <p className="text-lg font-medium mb-2 text-white">Нет активных сессий</p>
                                    <p className="text-sm text-slate-400">Активные сессии будут отображаться здесь</p>
                                </CardContent>
                            </Card>
                        ) : (
                            sessions.map((session) => (
                                <Card key={session.user_id || session.channel} className="bg-slate-800/50 border-slate-700">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <Users className="w-4 h-4 text-green-500" />
                                                    <span className="font-medium text-white">
                                                        {session.channel || `User_${session.user_id}`}
                                                    </span>
                                                    {session.is_admin && (
                                                        <Badge variant="outline" className="text-purple-600 border-purple-200">
                                                            Админ
                                                        </Badge>
                                                    )}
                                                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                                        Активна
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center space-x-4 text-xs text-slate-400">
                                                    <span>ID: {session.user_id || session.channel}</span>
                                                    <span>Создана: {new Date(session.created_at).toLocaleString('ru-RU')}</span>
                                                    <span>Активность: {formatLastActivity(session.last_activity)}</span>
                                                </div>
                                                
                                                {/* Twitch каналы */}
                                                {session.twitch_channels && session.twitch_channels.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="text-xs font-medium text-purple-300 flex items-center">
                                                            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                                                            Twitch каналы:
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {session.twitch_channels.map((channel, idx) => (
                                                                <Badge key={idx} variant="outline" className="text-xs bg-purple-900/20 border-purple-500/30 text-purple-300">
                                                                    {channel.display_name || channel.channel_name}
                                                                    {channel.is_live && (
                                                                        <span className="ml-1 w-1.5 h-1.5 bg-red-500 rounded-full inline-block"></span>
                                                                    )}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* VK каналы */}
                                                {session.vk_channels && session.vk_channels.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="text-xs font-medium text-blue-300 flex items-center">
                                                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                                            VK Live каналы:
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {session.vk_channels.map((channel, idx) => (
                                                                <Badge key={idx} variant="outline" className="text-xs bg-blue-900/20 border-blue-500/30 text-blue-300">
                                                                    {channel.display_name || channel.channel_name}
                                                                    {channel.is_live && (
                                                                        <span className="ml-1 w-1.5 h-1.5 bg-red-500 rounded-full inline-block"></span>
                                                                    )}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => terminateSession(session)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                Завершить
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* Диалог редактирования */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактировать пользователя</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>ID пользователя: {currentUser?.id}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="edit_is_admin"
                                checked={editForm.is_admin}
                                onChange={(e) => setEditForm({...editForm, is_admin: e.target.checked})}
                            />
                            <Label htmlFor="edit_is_admin">Администратор</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button onClick={updateUser}>
                            Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Диалог блокировки */}
            <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Заблокировать пользователя</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Заблокировать пользователя <strong>User_{currentUser?.id}</strong>?
                        </p>
                        <div>
                            <Label htmlFor="block_reason">Причина блокировки</Label>
                            <Textarea
                                id="block_reason"
                                value={blockForm.reason}
                                onChange={(e) => setBlockForm({...blockForm, reason: e.target.value})}
                                placeholder="Укажите причину блокировки..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button variant="destructive" onClick={blockUser}>
                            Заблокировать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagementPage;
