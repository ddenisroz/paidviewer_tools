import React from 'react';

import { Pause, Play, Wifi, WifiOff } from 'lucide-react';

import { useChat } from '@/context/ChatContext';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

const ChatControl: React.FC = () => {
    const {
        isConnected: isChatConnected,
        connectBotToChannels: connectChat,
        disconnectBotFromChannels: disconnectChat,
    } = useChat();

    // Pause/resume functionality not implemented in current context
    const isChatPaused = false;
    const pauseChat = () => {
        /* Pause not implemented */
    };
    const resumeChat = () => {
        /* Resume not implemented */
    };

    // Убираем требование авторизации для чата
    // if (!isAuthenticated) {
    //     return (
    //         <Card className="border-dashed border-2 border-muted-foreground/25">
    //             <CardContent className="p-6 text-center">
    //                 <WifiOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
    //                 <p className="text-sm text-muted-foreground mb-4">
    //                     Войдите в систему для подключения к чату
    //                 </p>
    //             </CardContent>
    //         </Card>
    //     );
    // }

    return (
        <Card className="border-2">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div
                            className={`w-3 h-3 rounded-full ${
                                isChatConnected ? (isChatPaused ? 'bg-yellow-500' : 'bg-green-500') : 'bg-red-500'
                            }`}
                        />
                        <div>
                            <p className="text-sm font-medium">
                                {isChatConnected ? (isChatPaused ? 'Чат на паузе' : 'Чат подключен') : 'Чат отключен'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {isChatConnected
                                    ? isChatPaused
                                        ? 'Сообщения не загружаются'
                                        : 'Получаем сообщения в реальном времени'
                                    : 'Нажмите для подключения'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {!isChatConnected ? (
                            <Button onClick={() => connectChat()} size="sm" className="bg-green-600 hover:bg-green-700">
                                <Wifi className="h-4 w-4 mr-2" />
                                Подключиться
                            </Button>
                        ) : (
                            <>
                                {isChatPaused ? (
                                    <Button
                                        onClick={resumeChat}
                                        size="sm"
                                        variant="outline"
                                        className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Продолжить
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={pauseChat}
                                        size="sm"
                                        variant="outline"
                                        className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                                    >
                                        <Pause className="h-4 w-4 mr-2" />
                                        Пауза
                                    </Button>
                                )}
                                <Button
                                    onClick={disconnectChat}
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500 text-red-600 hover:bg-red-50"
                                >
                                    <WifiOff className="h-4 w-4 mr-2" />
                                    Отключить
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ChatControl;
