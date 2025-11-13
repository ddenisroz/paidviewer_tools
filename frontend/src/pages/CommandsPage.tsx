import React, { useState, useMemo } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Terminal, 
    Edit2, 
    Trash2, 
    Save, 
    Settings,
    Users,
    ShieldCheck,
    Crown,
    Clock,
    Search,
    Star,
    Filter,
    ChevronDown,
    Info,
    Play,
    Mic,
    Radio,
    Tag,
    AlertCircle,
    Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import {
    useCommands,
    useCreateCommand,
    useCreateCommandOverride,
    useUpdateCommand,
    useDeleteCommand,
    useToggleCommand,
} from '../queries/commands/commandsQueries';
import { PageLoader } from '@/components/ui/loader';
import PageWrapper from '../components/PageWrapper';

interface Command {
    id?: number;
    command_name: string;
    description?: string;
    response_text?: string;
    platforms?: string;
    allowed_roles?: string;
    cooldown_seconds?: number;
    is_enabled?: boolean;
    command_type?: 'global' | 'override' | 'custom';
    tags?: string[];
}

interface CreateForm {
    command_name: string;
    response_text: string;
    platforms: string;
    allowed_roles: string;
    cooldown_seconds: number;
    is_enabled: boolean;
}

interface EditForm {
    is_enabled: boolean;
    platforms: string;
    allowed_roles: string;
    cooldown_seconds: number;
    response_text: string;
}

interface RoleOption {
    value: string;
    label: string;
    icon: React.ReactNode;
}

interface PlatformOption {
    value: string;
    label: string;
    enabled: boolean;
}

interface TagConfig {
    icon: React.ComponentType<any>;
    color: string;
}

interface CommandCardProps {
    command: Command;
    type: 'basic' | 'custom';
    onToggle: (commandName: string, data: { is_enabled: boolean }) => void;
    onEdit: (command: Command) => void;
    onDelete?: (commandId: number) => void;
}

