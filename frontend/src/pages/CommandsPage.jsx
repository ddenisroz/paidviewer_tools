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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Terminal, 
    Edit2, 
    Trash2, 
    Save, 
    X, 
    Plus,
    Settings,
    Users,
    ShieldCheck,
    Crown,
    Clock,
    Hash,
    MessageSquare,
    Search,
    Twitch,
    Star,
    Filter,
    ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import api from '../services/api';
import { toast } from 'sonner';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageLoader } from '@/components/ui/loader';
import PageWrapper from '../components/PageWrapper';


    const CommandsPage = () => {
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    
    const [basicCommands, setBasicCommands] = useState([]);
    const [customCommands, setCustomCommands] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Состояния для фильтрации базовых команд (как в Excel)
    const [basicSearchTerm, setBasicSearchTerm] = useState('');
    const [selectedBasicTags, setSelectedBasicTags] = useState([]);
    const [basicTags, setBasicTags] = useState([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    
    // Состояния для создания/редактирования команд
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingCommand, setEditingCommand] = useState(null);
    
    const [createForm, setCreateForm] = useState({
        command_name: '',
        response_text: '',
        platforms: 'twitch,vk',
        allowed_roles: 'all', // Пока оставляем строкой
        cooldown_seconds: 0,
        is_enabled: true
    });
    
    const [editForm, setEditForm] = useState({
        is_enabled: true,
        platforms: 'twitch,vk',
        allowed_roles: 'all', // Пока оставляем строкой
        cooldown_seconds: 0,
        response_text: ''
    });

    // Роли согласно Twitch API и VK API
    // Twitch: broadcaster, moderator, vip, subscriber, founder
    // VK: owner (алиас broadcaster), moderator
    // Владелец канала (broadcaster) имеет доступ ко всем командам автоматически
    const roleOptions = [
        { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
        { value: 'moderator', label: 'Модераторы', icon: <ShieldCheck className="h-3 w-3" /> },
        { value: 'vip', label: 'VIP (только Twitch)', icon: <Star className="h-3 w-3" /> },
        { value: 'subscriber', label: 'Подписчики (только Twitch)', icon: <Star className="h-3 w-3" /> }
    ];


    const platformOptions = [
        { value: 'twitch,vk', label: 'Все платформы', enabled: integrations?.twitch?.enabled && integrations?.vk?.enabled },
        { value: 'twitch', label: 'Только Twitch', enabled: integrations?.twitch?.enabled },
        { value: 'vk', label: 'Только VK Live', enabled: integrations?.vk?.enabled }
    ];

    // Получаем доступные платформы
    const availablePlatforms = platformOptions.filter(opt => opt.enabled);
    
    // Если ни одна платформа не подключена, показываем все
    const platformsToShow = availablePlatforms.length > 0 ? availablePlatforms : platformOptions;

    useEffect(() => {
        if (isAuthenticated) {
            loadCommands();
        }
    }, [isAuthenticated]);

    const loadCommands = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/commands');
            
            const basicCommandsData = response.data.basic_commands || [];
            
            setBasicCommands(basicCommandsData);
            setCustomCommands(response.data.custom_commands || []);
            
            // Извлекаем уникальные теги из базовых команд
            const tags = [...new Set(basicCommandsData.flatMap(cmd => {
                return Array.isArray(cmd.tags) ? cmd.tags : [];
            }))];
            
            setBasicTags(tags);
            
        } catch (error) {
            console.error('Error loading commands:', error);
            toast.error('Ошибка загрузки команд');
        } finally {
            setLoading(false);
        }
    };

    // Функция для фильтрации базовых команд (как в Excel)
    const getFilteredBasicCommands = () => {
        return basicCommands.filter(command => {
            const matchesSearch = command.command_name.toLowerCase().includes(basicSearchTerm.toLowerCase()) ||
                                command.description?.toLowerCase().includes(basicSearchTerm.toLowerCase());
            
            // Если не выбрано ни одного тега - показываем все
            if (selectedBasicTags.length === 0) {
                return matchesSearch;
            }
            
            // Проверяем, есть ли хотя бы один выбранный тег в команде
            const matchesTags = selectedBasicTags.some(selectedTag => 
                command.tags && Array.isArray(command.tags) && command.tags.includes(selectedTag)
            );
            
            return matchesSearch && matchesTags;
        });
    };

    // Проверяем, выбраны ли все теги
    const areAllTagsSelected = selectedBasicTags.length === basicTags.length && basicTags.length > 0;

    // Функции для работы с фильтрами (как в Excel)
    const toggleTag = (tag) => {
        setSelectedBasicTags(prev => 
            prev.includes(tag) 
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    const clearAllFilters = () => {
        setSelectedBasicTags([]);
    };

    const selectAllFilters = () => {
        setSelectedBasicTags([...basicTags]);
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
        // Оптимистичное обновление - сразу меняем состояние
        setBasicCommands(prev => 
            prev.map(cmd => 
                cmd.command_name === commandName 
                    ? { ...cmd, ...data }
                    : cmd
            )
        );
        
        setCustomCommands(prev => 
            prev.map(cmd => 
                cmd.command_name === commandName 
                    ? { ...cmd, ...data }
                    : cmd
            )
        );
        
        // Отправляем запрос в фоне
        try {
            await api.put(`/api/commands/${commandName}`, data);
        } catch (error) {
            console.error('Error toggling command:', error);
            toast.error('Ошибка переключения команды');
            // Откатываем изменения при ошибке
            loadCommands();
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
            platforms: command.platforms || 'twitch,vk',
            allowed_roles: command.allowed_roles || 'all',
            cooldown_seconds: command.cooldown_seconds || 0,
            response_text: command.response_text || ''
        });
        setIsEditDialogOpen(true);
    };

    const getRoleLabel = (role) => {
        // Broadcaster всегда имеет доступ ко всем командам
        if (role === 'broadcaster') {
            return 'Владелец канала';
        }
        
        // Нормализуем роль - сортируем для совместимости
        const normalizedRole = role?.split(',').sort().join(',');
        const option = roleOptions.find(opt => {
            const normalizedValue = opt.value?.split(',').sort().join(',');
            return normalizedValue === normalizedRole;
        });
        return option ? option.label : role;
    };

    const getRoleIcon = (role) => {
        // Broadcaster всегда имеет доступ ко всем командам
        if (role === 'broadcaster') {
            return <Crown className="h-3 w-3" />;
        }
        
        const normalizedRole = role?.split(',').sort().join(',');
        const option = roleOptions.find(opt => {
            const normalizedValue = opt.value?.split(',').sort().join(',');
            return normalizedValue === normalizedRole;
        });
        return option ? option.icon : <Users className="h-3 w-3" />;
    };

    const getPlatformLabel = (platforms) => {
        if (platforms === 'twitch,vk') return 'Все платформы';
        if (platforms === 'twitch') return 'Twitch';
        if (platforms === 'vk') return 'VK Live';
        return platforms;
    };

    const CommandCard = React.memo(({ command, type }) => (
        <Card className="h-full transition-all duration-300 ease-in-out">
            <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-3 w-3 text-primary" />
                        <code className="text-sm font-bold font-mono bg-muted px-2 py-1 rounded text-foreground">
                            !{command.command_name}
                        </code>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 transition-all duration-300 ease-in-out">
                            <Badge variant={command.is_enabled ? "default" : "secondary"} className="transition-all duration-300 ease-in-out">
                                {command.is_enabled ? 'Включена' : 'Отключена'}
                            </Badge>
                            <Switch
                                checked={command.is_enabled}
                                onCheckedChange={(checked) => handleToggleCommand(command.command_name, { is_enabled: checked })}
                                className="transition-all duration-300 ease-in-out"
                            />
                        </div>
                        {type === 'custom' && (
                            <Badge variant="outline">Кастомная</Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Описание */}
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {command.description || 'Описание команды не указано'}
                </p>
                
                {/* Ответ команды */}
                {command.response_text && (
                    <div className="p-2 bg-muted/30 rounded-md border-l-2 border-primary/20">
                        <p className="text-xs font-medium text-primary mb-1">Ответ:</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">"{command.response_text}"</p>
                    </div>
                )}

                {/* Метаданные в одну строку */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                        {getRoleIcon(command.allowed_roles)}
                        <span>{getRoleLabel(command.allowed_roles)}</span>
                    </div>
                        <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{command.cooldown_seconds}с</span>
                    </div>
            </div>
                    <div className="text-right">
                        {getPlatformLabel(command.platforms || 'twitch,vk')}
                    </div>
                </div>

                {/* Теги */}
                {command.tags && Array.isArray(command.tags) && command.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {command.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Кнопки действий */}
                <div className="flex gap-2 pt-2 border-t border-border/30">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(command)}
                        className="flex-1 h-8 text-xs"
                    >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Настроить
                    </Button>
                    {type === 'custom' && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteCommand(command.id)}
                            className="h-8 w-8 p-0"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                                </div>
            </CardContent>
        </Card>
    ));

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Команды чата">
                <Card>
                    <CardContent className="flex items-center justify-center h-64">
                        <div className="text-center space-y-4">
                            <Settings className="h-16 w-16 mx-auto text-muted-foreground" />
                            <p className="text-muted-foreground">Войдите в систему для управления командами</p>
                        </div>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    // Ранний return для загрузки - сохраняем структуру контейнера
    if (loading) {
        return (
            <PageWrapper title="Команды чата">
                <PageLoader message="Загрузка команд..." />
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Команды чата">
            <Tabs defaultValue="basic" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="basic">Базовые команды</TabsTrigger>
                    <TabsTrigger value="custom">Кастомные команды</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <Card className="transition-all duration-200">
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
                            {/* Фильтры для базовых команд */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                
                                {/* Поиск */}
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                        <Input
                                            placeholder="Поиск команд..."
                                            value={basicSearchTerm}
                                            onChange={(e) => setBasicSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                
                                {/* Фильтр как в Excel */}
                                <div className="relative">
                                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-9 min-w-[180px]">
                                                <Filter className="h-4 w-4 mr-2" />
                                                Фильтр по тегам
                                                {selectedBasicTags.length > 0 && (
                                                    <Badge variant="secondary" className="ml-2">
                                                        {selectedBasicTags.length}
                                                    </Badge>
                                                )}
                                                <ChevronDown className="h-4 w-4 ml-2" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-0" align="start">
                                            <div className="p-3 border-b">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium text-sm">Фильтр по тегам</h4>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant={areAllTagsSelected ? "default" : "ghost"}
                                                            size="sm"
                                                            onClick={selectAllFilters}
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            {areAllTagsSelected ? "Все ✓" : "Все"}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={clearAllFilters}
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            Очистить
                                                        </Button>
                                                    </div>
                                                </div>
                                                <Input
                                                    placeholder="Поиск тегов..."
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {basicTags.length > 0 ? (
                                                    basicTags.map(tag => (
                                                        <div
                                                            key={tag}
                                                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 cursor-pointer"
                                                            onClick={() => toggleTag(tag)}
                                                        >
                                                            <Checkbox
                                                                checked={selectedBasicTags.includes(tag)}
                                                                onChange={() => toggleTag(tag)}
                                                            />
                                                            <span className="text-sm flex-1">{tag}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-3 text-sm text-muted-foreground text-center">
                                                        Нет тегов
                                                    </div>
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-200">
                                    {getFilteredBasicCommands().map(command => (
                                        <div key={command.id} className="transition-all duration-200">
                                        <CommandCard
                                            command={command}
                                            type="basic"
                                        />
                                        </div>
                                    ))}
                </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="custom" className="space-y-4">
                    <Card className="transition-all duration-200">
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
                            <DialogDescription>
                                Создайте новую кастомную команду для вашего бота
                            </DialogDescription>
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
                                        value={createForm.platforms || 'twitch,vk'}
                                        onValueChange={(value) => setCreateForm(prev => ({
                                            ...prev,
                                            platforms: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите платформы" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {platformsToShow.map(option => (
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
                                            <SelectValue placeholder="Выберите доступ" />
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
                            {!loading && customCommands.length === 0 ? (
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-200">
                                    {customCommands.map(command => (
                                        <div key={command.id} className="transition-all duration-200">
                                        <CommandCard
                                            command={command}
                                            type="custom"
                                        />
                                        </div>
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
                        <DialogDescription>
                            Настройте параметры команды: платформы, роли и кулдаун
                        </DialogDescription>
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
                                        value={editForm.platforms || 'twitch,vk'}
                                        onValueChange={(value) => setEditForm(prev => ({
                                            ...prev,
                                            platforms: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите платформы" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {platformsToShow.map(option => (
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
                                            <SelectValue placeholder="Выберите доступ" />
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
        </PageWrapper>
    );
};

export default CommandsPage;
