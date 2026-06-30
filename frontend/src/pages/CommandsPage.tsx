import React, { useMemo, useState } from 'react';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    AlertCircle,
    BarChart3,
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
    XCircle,
} from 'lucide-react';
import { formatAppDateTime } from '@/shared/utils/dateTime';
import { useNavigate } from 'react-router-dom';

import { TABLE_CLASSES } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import {
    useCommands,
    useCommandsHistory,
    useCreateCommand,
    useCreateCommandOverride,
    useDeleteCommand,
    useToggleCommand,
    useUpdateCommand,
} from '@/queries/commands/commandsQueries';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PageLoader } from '@/shared/components/ui/loader';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import {
    DASHBOARD_TAB_TRIGGER_CLASS,
    DASHBOARD_TABS_LIST_CLASS,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/shared/components/ui/tabs';
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
    trigger_mode: 'command' | 'keyword' | 'timer';
    trigger_keyword: string;
    timer_interval_seconds: number;
    priority: number;
    anti_spam_window_seconds: number;
    condition_live_only: boolean;
    condition_min_streak_days: number;
}

interface EditForm {
    command_name: string;
    alias: string;
    is_enabled: boolean;
    platforms: string;
    allowed_roles: string;
    cooldown_seconds: number;
    response_text: string;
    extra_settings: Record<string, unknown>;
    trigger_mode: 'command' | 'keyword' | 'timer';
    trigger_keyword: string;
    timer_interval_seconds: number;
    priority: number;
    anti_spam_window_seconds: number;
    condition_live_only: boolean;
    condition_min_streak_days: number;
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

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/85';
const CONTROL_TRIGGER_CLASS =
    'h-9 w-full border-sky-400/45 bg-[#0b0712] text-sky-100 shadow-[0_0_0_1px_rgba(14,165,233,0.12)] data-[state=open]:border-sky-400/75 data-[state=open]:bg-[#0b0712]';
const CONTROL_CONTENT_CLASS = 'border-sky-400/40 bg-[#0b0712] shadow-2xl shadow-black/60 ring-1 ring-white/10';
const TRIGGER_MODE_LABELS: Record<'command' | 'keyword' | 'timer', string> = {
    command: 'По !команде',
    keyword: 'По слову',
    timer: 'По таймеру',
};

const hasBrokenSymbols = (text: string): boolean => {
    const normalized = text.trim();
    const compactText = normalized.replace(/\s+/g, '');
    if (!compactText) return false;

    const brokenChars = (compactText.match(/[??]/g) || []).length;
    if (brokenChars >= 3 && brokenChars / compactText.length > 0.35) {
        return true;
    }

    // Common mojibake pattern (UTF-8 text decoded as cp1251): "Привет"
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
    const showResponsePreview = type === 'custom' && safeResponse.length > 0;
    const commandSettings = (command.extra_settings || {}) as Record<string, unknown>;
    const triggerMode = (commandSettings.trigger_mode as 'command' | 'keyword' | 'timer' | undefined) || 'command';
    const triggerKeyword = String(commandSettings.trigger_keyword || '').trim();
    const timerInterval = Number(commandSettings.timer_interval_seconds || 300);
    const priority = Number(commandSettings.priority || 0);
    const antiSpamWindow = Number(commandSettings.anti_spam_window_seconds || 0);
    const conditionLiveOnly = Boolean(commandSettings.condition_live_only || false);
    const conditionMinStreak = Number(commandSettings.condition_min_streak_days || 0);
    const safeAlias = toSafeText(command.alias, '');

    const getRoleIcon = (role: string | undefined): React.ReactNode => {
        if (!role || role.trim() === '') {
            return <Users className="h-3 w-3" />;
        }
        // Map ChatCommand user_level to role display
        const roleMap: Record<string, string> = {
            everyone: 'all',
            subscriber: 'vip',
            moderator: 'moderator',
            broadcaster: 'broadcaster',
        };
        const mappedRole = roleMap[role] || role;

        const roleOptions: RoleOption[] = [
            { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
            { value: 'vip', label: 'VIP+', icon: <Star className="h-3 w-3" /> },
            { value: 'moderator', label: 'Модераторы+', icon: <ShieldCheck className="h-3 w-3" /> },
            { value: 'broadcaster', label: 'Владелец', icon: <Crown className="h-3 w-3" /> },
        ];
        const option = roleOptions.find((opt) => opt.value === mappedRole);
        return option ? option.icon : <Users className="h-3 w-3" />;
    };

    const getRoleLabel = (role: string | undefined): string => {
        if (!role || role.trim() === '') {
            return 'Все зрители';
        }
        // Map ChatCommand user_level to role display
        const roleMap: Record<string, string> = {
            everyone: 'all',
            subscriber: 'vip',
            moderator: 'moderator',
            broadcaster: 'broadcaster',
        };
        const mappedRole = roleMap[role] || role;

        const roleOptions: RoleOption[] = [
            { value: 'all', label: 'Все зрители', icon: <Users className="h-3 w-3" /> },
            { value: 'vip', label: 'VIP+', icon: <Star className="h-3 w-3" /> },
            { value: 'moderator', label: 'Модераторы+', icon: <ShieldCheck className="h-3 w-3" /> },
            { value: 'broadcaster', label: 'Владелец', icon: <Crown className="h-3 w-3" /> },
        ];
        const option = roleOptions.find((opt) => opt.value === mappedRole);
        return option ? option.label : 'Неизвестная роль';
    };

    const getTagConfig = (tag: string): TagConfig => {
        const tagConfig: Record<string, TagConfig> = {
            Общее: { icon: Info, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
            Медиа: { icon: Play, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
            'TTS ИИ озвучка': { icon: Mic, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
            'Управление трансляцией': { icon: Radio, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
            'Управление чатом': { icon: MessageSquare, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
            Memealerts: { icon: Coins, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
        };
        return tagConfig[tag] || { icon: Tag, color: 'bg-muted/60 text-muted-foreground border-border' };
    };

    return (
        <Card className={`min-w-0 ${SURFACE_CARD_CLASS}`}>
            <CardHeader className="p-3 pb-1">
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Terminal className="h-3 w-3 shrink-0 text-primary" />
                        <code className="min-w-0 truncate rounded bg-muted px-2 py-1 font-mono text-sm font-bold text-foreground">
                            !{safeCommandName}
                        </code>
                        {safeAlias ? (
                            <code className="min-w-0 truncate rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-sm font-bold text-emerald-200">
                                !{safeAlias}
                            </code>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Switch
                            checked={command.enabled}
                            onCheckedChange={(checked) => onToggle(command.name, { is_enabled: checked }, command.id)}
                        />
                        {type === 'custom' && <Badge variant="outline">Кастомная</Badge>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3 pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{safeDescription}</p>

                {showResponsePreview && (
                    <div className="p-2 bg-muted/30 rounded-md border-l-2 border-primary/20">
                        <p className="text-xs font-medium text-primary mb-1">Ответ:</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">"{safeResponse}"</p>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                        <div className="flex min-w-0 items-center gap-1">
                            {getRoleIcon(command.user_level || 'everyone')}
                            <span className="truncate">{getRoleLabel(command.user_level || 'everyone')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{command.cooldown || 0}с</span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {(command.platform === 'all' || command.platform === 'twitch') && (
                            <Badge
                                variant="outline"
                                className="whitespace-nowrap px-1.5 py-0 text-[11px] bg-purple-500/10 text-purple-400 border-purple-500/20"
                                title="Twitch"
                            >
                                TW
                            </Badge>
                        )}
                        {(command.platform === 'all' || command.platform === 'vk') && (
                            <Badge
                                variant="outline"
                                className="whitespace-nowrap px-1.5 py-0 text-[11px] bg-red-500/10 text-red-400 border-red-500/20"
                                title="VK Live"
                            >
                                VK
                            </Badge>
                        )}
                    </div>
                </div>

                {type === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-300">
                            {TRIGGER_MODE_LABELS[triggerMode] || TRIGGER_MODE_LABELS.command}
                        </Badge>
                        {triggerMode === 'keyword' && triggerKeyword && (
                            <span>
                                Триггер: <span className="text-foreground">{triggerKeyword}</span>
                            </span>
                        )}
                        {triggerMode === 'timer' && <span>{Math.max(15, timerInterval)}с</span>}
                        <span>prio {Math.max(0, priority)}</span>
                        {antiSpamWindow > 0 && <span>анти-спам {antiSpamWindow}с</span>}
                        {conditionLiveOnly && <span>только онлайн</span>}
                        {conditionMinStreak > 0 && <span>стрик {conditionMinStreak}+</span>}
                    </div>
                )}

                {command.tags && Array.isArray(command.tags) && command.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {command.tags.slice(0, 2).map((tag, index) => {
                            const safeTag = toSafeText(tag, 'Без категории');
                            const config = getTagConfig(safeTag);
                            const IconComponent = config.icon;
                            return (
                                <Badge
                                    key={`${tag}-${index}`}
                                    variant="outline"
                                    className={`max-w-full px-2 py-0.5 text-xs flex items-center gap-1 ${config.color}`}
                                >
                                    <IconComponent className="h-3 w-3" />
                                    <span className="truncate">{safeTag}</span>
                                </Badge>
                            );
                        })}
                    </div>
                )}

                <div className="flex gap-2 pt-1 border-t border-border/30">
                    <Button variant="default" size="sm" onClick={() => onEdit(command)} className="flex-1 h-8 text-xs">
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
    const {
        data: commandsData,
        isLoading: loading,
        isInitialLoading: initialLoading,
    } = useCommands({
        enabled: !!isAuthenticated && (integrations?.twitch?.enabled || integrations?.vk?.enabled),
    });
    const [historySearch, setHistorySearch] = useState<string>('');
    const [historyPlatform, setHistoryPlatform] = useState<string>('all');
    const [historyType, setHistoryType] = useState<string>('all');
    const { data: commandHistory = [], isLoading: historyLoading } = useCommandsHistory(
        {
            search: historySearch || undefined,
            platform: historyPlatform === 'all' ? undefined : historyPlatform,
            command_type: historyType === 'all' ? undefined : historyType,
            limit: 100,
        },
        {
            enabled: !!isAuthenticated,
        }
    );

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
    const [commandToDelete, setCommandToDelete] = useState<number | null>(null);

    const [createForm, setCreateForm] = useState<CreateForm>({
        command_name: '',
        response_text: '',
        platforms: 'twitch,vk',
        allowed_roles: 'all',
        cooldown_seconds: 0,
        is_enabled: true,
        trigger_mode: 'command',
        trigger_keyword: '',
        timer_interval_seconds: 300,
        priority: 0,
        anti_spam_window_seconds: 0,
        condition_live_only: false,
        condition_min_streak_days: 0,
    });

    const [editForm, setEditForm] = useState<EditForm>({
        command_name: '',
        alias: '',
        is_enabled: true,
        platforms: 'twitch,vk',
        allowed_roles: 'all',
        cooldown_seconds: 0,
        response_text: '',
        extra_settings: {},
        trigger_mode: 'command',
        trigger_keyword: '',
        timer_interval_seconds: 300,
        priority: 0,
        anti_spam_window_seconds: 0,
        condition_live_only: false,
        condition_min_streak_days: 0,
    });

    const basicCommands = useMemo<ChatCommand[]>(() => {
        return commandsData?.basic_commands || [];
    }, [commandsData?.basic_commands]);
    const customCommands = useMemo<ChatCommand[]>(() => {
        return commandsData?.custom_commands || [];
    }, [commandsData?.custom_commands]);
    const isGlobalLikeEditingCommand =
        editingCommand?.command_type === 'global' || editingCommand?.command_type === 'override';

    // Все хуки должны быть вызваны до любых условных return (правило React Hooks)
    const basicTags = useMemo(() => {
        const normalizedTags = basicCommands.flatMap((cmd: ChatCommand) => {
            if (!Array.isArray(cmd.tags)) {
                return [];
            }
            return cmd.tags.map((tag) => normalizeTag(typeof tag === 'string' ? tag : String(tag)));
        });
        return [...new Set(normalizedTags)].sort((a, b) => {
            if (a === 'Общее') return -1;
            if (b === 'Общее') return 1;
            return a.localeCompare(b, 'ru', { sensitivity: 'base' });
        }) as string[];
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
                            <h3 className="text-xl font-semibold text-foreground">Требуется авторизация</h3>
                            <p className="text-muted-foreground text-sm">
                                Для использования управления командами необходимо войти в систему и подключить хотя бы
                                одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button onClick={() => navigate('/login')} className="gap-2">
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
        { value: 'broadcaster', label: 'Только владелец', icon: <Crown className="h-3 w-3" /> },
    ];

    const platformOptions: PlatformOption[] = [
        {
            value: 'twitch,vk',
            label: 'Все платформы',
            enabled: !!(integrations?.twitch?.enabled && integrations?.vk?.enabled),
        },
        { value: 'twitch', label: 'Только Twitch', enabled: !!integrations?.twitch?.enabled },
        { value: 'vk', label: 'Только VK Live', enabled: !!integrations?.vk?.enabled },
    ];

    const tagConfig: Record<string, TagConfig> = {
        Общее: { icon: Info, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
        Медиа: { icon: Play, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
        'TTS ИИ озвучка': { icon: Mic, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
        'Управление трансляцией': { icon: Radio, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
        'Управление чатом': { icon: MessageSquare, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
        Memealerts: { icon: Coins, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
    };

    const getTagConfig = (tag: string): TagConfig => {
        return tagConfig[tag] || { icon: Tag, color: 'bg-muted/60 text-muted-foreground border-border' };
    };

    const platformsToShow = platformOptions;

    const getPlatformLabel = (platforms: string): string => {
        if (platforms === 'twitch,vk' || platforms === 'all') return 'Все платформы';
        return platformOptions.find((opt) => opt.value === platforms)?.label || platforms;
    };

    const getFilteredBasicCommands = (): ChatCommand[] => {
        return basicCommands.filter((command: ChatCommand) => {
            const matchesSearch =
                command.name.toLowerCase().includes(basicSearchTerm.toLowerCase()) ||
                command.description?.toLowerCase().includes(basicSearchTerm.toLowerCase());

            const normalizedCommandTags = Array.isArray(command.tags)
                ? command.tags.map((tag) => normalizeTag(typeof tag === 'string' ? tag : String(tag)))
                : [];
            const matchesTags =
                selectedBasicTags.length === 0 ||
                selectedBasicTags.some((selectedTag) => normalizedCommandTags.includes(selectedTag));

            const matchesPlatform =
                platformFilter === 'all' || command.platform === 'all' || command.platform === platformFilter;

            return matchesSearch && matchesTags && matchesPlatform;
        });
    };

    const getFilteredCustomCommands = (): ChatCommand[] => {
        return customCommands.filter((command: ChatCommand) => {
            const matchesSearch =
                command.name.toLowerCase().includes(customSearchTerm.toLowerCase()) ||
                command.response?.toLowerCase().includes(customSearchTerm.toLowerCase());

            const matchesPlatform =
                platformFilter === 'all' || command.platform === 'all' || command.platform === platformFilter;

            return matchesSearch && matchesPlatform;
        });
    };

    const toggleTag = (tag: string): void => {
        setSelectedBasicTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    };

    const clearAllFilters = (): void => {
        setSelectedBasicTags([]);
    };

    const handleCreateCommand = (): void => {
        const commandData = {
            command_name: createForm.command_name,
            response_text: createForm.response_text,
            platforms: createForm.platforms,
            allowed_roles: createForm.allowed_roles,
            cooldown_seconds: createForm.cooldown_seconds,
            is_enabled: createForm.is_enabled,
            extra_settings: {
                trigger_mode: createForm.trigger_mode,
                trigger_keyword: createForm.trigger_mode === 'keyword' ? createForm.trigger_keyword.trim() : '',
                timer_interval_seconds:
                    createForm.trigger_mode === 'timer' ? Math.max(15, createForm.timer_interval_seconds) : 300,
                priority: Math.max(0, Math.min(100, createForm.priority)),
                anti_spam_window_seconds: Math.max(0, Math.min(600, createForm.anti_spam_window_seconds)),
                condition_live_only: createForm.condition_live_only,
                condition_min_streak_days: Math.max(0, Math.min(365, createForm.condition_min_streak_days)),
            },
        };

        createCommandMutation.mutate(commandData as unknown as Partial<ChatCommand>, {
            onSuccess: () => {
                setIsCreateDialogOpen(false);
                setCreateForm({
                    command_name: '',
                    response_text: '',
                    platforms: 'twitch,vk',
                    allowed_roles: 'all',
                    cooldown_seconds: 0,
                    is_enabled: true,
                    trigger_mode: 'command',
                    trigger_keyword: '',
                    timer_interval_seconds: 300,
                    priority: 0,
                    anti_spam_window_seconds: 0,
                    condition_live_only: false,
                    condition_min_streak_days: 0,
                });
            },
        });
    };

    const handleUpdateCommand = (commandId: number | undefined): void => {
        if (!commandId || !editingCommand) return;

        if (editingCommand.command_type === 'global' || editingCommand.command_type === 'override') {
            createOverrideMutation.mutate(
                {
                    command_name: editingCommand.name,
                    is_enabled: editForm.is_enabled,
                    platforms: editForm.platforms,
                    allowed_roles: editForm.allowed_roles,
                    cooldown_seconds: editForm.cooldown_seconds,
                    alias: editForm.alias.trim() || null,
                    extra_settings: {
                        ...editForm.extra_settings,
                        trigger_mode: editForm.trigger_mode,
                        trigger_keyword: editForm.trigger_mode === 'keyword' ? editForm.trigger_keyword.trim() : '',
                        timer_interval_seconds:
                            editForm.trigger_mode === 'timer' ? Math.max(15, editForm.timer_interval_seconds) : 300,
                        priority: Math.max(0, Math.min(100, editForm.priority)),
                        anti_spam_window_seconds: Math.max(0, Math.min(600, editForm.anti_spam_window_seconds)),
                        condition_live_only: editForm.condition_live_only,
                        condition_min_streak_days: Math.max(0, Math.min(365, editForm.condition_min_streak_days)),
                    },
                },
                {
                    onSuccess: () => {
                        setIsEditDialogOpen(false);
                        setEditingCommand(null);
                    },
                }
            );
        } else {
            const commandData = {
                command_name: editForm.command_name,
                alias: editForm.alias.trim() || null,
                response_text: editForm.response_text,
                platforms: editForm.platforms,
                allowed_roles: editForm.allowed_roles,
                cooldown_seconds: editForm.cooldown_seconds,
                is_enabled: editForm.is_enabled,
                extra_settings: {
                    ...editForm.extra_settings,
                    trigger_mode: editForm.trigger_mode,
                    trigger_keyword: editForm.trigger_mode === 'keyword' ? editForm.trigger_keyword.trim() : '',
                    timer_interval_seconds:
                        editForm.trigger_mode === 'timer' ? Math.max(15, editForm.timer_interval_seconds) : 300,
                    priority: Math.max(0, Math.min(100, editForm.priority)),
                    anti_spam_window_seconds: Math.max(0, Math.min(600, editForm.anti_spam_window_seconds)),
                    condition_live_only: editForm.condition_live_only,
                    condition_min_streak_days: Math.max(0, Math.min(365, editForm.condition_min_streak_days)),
                },
            };

            updateCommandMutation.mutate(
                { commandId, command: commandData as unknown as Partial<ChatCommand> },
                {
                    onSuccess: () => {
                        setIsEditDialogOpen(false);
                        setEditingCommand(null);
                    },
                }
            );
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
        setCommandToDelete(commandId);
    };

    const confirmDeleteCommand = (): void => {
        if (commandToDelete === null) return;
        deleteCommandMutation.mutate(commandToDelete);
        setCommandToDelete(null);
    };

    const openEditDialog = (command: ChatCommand): void => {
        setEditingCommand(command);
        const platform = command.platform || 'all';
        const user_level = command.user_level || 'everyone';
        const roleMap: Record<string, string> = {
            everyone: 'all',
            subscriber: 'vip',
            moderator: 'moderator',
            broadcaster: 'broadcaster',
        };
        // Get extra_settings from command if available
        const cmdExtraSettings =
            (command as unknown as { extra_settings?: Record<string, unknown> }).extra_settings || {};
        const triggerMode = (cmdExtraSettings.trigger_mode as 'command' | 'keyword' | 'timer' | undefined) || 'command';
        const triggerKeyword = String(cmdExtraSettings.trigger_keyword || '');
        const timerInterval = Number(cmdExtraSettings.timer_interval_seconds || 300);
        const priority = Number(cmdExtraSettings.priority || 0);
        const antiSpamWindow = Number(cmdExtraSettings.anti_spam_window_seconds || 0);
        const conditionLiveOnly = Boolean(cmdExtraSettings.condition_live_only || false);
        const conditionMinStreakDays = Number(cmdExtraSettings.condition_min_streak_days || 0);
        setEditForm({
            command_name: command.name || '',
            alias: command.alias || '',
            is_enabled: command.enabled ?? true,
            platforms: platform === 'all' ? 'twitch,vk' : platform,
            allowed_roles: roleMap[user_level] || user_level,
            cooldown_seconds: command.cooldown || 0,
            response_text: command.response || '',
            extra_settings: cmdExtraSettings,
            trigger_mode: triggerMode,
            trigger_keyword: triggerKeyword,
            timer_interval_seconds: Number.isFinite(timerInterval) ? Math.max(15, timerInterval) : 300,
            priority: Number.isFinite(priority) ? Math.max(0, Math.min(100, priority)) : 0,
            anti_spam_window_seconds: Number.isFinite(antiSpamWindow) ? Math.max(0, Math.min(600, antiSpamWindow)) : 0,
            condition_live_only: conditionLiveOnly,
            condition_min_streak_days: Number.isFinite(conditionMinStreakDays)
                ? Math.max(0, Math.min(365, conditionMinStreakDays))
                : 0,
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
            <Tabs defaultValue="basic" className="min-w-0 space-y-6">
                <TabsList className={DASHBOARD_TABS_LIST_CLASS}>
                    <TabsTrigger value="basic" className={DASHBOARD_TAB_TRIGGER_CLASS}>
                        Базовые команды
                    </TabsTrigger>
                    <TabsTrigger value="custom" className={DASHBOARD_TAB_TRIGGER_CLASS}>
                        Кастомные команды
                    </TabsTrigger>
                    <TabsTrigger value="history" className={DASHBOARD_TAB_TRIGGER_CLASS}>
                        История
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <Card className={SURFACE_CARD_CLASS}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4" />
                            <div className="mb-4 grid grid-cols-[minmax(220px,1fr)_150px_170px] items-center gap-2 min-[1280px]:grid-cols-[minmax(280px,1fr)_170px_190px]">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                        <Input
                                            placeholder="Поиск команд..."
                                            value={basicSearchTerm}
                                            onChange={(e) => setBasicSearchTerm(e.target.value)}
                                            className="border-sky-500/25 bg-[#0b0712] pl-10 text-sky-100 placeholder:text-sky-200/50"
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
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-full justify-between border-sky-500/35 bg-[#0b0712] text-sky-100 hover:border-sky-400/55 hover:bg-sky-500/10"
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <Filter className="h-4 w-4" />
                                                    Категории
                                                </span>
                                                <span className="inline-flex items-center gap-1 min-w-[42px] justify-end">
                                                    <Badge
                                                        variant="secondary"
                                                        className={`h-5 px-1.5 ${selectedBasicTags.length === 0 ? 'opacity-0' : ''}`}
                                                    >
                                                        {selectedBasicTags.length}
                                                    </Badge>
                                                    <ChevronDown
                                                        className={`h-4 w-4 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`}
                                                    />
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-[min(34rem,calc(100vw-2rem))] p-0 border-sky-400/45 bg-[#0b0712] shadow-2xl shadow-black/70 ring-1 ring-white/10"
                                            align="start"
                                        >
                                            <div className="p-3 border-b border-sky-500/20">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium text-sm">Категории</h4>
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
                                                    placeholder="Поиск категории..."
                                                    value={tagSearchTerm}
                                                    onChange={(e) => setTagSearchTerm(e.target.value)}
                                                    className="h-8 border-sky-500/25 bg-background/70 text-xs text-sky-100 placeholder:text-sky-200/50"
                                                />
                                            </div>
                                            <div className="flex flex-wrap content-start gap-2 p-3">
                                                {basicTags.length > 0 ? (
                                                    basicTags
                                                        .filter((tag) =>
                                                            tag.toLowerCase().includes(tagSearchTerm.toLowerCase())
                                                        )
                                                        .map((tag) => {
                                                            const config = getTagConfig(tag);
                                                            const IconComponent = config.icon;
                                                            const isSelected = selectedBasicTags.includes(tag);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={tag}
                                                                    className={`inline-flex min-h-8 max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                                                        isSelected
                                                                            ? 'border-sky-400/60 bg-sky-500/15 text-sky-100'
                                                                            : 'border-border/60 bg-background/55 text-muted-foreground hover:border-sky-400/35 hover:bg-sky-500/10 hover:text-foreground'
                                                                    }`}
                                                                    onClick={() => toggleTag(tag)}
                                                                >
                                                                    <div className={`p-1.5 rounded-md ${config.color}`}>
                                                                        <IconComponent className="h-3.5 w-3.5" />
                                                                    </div>
                                                                    <span className="truncate">{tag}</span>
                                                                </button>
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

                            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 min-[1280px]:grid-cols-[repeat(3,minmax(0,1fr))]">
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
                            </div>
                            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="h-9 border-border/70">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Создать команду
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
                                                onChange={(e) =>
                                                    setCreateForm((prev) => ({
                                                        ...prev,
                                                        command_name: e.target.value.replace('!', ''),
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="response_text">Ответ команды</Label>
                                            <Textarea
                                                id="response_text"
                                                placeholder="Подписывайтесь на мой Telegram канал: https://t.me/..."
                                                value={createForm.response_text}
                                                onChange={(e) =>
                                                    setCreateForm((prev) => ({
                                                        ...prev,
                                                        response_text: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label>Платформы</Label>
                                                <Select
                                                    value={createForm.platforms || 'twitch,vk'}
                                                    onValueChange={(value) =>
                                                        setCreateForm((prev) => ({
                                                            ...prev,
                                                            platforms: value,
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                                        <SelectValue placeholder="Выберите платформы">
                                                            {createForm.platforms === 'twitch,vk' ||
                                                            !createForm.platforms
                                                                ? 'Все платформы'
                                                                : getPlatformLabel(createForm.platforms)}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                                        {platformsToShow.map((option) => (
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
                                                    onValueChange={(value) =>
                                                        setCreateForm((prev) => ({
                                                            ...prev,
                                                            allowed_roles: value,
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                                        <SelectValue placeholder="Выберите доступ">
                                                            {roleOptions.find(
                                                                (opt) => opt.value === createForm.allowed_roles
                                                            )?.label || 'Выберите доступ'}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                                        {roleOptions.map((option) => (
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
                                                onChange={(e) =>
                                                    setCreateForm((prev) => ({
                                                        ...prev,
                                                        cooldown_seconds: parseInt(e.target.value) || 0,
                                                    }))
                                                }
                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <Label>Режим запуска</Label>
                                                <Select
                                                    value={createForm.trigger_mode}
                                                    onValueChange={(value) =>
                                                        setCreateForm((prev) => ({
                                                            ...prev,
                                                            trigger_mode: value as 'command' | 'keyword' | 'timer',
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                                        <SelectItem value="command">По !команде</SelectItem>
                                                        <SelectItem value="keyword">По ключевому слову</SelectItem>
                                                        <SelectItem value="timer">По таймеру</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {createForm.trigger_mode === 'keyword' && (
                                                <div>
                                                    <Label htmlFor="trigger_keyword">Ключевое слово</Label>
                                                    <Input
                                                        id="trigger_keyword"
                                                        placeholder="например: привет"
                                                        value={createForm.trigger_keyword}
                                                        onChange={(e) =>
                                                            setCreateForm((prev) => ({
                                                                ...prev,
                                                                trigger_keyword: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            )}
                                            {createForm.trigger_mode === 'timer' && (
                                                <div>
                                                    <Label htmlFor="timer_interval">Интервал автозапуска (сек)</Label>
                                                    <Input
                                                        id="timer_interval"
                                                        type="number"
                                                        min="15"
                                                        value={createForm.timer_interval_seconds}
                                                        onChange={(e) =>
                                                            setCreateForm((prev) => ({
                                                                ...prev,
                                                                timer_interval_seconds: Math.max(
                                                                    15,
                                                                    parseInt(e.target.value, 10) || 15
                                                                ),
                                                            }))
                                                        }
                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div>
                                                    <Label htmlFor="priority">Приоритет (0-100)</Label>
                                                    <Input
                                                        id="priority"
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={createForm.priority}
                                                        onChange={(e) =>
                                                            setCreateForm((prev) => ({
                                                                ...prev,
                                                                priority: Math.max(
                                                                    0,
                                                                    Math.min(100, parseInt(e.target.value, 10) || 0)
                                                                ),
                                                            }))
                                                        }
                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="anti_spam_window">Анти-спам (сек)</Label>
                                                    <Input
                                                        id="anti_spam_window"
                                                        type="number"
                                                        min="0"
                                                        max="600"
                                                        value={createForm.anti_spam_window_seconds}
                                                        onChange={(e) =>
                                                            setCreateForm((prev) => ({
                                                                ...prev,
                                                                anti_spam_window_seconds: Math.max(
                                                                    0,
                                                                    Math.min(600, parseInt(e.target.value, 10) || 0)
                                                                ),
                                                            }))
                                                        }
                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="flex items-center justify-between rounded-md border border-border/70 p-2">
                                                    <Label htmlFor="condition_live_only" className="text-sm">
                                                        Только когда стрим онлайн
                                                    </Label>
                                                    <Switch
                                                        id="condition_live_only"
                                                        checked={createForm.condition_live_only}
                                                        onCheckedChange={(checked) =>
                                                            setCreateForm((prev) => ({
                                                                ...prev,
                                                                condition_live_only: checked,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="condition_min_streak_days">
                                                        Мин. стрик зрителя
                                                    </Label>
                                                    <Input
                                                        id="condition_min_streak_days"
                                                        type="number"
                                                        min="0"
                                                        max="365"
                                                        value={createForm.condition_min_streak_days}
                                                        onChange={(e) =>
                                                            setCreateForm((prev) => ({
                                                                ...prev,
                                                                condition_min_streak_days: Math.max(
                                                                    0,
                                                                    Math.min(365, parseInt(e.target.value, 10) || 0)
                                                                ),
                                                            }))
                                                        }
                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                            Отмена
                                        </Button>
                                        <Button onClick={handleCreateCommand} className="h-9 shadow-none">
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
                                    <div className="mb-4 grid grid-cols-[minmax(220px,1fr)_150px_170px] items-center gap-2 min-[1280px]:grid-cols-[minmax(280px,1fr)_170px_190px]">
                                        <div className="flex-1">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                                <Input
                                                    placeholder="Поиск кастомных команд..."
                                                    value={customSearchTerm}
                                                    onChange={(e) => setCustomSearchTerm(e.target.value)}
                                                    className="border-sky-500/25 bg-[#0b0712] pl-10 text-sky-100 placeholder:text-sky-200/50"
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
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 min-[1280px]:grid-cols-[repeat(3,minmax(0,1fr))]">
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
                <TabsContent value="history" className="space-y-4">
                    <Card className={SURFACE_CARD_CLASS}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                История команд
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-[minmax(220px,1fr)_150px_170px] gap-2 min-[1280px]:grid-cols-[minmax(220px,1fr)_160px_180px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Поиск по команде..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="border-sky-500/25 bg-[#0b0712] pl-10 text-sky-100 placeholder:text-sky-200/50"
                                    />
                                </div>
                                <Select value={historyPlatform} onValueChange={setHistoryPlatform}>
                                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Платформа" />
                                    </SelectTrigger>
                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                        <SelectItem value="all">Все платформы</SelectItem>
                                        <SelectItem value="twitch">Twitch</SelectItem>
                                        <SelectItem value="vk">VK Live</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={historyType} onValueChange={setHistoryType}>
                                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Тип" />
                                    </SelectTrigger>
                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                        <SelectItem value="all">Все типы</SelectItem>
                                        <SelectItem value="custom">Кастомные</SelectItem>
                                        <SelectItem value="override">Override</SelectItem>
                                        <SelectItem value="global">Глобальные</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {historyLoading ? (
                                <div className="text-sm text-muted-foreground">Загрузка истории...</div>
                            ) : commandHistory.length === 0 ? (
                                <div className="text-sm text-muted-foreground">История команд пока пуста</div>
                            ) : (
                                <div className="space-y-2">
                                    {commandHistory.map((cmd) => (
                                        <div
                                            key={`hist-${cmd.id}`}
                                            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto] gap-2 rounded-md border border-border/70 bg-card/60 p-2.5"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-mono text-sm text-foreground truncate">
                                                    !{cmd.canonical_command_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Триггер: !{cmd.used_trigger}
                                                </div>
                                            </div>
                                            <div className="min-w-0 text-xs text-muted-foreground">
                                                <div className="truncate text-foreground">
                                                    {cmd.viewer_name || 'Система'} · {cmd.platform || 'чат'}
                                                </div>
                                                <div className="truncate">
                                                    {cmd.has_platform_message || cmd.message_text
                                                        ? cmd.message_text || 'Есть сообщение платформы'
                                                        : 'Без сообщения платформы'}
                                                </div>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="w-fit border-sky-500/30 bg-sky-500/10 text-sky-200 md:justify-self-end"
                                            >
                                                {cmd.created_at ? formatAppDateTime(cmd.created_at) : 'сейчас'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Настройка команды</DialogTitle>
                    </DialogHeader>
                    {editingCommand && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="edit_command_name">Основная команда</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">!</span>
                                        <Input
                                            id="edit_command_name"
                                            value={editForm.command_name}
                                            disabled={isGlobalLikeEditingCommand}
                                            onChange={(e) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    command_name: e.target.value,
                                                }))
                                            }
                                            placeholder="например, hello"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="edit_command_alias">Дополнительный алиас</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">!</span>
                                        <Input
                                            id="edit_command_alias"
                                            value={editForm.alias}
                                            onChange={(e) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    alias: e.target.value,
                                                }))
                                            }
                                            placeholder={isGlobalLikeEditingCommand ? 'например, игра' : 'например, привет'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {editingCommand.command_type === 'custom' && (
                                <div>
                                    <Label htmlFor="edit_response">Ответ команды</Label>
                                    <Textarea
                                        id="edit_response"
                                        value={editForm.response_text}
                                        onChange={(e) =>
                                            setEditForm((prev) => ({
                                                ...prev,
                                                response_text: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <Label>Платформы</Label>
                                    <Select
                                        value={editForm.platforms || 'twitch,vk'}
                                        onValueChange={(value) =>
                                            setEditForm((prev) => ({
                                                ...prev,
                                                platforms: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Выберите платформы">
                                                {editForm.platforms === 'twitch,vk' || !editForm.platforms
                                                    ? 'Все платформы'
                                                    : getPlatformLabel(editForm.platforms)}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                                            {platformsToShow.map((option) => (
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
                                        onValueChange={(value) =>
                                            setEditForm((prev) => ({
                                                ...prev,
                                                allowed_roles: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Выберите доступ">
                                                {roleOptions.find((opt) => opt.value === editForm.allowed_roles)
                                                    ?.label || 'Выберите доступ'}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                                            {roleOptions.map((option) => (
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
                                    onChange={(e) =>
                                        setEditForm((prev) => ({
                                            ...prev,
                                            cooldown_seconds: parseInt(e.target.value) || 0,
                                        }))
                                    }
                                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>

                            {editingCommand.command_type === 'custom' && (
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <Label>Режим запуска</Label>
                                        <Select
                                            value={editForm.trigger_mode}
                                            onValueChange={(value) =>
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    trigger_mode: value as 'command' | 'keyword' | 'timer',
                                                }))
                                            }
                                        >
                                            <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className={CONTROL_CONTENT_CLASS}>
                                                <SelectItem value="command">По !команде</SelectItem>
                                                <SelectItem value="keyword">По ключевому слову</SelectItem>
                                                <SelectItem value="timer">По таймеру</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {editForm.trigger_mode === 'keyword' && (
                                        <div>
                                            <Label htmlFor="edit_trigger_keyword">Ключевое слово</Label>
                                            <Input
                                                id="edit_trigger_keyword"
                                                value={editForm.trigger_keyword}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        trigger_keyword: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    )}
                                    {editForm.trigger_mode === 'timer' && (
                                        <div>
                                            <Label htmlFor="edit_timer_interval">Интервал автозапуска (сек)</Label>
                                            <Input
                                                id="edit_timer_interval"
                                                type="number"
                                                min="15"
                                                value={editForm.timer_interval_seconds}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        timer_interval_seconds: Math.max(
                                                            15,
                                                            parseInt(e.target.value, 10) || 15
                                                        ),
                                                    }))
                                                }
                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <Label htmlFor="edit_priority">Приоритет (0-100)</Label>
                                            <Input
                                                id="edit_priority"
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={editForm.priority}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        priority: Math.max(
                                                            0,
                                                            Math.min(100, parseInt(e.target.value, 10) || 0)
                                                        ),
                                                    }))
                                                }
                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="edit_anti_spam_window">Анти-спам (сек)</Label>
                                            <Input
                                                id="edit_anti_spam_window"
                                                type="number"
                                                min="0"
                                                max="600"
                                                value={editForm.anti_spam_window_seconds}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        anti_spam_window_seconds: Math.max(
                                                            0,
                                                            Math.min(600, parseInt(e.target.value, 10) || 0)
                                                        ),
                                                    }))
                                                }
                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="flex items-center justify-between rounded-md border border-border/70 p-2">
                                            <Label htmlFor="edit_condition_live_only" className="text-sm">
                                                Только когда стрим онлайн
                                            </Label>
                                            <Switch
                                                id="edit_condition_live_only"
                                                checked={editForm.condition_live_only}
                                                onCheckedChange={(checked) =>
                                                    setEditForm((prev) => ({ ...prev, condition_live_only: checked }))
                                                }
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="edit_condition_min_streak_days">Мин. стрик зрителя</Label>
                                            <Input
                                                id="edit_condition_min_streak_days"
                                                type="number"
                                                min="0"
                                                max="365"
                                                value={editForm.condition_min_streak_days}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        condition_min_streak_days: Math.max(
                                                            0,
                                                            Math.min(365, parseInt(e.target.value, 10) || 0)
                                                        ),
                                                    }))
                                                }
                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Настройки голосования для команды skip */}
                            {editingCommand.name === 'skip' && (
                                <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800/50 mt-4">
                                    <Label htmlFor="skip_votes" className="text-base font-medium">
                                        Количество разных зрителей для !skip
                                    </Label>
                                    <Input
                                        id="skip_votes"
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={(editForm.extra_settings?.skip_votes_required as number) || 1}
                                        onChange={(e) =>
                                            setEditForm((prev) => ({
                                                ...prev,
                                                extra_settings: {
                                                    ...prev.extra_settings,
                                                    skip_votes_required: parseInt(e.target.value) || 1,
                                                },
                                            }))
                                        }
                                        className="w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                            onClick={() =>
                                handleUpdateCommand(editingCommand?.id ? Number(editingCommand.id) : undefined)
                            }
                            className="h-9 shadow-none"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={commandToDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setCommandToDelete(null);
                }}
                title="Удалить команду"
                description="Команда будет удалена из списка кастомных команд."
                confirmLabel="Удалить"
                variant="destructive"
                loading={deleteCommandMutation.isPending}
                onConfirm={confirmDeleteCommand}
            />
        </PageWrapper>
    );
};

export default CommandsPage;
