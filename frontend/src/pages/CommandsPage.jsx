import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
    Terminal, 
    Edit2, 
    Trash2, 
    Save, 
    X, 
    Plus,
    Settings,
    Users,
    Shield,
    ShieldCheck,
    Crown,
    Clock,
    Hash,
    MessageSquare,
    Twitch,
    Volume2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import api from '../services/api';
import { toast } from 'sonner';

const CommandsPage = () => {
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    
    const [basicCommands, setBasicCommands] = useState([]);
    const [customCommands, setCustomCommands] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Состояния для создания/редактирования команд
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingCommand, setEditingCommand] = useState(null);
    
    const [createForm, setCreateForm] = useState({
        command_name: '',
        response_text: '',
        platforms: 'twitch,vk',
        allowed_roles: 'all',
        cooldown_seconds: 0,
        is_enabled: true
    });
    
    const [editForm, setEditForm] = useState({
        is_enabled: true,
        platforms: 'twitch,vk',
        allowed_roles: 'all',
        cooldown_seconds: 0,
        response_text: ''
    });

    const roleOptions = [
        { value: 'all', label: 'Все', icon: <Users className="h-3 w-3" /> },
        { value: 'vips', label: 'VIP', icon: <Shield className="h-3 w-3" /> },
        { value: 'mods', label: 'Модераторы', icon: <ShieldCheck className="h-3 w-3" /> },
        { value: 'broadcaster', label: 'Стример', icon: <Crown className="h-3 w-3" /> }
    ];

    const platformOptions = [
        { value: 'twitch,vk', label: 'Все платформы', enabled: integrations.twitch?.enabled && integrations.vk?.enabled },
        { value: 'twitch', label: 'Только Twitch', enabled: integrations.twitch?.enabled },
        { value: 'vk', label: 'Только VK Live', enabled: integrations.vk?.enabled }
    ];

    useEffect(() => {
        if (isAuthenticated) {
            loadCommands();
        }
    }, [isAuthenticated]);

    const loadCommands = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/commands');
            setBasicCommands(response.data.basic_commands || []);
            setCustomCommands(response.data.custom_commands || []);
        } catch (error) {
            console.error('Error loading commands:', error);
            toast.error('Ошибка загрузки команд');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCommand = async () => {
        try {
            await api.post('/api/commands', createForm);
            toast.success('Кастомная команда создана!');
            setIsCreateDialogOpen(false);
            setCreateForm({
                command_name: '',
                response_text: '',
                platforms: 'twitch,vk',
                allowed_roles: 'all',
                cooldown_seconds: 0,
                is_enabled: true
            });
            loadCommands();
        } catch (error) {
            console.error('Error creating command:', error);
            toast.error(error.response?.data?.detail || 'Ошибка создания команды');
        }
    };

    const handleUpdateCommand = async (commandName) => {
        try {
            await api.put(`/api/commands/${commandName}`, editForm);
            toast.success('Команда обновлена!');
            setIsEditDialogOpen(false);
            setEditingCommand(null);
            loadCommands();
        } catch (error) {
            console.error('Error updating command:', error);
            toast.error('Ошибка обновления команды');
        }
    };

    const handleToggleCommand = async (commandName, data) => {
        try {
            await api.put(`/api/commands/${commandName}`, data);
            toast.success('Команда обновлена!');
            loadCommands();
        } catch (error) {
            console.error('Error toggling command:', error);
            toast.error('Ошибка переключения команды');
        }
    };

    const handleDeleteCommand = async (commandId) => {
        if (!confirm('Вы уверены, что хотите удалить эту команду?')) return;
        
        try {
            await api.delete(`/api/commands/${commandId}`);
            toast.success('Команда удалена!');
            loadCommands();
        } catch (error) {
            console.error('Error deleting command:', error);
            toast.error('Ошибка удаления команды');
        }
    };

    const openEditDialog = (command) => {
        setEditingCommand(command);
        setEditForm({
            is_enabled: command.is_enabled,
            platforms: command.platforms,
            allowed_roles: command.allowed_roles,
            cooldown_seconds: command.cooldown_seconds,
            response_text: command.response_text || ''
        });
        setIsEditDialogOpen(true);
    };

    const getRoleLabel = (role) => {
        const option = roleOptions.find(opt => opt.value === role);
        return option ? option.label : role;
    };

    const getRoleIcon = (role) => {
        const option = roleOptions.find(opt => opt.value === role);
        return option ? option.icon : <Users className="h-3 w-3" />;
    };

    const getPlatformLabel = (platforms) => {
        if (platforms === 'twitch,vk') return 'Все платформы';
        if (platforms === 'twitch') return 'Twitch';
        if (platforms === 'vk') return 'VK Live';
        return platforms;
    };

    const CommandCard = ({ command, type }) => (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-primary" />
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            !{command.command_name}
                        </code>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant={command.is_enabled ? "default" : "secondary"}>
                                {command.is_enabled ? 'Включена' : 'Отключена'}
                            </Badge>
                            <Switch
                                checked={command.is_enabled}
                                onCheckedChange={(checked) => handleToggleCommand(command.command_name, { is_enabled: checked })}
                            />
                        </div>
                        {type === 'custom' && (
                            <Badge variant="outline">Кастомная</Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    {command.description}
                </p>
                
                {command.response_text && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-1">Ответ:</p>
                        <p className="text-xs text-muted-foreground">"{command.response_text}"</p>
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 text-xs">
                        {getRoleIcon(command.allowed_roles)}
                        <span>{getRoleLabel(command.allowed_roles)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        <span>{command.cooldown_seconds}с</span>
                    </div>
                </div>

                <div className="text-xs text-muted-foreground">
                    Платформы: {getPlatformLabel(command.platforms)}
                </div>

                <div className="flex gap-2 pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(command)}
                        className="flex-1"
                    >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Настроить
                    </Button>
                    {type === 'custom' && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteCommand(command.id)}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    if (!isAuthenticated) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="flex items-center justify-center h-64">
                        <div className="text-center space-y-4">
                            <Settings className="h-16 w-16 mx-auto text-muted-foreground" />
                            <p className="text-muted-foreground">Войдите в систему для управления командами</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Команды чата</h1>
            </div>

            <Tabs defaultValue="basic" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="basic">Базовые команды</TabsTrigger>
                    <TabsTrigger value="custom">Кастомные команды</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Базовые команды
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Встроенные команды бота. Можно настроить синтаксис, кулдаун и права доступа.
                            </p>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8">Загрузка команд...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {basicCommands.map(command => (
                                        <CommandCard
                                            key={command.command_name}
                                            command={command}
                                            type="basic"
                                        />
                                    ))}
                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="custom" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Terminal className="h-5 w-5" />
                                    Кастомные команды
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Создавайте собственные команды с настраиваемыми ответами.
                                </p>
                            </div>
                            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Создать команду
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Создать кастомную команду</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="command_name">Название команды</Label>
                                <Input
                                    id="command_name"
                                    placeholder="tg (без символа !)"
                                    value={createForm.command_name}
                                    onChange={(e) => setCreateForm(prev => ({
                                        ...prev,
                                        command_name: e.target.value.replace('!', '')
                                    }))}
                                />
                            </div>
                            <div>
                                <Label htmlFor="response_text">Ответ команды</Label>
                                <Textarea
                                    id="response_text"
                                    placeholder="Подписывайтесь на мой Telegram канал: https://t.me/..."
                                    value={createForm.response_text}
                                    onChange={(e) => setCreateForm(prev => ({
                                        ...prev,
                                        response_text: e.target.value
                                    }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Платформы</Label>
                                    <Select
                                        value={createForm.platforms}
                                        onValueChange={(value) => setCreateForm(prev => ({
                                            ...prev,
                                            platforms: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {platformOptions.filter(opt => opt.enabled).map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Доступ</Label>
                                    <Select
                                        value={createForm.allowed_roles}
                                        onValueChange={(value) => setCreateForm(prev => ({
                                            ...prev,
                                            allowed_roles: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roleOptions.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <div className="flex items-center gap-2">
                                                        {option.icon}
                                                        {option.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="cooldown">Кулдаун (секунды)</Label>
                                <Input
                                    id="cooldown"
                                    type="number"
                                    min="0"
                                    value={createForm.cooldown_seconds}
                                    onChange={(e) => setCreateForm(prev => ({
                                        ...prev,
                                        cooldown_seconds: parseInt(e.target.value) || 0
                                    }))}
                                />
                </div>
            </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button onClick={handleCreateCommand}>
                                <Save className="h-4 w-4 mr-2" />
                                Создать
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                                </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8">Загрузка команд...</div>
                            ) : customCommands.length === 0 ? (
                                <div className="text-center py-8 space-y-4">
                                    <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground" />
                                    <div>
                                        <p className="text-muted-foreground">Кастомных команд пока нет</p>
                                        <p className="text-sm text-muted-foreground">
                                            Создайте первую команду, чтобы начать
                                        </p>
                                    </div>
                                    </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {customCommands.map(command => (
                                        <CommandCard
                                            key={command.id}
                                            command={command}
                                            type="custom"
                                        />
                        ))}
                    </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Диалог редактирования команды */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Настройка команды !{editingCommand?.command_name}
                        </DialogTitle>
                    </DialogHeader>
                    {editingCommand && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Включена</Label>
                                <Switch
                                    checked={editForm.is_enabled}
                                    onCheckedChange={(checked) => setEditForm(prev => ({
                                        ...prev,
                                        is_enabled: checked
                                    }))}
                                />
                            </div>
                            
                            {editingCommand.command_type === 'custom' && (
                                <div>
                                    <Label htmlFor="edit_response">Ответ команды</Label>
                                    <Textarea
                                        id="edit_response"
                                        value={editForm.response_text}
                                        onChange={(e) => setEditForm(prev => ({
                                            ...prev,
                                            response_text: e.target.value
                                        }))}
                                    />
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Платформы</Label>
                                    <Select
                                        value={editForm.platforms}
                                        onValueChange={(value) => setEditForm(prev => ({
                                            ...prev,
                                            platforms: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {platformOptions.filter(opt => opt.enabled).map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Доступ</Label>
                                    <Select
                                        value={editForm.allowed_roles}
                                        onValueChange={(value) => setEditForm(prev => ({
                                            ...prev,
                                            allowed_roles: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roleOptions.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <div className="flex items-center gap-2">
                                                        {option.icon}
                                                        {option.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <div>
                                <Label htmlFor="edit_cooldown">Кулдаун (секунды)</Label>
                                <Input
                                    id="edit_cooldown"
                                    type="number"
                                    min="0"
                                    value={editForm.cooldown_seconds}
                                    onChange={(e) => setEditForm(prev => ({
                                        ...prev,
                                        cooldown_seconds: parseInt(e.target.value) || 0
                                    }))}
                                />
                            </div>
            </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button onClick={() => handleUpdateCommand(editingCommand?.command_name)}>
                            <Save className="h-4 w-4 mr-2" />
                            Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CommandsPage;