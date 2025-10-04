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
    Crown
} from 'lucide-react';
import api from '../../services/api';

const CommandsManagementPage = () => {
    const { user } = useAuth();
    const channelName = user?.username;

    const [commands, setCommands] = useState({});
    const [loading, setLoading] = useState(true);
    const [editingCommand, setEditingCommand] = useState(null);
    const [editForm, setEditForm] = useState({ command: '', description: '', enabled: true, permissions: 'all' });
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({ command: '', description: '', permissions: 'all', enabled: true });

    const categories = {
        'Основные': ['help', 'tts', 'volume'],
        'Управление': ['play', 'pause', 'skip', 'clear'],
        'Модерация': ['mute', 'unmute'],
        'Настройки': ['speed', 'voice', 'emotes']
    };

    const categoryIcons = {
        'Основные': <Settings className="h-4 w-4" />,
        'Управление': <Play className="h-4 w-4" />,
        'Модерация': <Users className="h-4 w-4" />,
        'Настройки': <Volume2 className="h-4 w-4" />,
        'Пользовательские': <Terminal className="h-4 w-4" />
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
                const response = await api.get(`/api/commands/${channelName}`);
                setCommands(response.data.commands || {});
            } catch (error) {
                console.error('Failed to fetch commands:', error);
            } finally {
                setLoading(false);
            }
        }
    }, [channelName]);

    useEffect(() => {
        fetchCommands();
    }, [fetchCommands]);

    const handleEditCommand = (commandKey) => {
        const command = commands[commandKey];
        setEditingCommand(commandKey);
        setEditForm({
            command: command.command,
            description: command.description,
            enabled: command.enabled,
            permissions: command.permissions || 'all'
        });
    };
    
    const handleSaveCommand = async () => {
        try {
            const payload = {
                command_key: editingCommand,
                updates: editForm
            };
            await api.post(`/api/commands/${channelName}/update`, payload);
            await fetchCommands();
            setEditingCommand(null);
        } catch (error) {
            console.error('Failed to update command:', error);
        }
    };

    const handleCreateCommand = async () => {
        try {
            await api.post(`/api/commands/${channelName}/create`, createForm);
            await fetchCommands();
            setShowCreateForm(false);
            setCreateForm({ command: '', description: '', permissions: 'all', enabled: true });
        } catch (error) {
            console.error('Failed to create command:', error);
        }
    };

    const handleCancelEdit = () => {
        setEditingCommand(null);
    };

    const handleToggleCommand = async (commandKey, enabled) => {
        try {
            await api.post(`/api/commands/${channelName}/update`, {
                command_key: commandKey,
                updates: { enabled }
            });
            await fetchCommands();
        } catch (error) {
            console.error('Failed to toggle command:', error);
        }
    };

    const handleResetCommands = async () => {
        if (window.confirm('Вы уверены, что хотите сбросить все команды к значениям по умолчанию?')) {
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
                                            <SelectItem value="mods">Только модераторы</SelectItem>
                                            <SelectItem value="broadcaster">Только стример</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                        {getPermissionIcon(command.permissions)}
                                        {getPermissionLabel(command.permissions)}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">{command.description}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={command.enabled}
                                        onCheckedChange={(checked) => handleToggleCommand(commandKey, checked)}
                                    />
                                    <Label className="text-sm">Включена</Label>
                                    <Button size="sm" variant="ghost" onClick={() => handleEditCommand(commandKey)} className="ml-auto"><Edit2 className="h-4 w-4" /></Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loading) {
        return <div className="flex items-center justify-center h-64">Загрузка команд...</div>;
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-6 text-foreground">Управление командами</h1>
                    <p className="text-muted-foreground">Настройте команды бота для вашего канала</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowCreateForm(!showCreateForm)} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />Создать команду
                    </Button>
                    <Button onClick={handleResetCommands} variant="outline" className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />Сбросить к умолчанию
                    </Button>
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
                                 <SelectItem value="mods">Только модераторы</SelectItem>
                                 <SelectItem value="broadcaster">Только стример</SelectItem>
                             </SelectContent>
                         </Select>
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
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="all">Все</TabsTrigger>
                    {Object.keys(categories).map(category => (
                        <TabsTrigger key={category} value={category} className="gap-2">{categoryIcons[category]}{category}</TabsTrigger>
                    ))}
                     <TabsTrigger value="Пользовательские" className="gap-2">{categoryIcons['Пользовательские']}Пользовательские</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(commands).map(([commandKey, command]) => renderCommandCard(commandKey, command))}
                    </div>
                </TabsContent>

                {Object.keys(categories).map(category => (
                    <TabsContent key={category} value={category} className="space-y-4 mt-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {categories[category]
                                .filter(commandKey => commands[commandKey])
                                .map(commandKey => renderCommandCard(commandKey, commands[commandKey]))
                            }
                        </div>
                    </TabsContent>
                ))}
                
                <TabsContent value="Пользовательские" className="space-y-4 mt-4">
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(commands)
                            .filter(([key, cmd]) => cmd.is_custom)
                            .map(([commandKey, command]) => renderCommandCard(commandKey, command))
                        }
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default CommandsManagementPage;
