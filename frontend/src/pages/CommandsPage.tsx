import React, { useMemo, useState } from 'react';

/* eslint-disable no-alert */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Clock,
    Coins,
    Crown,
    Edit2,
    Filter,
    Info,
    MessageSquare,
    Mic,
    Play,
    Plus,
    Radio,
    Save,
    Search,
    Settings,
    ShieldCheck,
    Star,
    Tag,
    Terminal,
    Trash2,
    Users,
    XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { TABLE_CLASSES } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import {
    useCommands,
    useCreateCommand,
    useCreateCommandOverride,
    useDeleteCommand,
    useToggleCommand,
    useUpdateCommand,
} from '@/queries/commands/commandsQueries';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PageLoader } from '@/shared/components/ui/loader';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';



import PageWrapper from '../shared/components/PageWrapper';

import type { Command as ChatCommand } from '@/features/drops/types';



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
    extra_settings: Record<string, unknown>;
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
    icon: React.ComponentType<{ className?: string }>;
    color: string;
}

interface CommandCardProps {
    command: ChatCommand;
    type: 'basic' | 'custom';
    onToggle: (commandName: string, data: { is_enabled: boolean }, commandId?: number) => void;
    onEdit: (command: ChatCommand) => void;
    onDelete?: (commandId: number) => void;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/70 backdrop-blur-sm';
const CONTROL_TRIGGER_CLASS = 'h-9 w-full border-border/70 bg-background/80 shadow-none';
const CONTROL_CONTENT_CLASS = 'border-border/70 bg-popover/95 backdrop-blur-sm';
const TAB_TRIGGER_CLASS =
    'rounded-none -mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none';

const hasBrokenSymbols = (text: string): boolean => {
    const normalized = text.trim();
    const compactText = normalized.replace(/\s+/g, '');
    if (!compactText) return false;

    const brokenChars = (compactText.match(/[?�]/g) || []).length;
    if (brokenChars >= 3 && brokenChars / compactText.length > 0.35) {
        return true;
    }

    // Common mojibake pattern (UTF-8 text decoded as cp1251): "РџСЂРёРІРµС‚"
    const mojibakePairs = (normalized.match(/[РС][^\s]/g) || []).length;
    return mojibakePairs >= 3 && (mojibakePairs * 2) / compactText.length > 0.3;
};

const toSafeText = (value: string | undefined | null, fallback: string): string => {
    if (!value) return fallback;
    const normalized = value.trim();
    if (!normalized) return fallback;
    return hasBrokenSymbols(normalized) ? fallback : normalized;
};

const normalizeTag = (tag: string | undefined | null): string => {
    return toSafeText(tag, 'Без категории');
};

const CommandCard: React.FC<CommandCardProps> = React.memo(({ command, type, onToggle, onEdit, onDelete }) => {
    const safeCommandName = toSafeText(command.name, 'unknown');
    const safeDescription = toSafeText(command.description, 'Описание команды недоступно');
    const safeResponse = toSafeText(command.response, '');

    const getRoleIcon = (role: string | undefined): React.ReactNode => {
        if (!role || role.trim() === '') {
            return <Users className="h-3 w-3" />;
        }
        // Map ChatCommand user_level to role display
        const roleMap: Record<string, string> = {
            'everyone': 'all',
            'subscriber': 'vip',
            'moderator': 'moderator',
            'broadcaster': 'broadcaster'
        };
        const mappedRole = roleMap[role] || role;

        const roleOptions: RoleOption[] = [
            { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
            { value: 'vip', label: 'VIP+', icon: <Star className="h-3 w-3" /> },
            { value: 'moderator', label: 'Модераторы+', icon: <ShieldCheck className="h-3 w-3" /> },
            { value: 'broadcaster', label: 'Владелец', icon: <Crown className="h-3 w-3" /> }
        ];
        const option = roleOptions.find(opt => opt.value === mappedRole);
        return option ? option.icon : <Users className="h-3 w-3" />;
    };

    const getRoleLabel = (role: string | undefined): string => {
        if (!role || role.trim() === '') {
            return 'Все зрители';
        }
        // Map ChatCommand user_level to role display
        const roleMap: Record<string, string> = {
            'everyone': 'all',
            'subscriber': 'vip',
            'moderator': 'moderator',
            'broadcaster': 'broadcaster'
        };
        const mappedRole = roleMap[role] || role;

        const roleOptions: RoleOption[] = [
            { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
            { value: 'vip', label: 'VIP+', icon: <Star className="h-3 w-3" /> },
            { value: 'moderator', label: 'Модераторы+', icon: <ShieldCheck className="h-3 w-3" /> },
            { value: 'broadcaster', label: 'Владелец', icon: <Crown className="h-3 w-3" /> }
        ];
        const option = roleOptions.find(opt => opt.value === mappedRole);
        return option ? option.label : 'Неизвестная роль';
    };



    const getTagConfig = (tag: string): TagConfig => {
        const tagConfig: Record<string, TagConfig> = {
            'Общее': { icon: Info, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
            'Медиа и интерактивность': { icon: Play, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
            'TTS ИИ озвучка': { icon: Mic, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
            'Управление трансляцией': { icon: Radio, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
            'Управление чатом': { icon: MessageSquare, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
            'Memealerts': { icon: Coins, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' }
        };
        return tagConfig[tag] || { icon: Tag, color: 'bg-muted/60 text-muted-foreground border-border' };
    };

    return (
        <Card className={`h-full ${SURFACE_CARD_CLASS}`}>
            <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-3 w-3 text-primary" />
                        <code className="text-sm font-bold font-mono bg-muted px-2 py-1 rounded text-foreground">
                            !{safeCommandName}
                        </code>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant={command.enabled ? "default" : "secondary"}>
                                {command.enabled ? 'Включена' : 'Отключена'}
                            </Badge>
                            <Switch
                                checked={command.enabled}
                                onCheckedChange={(checked) => onToggle(command.name, { is_enabled: checked }, command.id)}
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
                    {safeDescription}
                </p>

                {safeResponse && (
                    <div className="p-2 bg-muted/30 rounded-md border-l-2 border-primary/20">
                        <p className="text-xs font-medium text-primary mb-1">Ответ:</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">"{safeResponse}"</p>
                    </div>
                )}

                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <div className="flex items-center gap-1">
                            {getRoleIcon(command.user_level || 'everyone')}
                            <span>{getRoleLabel(command.user_level || 'everyone')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{command.cooldown || 0}с</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {(command.platform === 'all' || command.platform === 'twitch') && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-purple-500/10 text-purple-600 border-purple-500/20">
                                Twitch
                            </Badge>
                        )}
                        {(command.platform === 'all' || command.platform === 'vk') && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-red-500/10 text-red-600 border-red-500/20">
                                VK
                            </Badge>
                        )}
                    </div>
                </div>

                {command.tags && Array.isArray(command.tags) && command.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {command.tags.map((tag, index) => {
                            const safeTag = toSafeText(tag, 'Без категории');
                            const config = getTagConfig(safeTag);
                            const IconComponent = config.icon;
                            return (
                                <Badge
                                    key={`${tag}-${index}`}
                                    variant="outline"
                                    className={`text-xs px-2 py-0.5 flex items-center gap-1 ${config.color}`}
                                >
                                    <IconComponent className="h-3 w-3" />
                                    {safeTag}
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
                            onClick={() => onDelete(Number(command.id!))}
                            className={TABLE_CLASSES.actionButton}
                        >
                            <Trash2 className="h-4 w-4" />
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
    const [platformFilter, setPlatformFilter] = useState<string>('all'); // 'all', 'twitch', 'vk'
    const [customSearchTerm, setCustomSearchTerm] = useState<string>('');

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
    const [editingCommand, setEditingCommand] = useState<ChatCommand | null>(null);

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
        response_text: '',
        extra_settings: {}
    });

    const basicCommands = useMemo<ChatCommand[]>(() => {
        return commandsData?.basic_commands || [];
    }, [commandsData?.basic_commands]);
    const customCommands = useMemo<ChatCommand[]>(() => {
        return commandsData?.custom_commands || [];
    }, [commandsData?.custom_commands]);

    // Все хуки должны быть вызваны до любых условных return (правило React Hooks)
    const basicTags = useMemo(() => {
        const normalizedTags = basicCommands.flatMap((cmd: ChatCommand) => {
            if (!Array.isArray(cmd.tags)) {
                return [];
            }
            return cmd.tags.map(tag => normalizeTag(typeof tag === 'string' ? tag : String(tag)));
        });
        return [...new Set(normalizedTags)] as string[];
    }, [basicCommands]);

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Команды">
                <Card className="card-glass border-border">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">
                                Требуется авторизация
                            </h3>
                            <p className="text-muted-foreground text-sm">
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
        'Управление трансляцией': { icon: Radio, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
        'Управление чатом': { icon: MessageSquare, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
        'Memealerts': { icon: Coins, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' }
    };

    const getTagConfig = (tag: string): TagConfig => {
        return tagConfig[tag] || { icon: Tag, color: 'bg-muted/60 text-muted-foreground border-border' };
    };

    const availablePlatforms = platformOptions.filter(opt => opt.enabled);
    const platformsToShow = availablePlatforms.length > 0 ? availablePlatforms : platformOptions;

    const getPlatformLabel = (platforms: string): string => {
        if (platforms === 'twitch,vk' || platforms === 'all') return 'Все платформы';
        return platformOptions.find(opt => opt.value === platforms)?.label || platforms;
    };

    const getFilteredBasicCommands = (): ChatCommand[] => {
        return basicCommands.filter((command: ChatCommand) => {
            const matchesSearch = command.name.toLowerCase().includes(basicSearchTerm.toLowerCase()) ||
                command.description?.toLowerCase().includes(basicSearchTerm.toLowerCase());

            const normalizedCommandTags = Array.isArray(command.tags)
                ? command.tags.map(tag => normalizeTag(typeof tag === 'string' ? tag : String(tag)))
                : [];
            const matchesTags = selectedBasicTags.length === 0 || selectedBasicTags.some(selectedTag =>
                normalizedCommandTags.includes(selectedTag)
            );

            const matchesPlatform = platformFilter === 'all' ||
                command.platform === 'all' ||
                command.platform === platformFilter;

            return matchesSearch && matchesTags && matchesPlatform;
        });
    };

    const getFilteredCustomCommands = (): ChatCommand[] => {
        return customCommands.filter((command: ChatCommand) => {
            const matchesSearch = command.name.toLowerCase().includes(customSearchTerm.toLowerCase()) ||
                command.response?.toLowerCase().includes(customSearchTerm.toLowerCase());

            const matchesPlatform = platformFilter === 'all' ||
                command.platform === 'all' ||
                command.platform === platformFilter;

            return matchesSearch && matchesPlatform;
        });
    };

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

    const handleCreateCommand = (): void => {
        // Преобразуем форму в формат Partial<ChatCommand>
        const commandData: Partial<ChatCommand> = {
            name: createForm.command_name,
            response: createForm.response_text,
            platform: createForm.platforms as 'twitch' | 'vk' | 'youtube' | 'all',
            user_level: createForm.allowed_roles as 'everyone' | 'subscriber' | 'moderator' | 'broadcaster',
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
                command_name: editingCommand.name,
                is_enabled: editForm.is_enabled,
                platforms: editForm.platforms,
                allowed_roles: editForm.allowed_roles,
                cooldown_seconds: editForm.cooldown_seconds,
                alias: null,
                extra_settings: editForm.extra_settings
            }, {
                onSuccess: () => {
                    setIsEditDialogOpen(false);
                    setEditingCommand(null);
                },
            });
        } else {
            // Преобразуем форму в формат Partial<ChatCommand>
            const commandData: Partial<ChatCommand> = {
                response: editForm.response_text,
                platform: editForm.platforms === 'twitch,vk' ? 'all' : editForm.platforms as 'twitch' | 'vk' | 'youtube' | 'all',
                user_level: editForm.allowed_roles as 'everyone' | 'subscriber' | 'moderator' | 'broadcaster',
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

    const handleToggleCommand = (commandName: string, data: { is_enabled: boolean }, commandId?: number): void => {
        if (!commandId) {
            console.error('Command ID is required for toggle operation');
            return;
        }
        toggleCommandMutation.mutate({ commandName, data: { ...data, command_id: commandId } });
    };

    const handleDeleteCommand = (commandId: number): void => {
        if (!confirm('Вы уверены, что хотите удалить эту команду?')) return;
        deleteCommandMutation.mutate(commandId);
    };

    const openEditDialog = (command: ChatCommand): void => {
        setEditingCommand(command);
        const platform = command.platform || 'all';
        const user_level = command.user_level || 'everyone';
        // Get extra_settings from command if available
        const cmdExtraSettings = (command as unknown as { extra_settings?: Record<string, unknown> }).extra_settings || {};
        setEditForm({
            is_enabled: command.enabled ?? true,
            platforms: platform === 'all' ? 'twitch,vk' : platform,
            allowed_roles: user_level,
            cooldown_seconds: command.cooldown || 0,
            response_text: command.response || '',
            extra_settings: cmdExtraSettings
        });
        setIsEditDialogOpen(true);
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
                <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0 border-b border-border">
                    <TabsTrigger
                        value="basic"
                        className={TAB_TRIGGER_CLASS}
                    >
                        Базовые команды
                    </TabsTrigger>
                    <TabsTrigger
                        value="custom"
                        className={TAB_TRIGGER_CLASS}
                    >
                        Кастомные команды
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <Card className={SURFACE_CARD_CLASS}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4" />
                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_200px_230px] gap-3 mb-6 items-center">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                        <Input
                                            placeholder="Поиск команд..."
                                            value={basicSearchTerm}
                                            onChange={(e) => setBasicSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                
                                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                                <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Все платформы" />
                                    </SelectTrigger>
                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                        <SelectItem value="all">Все платформы</SelectItem>
                                        <SelectItem value="twitch">
                                            <div className="flex items-center gap-2">
                                                {integrations?.twitch?.enabled ? (
                                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                ) : (
                                                    <XCircle className="h-3 w-3 text-muted-foreground" />
                                                )}
                                                Twitch
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="vk">
                                            <div className="flex items-center gap-2">
                                                {integrations?.vk?.enabled ? (
                                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                ) : (
                                                    <XCircle className="h-3 w-3 text-muted-foreground" />
                                                )}
                                                VK Live
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="relative">
                                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-9 w-full justify-between">
                                                <span className="inline-flex items-center gap-2">
                                                    <Filter className="h-4 w-4" />
                                                    Фильтр по тегам
                                                </span>
                                                <span className="inline-flex items-center gap-1 min-w-[42px] justify-end">
                                                    <Badge
                                                        variant="secondary"
                                                        className={`h-5 px-1.5 ${selectedBasicTags.length === 0 ? 'opacity-0' : ''}`}
                                                    >
                                                        {selectedBasicTags.length}
                                                    </Badge>
                                                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-64 p-0 border-border/70 bg-popover/95 backdrop-blur-sm origin-top-left data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in"
                                            align="start"
                                        >
                                            <div className="p-3 border-b">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium text-sm">Фильтр по тегам</h4>
                                                    {selectedBasicTags.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={clearAllFilters}
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            Сбросить
                                                        </Button>
                                                    )}
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
                                                                    className={`flex items-center space-x-3 p-2.5 hover:bg-muted/70 cursor-pointer rounded-md transition-colors ${isSelected ? 'bg-muted/50' : ''
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

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {getFilteredBasicCommands().map((command: ChatCommand) => (
                                    <div key={command.id || command.name}>
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
                    <Card className={SURFACE_CARD_CLASS}>
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
                                    <Button variant="outline" className="h-9 border-border/70">
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
                                                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                                        <SelectValue placeholder="Выберите платформы">
                                                            {createForm.platforms === 'twitch,vk' || !createForm.platforms
                                                                ? 'Все платформы'
                                                                : getPlatformLabel(createForm.platforms)}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
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
                                                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                                        <SelectValue placeholder="Выберите доступ">
                                                            {roleOptions.find(opt => opt.value === createForm.allowed_roles)?.label || 'Выберите доступ'}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                                        {roleOptions.map(option => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
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
                                        <Button onClick={handleCreateCommand} className="h-9 bg-none bg-primary hover:bg-primary/90 shadow-none">
                                            <Save className="h-4 w-4 mr-2" />
                                            Создать
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {customCommands.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between mb-4" />
                                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_200px_230px] gap-3 mb-6 items-center">
                                        <div className="flex-1">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                                <Input
                                                    placeholder="Поиск кастомных команд..."
                                                    value={customSearchTerm}
                                                    onChange={(e) => setCustomSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                        </div>

                                        <Select value={platformFilter} onValueChange={setPlatformFilter}>
                                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Все платформы" />
                                        </SelectTrigger>
                                            <SelectContent className={CONTROL_CONTENT_CLASS}>
                                                <SelectItem value="all">Все платформы</SelectItem>
                                                <SelectItem value="twitch">
                                                    <div className="flex items-center gap-2">
                                                        {integrations?.twitch?.enabled ? (
                                                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                        ) : (
                                                            <XCircle className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                        Twitch
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="vk">
                                                    <div className="flex items-center gap-2">
                                                        {integrations?.vk?.enabled ? (
                                                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                        ) : (
                                                            <XCircle className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                        VK Live
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div />
                                    </div>
                                </>
                            )}
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {getFilteredCustomCommands().map((command: ChatCommand) => (
                                        <div key={command.id || command.name}>
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
                            !{editingCommand?.name}
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
                                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Выберите платформы">
                                                {editForm.platforms === 'twitch,vk' || !editForm.platforms
                                                    ? 'Все платформы'
                                                    : getPlatformLabel(editForm.platforms)}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className={CONTROL_CONTENT_CLASS}>
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
                                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Выберите доступ">
                                                {roleOptions.find(opt => opt.value === editForm.allowed_roles)?.label || 'Выберите доступ'}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                                            {roleOptions.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
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

                            {/* Настройки голосования для команды skip */}
                            {editingCommand.name === 'skip' && (
                                <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800/50 mt-4">
                                    <Label htmlFor="skip_votes" className="text-base font-medium">Голосов для скипа</Label>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        1 = мгновенный скип (только модераторы), 2+ = голосование всех зрителей
                                    </p>
                                    <Input
                                        id="skip_votes"
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={(editForm.extra_settings?.skip_votes_required as number) || 1}
                                        onChange={(e) => setEditForm(prev => ({
                                            ...prev,
                                            extra_settings: {
                                                ...prev.extra_settings,
                                                skip_votes_required: parseInt(e.target.value) || 1
                                            }
                                        }))}
                                        className="w-24"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            onClick={() => handleUpdateCommand(editingCommand?.id ? Number(editingCommand.id) : undefined)}
                            className="h-9 bg-none bg-primary hover:bg-primary/90 shadow-none"
                        >
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

