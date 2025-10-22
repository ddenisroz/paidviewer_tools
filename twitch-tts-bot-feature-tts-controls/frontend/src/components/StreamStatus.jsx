import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Twitch, MessageCircle, Users, Wifi, WifiOff } from 'lucide-react';
import { VKIcon } from './PlatformIcons';

const StreamStatus = ({ integrations, streamData }) => {
    const twitchEnabled = integrations?.twitch?.enabled;
    const vkEnabled = integrations?.vk?.enabled;
    
    // Получаем данные о стримах
    const twitchStream = streamData?.twitch;
    const vkStream = streamData?.vk;
    
    
    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto">
            {/* Twitch статус */}
            <Card className={`${twitchEnabled ? 'border-purple-500/20 bg-purple-500/5' : 'border-muted-foreground/20 bg-muted/5'}`}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Twitch className="h-6 w-6 text-purple-500" />
                            <div className="font-medium text-sm">Twitch</div>
                        </div>
                        <div className="flex items-center gap-3">
                            {twitchEnabled ? (
                                twitchStream?.isLive ? (
                                    <>
                                        <Wifi className="h-4 w-4 text-green-500" />
                                        <Badge variant="secondary" className="bg-green-500/20 text-green-700 border-green-500/30">
                                            <Users className="h-3 w-3 mr-1" />
                                            {twitchStream.viewerCount || 0}
                                        </Badge>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="h-4 w-4 text-gray-400" />
                                        <Badge variant="outline" className="text-gray-500">
                                            Offline
                                        </Badge>
                                    </>
                                )
                            ) : (
                                <>
                                    <WifiOff className="h-4 w-4 text-gray-400" />
                                    <Badge variant="outline" className="text-gray-500">
                                        Не подключено
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* VK Live статус */}
            <Card className={`${vkEnabled ? 'border-blue-500/20 bg-blue-500/5' : 'border-muted-foreground/20 bg-muted/5'}`}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <VKIcon className="h-6 w-6 text-blue-500" />
                            <div className="font-medium text-sm">VK Live</div>
                        </div>
                        <div className="flex items-center gap-3">
                            {vkEnabled ? (
                                vkStream?.isLive ? (
                                    <>
                                        <Wifi className="h-4 w-4 text-green-500" />
                                        <Badge variant="secondary" className="bg-green-500/20 text-green-700 border-green-500/30">
                                            <Users className="h-3 w-3 mr-1" />
                                            {vkStream.viewerCount || 0}
                                        </Badge>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="h-4 w-4 text-gray-400" />
                                        <Badge variant="outline" className="text-gray-500">
                                            Offline
                                        </Badge>
                                    </>
                                )
                            ) : (
                                <>
                                    <WifiOff className="h-4 w-4 text-gray-400" />
                                    <Badge variant="outline" className="text-gray-500">
                                        Не подключено
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StreamStatus;