const CommandCard: React.FC<CommandCardProps> = React.memo(({ command, type, onToggle, onEdit, onDelete }) => {
    const getRoleIcon = (role: string | undefined): React.ReactNode => {
        if (!role || role.trim() === '') {
            return <Users className="h-3 w-3" />;
        }
        const roleOptions: RoleOption[] = [
            { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
            { value: 'vip', label: 'VIP и выше', icon: <Star className="h-3 w-3" /> },
            { value: 'moderator', label: 'Модераторы и выше', icon: <ShieldCheck className="h-3 w-3" /> },
            { value: 'broadcaster', label: 'Только владелец', icon: <Crown className="h-3 w-3" /> }
        ];
        const normalizedRole = role.split(',').sort().join(',');
        const option = roleOptions.find(opt => {
            const normalizedValue = opt.value?.split(',').sort().join(',');
            return normalizedValue === normalizedRole;
        });
        return option ? option.icon : <Users className="h-3 w-3" />;
    };

    const getRoleLabel = (role: string | undefined): string => {
        if (!role || role.trim() === '') {
            return 'Все зрители';
        }
        const roleOptions: RoleOption[] = [
            { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
            { value: 'vip', label: 'VIP и выше', icon: <Star className="h-3 w-3" /> },
            { value: 'moderator', label: 'Модераторы и выше', icon: <ShieldCheck className="h-3 w-3" /> },
            { value: 'broadcaster', label: 'Только владелец', icon: <Crown className="h-3 w-3" /> }
        ];
        const normalizedRole = role.split(',').sort().join(',');
        const option = roleOptions.find(opt => {
            const normalizedValue = opt.value?.split(',').sort().join(',');
            return normalizedValue === normalizedRole;
        });
        return option ? option.label : role;
    };

    const getPlatformLabel = (platforms: string | undefined): string => {
        if (platforms === 'twitch,vk') return 'Все платформы';
        if (platforms === 'twitch') return 'Twitch';
        if (platforms === 'vk') return 'VK Live';
        return platforms || 'Все платформы';
    };

    const getTagConfig = (tag: string): TagConfig => {
        const tagConfig: Record<string, TagConfig> = {
            'Общее': { icon: Info, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
            'Медиа и интерактивность': { icon: Play, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
            'TTS ИИ озвучка': { icon: Mic, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
            'Управление трансляцией': { icon: Radio, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' }
        };
        return tagConfig[tag] || { icon: Tag, color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
    };

    return (
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
                                onCheckedChange={(checked) => onToggle(command.command_name, { is_enabled: checked })}
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
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {command.description || 'Описание команды не указано'}
                </p>
                
                {command.response_text && (
                    <div className="p-2 bg-muted/30 rounded-md border-l-2 border-primary/20">
                        <p className="text-xs font-medium text-primary mb-1">Ответ:</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">"{command.response_text}"</p>
                    </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            {getRoleIcon(command.allowed_roles || 'all')}
                            <span>{getRoleLabel(command.allowed_roles || 'all')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{command.cooldown_seconds || 0}с</span>
                        </div>
                    </div>
                    <div className="text-right">
                        {getPlatformLabel(command.platforms || 'twitch,vk')}
                    </div>
                </div>

                {command.tags && Array.isArray(command.tags) && command.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {command.tags.map(tag => {
                            const config = getTagConfig(tag);
                            const IconComponent = config.icon;
                            return (
                                <Badge 
                                    key={tag} 
                                    variant="outline" 
                                    className={`text-xs px-2 py-0.5 flex items-center gap-1 ${config.color}`}
                                >
                                    <IconComponent className="h-3 w-3" />
                                    {tag}
                                </Badge>
                            );
                        })}
                    </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-border/30">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(command)}
                        className="flex-1 h-8 text-xs"
                    >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Настроить
                    </Button>
                    {type === 'custom' && command.id && onDelete && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(command.id!)}
                            className="h-8 w-8 p-0"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
});

CommandCard.displayName = 'CommandCard';

const CommandsPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    
    // Все хуки должны быть вызваны до любых условных return
    const { data: commandsData, isLoading: loading, isInitialLoading: initialLoading } = useCommands({
        enabled: !!isAuthenticated && (integrations?.twitch?.enabled || integrations?.vk?.enabled),
    });
    
    const createCommandMutation = useCreateCommand();
    const createOverrideMutation = useCreateCommandOverride();
    const updateCommandMutation = useUpdateCommand();
    const toggleCommandMutation = useToggleCommand();
    const deleteCommandMutation = useDeleteCommand();
    
    const [basicSearchTerm, setBasicSearchTerm] = useState<string>('');
    const [selectedBasicTags, setSelectedBasicTags] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
    const [tagSearchTerm, setTagSearchTerm] = useState<string>('');
    
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
    const [editingCommand, setEditingCommand] = useState<Command | null>(null);
    
    const [createForm, setCreateForm] = useState<CreateForm>({
        command_name: '',
        response_text: '',
        platforms: 'twitch,vk',
        allowed_roles: 'all',
        cooldown_seconds: 0,
        is_enabled: true
    });
    
    const [editForm, setEditForm] = useState<EditForm>({
        is_enabled: true,
        platforms: 'twitch,vk',
        allowed_roles: 'all',
        cooldown_seconds: 0,
        response_text: ''
    });
    
    const basicCommands = (commandsData as any)?.basic_commands || [];
    const customCommands = (commandsData as any)?.custom_commands || [];
    
    // Все хуки должны быть вызваны до любых условных return (правило React Hooks)
    const basicTags = useMemo(() => {
        return [...new Set(basicCommands.flatMap((cmd: Command) => {
            return Array.isArray(cmd.tags) ? cmd.tags : [];
        }))] as string[];
    }, [basicCommands]);
    
    if (!isAuthenticated) {
        return (
            <PageWrapper title="Команды">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Требуется авторизация
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для использования управления командами необходимо войти в систему и подключить хотя бы одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button 
                            onClick={() => navigate('/login')}
                            className="gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Войти в систему
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }
    
    const roleOptions: RoleOption[] = [
        { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
        { value: 'vip', label: 'VIP и выше', icon: <Star className="h-3 w-3" /> },
        { value: 'moderator', label: 'Модераторы и выше', icon: <ShieldCheck className="h-3 w-3" /> },
        { value: 'broadcaster', label: 'Только владелец', icon: <Crown className="h-3 w-3" /> }
    ];

    const platformOptions: PlatformOption[] = [
        { value: 'twitch,vk', label: 'Все платформы', enabled: !!(integrations?.twitch?.enabled && integrations?.vk?.enabled) },
        { value: 'twitch', label: 'Только Twitch', enabled: !!integrations?.twitch?.enabled },
        { value: 'vk', label: 'Только VK Live', enabled: !!integrations?.vk?.enabled }
    ];

    const tagConfig: Record<string, TagConfig> = {
        'Общее': { icon: Info, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
        'Медиа и интерактивность': { icon: Play, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
        'TTS ИИ озвучка': { icon: Mic, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
        'Управление трансляцией': { icon: Radio, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' }
    };

    const getTagConfig = (tag: string): TagConfig => {
        return tagConfig[tag] || { icon: Tag, color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
    };

    const availablePlatforms = platformOptions.filter(opt => opt.enabled);
    const platformsToShow = availablePlatforms.length > 0 ? availablePlatforms : platformOptions;
    
    const getFilteredBasicCommands = (): Command[] => {
        return basicCommands.filter((command: Command) => {
            const matchesSearch = command.command_name.toLowerCase().includes(basicSearchTerm.toLowerCase()) ||
                                command.description?.toLowerCase().includes(basicSearchTerm.toLowerCase());
            
            if (selectedBasicTags.length === 0) {
                return matchesSearch;
            }
            
            const matchesTags = selectedBasicTags.some(selectedTag => 
                command.tags && Array.isArray(command.tags) && command.tags.includes(selectedTag)
            );
            
            return matchesSearch && matchesTags;
        });
    };

    const areAllTagsSelected = selectedBasicTags.length === basicTags.length && basicTags.length > 0;

    const toggleTag = (tag: string): void => {
        setSelectedBasicTags(prev => 
            prev.includes(tag) 
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    const clearAllFilters = (): void => {
        setSelectedBasicTags([]);
    };

    const selectAllFilters = (): void => {
        setSelectedBasicTags([...basicTags]);
    };

    const handleCreateCommand = (): void => {
        // Преобразуем форму в формат ChatCommand
        const commandData = {
            name: createForm.command_name,
            response: createForm.response_text,
            platform: createForm.platforms as any,
            user_level: createForm.allowed_roles as any,
            cooldown: createForm.cooldown_seconds,
            enabled: createForm.is_enabled
        };
        
        createCommandMutation.mutate(commandData, {
            onSuccess: () => {
                setIsCreateDialogOpen(false);
                setCreateForm({
                    command_name: '',
                    response_text: '',
                    platforms: 'twitch,vk',
                    allowed_roles: 'all',
                    cooldown_seconds: 0,
                    is_enabled: true
                });
            }
        });
    };

    const handleUpdateCommand = (commandId: number | undefined): void => {
        if (!commandId || !editingCommand) return;
        
        if (editingCommand.command_type === 'global') {
            createOverrideMutation.mutate({
                command_name: editingCommand.command_name,
                is_enabled: editForm.is_enabled,
                platforms: editForm.platforms,
                allowed_roles: editForm.allowed_roles,
                cooldown_seconds: editForm.cooldown_seconds,
                alias: null
            }, {
                onSuccess: () => {
                    setIsEditDialogOpen(false);
                    setEditingCommand(null);
                },
            });
        } else {
            // Преобразуем форму в формат ChatCommand
            const commandData = {
                response: editForm.response_text,
                platform: editForm.platforms as any,
                user_level: editForm.allowed_roles as any,
                cooldown: editForm.cooldown_seconds,
                enabled: editForm.is_enabled
            };
            
            updateCommandMutation.mutate({ commandId, command: commandData }, {
                onSuccess: () => {
                    setIsEditDialogOpen(false);
                    setEditingCommand(null);
                }
            });
        }
    };

    const handleToggleCommand = (commandName: string, data: { is_enabled: boolean }): void => {
        toggleCommandMutation.mutate({ commandName, data });
    };

    const handleDeleteCommand = (commandId: number): void => {
        if (!confirm('Вы уверены, что хотите удалить эту команду?')) return;
        deleteCommandMutation.mutate(commandId);
    };

    const openEditDialog = (command: Command): void => {
        setEditingCommand(command);
        const platforms = command.platforms || 'twitch,vk';
        const allowed_roles = (command.allowed_roles && command.allowed_roles.trim() !== '') ? command.allowed_roles : 'all';
        setEditForm({
            is_enabled: command.is_enabled ?? true,
            platforms: platforms,
            allowed_roles: allowed_roles,
            cooldown_seconds: command.cooldown_seconds || 0,
            response_text: command.response_text || ''
        });
        setIsEditDialogOpen(true);
    };

    const getPlatformLabel = (platforms: string | undefined): string => {
        if (platforms === 'twitch,vk') return 'Все платформы';
        if (platforms === 'twitch') return 'Twitch';
        if (platforms === 'vk') return 'VK Live';
        return platforms || 'Все платформы';
    };

    if (initialLoading && basicCommands.length === 0 && customCommands.length === 0) {
        return (
            <PageWrapper>
                <PageLoader message="Загрузка команд..." />
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
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
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                                                    value={tagSearchTerm}
                                                    onChange={(e) => setTagSearchTerm(e.target.value)}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {basicTags.length > 0 ? (
                                                    basicTags
                                                        .filter(tag => tag.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                                                        .map(tag => {
                                                        const config = getTagConfig(tag);
                                                        const IconComponent = config.icon;
                                                        const isSelected = selectedBasicTags.includes(tag);
                                                        return (
                                                            <div
                                                                key={tag}
                                                                className={`flex items-center space-x-3 p-2.5 hover:bg-muted/70 cursor-pointer rounded-md transition-colors ${
                                                                    isSelected ? 'bg-muted/50' : ''
                                                                }`}
                                                                onClick={() => toggleTag(tag)}
                                                            >
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onChange={() => toggleTag(tag)}
                                                                />
                                                                <div className={`p-1.5 rounded-md ${config.color}`}>
                                                                    <IconComponent className="h-3.5 w-3.5" />
                                                                </div>
                                                                <span className="text-sm flex-1 font-medium">{tag}</span>
                                                            </div>
                                                        );
                                                    })
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
                                {getFilteredBasicCommands().map((command: Command) => (
                                    <div key={command.id || command.command_name} className="transition-all duration-200">
                                        <CommandCard
                                            command={command}
                                            type="basic"
                                            onToggle={handleToggleCommand}
                                            onEdit={openEditDialog}
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
                                                        <SelectValue placeholder="Выберите платформы">
                                                            {createForm.platforms === 'twitch,vk' || !createForm.platforms 
                                                                ? 'Все платформы' 
                                                                : getPlatformLabel(createForm.platforms)}
                                                        </SelectValue>
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
                                <div className="text-center py-12 space-y-4">
                                    <Terminal className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                                    <div>
                                        <h4 className="text-lg font-semibold mb-2">Нет кастомных команд</h4>
                                        <p className="text-muted-foreground">
                                            Создайте первую команду для взаимодействия с вашей аудиторией
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-200">
                                    {customCommands.map((command: Command) => (
                                        <div key={command.id || command.command_name} className="transition-all duration-200">
                                            <CommandCard
                                                command={command}
                                                type="custom"
                                                onToggle={handleToggleCommand}
                                                onEdit={openEditDialog}
                                                onDelete={handleDeleteCommand}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            !{editingCommand?.command_name}
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
                                        value={editForm.platforms || 'twitch,vk'}
                                        onValueChange={(value) => setEditForm(prev => ({
                                            ...prev,
                                            platforms: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите платформы">
                                                {editForm.platforms === 'twitch,vk' || !editForm.platforms 
                                                    ? 'Все платформы' 
                                                    : getPlatformLabel(editForm.platforms)}
                                            </SelectValue>
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
                        <Button onClick={() => handleUpdateCommand(editingCommand?.id)}>
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

