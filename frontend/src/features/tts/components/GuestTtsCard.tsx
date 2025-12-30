import React, { useEffect, useRef, useState } from 'react';

import { AlertCircle, Check, Loader, Mic, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminService, chatService, ttsService } from '@/services/api/services';
import { logger } from '@/utils/prodLogger';
import { toast } from '@/utils/toastManager';

interface Voice {
    name: string;
    type?: string;
}

interface TtsStatus {
    ready?: boolean;
    loaded?: boolean;
    enabled?: boolean;
    message?: string;
}

interface AllowedChannels {
    twitch: string[];
    vk: string[];
}

const GuestTtsCard: React.FC = () => {
    const [channel, setChannel] = useState('');
    const [platform, setPlatform] = useState<'twitch' | 'vk'>('twitch');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [allowedChannels, setAllowedChannels] = useState<AllowedChannels>({ twitch: [], vk: [] });
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [ttsStatus, setTtsStatus] = useState<TtsStatus>({ ready: false, loaded: false });
    const [voices, setVoices] = useState<Voice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState('');
    const [verificationRequired, setVerificationRequired] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationTimeout, setVerificationTimeout] = useState(0);
    const [isVerified, setIsVerified] = useState(false);
    const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Отладочные логи для состояния верификации
    useEffect(() => {
        // GuestTtsCard: verificationRequired changed:', verificationRequired);
    }, [verificationRequired]);

    useEffect(() => {
        // GuestTtsCard: verificationCode changed:', verificationCode);
    }, [verificationCode]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (verificationTimerRef.current) {
                clearInterval(verificationTimerRef.current);
            }
        };
    }, []);

    // Убираем автоматические запросы - они будут вызываться только при подключении к каналу
    // useEffect(() => {
    //     loadAllowedChannels();
    //     loadTtsStatus();
    // }, []);

    const loadAllowedChannels = async () => {
        try {
            const response = await adminService.getWhitelist();
            const data = response.data.data || response.data;
            if (response.data.success) {
                const whitelistData = data as { whitelist_users?: string[] };
                setAllowedChannels({
                    twitch: whitelistData.whitelist_users || [],
                    vk: []
                });
            }
        } catch (error) {
            logger.error('Error loading allowed channels:', error);
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
            const response = await ttsService.getStatus(channel);
            const data = response.data.data || response.data;
            const enabled = (data as TtsStatus)?.enabled || false;
            setTtsStatus({ enabled, ready: true, loaded: true });
            setTtsEnabled(enabled);
        } catch (error) {
            logger.error('Error loading TTS status:', error);
            setTtsStatus({ enabled: false, message: 'Ошибка загрузки статуса TTS' });
            setTtsEnabled(false);
        }
    };

    const loadVoices = async () => {
        try {
            const response = await ttsService.getGlobalVoices();
            const voices = response.data.data || response.data;
            setVoices(Array.isArray(voices) ? voices : []);
            if (Array.isArray(voices) && voices.length > 0) {
                setSelectedVoice(voices[0].name);
            }
        } catch (error) {
            logger.error('Error loading voices:', error);
        }
    };

    const startVerificationTimer = () => {
        // Clear previous timer if exists
        if (verificationTimerRef.current) {
            clearInterval(verificationTimerRef.current);
        }

        let timeLeft = verificationTimeout;
        verificationTimerRef.current = setInterval(() => {
            timeLeft -= 1;
            setVerificationTimeout(timeLeft);
            
            if (timeLeft <= 0) {
                if (verificationTimerRef.current) {
                    clearInterval(verificationTimerRef.current);
                    verificationTimerRef.current = null;
                }
                // Проверяем статус верификации
                checkVerificationStatus();
            }
        }, 1000);
    };

    const checkVerificationStatus = async () => {
        try {
            const response = await chatService.getGuestStatus(channel);
            const data = response.data.data as { verified?: boolean; connected?: boolean } | undefined;
            if (data?.verified) {
                setIsVerified(true);
                setVerificationRequired(false);
                toast.success('Верификация успешна! Добро пожаловать!');
                await loadTtsStatus();
                await loadVoices();
            } else if (data?.connected === false) {
                // Бот отключился из-за неудачной верификации
                setVerificationRequired(false);
                setIsConnected(false);
                toast.error('Верификация не пройдена. Бот отключился от канала.');
            }
        } catch (error) {
            logger.error('Error checking verification status:', error);
        }
    };

    const connectToChannel = async () => {
        if (!channel.trim()) {
            toast.error('Введите название канала');
            return;
        }

        setIsConnecting(true);
        try {
            // Сначала загружаем разрешенные каналы
            await loadAllowedChannels();
            
            const response = await chatService.connectGuest({
                channel_name: channel.trim(),
                platform: 'twitch' // По умолчанию Twitch для GuestTtsCard
            });

            // GuestTtsCard: API response:', response.data);
            const data = response.data.data as { verification_required?: boolean; verification_code?: string; timeout?: number; message?: string } | undefined;

            if (data?.verification_required) {
                // GuestTtsCard: Verification required, setting up verification UI');
                setIsConnected(true); // Бот подключен, но требует верификации
                setVerificationRequired(true);
                setVerificationCode(data.verification_code || '');
                setVerificationTimeout(data.timeout || 0);
                toast.warning(`Бот подключен! Отправьте код "${data.verification_code}" в чат канала ${channel} для верификации`);
                
                // Запускаем таймер верификации
                startVerificationTimer();
            } else if (data?.message) {
                setIsConnected(true);
                setIsVerified(true);
                toast.success(`Подключен к каналу ${channel}`);
                // Загружаем TTS статус и голоса только после успешного подключения
                await loadTtsStatus();
                await loadVoices();
            }
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { detail?: string } } };
            const errorMessage = axiosError.response?.data?.detail || 'Ошибка подключения';
            toast.error(errorMessage);
        } finally {
            setIsConnecting(false);
        }
    };

    const toggleTts = async () => {
        try {
            if (ttsEnabled) {
                await ttsService.disableGuest({ channel_name: channel, platform: platform as 'twitch' | 'vk' });
                setTtsEnabled(false);
                toast.success('TTS отключен');
            } else {
                await ttsService.enableGuest({ channel_name: channel, platform: platform as 'twitch' | 'vk' });
                setTtsEnabled(true);
                toast.success('TTS включен');
            }
        } catch (error) {
            toast.error('Ошибка переключения TTS');
        }
    };

    const disconnect = async () => {
        try {
            // Clear verification timer
            if (verificationTimerRef.current) {
                clearInterval(verificationTimerRef.current);
                verificationTimerRef.current = null;
            }

            // Отключаемся от канала через API
            await ttsService.disconnectGuest({
                channel_name: channel,
                platform: platform
            });
            
            // Отключаем TTS
            if (ttsEnabled) {
                await ttsService.disable();
            }
            
            // Обновляем локальное состояние
            setIsConnected(false);
            setChannel('');
            setTtsEnabled(false);
            setTtsStatus({ ready: false, loaded: false });
            setVoices([]);
            setSelectedVoice('');
            setVerificationRequired(false);
            setVerificationCode('');
            setVerificationTimeout(0);
            setIsVerified(false);
            toast.success('Отключен от канала');
        } catch (error) {
            logger.error('Error disconnecting:', error);
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
                            <Select value={platform} onValueChange={(value) => setPlatform(value as 'twitch' | 'vk')} disabled={isConnected}>
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
                            {allowedChannels[platform as keyof AllowedChannels]?.length > 0 ? (
                                allowedChannels[platform as keyof AllowedChannels].map((allowedChannel) => (
                                    <Badge
                                        key={allowedChannel}
                                        variant={channel.toLowerCase() === allowedChannel.toLowerCase() ? "default" : "secondary"}
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

