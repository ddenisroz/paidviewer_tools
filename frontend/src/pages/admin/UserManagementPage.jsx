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
    Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' или 'sessions'
    
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

    const filteredUsers = users.filter(user =>
        `User_${user.id}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        loadUsers();
        loadSessions();
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
            </div>


            {/* Контент в зависимости от активного подтаба */}
            {activeSubTab === 'users' ? (
                <>
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
                    </div>

                    {/* Список пользователей */}
                    <div className="grid gap-4">
                        {filteredUsers.map((user) => (
                    <Card key={user.id} className={user.is_blocked ? 'border-red-200 bg-red-50' : ''}>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                        {user.is_admin ? (
                                            <Shield className="w-8 h-8 text-purple-500" />
                                        ) : (
                                            <Users className="w-8 h-8 text-gray-500" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold flex items-center space-x-2">
                                            <span>User_{user.id}</span>
                                            {user.is_admin && (
                                                <Badge variant="default">Админ</Badge>
                                            )}
                                            {user.is_blocked && (
                                                <Badge variant="destructive">Заблокирован</Badge>
                                            )}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            ID: {user.id} • Создан: {formatDate(user.created_at)}
                                        </p>
                                        {user.is_blocked && (
                                            <p className="text-sm text-red-600 mt-1">
                                                Причина: {user.blocked_reason || 'Не указана'} • 
                                                Заблокирован: {formatDate(user.blocked_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    {user.is_blocked ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => unblockUser(user.id)}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            Разблокировать
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openBlockDialog(user)}
                                        >
                                            <ShieldOff className="w-4 h-4 mr-1" />
                                            Заблокировать
                                        </Button>
                                    )}
                                    
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openEditDialog(user)}
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
                        </CardContent>
                    </Card>
                        ))}
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
