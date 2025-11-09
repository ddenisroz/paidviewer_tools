import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    ChevronDown,
    Info,
    Play,
    Mic,
    Radio,
    Tag,
    AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import api from '../services/api';
import { toast } from 'sonner';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageLoader } from '@/components/ui/loader';
import PageWrapper from '../components/PageWrapper';
import { logger } from '../utils/prodLogger';


    const CommandsPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    
    // 🔒 ПЕРВООЧЕРЕДНАЯ ПРОВЕРКА: Авторизация
    // Если пользователь не авторизован - показываем сообщение с предложением войти
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
    
    const queryClient = useQueryClient();
    
    // ✅ ОПТИМИЗАЦИЯ: Используем React Query вместо ручного кэширования
    const { data: commandsData, isLoading: loading, isInitialLoading: initialLoading } = useQuery({
        queryKey: ['commands'],
        queryFn: async () => {
            const response = await api.get('/api/commands');
            return {
                basic_commands: response.data.basic_commands || [],
                custom_commands: response.data.custom_commands || []
            };
        },
        enabled: isAuthenticated && (integrations?.twitch?.enabled || integrations?.vk?.enabled),
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        retry: 1,
        onError: (error) => {
            logger.error('Error loading commands:', error);
            toast.error('Ошибка загрузки команд');
        }
    });
    
    const basicCommands = commandsData?.basic_commands || [];
    const customCommands = commandsData?.custom_commands || [];
    
    // ✅ Mutations для управления командами
    const createCommandMutation = useMutation({
        mutationFn: async (data) => {
            return await api.post('/api/commands', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commands'] });
            toast.success('Кастомная команда создана!');
        },
        onError: (error) => {
            logger.error('Error creating command:', error);
            toast.error(error.response?.data?.detail || 'Ошибка создания команды');
        }
    });
    
    const createOverrideMutation = useMutation({
        mutationFn: async (data) => {
            return await api.post('/api/commands/override', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commands'] });
            toast.success('Персональная настройка команды создана!');
        },
        onError: (error) => {
            logger.error('Error creating override:', error);
            if (error.response?.status === 400 && 
                error.response?.data?.detail?.includes('уже существует')) {
                toast.error('Персональная настройка уже существует. Перезагрузите список команд.');
                queryClient.invalidateQueries({ queryKey: ['commands'] });
            } else {
                throw error;
            }
        }
    });
    
    const updateCommandMutation = useMutation({
        mutationFn: async ({ commandId, data }) => {
            return await api.put(`/api/commands/${commandId}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commands'] });
            toast.success('Команда обновлена!');
        },
        onError: (error) => {
            logger.error('Error updating command:', error);
            if (!error.response?.data?.detail?.includes('уже существует')) {
                toast.error(error.response?.data?.detail || 'Ошибка обновления команды');
            }
        }
    });
    
    const toggleCommandMutation = useMutation({
        mutationFn: async ({ commandName, data }) => {
            return await api.put(`/api/commands/${commandName}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commands'] });
        },
        onError: (error) => {
            logger.error('Error toggling command:', error);
            toast.error('Ошибка переключения команды');
            // ✅ Откатываем изменения через invalidateQueries
            queryClient.invalidateQueries({ queryKey: ['commands'] });
        }
    });
    
    const deleteCommandMutation = useMutation({
        mutationFn: async (commandId) => {
            return await api.delete(`/api/commands/${commandId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commands'] });
            toast.success('Команда удалена!');
        },
        onError: (error) => {
            logger.error('Error deleting command:', error);
            toast.error('Ошибка удаления команды');
        }
    });
    
    // Состояния для фильтрации базовых команд (как в Excel)
    const [basicSearchTerm, setBasicSearchTerm] = useState('');
    const [selectedBasicTags, setSelectedBasicTags] = useState([]);
    // ✅ Удаляем basicTags из state - теперь вычисляется через useMemo
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [tagSearchTerm, setTagSearchTerm] = useState('');
    
    
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
    // Владелец канала (broadcaster) ВСЕГДА имеет доступ ко всем командам
    // Но можно создать команды ТОЛЬКО для владельца (broadcaster role)
    const roleOptions = [
        { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
        { value: 'vip', label: 'VIP и выше', icon: <Star className="h-3 w-3" /> },
        { value: 'moderator', label: 'Модераторы и выше', icon: <ShieldCheck className="h-3 w-3" /> },
        { value: 'broadcaster', label: 'Только владелец', icon: <Crown className="h-3 w-3" /> }
    ];


    const platformOptions = [
        { value: 'twitch,vk', label: 'Все платформы', enabled: integrations?.twitch?.enabled && integrations?.vk?.enabled },
        { value: 'twitch', label: 'Только Twitch', enabled: integrations?.twitch?.enabled },
        { value: 'vk', label: 'Только VK Live', enabled: integrations?.vk?.enabled }
    ];

    // Конфигурация тегов (категорий) с иконками и цветами
    const tagConfig = {
        'Общее': { icon: Info, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
        'Медиа и интерактивность': { icon: Play, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
        'TTS ИИ озвучка': { icon: Mic, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
        'Управление трансляцией': { icon: Radio, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' }
    };

    const getTagConfig = (tag) => {
        return tagConfig[tag] || { icon: Tag, color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
    };

    // Получаем доступные платформы
    const availablePlatforms = platformOptions.filter(opt => opt.enabled);
    
    // Если ни одна платформа не подключена, показываем все
    const platformsToShow = availablePlatforms.length > 0 ? availablePlatforms : platformOptions;

    // ✅ ОПТИМИЗАЦИЯ: Извлекаем уникальные теги из базовых команд (мемоизируем)
    const basicTags = React.useMemo(() => {
        return [...new Set(basicCommands.flatMap(cmd => {
            return Array.isArray(cmd.tags) ? cmd.tags : [];
        }))];
    }, [basicCommands]);
    
    // ✅ Удаляем ручную загрузку - React Query делает это автоматически
    // useEffect для loadCommands больше не нужен

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

    const handleCreateCommand = () => {
        createCommandMutation.mutate(createForm, {
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

    const handleUpdateCommand = (commandId) => {
        // Если редактируем global команду - создаем override
        if (editingCommand?.command_type === 'global') {
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
                onError: () => {
                    // Ошибка уже обработана в mutation
                }
            });
        } else {
            // Для override и custom команд - обычное обновление
            updateCommandMutation.mutate({ commandId, data: editForm }, {
                onSuccess: () => {
                    toast.success('Команда обновлена!');
                    setIsEditDialogOpen(false);
                    setEditingCommand(null);
                }
            });
        }
    };

    const handleToggleCommand = (commandName, data) => {
        // ✅ Оптимистичное обновление через React Query
        queryClient.setQueryData(['commands'], (old) => {
            if (!old) return old;
            return {
                basic_commands: old.basic_commands?.map(cmd => 
                    cmd.command_name === commandName ? { ...cmd, ...data } : cmd
                ) || [],
                custom_commands: old.custom_commands?.map(cmd => 
                    cmd.command_name === commandName ? { ...cmd, ...data } : cmd
                ) || []
            };
        });
        
        // ✅ Отправляем запрос через mutation
        toggleCommandMutation.mutate({ commandName, data });
    };

    const handleDeleteCommand = (commandId) => {
        if (!confirm('Вы уверены, что хотите удалить эту команду?')) return;
        
        deleteCommandMutation.mutate(commandId);
    };

    const openEditDialog = (command) => {
        setEditingCommand(command);
        // ✅ УНИФИКАЦИЯ: Всегда используем значения по умолчанию если пусто
        const platforms = command.platforms || 'twitch,vk';
        const allowed_roles = (command.allowed_roles && command.allowed_roles.trim() !== '') ? command.allowed_roles : 'all';
        setEditForm({
            is_enabled: command.is_enabled,
            platforms: platforms,
            allowed_roles: allowed_roles,
            cooldown_seconds: command.cooldown_seconds || 0,
            response_text: command.response_text || ''
        });
        setIsEditDialogOpen(true);
    };

    const getRoleLabel = (role) => {
        if (!role || role.trim() === '') {
            return 'Все зрители'; // По умолчанию если пусто
        }
        // Нормализуем роль - сортируем для совместимости
        const normalizedRole = role.split(',').sort().join(',');
        const option = roleOptions.find(opt => {
            const normalizedValue = opt.value?.split(',').sort().join(',');
            return normalizedValue === normalizedRole;
        });
        return option ? option.label : role;
    };

    const getRoleIcon = (role) => {
        if (!role || role.trim() === '') {
            return <Users className="h-3 w-3" />; // По умолчанию если пусто
        }
        const normalizedRole = role.split(',').sort().join(',');
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
                        {getRoleIcon(command.allowed_roles || 'all')}
                        <span>{getRoleLabel(command.allowed_roles || 'all')}</span>
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

                {/* Теги с иконками и цветами */}
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

    // ⚡ Показываем лоадер ТОЛЬКО при первой загрузке и если данных еще нет
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
