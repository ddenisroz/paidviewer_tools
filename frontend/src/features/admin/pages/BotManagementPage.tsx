import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Bot, 
    RefreshCw,
    CheckCircle,
    Square,
    AlertCircle,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../../services/api/services/adminService';
import { useTts } from '../../../context/TtsContext';
import { TTS_SERVICE_URL } from '../../../constants';
import { logger } from '../../../utils/prodLogger';

interface BotData {
    name: string;
    platform: string;
    status: 'running' | 'stopped' | 'error';
    connected: boolean;
    connected_channels: number;
    is_ready?: boolean;
    is_running?: boolean;
}

interface TtsStatus {
    status?: string;
    healthy?: boolean;
    available?: boolean;
    error?: string;
    url?: string;
}

type BotStatus = 'running' | 'stopped' | 'error';
type RestartingState = Record<string, boolean>;

const BotManagementPage: React.FC = () => {
    const [bots, setBots] = useState<BotData[]>([]);
    const [ttsStatus, setTtsStatus] = useState<TtsStatus | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [restarting, setRestarting] = useState<RestartingState>({});
    const { engineStatus, isCheckingHealth } = useTts();
    const ttsIsHealthy = engineStatus.loaded;
    const ttsIsChecking = isCheckingHealth;

    const loadBotsStatus = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await adminService.getBotsStatus();
            const botsData = (response.data as any)?.bots || {};
            const botsArray: BotData[] = [];
            
            if (botsData.twitch) {
                botsArray.push({
                    name: 'twitch_bot',
                    platform: 'twitch',
                    status: botsData.twitch.connected && botsData.twitch.is_ready ? 'running' : 
                           botsData.twitch.connected ? 'error' : 'stopped',
                    connected: botsData.twitch.connected,
                    connected_channels: botsData.twitch.channels || 0,
                    is_ready: botsData.twitch.is_ready || false
                });
            }
            
            if (botsData.vk) {
                botsArray.push({
                    name: 'vk_live_bot',
                    platform: 'vk_live',
                    status: botsData.vk.connected && botsData.vk.is_running ? 'running' : 
                           botsData.vk.connected ? 'error' : 'stopped',
                    connected: botsData.vk.connected,
                    connected_channels: botsData.vk.channels || 0,
                    is_running: botsData.vk.is_running || false
                });
            }
            
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
            const ttsService = (response.data as any)?.tts_service || {};
            
            let isHealthy = ttsService.healthy;
            if (isHealthy === undefined) {
                const status = (ttsService.status || '').toLowerCase();
                isHealthy = ttsService.available === true && 
                           (status === 'healthy' || status === 'ok' || status === 'up');
            }
            
            setTtsStatus({
                ...ttsService,
                healthy: isHealthy === true,
                status: ttsService.status || (isHealthy ? 'healthy' : 'offline')
            });
        } catch (error: any) {
            logger.error('Error loading TTS status:', error);
            setTtsStatus({ 
                status: 'error', 
                healthy: false, 
                available: false,
                error: error.response?.data?.detail || error.message || 'Failed to check TTS status',
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

    const getBotServiceStatus = (): BotStatus => {
        if (bots.length === 0) return 'stopped';
        
        const hasRunningBot = bots.some(bot => bot.status === 'running');
        const hasErrorBot = bots.some(bot => bot.status === 'error');
        
        if (hasRunningBot) return 'running';
        if (hasErrorBot) return 'error';
        return 'stopped';
    };

    const getBotServiceStatusBadge = (): React.ReactNode => {
        const status = getBotServiceStatus();
        switch (status) {
            case 'running':
                return <Badge variant="outline" className="text-green-600 border-green-600">Работает</Badge>;
            case 'error':
                return <Badge variant="outline" className="text-red-600 border-red-600">Ошибка</Badge>;
            default:
                return <Badge variant="outline" className="text-gray-600 border-gray-600">Остановлен</Badge>;
        }
    };

    const getBotServiceDescription = (): string => {
        if (bots.length === 0) {
            return 'Загрузка статуса...';
        }
        
        const twitchBot = bots.find(bot => bot.platform === 'twitch');
        const vkBot = bots.find(bot => bot.platform === 'vk_live');
        
        const twitchStatus = twitchBot ? (twitchBot.status === 'running' ? 'работает' : 
                                          twitchBot.status === 'error' ? 'ошибка' : 'остановлен') : 'не найден';
        const vkStatus = vkBot ? (vkBot.status === 'running' ? 'работает' : 
                                  vkBot.status === 'error' ? 'ошибка' : 'остановлен') : 'не найден';
        const twitchChannels = twitchBot ? twitchBot.connected_channels || 0 : 0;
        const vkChannels = vkBot ? vkBot.connected_channels || 0 : 0;
        
        return `Twitch: ${twitchStatus} (${twitchChannels} каналов) • VK Live: ${vkStatus} (${vkChannels} каналов)`;
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
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
                    <span className="ml-2 text-lg">Загрузка статуса ботов...</span>
                </div>
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
                        Мониторинг и управление ботов Twitch и VK Live
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
                                    {getBotServiceStatus() === 'running' ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : getBotServiceStatus() === 'error' ? (
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
                                        {getBotServiceDescription()}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={restartBotService}
                                    disabled={restarting['bot_service']}
                                    className={getBotServiceStatus() === 'running' 
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
                                            {ttsStatus?.healthy ? 'Готов' : 'Недоступен'}
                                        </Badge>
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Движок синтеза речи • Статус: {ttsStatus?.status || 'Проверяется...'} • URL: {ttsStatus?.url || TTS_SERVICE_URL}
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



