import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { botService } from '../../services/microservices';
import { useTts } from '../../context/TtsContext';
import { TTS_SERVICE_URL } from '../../constants';
import { logger } from '../../utils/prodLogger';

const BotManagementPage = () => {
    const [bots, setBots] = useState([]);
    const [ttsStatus, setTtsStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [restarting, setRestarting] = useState({});
    const { engineStatus, isCheckingHealth } = useTts();
    const ttsIsHealthy = engineStatus.loaded;
    const ttsIsChecking = isCheckingHealth;
    const ttsLastCheck = null; // React Query управляет этим автоматически

    const loadBotsStatus = async () => {
        try {
            setLoading(true);
            const response = await botService.get('/api/admin/bots/status');
            // Преобразуем объект ботов в массив
            const botsData = response.data?.bots || {};
            const botsArray = [];
            
            // Обрабатываем Twitch бота
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
            
            // Обрабатываем VK бота
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

    const loadTtsStatus = async () => {
        try {
            const response = await botService.get('/api/admin/tts/status');
            const ttsService = response.data?.tts_service || {};
            
            // Убеждаемся что healthy определен правильно
            // Если healthy явно не установлен, определяем его из available и status
            let isHealthy = ttsService.healthy;
            if (isHealthy === undefined) {
                // Fallback: если healthy не пришел, определяем из других полей
                const status = (ttsService.status || '').toLowerCase();
                isHealthy = ttsService.available === true && 
                           (status === 'healthy' || status === 'ok' || status === 'up');
            }
            
            setTtsStatus({
                ...ttsService,
                healthy: isHealthy === true, // Гарантируем boolean
                status: ttsService.status || (isHealthy ? 'healthy' : 'offline')
            });
        } catch (error) {
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


    const restartBotService = async () => {
        try {
            setRestarting(prev => ({ ...prev, 'bot_service': true }));
            await botService.post('/api/admin/bot-service/restart');
            toast.success('Bot Service перезапущен');
            await loadBotsStatus();
        } catch (error) {
            logger.error('Error restarting bot service:', error);
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
            logger.error('Error restarting TTS engine:', error);
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
        const botsArray = Array.isArray(bots) ? bots : [];
        if (botsArray.length === 0) return 'stopped';
        
        // Если хотя бы один бот работает, считаем сервис работающим
        const hasRunningBot = botsArray.some(bot => bot.status === 'running');
        const hasErrorBot = botsArray.some(bot => bot.status === 'error');
        
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
        const botsArray = Array.isArray(bots) ? bots : [];
        if (botsArray.length === 0) {
            return 'Загрузка статуса...';
        }
        
        const twitchBot = botsArray.find(bot => bot.platform === 'twitch');
        const vkBot = botsArray.find(bot => bot.platform === 'vk_live');
        
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
        // Автоматически обновляем статус каждые 10 секунд
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
