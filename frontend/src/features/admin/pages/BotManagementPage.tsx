import React, { useEffect, useState } from 'react';

import {
    Bot,
    CheckCircle,
    RefreshCw,
    Square
} from 'lucide-react';

import { TTS_SERVICE_URL } from '@/constants';
import { useTts } from '@/context/TtsContext';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
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
    const [bots, setBots] = useState<BotData[]>([]);
    const [ttsStatus, setTtsStatus] = useState<TtsStatus | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [restarting, setRestarting] = useState<RestartingState>({});
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

    if (loading) {
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
                    <h1 className="text-3xl font-bold mb-6 text-foreground flex items-center">
                        <Bot className="w-8 h-8 mr-3 text-purple-500" />
                        Управление ботами
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Управление и мониторинг ботов Twitch и VK Live
                    </p>
                </div>

                <div className="flex items-center space-x-4">
                    <Button onClick={loadBotsStatus} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Обновить
                    </Button>
                </div>
            </div>

            <div className="grid gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                    {currentBotStatus === 'running' ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : currentBotStatus === 'error' ? (
                                        <Square className="w-5 h-5 text-red-500" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-500" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                                        <span>Bot Service</span>
                                        {getBotServiceStatusBadge()}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        {getBotServiceDescription(bots)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
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
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                    <Bot className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                                        <span>TTS Engine</span>
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
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Статус синтеза речи и очередь: {ttsStatus?.status || 'Подключение...'} • URL: {ttsStatus?.url || TTS_SERVICE_URL}
                                        {ttsStatus?.error && (
                                            <span className="text-red-400 block mt-1">Ошибка: {ttsStatus.error}</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
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
                                {ttsStatus?.healthy && (
                                    <div className="flex items-center space-x-2 text-green-600">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm">Работает</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default BotManagementPage;



