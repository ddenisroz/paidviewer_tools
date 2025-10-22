import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
    Terminal, 
    Edit2, 
    Trash2, 
    Save, 
    X, 
    RotateCcw, 
    Plus,
    Settings,
    Play,
    Users,
    Volume2,
    Shield,
    ShieldCheck,
    Crown,
    Search,
    Filter,
    Tag
} from 'lucide-react';
import api from '../../services/api';
import { CardSkeleton } from '@/components/ui/skeleton';
import PageLayout from '@/components/ui/PageLayout';
import { PageLoader } from '@/components/ui/loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CommandsManagementPage = () => {
    const { user } = useAuth();
    const channelName = user?.username;

    const [commands, setCommands] = useState({});
    const [loading, setLoading] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [editingCommand, setEditingCommand] = useState(null);
    const [editForm, setEditForm] = useState({ command: '', description: '', enabled: true, permissions: 'all', tags: '' });
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({ command: '', description: '', permissions: 'all', enabled: true, tags: 'пользовательские' });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState('all');

    const tagCategories = {
        'медиа запросы': { icon: <Play className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800' },
        'TTS озвучка': { icon: <Volume2 className="h-4 w-4" />, color: 'bg-green-100 text-green-800' },
        'управление': { icon: <Settings className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800' },
        'модерация': { icon: <Users className="h-4 w-4" />, color: 'bg-red-100 text-red-800' },
        'информация': { icon: <Terminal className="h-4 w-4" />, color: 'bg-gray-100 text-gray-800' },
        'пользовательские': { icon: <Tag className="h-4 w-4" />, color: 'bg-yellow-100 text-yellow-800' }
    };

    const getPermissionIcon = (permissions) => {
        switch (permissions) {
            case 'all': return <Shield className="h-3 w-3" />;
            case 'mods': return <ShieldCheck className="h-3 w-3" />;
            case 'broadcaster': return <Crown className="h-3 w-3" />;
            default: return <Shield className="h-3 w-3" />;
        }
    };

    const getPermissionLabel = (permissions) => {
        switch (permissions) {
            case 'all': return 'Все';
            case 'mods': return 'Модераторы';
            case 'broadcaster': return 'Стример';
            default: return 'Все';
        }
    };

    const fetchCommands = useCallback(async () => {
        if (channelName) {
            try {
                setLoading(true);
                const response = await api.get(`/api/commands`);
                const data = response.data;
                
                // Объединяем базовые и кастомные команды
                const allCommands = {};
                
                // Добавляем базовые команды
                if (data.basic_commands) {
                    data.basic_commands.forEach(cmd => {
                        allCommands[cmd.command_name] = {
                            ...cmd,
                            command: `!${cmd.command_name}`,
                            is_custom: false
                        };
                    });
                }
                
                // Добавляем кастомные команды
                if (data.custom_commands) {
                    data.custom_commands.forEach(cmd => {
                        allCommands[cmd.command_name] = {
                            ...cmd,
                            command: `!${cmd.command_name}`,
                            is_custom: true
                        };
                    });
                }
                
                setCommands(allCommands);
            } catch (error) {
                console.error('Failed to fetch commands:', error);
        } finally {
            setLoading(false);
            setShowSkeleton(false);
        }
        }
    }, [channelName]);

    // Функция для фильтрации команд
    const getFilteredCommands = () => {
        let filtered = Object.entries(commands);
        
        // Фильтр по поиску
        if (searchTerm) {
            filtered = filtered.filter(([key, cmd]) => 
                cmd.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cmd.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cmd.command_name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        // Фильтр по тегам
        if (selectedTag !== 'all') {
            filtered = filtered.filter(([key, cmd]) => 
                cmd.tags && cmd.tags.includes(selectedTag)
            );
        }
        
        return Object.fromEntries(filtered);
    };

    // Функция валидации команды
    const validateCommand = (commandName, responseText) => {
        const errors = [];
        const warnings = [];
        
        // Проверка названия команды
        if (!commandName) {
            errors.push("Название команды не может быть пустым");
        } else if (commandName.length < 2) {
            errors.push("Название команды должно содержать минимум 2 символа");
        } else if (commandName.length > 20) {
            errors.push("Название команды не должно превышать 20 символов");
        } else if (!/^[a-zA-Z0-9_-]+$/.test(commandName)) {
            errors.push("Название команды может содержать только буквы, цифры, _ и -");
        } else if (commandName.startsWith('_') || commandName.startsWith('-') || 
                   commandName.endsWith('_') || commandName.endsWith('-')) {
            errors.push("Название команды не должно начинаться или заканчиваться на _ или -");
        }
        
        // Проверка зарезервированных слов
        const reservedWords = ['admin', 'mod', 'owner', 'broadcaster', 'system', 'bot', 'api'];
        if (reservedWords.includes(commandName.toLowerCase())) {
            warnings.push(`'${commandName}' - зарезервированное слово, может конфликтовать с системными командами`);
        }
        
        // Проверка текста ответа
        if (responseText) {
            if (responseText.length > 500) {
                errors.push("Текст ответа не должен превышать 500 символов");
            } else if (responseText.trim().length === 0) {
                errors.push("Текст ответа не может быть пустым");
            }
            
            // Проверка на потенциально опасные символы
            const dangerousChars = ['<', '>', '&', '"', "'", '\\', '/', ';', '|', '`'];
            for (const char of dangerousChars) {
                if (responseText.includes(char)) {
                    warnings.push(`Текст содержит потенциально опасный символ: '${char}'`);
                }
            }
        }
        
        return { valid: errors.length === 0, errors, warnings };
    };

    useEffect(() => {
        fetchCommands();
    }, [fetchCommands]);

    const handleEditCommand = (commandKey) => {
        const command = commands[commandKey];
        setEditingCommand(commandKey);
        setEditForm({
            command: command.command,
            description: command.description,
            enabled: command.is_enabled,
            permissions: command.allowed_roles || 'all',
            tags: command.tags || ''
        });
    };
    
    const handleSaveCommand = async () => {
        try {
            const commandName = editingCommand.replace('!', '');
            
            // Валидация команды (только для кастомных команд)
            if (commands[editingCommand]?.is_custom) {
                const validation = validateCommand(commandName, editForm.description);
                if (!validation.valid) {
                    toast.error(`Ошибки валидации:\n${validation.errors.join('\n')}`);
                    return;
                }
                
                // Показываем предупреждения
                if (validation.warnings.length > 0) {
                    toast.warning(`Предупреждения:\n${validation.warnings.join('\n')}\n\nПродолжить сохранение команды?`);
                    // Продолжаем без подтверждения для лучшего UX
                }
            }
            
            const payload = {
                is_enabled: editForm.enabled,
                allowed_roles: editForm.permissions,
                tags: editForm.tags
            };
            
            // Если это кастомная команда, добавляем response_text
            if (commands[editingCommand]?.is_custom) {
                payload.response_text = editForm.description;
            }
            
            await api.put(`/api/commands/${commandName}`, payload);
            await fetchCommands();
            setEditingCommand(null);
        } catch (error) {
            console.error('Failed to update command:', error);
        }
    };

    const handleCreateCommand = async () => {
        try {
            const commandName = createForm.command.replace('!', '');
            
            // Валидация команды
            const validation = validateCommand(commandName, createForm.description);
            if (!validation.valid) {
                toast.error(`Ошибки валидации:\n${validation.errors.join('\n')}`);
                return;
            }
            
            // Показываем предупреждения
            if (validation.warnings.length > 0) {
                toast.warning(`Предупреждения:\n${validation.warnings.join('\n')}\n\nПродолжить создание команды?`);
                // Продолжаем без подтверждения для лучшего UX
            }
            
            const payload = {
                command_name: commandName,
                response_text: createForm.description,
                is_enabled: createForm.enabled,
                allowed_roles: createForm.permissions,
                tags: createForm.tags
            };
            await api.post(`/api/commands`, payload);
            await fetchCommands();
            setShowCreateForm(false);
            setCreateForm({ command: '', description: '', permissions: 'all', enabled: true, tags: 'пользовательские' });
        } catch (error) {
            console.error('Failed to create command:', error);
        }
    };

    const handleCancelEdit = () => {
        setEditingCommand(null);
    };

    const handleToggleCommand = async (commandKey, enabled) => {
        try {
            const commandName = commandKey.replace('!', '');
            await api.put(`/api/commands/${commandName}`, { is_enabled: enabled });
            await fetchCommands();
        } catch (error) {
            console.error('Failed to toggle command:', error);
        }
    };

    const handleResetCommands = async () => {
        // Используем toast для подтверждения вместо confirm
        toast.error('Функция сброса команд временно недоступна. Используйте интерфейс для редактирования команд.');
        return;
        
        // if (window.confirm('Вы уверены, что хотите сбросить все команды к значениям по умолчанию?')) {
            try {
                await api.post(`/api/commands/${channelName}/reset`);
                await fetchCommands();
            } catch (error) {
                console.error('Failed to reset commands:', error);
            }
        }
    };

    const renderCommandCard = (commandKey, command) => (
        <Card key={commandKey}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        {editingCommand === commandKey ? (
                            <div className="space-y-3 mt-3">
                                <div>
                                    <Label htmlFor={`command-${commandKey}`}>Команда</Label>
                                    <Input
                                        id={`command-${commandKey}`}
                                        value={editForm.command}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, command: e.target.value }))}
                                        placeholder="!help"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor={`description-${commandKey}`}>Описание</Label>
                                    <Input
                                        id={`description-${commandKey}`}
                                        value={editForm.description}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Описание команды"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor={`permissions-${commandKey}`}>Права доступа</Label>
                                    <Select
                                        value={editForm.permissions}
                                        onValueChange={(value) => setEditForm(prev => ({ ...prev, permissions: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите права" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Все пользователи</SelectItem>
                                            <SelectItem value="broadcaster,moderator,owner,moderator_vk">Модераторы и стример</SelectItem>
                                            <SelectItem value="broadcaster,owner">Только стример</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor={`tags-${commandKey}`}>Теги</Label>
                                    <Input
                                        id={`tags-${commandKey}`}
                                        value={editForm.tags}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                                        placeholder="медиа запросы, управление"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <Switch
                                        id={`enabled-${commandKey}`}
                                        checked={editForm.enabled}
                                        onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, enabled: checked }))}
                                    />
                                    <Label htmlFor={`enabled-${commandKey}`}>Включена</Label>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" onClick={handleSaveCommand}><Save className="h-4 w-4 mr-2" />Сохранить</Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelEdit}><X className="h-4 w-4 mr-2" />Отмена</Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-2">
                                    <Badge variant="secondary" className="font-mono">{command.command}</Badge>
                                    <Badge variant="outline" className="flex items-center gap-1">
                                        {getPermissionIcon(command.allowed_roles)}
                                        {getPermissionLabel(command.allowed_roles)}
                                    </Badge>
                                    {command.tags && (
                                        <div className="flex gap-1">
                                            {command.tags.split(',').map((tag, index) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="outline" 
                                                    className={`${tagCategories[tag.trim()]?.color || 'bg-gray-100 text-gray-800'} text-xs`}
                                                >
                                                    {tagCategories[tag.trim()]?.icon}
                                                    {tag.trim()}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="mb-2">
                                    <span className="text-sm text-muted-foreground">{command.description}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={command.is_enabled}
                                        onCheckedChange={(checked) => handleToggleCommand(commandKey, checked)}
                                    />
                                    <Label className="text-sm">Включена</Label>
                                    <Button size="sm" variant="ghost" onClick={() => handleEditCommand(commandKey)} className="ml-auto">
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const loadingContent = (
        <div className="space-y-6">
            {/* Кнопки */}
            <div className="flex gap-2">
                <div className="h-10 w-32"></div>
                <div className="h-10 w-40"></div>
            </div>
            
            {/* Поиск */}
            <div className="flex gap-4">
                <div className="flex-1 h-10"></div>
                <div className="h-10 w-24"></div>
            </div>
            
            {/* Tabs */}
            <Tabs defaultValue="basic" className="space-y-6">
                <TabsList>
                    <div className="h-9 w-32"></div>
                    <div className="h-9 w-36"></div>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <div className="h-32"></div>
                    <div className="h-32"></div>
                </TabsContent>

                <TabsContent value="custom" className="space-y-4">
                    <div className="h-32"></div>
                    <div className="h-32"></div>
                </TabsContent>
            </Tabs>
        </div>
    );

    return (
        <PageLayout 
            title="Управление командами"
            description="Настройте команды бота для вашего канала"
            loading={loading || showSkeleton}
            skeleton={loadingContent}
        >
            {!(loading || showSkeleton) && (
                <>
                <div className="flex gap-2">
                    <Button onClick={() => setShowCreateForm(!showCreateForm)} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />Создать команду
                    </Button>
                    <Button onClick={handleResetCommands} variant="outline" className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />Сбросить к умолчанию
                    </Button>
                </div>
            </div>

            {/* Поиск и фильтрация */}
            <div className="flex gap-4 mb-6">
                <div className="flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="Поиск команд..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                <div className="w-64">
                    <Select value={selectedTag} onValueChange={setSelectedTag}>
                        <SelectTrigger>
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Фильтр по тегам" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все теги</SelectItem>
                            {getAllTags().map(tag => (
                                <SelectItem key={tag} value={tag}>
                                    <div className="flex items-center gap-2">
                                        {tagCategories[tag]?.icon}
                                        {tag}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {showCreateForm && (
                 <Card>
                 <CardHeader><CardTitle>Создать новую команду</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                     <div>
                         <Label htmlFor="create-command">Команда</Label>
                         <Input id="create-command" value={createForm.command} onChange={(e) => setCreateForm(prev => ({ ...prev, command: e.target.value }))} placeholder="!моякоманда"/>
                     </div>
                     <div>
                         <Label htmlFor="create-description">Описание</Label>
                         <Input id="create-description" value={createForm.description} onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Описание команды"/>
                     </div>
                     <div>
                         <Label htmlFor="create-permissions">Права доступа</Label>
                         <Select value={createForm.permissions} onValueChange={(value) => setCreateForm(prev => ({ ...prev, permissions: value }))}>
                             <SelectTrigger><SelectValue placeholder="Выберите права" /></SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="all">Все пользователи</SelectItem>
                                 <SelectItem value="broadcaster,moderator,owner,moderator_vk">Модераторы и стример</SelectItem>
                                 <SelectItem value="broadcaster,owner">Только стример</SelectItem>
                             </SelectContent>
                         </Select>
                     </div>
                     <div>
                         <Label htmlFor="create-tags">Теги</Label>
                         <Input 
                             id="create-tags" 
                             value={createForm.tags} 
                             onChange={(e) => setCreateForm(prev => ({ ...prev, tags: e.target.value }))} 
                             placeholder="пользовательские, развлечение"
                         />
                     </div>
                     <div className="flex items-center gap-2 pt-2">
                         <Switch id="create-enabled" checked={createForm.enabled} onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, enabled: checked }))}/>
                         <Label htmlFor="create-enabled">Включена</Label>
                     </div>
                     <div className="flex gap-2 pt-2">
                         <Button onClick={handleCreateCommand}><Save className="h-4 w-4 mr-2" />Создать</Button>
                         <Button variant="outline" onClick={() => setShowCreateForm(false)}><X className="h-4 w-4 mr-2" />Отмена</Button>
                     </div>
                 </CardContent>
             </Card>
            )}

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-7">
                    <TabsTrigger value="all">Все</TabsTrigger>
                    {Object.keys(tagCategories).map(tag => (
                        <TabsTrigger key={tag} value={tag} className="gap-2">
                            {tagCategories[tag].icon}
                            {tag}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(getFilteredCommands()).map(([commandKey, command]) => renderCommandCard(commandKey, command))}
                    </div>
                </TabsContent>

                {Object.keys(tagCategories).map(tag => (
                    <TabsContent key={tag} value={tag} className="space-y-4 mt-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(getFilteredCommands())
                                .filter(([key, cmd]) => cmd.tags && cmd.tags.includes(tag))
                                .map(([commandKey, command]) => renderCommandCard(commandKey, command))
                            }
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
                </>
            )}
        </PageLayout>
    );
};

export default CommandsManagementPage;
