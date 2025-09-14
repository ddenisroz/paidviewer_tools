// src/pages/tts/TtsMainPage.jsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Play, Pause, SkipForward, Trash2, Volume2, VolumeX, Settings, Mic, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { useIntegrations } from '../../hooks/useIntegrations';
import api, { ttsApi } from '../../services/api';
import { toast } from 'sonner';

const TtsMainPage = () => {
    const navigate = useNavigate();
    const { integrations, updateTwitchIntegration } = useIntegrations();
    const [mutedUsers, setMutedUsers] = React.useState(new Set());
    const [muteInput, setMuteInput] = React.useState('');
    const [unmuteInput, setUnmuteInput] = React.useState('');
    const [chatMessages, setChatMessages] = React.useState([]);
    
    // TTS состояние
    const [ttsStatus, setTtsStatus] = React.useState({ loaded: false, ready: false });
    const [ttsProgress, setTtsProgress] = React.useState({ progress: 0, status: 'not_started', message: '' });
    const [isLoadingTts, setIsLoadingTts] = React.useState(false);
    const [ttsEnabled, setTtsEnabled] = React.useState(false);
    const [progressInterval, setProgressInterval] = React.useState(null);

    const handleSkip = async () => {
        try {
            await api.post('/api/bot/queue/skip');
            toast.success('Текущее сообщение пропущено');
        } catch (error) {
            console.error('Failed to skip:', error);
            toast.error('Ошибка при пропуске');
        }
    };

    const handleClearQueue = async () => {
        try {
            await api.post('/api/bot/queue/clear');
            toast.success('Очередь очищена');
        } catch (error) {
            console.error('Failed to clear queue:', error);
            toast.error('Ошибка при очистке очереди');
        }
    };

    const handleMuteUser = () => {
        if (muteInput.trim()) {
            setMutedUsers(prev => new Set([...prev, muteInput.trim().toLowerCase()]));
            setMuteInput('');
            toast.success(`Пользователь ${muteInput} заглушен`);
        }
    };

    const handleUnmuteUser = () => {
        if (unmuteInput.trim()) {
            setMutedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(unmuteInput.trim().toLowerCase());
                return newSet;
            });
            setUnmuteInput('');
            toast.success(`Пользователь ${unmuteInput} разглушен`);
        }
    };

    // TTS функции
    const loadTtsStatus = async () => {
        try {
            const status = await ttsApi.getStatus();
            console.log('TTS status loaded:', status);
            setTtsStatus(status);
            setTtsEnabled(status.ready);
            
            // Если TTS загружен, но не готов, показываем это
            if (status.loaded && !status.ready) {
                console.log('TTS loaded but not ready, starting initialization...');
                await startTtsLoading();
            }
        } catch (error) {
            console.error('Error loading TTS status:', error);
        }
    };

    const loadTtsProgress = async () => {
        try {
            const progress = await ttsApi.getProgress();
            setTtsProgress(progress);
        } catch (error) {
            console.error('Error loading TTS progress:', error);
        }
    };

    const startTtsLoading = async () => {
        setIsLoadingTts(true);
        try {
            const response = await ttsApi.loadEngine();
            console.log('TTS load response:', response);
            
            // Начинаем опрос прогресса
            const interval = setInterval(async () => {
                try {
                    await loadTtsProgress();
                    // Проверяем статус после загрузки прогресса
                    const currentProgress = await ttsApi.getProgress();
                    console.log('TTS progress:', currentProgress);
                    
                    if (currentProgress.status === 'ready' || currentProgress.status === 'error') {
                        clearInterval(interval);
                        setProgressInterval(null);
                        setIsLoadingTts(false);
                        if (currentProgress.status === 'ready') {
                            toast.success('TTS движок готов к работе!');
                            await loadTtsStatus();
                        } else {
                            toast.error('Ошибка загрузки TTS движка');
                        }
                    }
                } catch (progressError) {
                    console.error('Error in progress check:', progressError);
                    clearInterval(interval);
                    setProgressInterval(null);
                    setIsLoadingTts(false);
                    toast.error('Ошибка при отслеживании прогресса TTS');
                }
            }, 1000);
            setProgressInterval(interval);
        } catch (error) {
            console.error('Error starting TTS loading:', error);
            toast.error('Ошибка запуска загрузки TTS: ' + (error.response?.data?.detail || error.message));
            setIsLoadingTts(false);
        }
    };

    const stopTtsLoading = () => {
        if (progressInterval) {
            clearInterval(progressInterval);
            setProgressInterval(null);
        }
        setIsLoadingTts(false);
        setTtsEnabled(false);
        setTtsStatus({ loaded: false, ready: false });
        setTtsProgress({ progress: 0, status: 'not_started', message: '' });
    };

    const forceReloadTts = async () => {
        console.log('Force reloading TTS...');
        setIsLoadingTts(true);
        setTtsStatus({ loaded: false, ready: false });
        setTtsProgress({ progress: 0, status: 'not_started', message: 'Принудительная перезагрузка...' });
        
        try {
            // Сначала останавливаем текущий процесс
            if (progressInterval) {
                clearInterval(progressInterval);
                setProgressInterval(null);
            }
            
            // Используем API для принудительной перезагрузки
            await ttsApi.reloadEngine();
            toast.info('TTS движок перезагружается...');
            
            // Запускаем отслеживание прогресса
            const interval = setInterval(async () => {
                try {
                    await loadTtsProgress();
                    const currentProgress = await ttsApi.getProgress();
                    console.log('TTS reload progress:', currentProgress);
                    
                    if (currentProgress.status === 'ready' || currentProgress.status === 'error') {
                        clearInterval(interval);
                        setProgressInterval(null);
                        setIsLoadingTts(false);
                        if (currentProgress.status === 'ready') {
                            toast.success('TTS движок перезагружен и готов к работе!');
                            await loadTtsStatus();
                        } else {
                            toast.error('Ошибка перезагрузки TTS движка');
                        }
                    }
                } catch (progressError) {
                    console.error('Error in reload progress check:', progressError);
                    clearInterval(interval);
                    setProgressInterval(null);
                    setIsLoadingTts(false);
                    toast.error('Ошибка при отслеживании прогресса перезагрузки TTS');
                }
            }, 1000);
            setProgressInterval(interval);
        } catch (error) {
            console.error('Error force reloading TTS:', error);
            toast.error('Ошибка принудительной перезагрузки TTS: ' + (error.response?.data?.detail || error.message));
            setIsLoadingTts(false);
        }
    };

    // Загружаем статус TTS при монтировании
    React.useEffect(() => {
        loadTtsStatus();
    }, []);

    // Очищаем интервал при размонтировании
    React.useEffect(() => {
        return () => {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
        };
    }, [progressInterval]);

    const handleMuteFromMessage = (username) => {
        if (mutedUsers.has(username.toLowerCase())) {
            // Разглушить пользователя
            setMutedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(username.toLowerCase());
                return newSet;
            });
            toast.success(`Пользователь ${username} разглушен`);
        } else {
            // Заглушить пользователя
            setMutedUsers(prev => new Set([...prev, username.toLowerCase()]));
            toast.success(`Пользователь ${username} заглушен`);
        }
    };

    // Загружаем реальные сообщения из API
    React.useEffect(() => {
        if (integrations.twitch_enabled && ttsEnabled) {
            loadChatMessages();
        } else {
            setChatMessages([]);
        }
    }, [integrations.twitch_enabled, ttsEnabled]);

    const loadChatMessages = async () => {
        try {
            const messages = await ttsApi.getChatMessages();
            // Преобразуем timestamp в Date объекты
            const formattedMessages = messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            }));
            setChatMessages(formattedMessages);
        } catch (error) {
            console.error('Error loading chat messages:', error);
            // В случае ошибки показываем пустой список
            setChatMessages([]);
        }
    };

    // Если интеграция с Twitch отключена, показываем сообщение
    if (!integrations.twitch_enabled) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Интеграция с Twitch отключена</h2>
                    <p className="text-muted-foreground mb-6">
                        Включите интеграцию с Twitch в настройках, чтобы использовать TTS
                    </p>
                    <Button 
                        className="flex items-center gap-2 mx-auto"
                        onClick={() => navigate('/dashboard/settings')}
                    >
                        <Settings className="h-4 w-4" />
                        Открыть настройки интеграций
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Панель управления */}
            <Card>
                <CardHeader>
                    <CardTitle>Панель управления</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-4">
                        {/* TTS Переключатель */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="tts-enabled"
                                    checked={ttsEnabled}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            startTtsLoading();
                                        } else {
                                            stopTtsLoading();
                                        }
                                    }}
                                    disabled={isLoadingTts}
                                />
                                <Label htmlFor="tts-enabled" className="text-lg font-medium">
                                    {ttsEnabled ? 'Выключить озвучку' : 'Включить озвучку чата'}
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                {ttsEnabled ? (
                                    <div className="flex items-center space-x-2">
                                        <Check className="w-4 h-4 text-green-500 animate-in zoom-in-50 duration-300" />
                                        <span className="text-sm text-green-600 font-medium">Работает</span>
                                    </div>
                                ) : isLoadingTts ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                                        <span className="text-sm text-muted-foreground">Загрузка...</span>
                                    </div>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="text-sm text-muted-foreground">Отключена</span>
                                {ttsStatus.loaded && !ttsStatus.ready && (
                                    <Button
                                        onClick={forceReloadTts}
                                        size="sm"
                                        variant="outline"
                                        className="ml-2"
                                    >
                                        Перезагрузить
                                    </Button>
                                )}
                            </div>
                        )}
                            </div>
                        </div>

                        {/* Прогресс-бар TTS */}
                        {isLoadingTts && (
                            <div className="space-y-2">
                                <div className="text-sm text-muted-foreground">{ttsProgress.message}</div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div 
                                        className="bg-primary h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${ttsProgress.progress}%` }}
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground text-center">
                                    {ttsProgress.progress}%
                                </div>
                            </div>
                        )}

                    </div>
                    
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleSkip}
                        >
                            <SkipForward className="h-4 w-4" />
                            Пропустить
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleClearQueue}
                        >
                            <Trash2 className="h-4 w-4" />
                            Очистить очередь
                        </Button>
                        <Link to="/dashboard/tts/voices">
                            <Button variant="outline" size="sm">
                                <Mic className="h-4 w-4" />
                                Управление голосами
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Управление пользователями */}
            <Card>
                <CardHeader>
                    <CardTitle>Управление пользователями</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="mute-user">Заглушить пользователя</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="mute-user"
                                    type="text"
                                    placeholder="Имя пользователя"
                                    value={muteInput}
                                    onChange={(e) => setMuteInput(e.target.value)}
                                    className="flex-1"
                                />
                                <Button size="sm" onClick={handleMuteUser} disabled={!muteInput.trim()}>
                                    Заглушить
                                </Button>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="unmute-user">Разглушить пользователя</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="unmute-user"
                                    type="text"
                                    placeholder="Имя пользователя"
                                    value={unmuteInput}
                                    onChange={(e) => setUnmuteInput(e.target.value)}
                                    className="flex-1"
                                />
                                <Button size="sm" onClick={handleUnmuteUser} disabled={!unmuteInput.trim()}>
                                    Разглушить
                                </Button>
                            </div>
                        </div>
                        {mutedUsers.size > 0 && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Заглушенные пользователи ({mutedUsers.size})</Label>
                                <div className="flex flex-wrap gap-2">
                                    {Array.from(mutedUsers).map((user) => (
                                        <div
                                            key={user}
                                            className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm"
                                        >
                                            <span className="text-red-800 font-medium">{user}</span>
                                            <button
                                                onClick={() => {
                                                    setMutedUsers(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete(user);
                                                        return newSet;
                                                    });
                                                    toast.success(`Пользователь ${user} разглушен`);
                                                }}
                                                className="text-red-600 hover:text-red-800 text-xs"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Сообщения из чата */}
            <Card>
                <CardHeader>
                    <CardTitle>Сообщения из чата</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 bg-muted/20 rounded-md p-4 overflow-y-auto">
                        {chatMessages.length > 0 ? (
                            <div className="space-y-2">
                                {chatMessages.map((msg) => (
                                    <div 
                                        key={msg.id}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                                            mutedUsers.has(msg.username.toLowerCase()) 
                                                ? 'bg-red-50 border-red-200 opacity-75' 
                                                : 'bg-background hover:bg-muted/50'
                                        }`}
                                        onClick={() => handleMuteFromMessage(msg.username)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium ${
                                                    mutedUsers.has(msg.username.toLowerCase()) 
                                                        ? 'text-red-600' 
                                                        : 'text-blue-600'
                                                }`}>
                                                    {msg.username}
                                                </span>
                                                <span className="text-muted-foreground text-sm">
                                                    {msg.timestamp.toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {mutedUsers.has(msg.username.toLowerCase()) ? (
                                                    <span className="text-xs text-red-600 font-medium bg-red-100 px-2 py-1 rounded">
                                                        ЗАГЛУШЕН
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded">
                                                        АКТИВЕН
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm mt-2">{msg.message}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground mb-2">
                                    {ttsEnabled && integrations.twitch_enabled 
                                        ? 'Сообщения из чата будут отображаться здесь'
                                        : 'Включите TTS для отображения сообщений'
                                    }
                                </p>
                                {ttsEnabled && integrations.twitch_enabled && (
                                    <p className="text-xs text-muted-foreground">
                                        Нажмите на сообщение чтобы заглушить/разглушить пользователя
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TtsMainPage;
