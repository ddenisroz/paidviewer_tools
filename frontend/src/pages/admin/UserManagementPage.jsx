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
    CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    
    // Формы
    const [editForm, setEditForm] = useState({
        display_name: '',
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

    const openEditDialog = (user) => {
        setCurrentUser(user);
        setEditForm({
            display_name: user.display_name,
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
        user.display_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        loadUsers();
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
                    <Button onClick={loadUsers} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Обновить
                    </Button>
                </div>
            </div>


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
                                            <span>{user.display_name}</span>
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

            {/* Диалог редактирования */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактировать пользователя</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit_display_name">Имя пользователя</Label>
                            <Input
                                id="edit_display_name"
                                value={editForm.display_name}
                                onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                                placeholder="Введите имя пользователя"
                            />
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
                            Заблокировать пользователя <strong>{currentUser?.display_name}</strong>?
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
