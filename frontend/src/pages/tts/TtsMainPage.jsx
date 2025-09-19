// src/pages/tts/TtsMainPage.jsx
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, SkipForward, Trash2, Mic, Check, Power, Loader, AlertTriangle, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { useTts } from '../../context/TtsContext';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { toast } from 'sonner';
import api from '../../services/api';

const TtsMainPage = () => {
    const { user, isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const { 
        messages, 
        isConnected, 
        isConnecting, 
        error: chatError,
        connect,
        disconnect,
        clearChat
    } = useChat();
    
    const { 
        ttsEnabled, 
        isLoadingTts, 
        toggleTts,
        mutedUsers,
        unmuteUser,
        muteUser
    } = useTts();
    
    const [isWhitelisted, setIsWhitelisted] = useState(false);
    const [checkingWhitelist, setCheckingWhitelist] = useState(true);
    
    useEffect(() => {
        if (chatError) {
            toast.error(chatError);
        }
    }, [chatError]);
    
    // Проверяем whitelist при загрузке страницы
    useEffect(() => {
        const checkWhitelist = async () => {
            if (!user?.username) return;
            
            try {
                setCheckingWhitelist(true);
                const response = await api.get('/api/admin/whitelist');
                const whitelistedChannels = response.data.whitelist_users || [];
                const isInWhitelist = whitelistedChannels.some(
                    channel => channel.channel_name.toLowerCase() === user.username.toLowerCase()
                );
                setIsWhitelisted(isInWhitelist);
            } catch (error) {
                console.error('Ошибка проверки whitelist:', error);
                setIsWhitelisted(false);
            } finally {
                setCheckingWhitelist(false);
            }
        };
        
        checkWhitelist();
    }, [user?.username]);
    
    const handleToggleConnection = async () => {
        if (isConnected) {
            disconnect();
            toast.info("Бот отключается от вашего канала...");
        } else {
            try {
                toast.info("Бот подключается к вашему каналу...");
                await connect();
            } catch (error) {
                // Ошибки (включая 403 от whitelist) будут обработаны в ChatContext
                // и выведены через toast. Здесь можно ничего не делать.
            }
        }
    };

    const handleSkip = async () => {
        toast.warning("Функционал пропуска сообщения еще не реализован.");
    };

    const handleClearQueue = async () => {
        toast.warning("Функционал очистки очереди еще не реализован.");
    };
    
    const handleMuteFromMessage = (username) => {
        const lowerCaseUsername = username.toLowerCase();
        if (mutedUsers.has(lowerCaseUsername)) {
            unmuteUser(lowerCaseUsername);
            toast.success(`Пользователь ${username} разглушен.`);
        } else {
            muteUser(lowerCaseUsername);
            toast.success(`Пользователь ${username} заглушен.`);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Требуется авторизация</h2>
                <p className="text-muted-foreground">
                    Пожалуйста, войдите через Twitch, чтобы использовать функционал TTS.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="space-y-6 pt-6">
                    <div className="flex flex-col space-y-3 p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="tts-enabled" className={`text-lg font-semibold transition-opacity ${!isWhitelisted || !isConnected ? 'opacity-50' : ''}`}>
                                Включить озвучку чата
                            </Label>
                            <Switch
                                id="tts-enabled"
                                checked={ttsEnabled}
                                onCheckedChange={toggleTts}
                                disabled={isLoadingTts || !isConnected || !isWhitelisted || checkingWhitelist}
                            />
                        </div>
                        {checkingWhitelist && (
                            <p className="text-sm text-muted-foreground">
                                Проверка прав доступа...
                            </p>
                        )}
                        {!checkingWhitelist && !isWhitelisted && (
                            <p className="text-sm text-destructive">
                                Ваш канал не прошел модерацию. Обратитесь к администратору для добавления в белый список.
                            </p>
                        )}
                        {!checkingWhitelist && isWhitelisted && !isConnected && (
                            <p className="text-sm text-muted-foreground">
                                Бот не подключен к чату. Проверьте интеграцию с Twitch в настройках.
                            </p>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleSkip}>
                            <SkipForward className="h-4 w-4 mr-2" /> Пропустить
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClearQueue}>
                             <Trash2 className="h-4 w-4 mr-2" /> Очистить очередь
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearChat}>
                            <Trash2 className="h-4 w-4 mr-2" /> Очистить чат
                        </Button>
                        <Link to="/dashboard/tts/voices">
                            <Button variant="outline" size="sm">
                                <Mic className="h-4 w-4 mr-2" /> Управление голосами
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {mutedUsers.size > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Заглушенные пользователи</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        {Array.from(mutedUsers).map((username) => (
                            <div key={username} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                                <span>{username}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full"
                                    onClick={() => unmuteUser(username)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Сообщения из чата</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-96 bg-muted/20 rounded-md p-4 overflow-y-auto flex flex-col-reverse">
                        {isConnected ? (
                            messages.length > 0 ? (
                                <div className="space-y-2">
                                    {messages
                                        .filter(msg => msg.author && !mutedUsers.has(msg.author.name.toLowerCase()))
                                        .map((msg) => (
                                            <div 
                                                key={msg.id}
                                                className="p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer"
                                                onClick={() => handleMuteFromMessage(msg.author.name)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold" style={{ color: msg.author.color || '#ffffff' }}>
                                                        {msg.author.name}
                                                    </span>
                                                </div>
                                                <p className="text-sm mt-1 break-words">{msg.content}</p>
                                            </div>
                                        ))
                                    }
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    Ожидание сообщений из чата...
                                </div>
                            )
                        ) : (
                             <div className="text-center py-8 text-muted-foreground">
                                Бот не подключен к каналу.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TtsMainPage;
