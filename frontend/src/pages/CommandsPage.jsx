import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { Mic, Clapperboard, Settings, Lock } from 'lucide-react';

const CommandsPage = () => {
    const { isAuthenticated } = useAuth();

    const basicCommands = [
        {
            command: '!tts',
            description: 'Включить/выключить озвучку сообщений',
            usage: '!tts',
            examples: [
                '!tts - переключить TTS (включить/выключить)'
            ],
            icon: <Mic className="h-4 w-4" />
        },
        {
            command: '!queue',
            description: 'Показать очередь YouTube видео',
            usage: '!queue',
            examples: [
                '!queue - показать текущую очередь воспроизведения'
            ],
            icon: <Clapperboard className="h-4 w-4" />
        },
        {
            command: '!next',
            description: 'Переключить на следующее видео',
            usage: '!next',
            examples: [
                '!next - переключить на следующее видео в очереди'
            ],
            icon: <Clapperboard className="h-4 w-4" />
        },
        {
            command: '!clear',
            description: 'Очистить очередь видео',
            usage: '!clear',
            examples: [
                '!clear - очистить всю очередь воспроизведения'
            ],
            icon: <Clapperboard className="h-4 w-4" />
        },
        {
            command: '!add',
            description: 'Добавить видео в очередь',
            usage: '!add <url>',
            examples: [
                '!add https://youtube.com/watch?v=... - добавить YouTube видео'
            ],
            icon: <Clapperboard className="h-4 w-4" />
        },
        {
            command: '!help',
            description: 'Показать список всех команд',
            usage: '!help',
            examples: [
                '!help - показать доступные команды'
            ],
            icon: <Settings className="h-4 w-4" />
        }
    ];

    const customCommands = [
        {
            command: '!custom1',
            description: 'Пользовательская команда 1',
            usage: '!custom1 <параметр>',
            examples: ['!custom1 test - пример использования'],
            icon: <Settings className="h-4 w-4" />
        },
        {
            command: '!custom2',
            description: 'Пользовательская команда 2',
            usage: '!custom2',
            examples: ['!custom2 - выполнить действие'],
            icon: <Settings className="h-4 w-4" />
        }
    ];

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Команды чата</h1>
                <p className="text-muted-foreground">
                    Список всех доступных команд для управления ботом и функциями стрима
                </p>
            </div>

            {/* Базовые команды */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold">Базовые команды</h2>
                    <Badge variant="secondary">Доступны всем</Badge>
                </div>
                <p className="text-muted-foreground">
                    Основные команды для управления голосами, медиа и озвучкой
                </p>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {basicCommands.map((cmd, index) => (
                        <Card key={index} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    {cmd.icon}
                                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                        {cmd.command}
                                    </code>
                                </CardTitle>
                                <CardDescription className="text-sm">
                                    {cmd.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Использование:</p>
                                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono block">
                                        {cmd.usage}
                                    </code>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">Примеры:</p>
                                    <ul className="space-y-1">
                                        {cmd.examples.map((example, idx) => (
                                            <li key={idx} className="text-xs text-muted-foreground">
                                                <code className="bg-muted px-1 py-0.5 rounded">
                                                    {example}
                                                </code>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Кастомные команды */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold">Кастомные команды</h2>
                    {isAuthenticated ? (
                        <Badge variant="default">Доступны</Badge>
                    ) : (
                        <Badge variant="outline" className="flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Требуется авторизация
                        </Badge>
                    )}
                </div>
                <p className="text-muted-foreground">
                    Персональные команды, доступные только авторизованным пользователям
                </p>
                
                {isAuthenticated ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {customCommands.map((cmd, index) => (
                            <Card key={index} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        {cmd.icon}
                                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                            {cmd.command}
                                        </code>
                                    </CardTitle>
                                    <CardDescription className="text-sm">
                                        {cmd.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Использование:</p>
                                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono block">
                                            {cmd.usage}
                                        </code>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Примеры:</p>
                                        <ul className="space-y-1">
                                            {cmd.examples.map((example, idx) => (
                                                <li key={idx} className="text-xs text-muted-foreground">
                                                    <code className="bg-muted px-1 py-0.5 rounded">
                                                        {example}
                                                    </code>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Требуется авторизация</h3>
                            <p className="text-muted-foreground mb-4">
                                Для доступа к кастомным командам необходимо войти в систему
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Авторизуйтесь через Twitch, чтобы получить доступ к персональным командам
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default CommandsPage;
