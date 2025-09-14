import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Terminal, Mic, Volume2, VolumeX, Play, Pause, SkipForward, Trash2, HelpCircle, Settings, Users, MessageSquare } from 'lucide-react';

const CommandsPage = () => {
    const commands = [
        {
            category: "Основные команды",
            icon: <Terminal className="h-4 w-4" />,
            commands: [
                {
                    command: "!help",
                    description: "Показать список всех доступных команд",
                    example: "!help"
                },
                {
                    command: "!tts",
                    description: "Включить/выключить озвучку чата",
                    example: "!tts on / !tts off"
                },
                {
                    command: "!volume",
                    description: "Изменить громкость озвучки (0-100)",
                    example: "!volume 50"
                }
            ]
        },
        {
            category: "Управление воспроизведением",
            icon: <Play className="h-4 w-4" />,
            commands: [
                {
                    command: "!play",
                    description: "Возобновить воспроизведение очереди",
                    example: "!play"
                },
                {
                    command: "!pause",
                    description: "Приостановить воспроизведение",
                    example: "!pause"
                },
                {
                    command: "!skip",
                    description: "Пропустить текущее сообщение",
                    example: "!skip"
                },
                {
                    command: "!clear",
                    description: "Очистить очередь сообщений",
                    example: "!clear"
                }
            ]
        },
        {
            category: "Модерация",
            icon: <Users className="h-4 w-4" />,
            commands: [
                {
                    command: "!mute",
                    description: "Заглушить пользователя (только для модераторов)",
                    example: "!mute @username"
                },
                {
                    command: "!unmute",
                    description: "Разглушить пользователя (только для модераторов)",
                    example: "!unmute @username"
                },
                {
                    command: "!mod",
                    description: "Назначить модератора (только для стримера)",
                    example: "!mod @username"
                }
            ]
        },
        {
            category: "Настройки",
            icon: <Settings className="h-4 w-4" />,
            commands: [
                {
                    command: "!speed",
                    description: "Изменить скорость речи (0.5-2.0)",
                    example: "!speed 1.2"
                },
                {
                    command: "!voice",
                    description: "Изменить голос озвучки",
                    example: "!voice default"
                },
                {
                    command: "!emotes",
                    description: "Включить/выключить озвучку смайлов",
                    example: "!emotes on / !emotes off"
                }
            ]
        }
    ];

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-4">Команды чата</h1>
                <p className="text-lg text-muted-foreground">
                    Полный список команд для управления ИИ озвучкой в чате Twitch
                </p>
            </div>

            <div className="grid gap-6">
                {commands.map((category, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {category.icon}
                                {category.category}
                            </CardTitle>
                            <CardDescription>
                                Команды для {category.category.toLowerCase()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {category.commands.map((cmd, cmdIndex) => (
                                    <div key={cmdIndex} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="font-mono">
                                                {cmd.command}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                                {cmd.description}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground font-mono">
                                            Пример: {cmd.example}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5" />
                        Дополнительная информация
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">Как использовать команды:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Все команды начинаются с символа <code className="bg-muted px-1 rounded">!</code></li>
                            <li>Команды не чувствительны к регистру</li>
                            <li>Некоторые команды доступны только модераторам или стримеру</li>
                            <li>Используйте <code className="bg-muted px-1 rounded">!help</code> в чате для быстрого доступа к списку команд</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h4 className="font-semibold mb-2">Настройка команд:</h4>
                        <p className="text-sm text-muted-foreground">
                            Владельцы каналов могут настраивать названия команд и их поведение в разделе "Настройки" дашборда.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default CommandsPage;
