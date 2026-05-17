import React, { useMemo, useState } from 'react';

import { AlertCircle, MessageSquare, Settings, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useCommands, useCreateCommandOverride } from '@/queries/commands/commandsQueries';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';

import PageWrapper from '../shared/components/PageWrapper';

const SURFACE_CARD_CLASS = 'card-glass border-border/70 bg-card/90 shadow-sm shadow-black/10';

const AnalyticsPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const { data: commandsData, isLoading: isCommandsLoading } = useCommands({
        enabled: !!isAuthenticated && (integrations?.twitch?.enabled || integrations?.vk?.enabled),
    });
    const createOverrideMutation = useCreateCommandOverride();

    const [isSaving, setIsSaving] = useState(false);

    const basicCommands = commandsData?.basic_commands || [];
    const analyzeCommand = basicCommands.find((cmd) => cmd.name === 'analyze');
    const hasPlatforms = !!(integrations?.twitch?.enabled || integrations?.vk?.enabled);
    const hasAnalyzeCommand = Boolean(analyzeCommand);
    const effectiveCommandName = useMemo(() => {
        const alias = analyzeCommand?.alias?.trim();
        return alias || 'analyze';
    }, [analyzeCommand?.alias]);

    const isEnabled = !isCommandsLoading && (analyzeCommand?.enabled ?? false);

    const handleToggle = async (enabled: boolean): Promise<void> => {
        if (!analyzeCommand) return;
        setIsSaving(true);
        try {
            await createOverrideMutation.mutateAsync({
                command_name: 'analyze',
                is_enabled: enabled,
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Аналитика чата" className="pt-12 sm:pt-14" contentClassName="mx-auto max-w-6xl">
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">Нужна авторизация</h3>
                            <p className="text-muted-foreground text-sm">
                                Войдите в аккаунт, чтобы управлять функциями анализа сообщений.
                            </p>
                        </div>
                        <Button onClick={() => navigate('/login')} variant="outline" className="gap-2 border-border/70">
                            <Settings className="w-4 h-4" />
                            Войти в аккаунт
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Аналитика чата" className="pt-12 sm:pt-14" contentClassName="mx-auto max-w-6xl">
            <div className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className={`h-full ${SURFACE_CARD_CLASS}`}>
                        <CardHeader className="pb-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Terminal className="h-3 w-3 text-sky-300" />
                                    <code className="text-sm font-bold font-mono bg-muted px-2 py-1 rounded text-foreground">
                                        !{effectiveCommandName}
                                    </code>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isCommandsLoading ? (
                                        <>
                                            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                                            <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
                                        </>
                                    ) : (
                                        <>
                                            <Badge variant={isEnabled ? 'default' : 'secondary'}>
                                                {isEnabled ? 'Включена' : 'Отключена'}
                                            </Badge>
                                            <Switch
                                                checked={isEnabled}
                                                disabled={!hasAnalyzeCommand || !hasPlatforms || isSaving}
                                                onCheckedChange={handleToggle}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                Команда показывает краткий разбор активности пользователя по его сообщениям.
                            </p>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <Badge
                                    variant="outline"
                                    className="text-xs px-1.5 py-0 bg-sky-500/10 text-sky-300 border-sky-500/30"
                                >
                                    <MessageSquare className="h-3 w-3 mr-1" /> Аналитика
                                </Badge>
                                {!hasPlatforms && (
                                    <Badge variant="outline" className="border-border/70 text-muted-foreground">
                                        Нет подключенных платформ
                                    </Badge>
                                )}
                                {!hasAnalyzeCommand && (
                                    <Badge variant="outline" className="border-border/70 text-muted-foreground">
                                        Команда не найдена
                                    </Badge>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-border/30">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => navigate('/dashboard/commands')}
                                    className="flex-1 h-8 text-xs"
                                >
                                    <Settings className="h-3 w-3 mr-1" />
                                    Настроить имя команды
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageWrapper>
    );
};

export default AnalyticsPage;
