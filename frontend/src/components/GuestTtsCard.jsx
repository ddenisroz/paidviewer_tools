import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mic, Check, X, AlertCircle, Loader } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import api from '../services/api';

const GuestTtsCard = () => {
    const { showNotification } = useNotification();
    const [channel, setChannel] = useState('');
    const [platform, setPlatform] = useState('twitch');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [allowedChannels, setAllowedChannels] = useState({ twitch: [], vk: [] });
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [ttsStatus, setTtsStatus] = useState({ ready: false, loaded: false });
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState('');
    const [verificationRequired, setVerificationRequired] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationTimeout, setVerificationTimeout] = useState(0);
    const [isVerified, setIsVerified] = useState(false);

    // Отладочные логи для состояния верификации
    useEffect(() => {
        // GuestTtsCard: verificationRequired changed:', verificationRequired);
    }, [verificationRequired]);

    useEffect(() => {
        // GuestTtsCard: verificationCode changed:', verificationCode);
    }, [verificationCode]);

    // Убираем автоматические запросы - они будут вызываться только при подключении к каналу
    // useEffect(() => {
    //     loadAllowedChannels();
    //     loadTtsStatus();
    // }, []);

    const loadAllowedChannels = async () => {
        try {
            const response = await api.get('/api/admin/whitelist');
            if (response.data.success) {
                setAllowedChannels({
                    twitch: response.data.whitelist_users || [],
                    vk: []
                });
            }
        } catch (error) {
            console.error('Error loading allowed channels:', error);
        }
    };

    const loadTtsStatus = async () => {
        try {
            if (!channel) {
                setTtsStatus({ enabled: false, message: 'Канал не выбран' });
                setTtsEnabled(false);
                return;
            }
            
            // Используем универсальный endpoint с channel_name
            const response = await api.get(`/api/tts/status?channel_name=${channel}`);
            const { enabled } = response.data;
            setTtsStatus({ enabled, ready: true, loaded: true });
            setTtsEnabled(enabled);
        } catch (error) {
            console.error('Error loading TTS status:', error);
            setTtsStatus({ enabled: false, message: 'Ошибка загрузки статуса TTS' });
            setTtsEnabled(false);
        }
    };

    const loadVoices = async () => {
        try {
            const response = await api.get('/api/voices');
            setVoices(response.data.voices || []);
            if (response.data.voices && response.data.voices.length > 0) {
                setSelectedVoice(response.data.voices[0].name);
            }
        } catch (error) {
            console.error('Error loading voices:', error);
        }
    };

    const startVerificationTimer = () => {
        let timeLeft = verificationTimeout;
        const timer = setInterval(() => {
            timeLeft -= 1;
            setVerificationTimeout(timeLeft);
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                // Проверяем статус верификации
                checkVerificationStatus();
            }
        }, 1000);
    };

    const checkVerificationStatus = async () => {
        try {
            const response = await api.get(`/api/chat/guest/status?channel_name=${channel}`);
            if (response.data.verified) {
                setIsVerified(true);
                setVerificationRequired(false);
                showNotification('Верификация успешна! Добро пожаловать!', 'success');
                await loadTtsStatus();
                await loadVoices();
            } else if (response.data.connected === false) {
                // Бот отключился из-за неудачной верификации
                setVerificationRequired(false);
                setIsConnected(false);
                showNotification('Верификация не пройдена. Бот отключился от канала.', 'error');
            }
        } catch (error) {
            console.error('Error checking verification status:', error);
        }
    };

    const connectToChannel = async () => {
        if (!channel.trim()) {
            showNotification('Введите название канала', 'error');
            return;
        }

        setIsConnecting(true);
        try {
            // Сначала загружаем разрешенные каналы
            await loadAllowedChannels();
            
            const response = await api.post('/api/chat/guest/connect', {
                channel_name: channel.trim(),
                platform: 'twitch' // По умолчанию Twitch для GuestTtsCard
            });

            // GuestTtsCard: API response:', response.data);

            if (response.data.verification_required) {
                // GuestTtsCard: Verification required, setting up verification UI');
                setIsConnected(true); // Бот подключен, но требует верификации
                setVerificationRequired(true);
                setVerificationCode(response.data.verification_code);
                setVerificationTimeout(response.data.timeout);
                showNotification(`Бот подключен! Отправьте код "${response.data.verification_code}" в чат канала ${channel} для верификации`, 'warning');
                
                // Запускаем таймер верификации
                startVerificationTimer();
            } else if (response.data.message) {
                setIsConnected(true);
                setIsVerified(true);
                showNotification(`Подключен к каналу ${channel}`, 'success');
                // Загружаем TTS статус и голоса только после успешного подключения
                await loadTtsStatus();
                await loadVoices();
            }
        } catch (error) {
            const errorMessage = error.response?.data?.detail || 'Ошибка подключения';
            showNotification(errorMessage, 'error');
        } finally {
            setIsConnecting(false);
        }
    };

    const toggleTts = async () => {
        try {
            if (ttsEnabled) {
                await api.post('/api/tts/guest/disable', { channel_name: channel });
                setTtsEnabled(false);
                showNotification('TTS отключен', 'success');
            } else {
                await api.post('/api/tts/guest/enable', { channel_name: channel });
                setTtsEnabled(true);
                showNotification('TTS включен', 'success');
            }
        } catch (error) {
            showNotification('Ошибка переключения TTS', 'error');
        }
    };

    const disconnect = async () => {
        try {
            // Отключаемся от канала через API
            await api.post('/api/tts/disconnect-guest', {
                channel: channel,
                platform: platform
            });
            
            // Отключаем TTS
            if (ttsEnabled) {
                await api.post('/api/tts/disable');
            }
            
            // Обновляем локальное состояние
            setIsConnected(false);
            setChannel('');
            setTtsEnabled(false);
            setTtsStatus({ ready: false, loaded: false });
            setVoices([]);
            setSelectedVoice('');
            showNotification('Отключен от канала', 'success');
        } catch (error) {
            console.error('Error disconnecting:', error);
            showNotification('Ошибка отключения от канала', 'error');
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mic className="h-6 w-6 text-green-500" />
                    TTS без авторизации
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Подключитесь к разрешенному каналу для использования TTS с ограниченными возможностями
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Выбор канала */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="channel">Название канала</Label>
                            <Input
                                id="channel"
                                value={channel}
                                onChange={(e) => setChannel(e.target.value)}
                                placeholder="Введите название канала"
                                disabled={isConnected}
                            />
                        </div>
                        <div>
                            <Label htmlFor="platform">Платформа</Label>
                            <Select value={platform} onValueChange={setPlatform} disabled={isConnected}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="twitch">Twitch</SelectItem>
                                    <SelectItem value="vk">VK</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Список разрешенных каналов */}
                    <div className="space-y-2">
                        <Label>Разрешенные каналы:</Label>
                        <div className="flex flex-wrap gap-2">
                            {allowedChannels[platform]?.length > 0 ? (
                                allowedChannels[platform].map((allowedChannel) => (
                                    <Badge
                                        key={allowedChannel}
                                        variant={channel.toLowerCase() === allowedChannel ? "default" : "secondary"}
                                        className="cursor-pointer"
                                        onClick={() => !isConnected && setChannel(allowedChannel)}
                                    >
                                        {allowedChannel}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-sm text-muted-foreground">
                                    Нет разрешенных каналов для {platform}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Кнопки подключения */}
                    <div className="flex gap-2">
                        {!isConnected ? (
                            <Button
                                onClick={connectToChannel}
                                disabled={isConnecting || !channel.trim()}
                                className="flex-1"
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                                        Подключение...
                                    </>
                                ) : (
                                    'Подключиться'
                                )}
                            </Button>
                        ) : (
                            <Button onClick={disconnect} variant="destructive" className="flex-1">
                                <X className="h-4 w-4 mr-2" />
                                Отключиться
                            </Button>
                        )}
                    </div>

                    {/* Верификация */}
                    {/* GuestTtsCard: Rendering verificationRequired:', verificationRequired) */}
                    {verificationRequired && (
                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-5 w-5 text-yellow-500" />
                                <span className="font-medium text-yellow-500">Требуется верификация</span>
                            </div>
                            <p className="text-sm text-yellow-300 mb-3">
                                Отправьте в чат канала <strong>{channel}</strong> следующий код:
                            </p>
                            <div className="bg-yellow-500/20 p-3 rounded border border-yellow-500/50 mb-3">
                                <code className="text-lg font-mono font-bold text-yellow-100">
                                    {verificationCode}
                                </code>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-yellow-300">
                                    Осталось времени: {verificationTimeout} сек
                                </span>
                                <Button
                                    onClick={checkVerificationStatus}
                                    size="sm"
                                    variant="outline"
                                    className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/20"
                                >
                                    Проверить статус
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Статус подключения */}
                {isConnected && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-green-700 font-medium">
                                Подключен к каналу {channel} на {platform}
                            </span>
                        </div>

                        {/* TTS управление - только после верификации */}
                        {isVerified && (
                            <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">TTS озвучка</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Только стандартные голоса доступны без авторизации
                                    </p>
                                </div>
                                <Button
                                    onClick={toggleTts}
                                    variant={ttsEnabled ? "destructive" : "default"}
                                    size="sm"
                                >
                                    {ttsEnabled ? 'Отключить' : 'Включить'}
                                </Button>
                            </div>

                            {/* Статус TTS */}
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                    ttsEnabled && ttsStatus.ready ? 'bg-green-500' : 
                                    ttsEnabled ? 'bg-orange-500' : 'bg-gray-400'
                                }`} />
                                <span className="text-sm">
                                    {ttsEnabled && ttsStatus.ready ? 'TTS готов к работе' :
                                     ttsEnabled ? 'TTS загружается...' : 'TTS отключен'}
                                </span>
                            </div>

                            {/* Выбор голоса - только стандартные */}
                            {voices.length > 0 && (
                                <div>
                                    <Label htmlFor="voice">Стандартные голоса</Label>
                                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите голос" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {voices
                                                .filter(voice => voice.type === 'standard' || !voice.type) // Только стандартные голоса
                                                .map((voice) => (
                                                    <SelectItem key={voice.name} value={voice.name}>
                                                        {voice.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Доступны только стандартные голоса. Для кастомных голосов требуется авторизация.
                                    </p>
                                </div>
                            )}

                            {/* Ограничения */}
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-yellow-700">
                                        <p className="font-medium mb-1">Ограничения гостевого режима:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Доступны только стандартные голоса</li>
                                            <li>Нет загрузки кастомных голосов</li>
                                            <li>Нет управления интеграциями</li>
                                            <li>Нет доступа к аналитике</li>
                                            <li>Нет доступа к личной папке голосов</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default GuestTtsCard;
