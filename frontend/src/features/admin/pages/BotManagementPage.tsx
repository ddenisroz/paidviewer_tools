import React, { useEffect, useState } from 'react';

import {
    AlertCircle,
    Bot,
    CheckCircle,
    Constants,
    ExternalLink,
    Info,
    RefreshCw,
    Square
} from 'lucide-react';

import { API_BASE_URL, TTS_SERVICE_URL } from '@/constants';
import { useTts } from '@/context/TtsContext';
import { useBotTokenStatusQuery, useRefreshBotTokenMutation } from '@/queries/admin/adminQueries';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageLoader } from '@/shared/components/ui/loader';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


// Types for bot management
export interface BotData {
    name: string;
    status: 'running' | 'stopped' | 'error';
    connections?: number;
}

export interface TtsStatus {
    status: string;
    healthy: boolean;
    available: boolean;
    error?: string;
    url?: string;
}

// Helper functions
function parseBotsResponse(data: { bots?: BotData[] }): BotData[] {
    return data?.bots || [];
}

function parseTtsResponse(data: { status?: string; healthy?: boolean; url?: string }): TtsStatus {
    return {
        status: data?.status || 'unknown',
        healthy: data?.healthy || false,
        available: data?.healthy || false,
        url: data?.url,
    };
}

function getBotServiceStatus(bots: BotData[]): 'running' | 'error' | 'stopped' {
    if (bots.length === 0) return 'stopped';
    const hasError = bots.some(b => b.status === 'error');
    if (hasError) return 'error';
    const hasRunning = bots.some(b => b.status === 'running');
    return hasRunning ? 'running' : 'stopped';
}

function getBotServiceDescription(bots: BotData[]): string {
    if (bots.length === 0) return 'Нет подключенных ботов';
    const running = bots.filter(b => b.status === 'running').length;
    return `${running} из ${bots.length} ботов активно`;
}

type RestartingState = Record<string, boolean>;

