import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Bot, 
    RefreshCw,
    CheckCircle,
    Square
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { useTtsHealth } from '../../context/TtsHealthContext';

const BotManagementPage = () => {
    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [restarting, setRestarting] = useState({});
    const { isHealthy: ttsIsHealthy, isChecking: ttsIsChecking, lastCheck: ttsLastCheck } = useTtsHealth();

    const loadBotsStatus = async () => {
        try {
            setLoading(true);
            const response = await botService.get('/api/admin/bots/status');
            setBots(response.data.bots || []);
        } catch (error) {
            console.error('Error loading bots status:', error);
            toast.error('Ошибка загрузки статуса ботов');
        } finally {
            setLoading(false);
        }
    };


    const restartBotService = async () => {
        try {
            setRestarting(prev => ({ ...prev, 'bot_service': true }));
            await botService.post('/api/admin/bot-service/restart');
            toast.success('Bot Service перезапущен');
            await loadBotsStatus();
        } catch (error) {
            console.error('Error restarting bot service:', error);
            toast.error('Ошибка перезапуска Bot Service');
        } finally {
            setRestarting(prev => ({ ...prev, 'bot_service': false }));
        }
    };

    const restartTtsEngine = async () => {
        try {
            setRestarting(prev => ({ ...prev, 'tts_engine': true }));
            await botService.post('/api/admin/tts/restart');
            toast.success('TTS движок перезапущен');
        } catch (error) {
            console.error('Error restarting TTS engine:', error);
            toast.error('Ошибка перезапуска TTS движка');
        } finally {
            setRestarting(prev => ({ ...prev, 'tts_engine': false }));
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'running':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'stopped':
                return <Square className="w-5 h-5 text-gray-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'running':
                return <Badge variant="default" className="bg-green-100 text-green-800">Работает</Badge>;
            case 'stopped':
                return <Badge variant="secondary">Остановлен</Badge>;
            case 'error':
                return <Badge variant="destructive">Ошибка</Badge>;
            default:
                return <Badge variant="outline">Неизвестно</Badge>;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Не указано';
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const getBotServiceStatus = () => {
        if (!bots || bots.length === 0) return 'stopped';
        
        // Если хотя бы один бот работает, считаем сервис работающим
        const hasRunningBot = bots.some(bot => bot.status === 'running');
        const hasErrorBot = bots.some(bot => bot.status === 'error');
        
        if (hasRunningBot) return 'running';
        if (hasErrorBot) return 'error';
        return 'stopped';
    };

    const getBotServiceStatusBadge = () => {
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

    const getBotServiceDescription = () => {
        if (!bots || bots.length === 0) {
            return 'Загрузка статуса...';
        }
        
        const twitchBot = bots.find(bot => bot.platform === 'twitch');
        const vkBot = bots.find(bot => bot.platform === 'vk_live');
        
        const twitchStatus = twitchBot ? twitchBot.status : 'stopped';
        const vkStatus = vkBot ? vkBot.status : 'stopped';
        const twitchChannels = twitchBot ? twitchBot.connected_channels || 0 : 0;
        const vkChannels = vkBot ? vkBot.connected_channels || 0 : 0;
        
        const lastActivity = bots.length > 0 ? new Date(bots[0].last_activity).toLocaleString('ru-RU') : 'Неизвестно';
        
        return `Twitch: ${twitchStatus} (${twitchChannels} каналов) • VK: ${vkStatus} (${vkChannels} каналов) • ${lastActivity}`;
    };



    useEffect(() => {
        loadBotsStatus();
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


            {/* Сервисы */}
            <div className="grid gap-4">
                {/* Bot Service Card */}
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

                {/* TTS Engine Card */}
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
                                                ttsIsHealthy 
                                                    ? "text-green-600 border-green-600" 
                                                    : "text-red-600 border-red-600"
                                            }
                                        >
                                            {ttsIsHealthy ? 'Готов' : 'Недоступен'}
                                        </Badge>
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Движок синтеза речи • {ttsIsHealthy ? 'Последняя активность' : 'Статус'}: {ttsIsHealthy ? (ttsLastCheck ? ttsLastCheck.toLocaleString('ru-RU') : 'Проверяется...') : 'Недоступен'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                {!ttsIsHealthy && (
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
                                {ttsIsHealthy && (
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
