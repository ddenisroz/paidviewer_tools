import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mic, Check, X, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

const GuestTtsCard = () => {
    const [channel, setChannel] = useState('');
    const [platform, setPlatform] = useState('twitch');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [allowedChannels, setAllowedChannels] = useState({ twitch: [], vk: [] });
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [ttsStatus, setTtsStatus] = useState({ ready: false, loaded: false });
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState('');

    useEffect(() => {
        loadAllowedChannels();
        loadTtsStatus();
    }, []);

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
            const response = await api.get('/api/tts/status');
            setTtsStatus(response.data);
            setTtsEnabled(response.data.enabled);
        } catch (error) {
            console.error('Error loading TTS status:', error);
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

    const connectToChannel = async () => {
        if (!channel.trim()) {
            toast.error('Введите название канала');
            return;
        }

        setIsConnecting(true);
        try {
            const response = await api.post('/api/tts/connect-guest', {
                channel: channel.trim(),
                platform
            });

            if (response.data.success) {
                setIsConnected(true);
                toast.success(`Подключен к каналу ${channel} на ${platform}`);
                await loadTtsStatus();
                await loadVoices();
            }
        } catch (error) {
            const errorMessage = error.response?.data?.detail || 'Ошибка подключения';
            toast.error(errorMessage);
        } finally {
            setIsConnecting(false);
        }
    };

    const toggleTts = async () => {
        try {
            if (ttsEnabled) {
                await api.post('/api/tts/disable');
                setTtsEnabled(false);
                toast.success('TTS отключен');
            } else {
                await api.post('/api/tts/enable');
                setTtsEnabled(true);
                toast.success('TTS включен');
            }
        } catch (error) {
            toast.error('Ошибка переключения TTS');
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
            toast.success('Отключен от канала');
        } catch (error) {
            console.error('Error disconnecting:', error);
            toast.error('Ошибка отключения от канала');
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

                        {/* TTS управление */}
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
                                                        {voice.display_name || voice.name}
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
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default GuestTtsCard;