const BotManagementPage: React.FC = () => {
    // Service Status State
    const [bots, setBots] = useState<BotData[]>([]);
    const [ttsStatus, setTtsStatus] = useState<TtsStatus | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [restarting, setRestarting] = useState<RestartingState>({});

    // OAuth Token State (Moved from BotManagementCard)
    const { data: tokenStatus, isLoading: tokenLoading } = useBotTokenStatusQuery();
    const refreshMutation = useRefreshBotTokenMutation();
    const refreshing = refreshMutation.isPending;

    const { engineStatus: _engineStatus } = useTts();

    const loadBotsStatus = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await adminService.getBotsStatus();
            const botsArray = parseBotsResponse(response.data as Parameters<typeof parseBotsResponse>[0]);
            setBots(botsArray);
        } catch (error) {
            logger.error('Error loading bots status:', error);
            toast.error('Ошибка загрузки статуса ботов');
            setBots([]);
        } finally {
            setLoading(false);
        }
    };

    const loadTtsStatus = async (): Promise<void> => {
        try {
            const response = await adminService.getTtsStatus();
            const ttsData = parseTtsResponse(response.data as Parameters<typeof parseTtsResponse>[0]);
            setTtsStatus(ttsData);
        } catch (error: unknown) {
            logger.error('Error loading TTS status:', error);
            const err = error as { response?: { data?: { detail?: string } }; message?: string };
            setTtsStatus({
                status: 'error',
                healthy: false,
                available: false,
                error: err.response?.data?.detail || err.message || 'Failed to check TTS status',
                url: TTS_SERVICE_URL
            });
        }
    };

    const restartBotService = async (): Promise<void> => {
        try {
            setRestarting(prev => ({ ...prev, 'bot_service': true }));
            await adminService.restartBotService();
            toast.success('Bot Service перезапущен');
            await loadBotsStatus();
        } catch (error) {
            logger.error('Error restarting bot service:', error);
            toast.error('Ошибка перезапуска Bot Service');
        } finally {
            setRestarting(prev => ({ ...prev, 'bot_service': false }));
        }
    };

    const restartTtsEngine = async (): Promise<void> => {
        try {
            setRestarting(prev => ({ ...prev, 'tts_engine': true }));
            await adminService.restartTtsEngine();
            toast.success('TTS движок перезапущен');
        } catch (error) {
            logger.error('Error restarting TTS engine:', error);
            toast.error('Ошибка перезапуска TTS движка');
        } finally {
            setRestarting(prev => ({ ...prev, 'tts_engine': false }));
        }
    };

    // OAuth Actions
    const handleAuthorizeBot = () => {
        window.location.href = `${API_BASE_URL}/auth/twitch/bot/login`;
    };

    const handleRefreshToken = () => {
        refreshMutation.mutate();
    };

    const getDaysLeftColor = (days?: number): "default" | "destructive" | "secondary" | "outline" => {
        if (!days) return 'default';
        if (days < 7) return 'destructive';
        if (days < 30) return 'secondary';
        return 'outline';
    };

    const getDaysLeftText = (days?: number) => {
        if (!days) return 'Неизвестно';
        if (days < 1) return 'Истекает сегодня!';
        if (days === 1) return '1 день';
        if (days < 7) return `${days} дней (внимание!)`;
        return `${days} дней`;
    };

    const currentBotStatus = getBotServiceStatus(bots);

    const getBotServiceStatusBadge = (): React.ReactNode => {
        switch (currentBotStatus) {
            case 'running':
                return <Badge variant="outline" className="text-green-600 border-green-600">Запущен</Badge>;
            case 'error':
                return <Badge variant="outline" className="text-red-600 border-red-600">Ошибка</Badge>;
            default:
                return <Badge variant="outline" className="text-gray-600 border-gray-600">Остановлен</Badge>;
        }
    };

    useEffect(() => {
        loadBotsStatus();
        loadTtsStatus();
        const interval = setInterval(() => {
            loadBotsStatus();
            loadTtsStatus();
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !tokenStatus) {
        return (
            <div className="container mx-auto p-6">
                <PageLoader message="Загрузка статуса систем..." />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-foreground flex items-center">
                        <Bot className="w-8 h-8 mr-3 text-purple-500" />
                        Управление ботами
                    </h1>
                    <p className="text-muted-foreground">
                        Управление, авторизация и мониторинг ботов Twitch и VK Live
                    </p>
                </div>

                <div className="flex items-center space-x-4">
                    <Button onClick={loadBotsStatus} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Обновить
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* 1. Bot Service Status */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="w-5 h-5" />
                            Bot Service
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                {currentBotStatus === 'running' ? (
                                    <CheckCircle className="w-8 h-8 text-green-500" />
                                ) : currentBotStatus === 'error' ? (
                                    <Square className="w-8 h-8 text-red-500" />
                                ) : (
                                    <Square className="w-8 h-8 text-gray-500" />
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">Статус сервиса</h3>
                                        {getBotServiceStatusBadge()}
                                    </div>
                                    <p className="text-sm text-slate-400">
                                        {getBotServiceDescription(bots)}
                                    </p>
                                </div>
                            </div>

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={restartBotService}
                                disabled={restarting['bot_service']}
                                className={currentBotStatus === 'running'
                                    ? "border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                                    : "border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                }
                            >
                                {restarting['bot_service'] ? (
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                )}
                                Перезапустить
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. TTS Engine Status */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="w-5 h-5" />
                            TTS Engine
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0">
                                    <Badge
                                        variant="outline"
                                        className={
                                            ttsStatus?.healthy
                                                ? "text-green-600 border-green-600"
                                                : "text-red-600 border-red-600"
                                        }
                                    >
                                        {ttsStatus?.healthy ? 'Активен' : 'Недоступен'}
                                    </Badge>
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium truncate">
                                        {ttsStatus?.url || TTS_SERVICE_URL}
                                    </p>
                                    {ttsStatus?.error && (
                                        <span className="text-red-400 text-xs block mt-1 truncate">{ttsStatus.error}</span>
                                    )}
                                </div>
                            </div>

                            {!ttsStatus?.healthy && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={restartTtsEngine}
                                    disabled={restarting['tts_engine']}
                                    className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    {restarting['tts_engine'] ? (
                                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-1" />
                                    )}
                                    Перезапустить
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 3. OAuth Авторизация (New Section) */}
            <Card className="border-slate-700">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-purple-400" />
                            <CardTitle>Авторизация бота (Twitch)</CardTitle>
                        </div>
                        {tokenStatus?.configured && tokenStatus.has_refresh_token && (
                            <Badge variant="outline" className="gap-1 border-green-500 text-green-500">
                                <CheckCircle className="w-3 h-3" />
                                Авторизован
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        Управление OAuth токеном для бота. Необходимо для работы чат-бота и модерации.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tokenLoading ? (
                        <div className="flex justify-center py-4">
                            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : tokenStatus?.configured ? (
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-muted/30 rounded-lg">
                                        <span className="text-xs text-muted-foreground block mb-1">Логин бота</span>
                                        <span className="font-mono font-medium">{tokenStatus.bot_login}</span>
                                    </div>
                                    <div className="p-3 bg-muted/30 rounded-lg">
                                        <span className="text-xs text-muted-foreground block mb-1">Статус токена</span>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={getDaysLeftColor(tokenStatus.days_left)}>
                                                {getDaysLeftText(tokenStatus.days_left)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                {tokenStatus.needs_refresh && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                                        <AlertCircle className="w-4 h-4 mt-0.5" />
                                        <p className="text-sm">Токен скоро истечет, пожалуйста обновите его вручную.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 justify-center min-w-[200px]">
                                <Button
                                    variant="outline"
                                    onClick={handleRefreshToken}
                                    disabled={refreshing}
                                >
                                    {refreshing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Обновление...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2" />
                                            Обновить токен
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleAuthorizeBot}
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Переавторизовать
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 space-y-4">
                            <div className="bg-blue-500/10 text-blue-400 p-4 rounded-lg inline-flex items-center gap-2 mb-2">
                                <Info className="w-5 h-5" />
                                <span>Бот не авторизован или токен истек</span>
                            </div>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Нажмите кнопку ниже, чтобы авторизовать бота через Twitch. Это откроет новое окно.
                            </p>
                            <Button onClick={handleAuthorizeBot} size="lg" className="bg-[#9146FF] hover:bg-[#772ce8] text-white">
                                <Bot className="w-5 h-5 mr-2" />
                                Авторизовать бота
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default BotManagementPage;



