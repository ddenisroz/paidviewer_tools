import React from 'react';

import { Users, Wifi, WifiOff } from 'lucide-react';

import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';

interface StreamStatusProps {
    integrations?: {
        twitch?: { enabled?: boolean };
        vk?: { enabled?: boolean };
    };
    streamData?: {
        twitch?: {
            isLive?: boolean;
            viewerCount?: number;
            gameName?: string;
            boxArtUrl?: string;
        };
        vk?: {
            isLive?: boolean;
            viewerCount?: number;
            gameName?: string;
            boxArtUrl?: string;
        };
    };
    isLoading?: boolean;
}

const StreamStatus: React.FC<StreamStatusProps> = ({ integrations, streamData, isLoading = false }) => {
    const twitchEnabled = integrations?.twitch?.enabled;
    const vkEnabled = integrations?.vk?.enabled;

    // Получаем данные о стримах
    const twitchStream = streamData?.twitch;
    const vkStream = streamData?.vk;
    const STATUS_BADGE_BASE = 'inline-flex h-7 min-w-[104px] justify-center px-3 text-xs font-medium';
    const CARD_BODY_CLASS = 'h-14 px-3 py-2';
    const formatOnline = (count?: number): string => `${Math.max(0, count ?? 0).toLocaleString('ru-RU')} онлайн`;
    const renderPlatformInfo = (label: string, count?: number): React.ReactNode => (
        <div className="flex min-w-0 flex-col justify-center">
            <div className="truncate text-sm font-semibold text-foreground">{label}</div>
            <div className="mt-0.5 flex items-center text-xs text-muted-foreground">
                <Users className="mr-1 h-3 w-3" />
                {formatOnline(count)}
            </div>
        </div>
    );

    // Если загружается, показываем пустые карточки с анимацией
    if (isLoading) {
        return (
            <div className="mx-auto grid w-full max-w-[680px] grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
                {/* Пустая Twitch карточка */}
                <Card className="h-full border-muted-foreground/20 bg-muted/5">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-muted-foreground/30 rounded"></div>
                                <div className="flex-1">
                                    <div className="h-4 bg-muted-foreground/30 rounded w-16 mb-2"></div>
                                    <div className="h-3 bg-muted-foreground/20 rounded w-12"></div>
                                </div>
                            </div>
                            <div className="flex space-x-1">
                                <div
                                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                    style={{ animationDelay: '0ms' }}
                                ></div>
                                <div
                                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                    style={{ animationDelay: '150ms' }}
                                ></div>
                                <div
                                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                    style={{ animationDelay: '300ms' }}
                                ></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Пустая VK карточка */}
                <Card className="h-full border-muted-foreground/20 bg-muted/5">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-muted-foreground/30 rounded"></div>
                                <div className="flex-1">
                                    <div className="h-4 bg-muted-foreground/30 rounded w-16 mb-2"></div>
                                    <div className="h-3 bg-muted-foreground/20 rounded w-12"></div>
                                </div>
                            </div>
                            <div className="flex space-x-1">
                                <div
                                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                    style={{ animationDelay: '0ms' }}
                                ></div>
                                <div
                                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                    style={{ animationDelay: '150ms' }}
                                ></div>
                                <div
                                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                    style={{ animationDelay: '300ms' }}
                                ></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto grid w-full max-w-[680px] grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
            {/* Twitch статус */}
            <Card
                className={`h-full card-glass transition-colors duration-300 ${twitchEnabled ? 'bg-purple-500/10 border-purple-500/20' : ''}`}
            >
                <CardContent className={CARD_BODY_CLASS}>
                    <div className="flex h-full items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <TwitchIcon
                                className={`h-7 w-7 flex-shrink-0 ${twitchEnabled ? 'text-[#9146FF]' : 'text-muted-foreground'}`}
                                aria-label="Twitch"
                            />
                            {renderPlatformInfo('Twitch', twitchStream?.viewerCount)}
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2">
                            {twitchEnabled ? (
                                twitchStream?.isLive ? (
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge
                                            variant="secondary"
                                            className={`${STATUS_BADGE_BASE} bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1`}
                                        >
                                            <Wifi className="h-3 w-3" />
                                            <span>В эфире</span>
                                        </Badge>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge
                                            variant="outline"
                                            className={`${STATUS_BADGE_BASE} text-gray-400 border-white/10 flex items-center gap-1`}
                                        >
                                            <WifiOff className="h-3 w-3" />
                                            <span>Не в эфире</span>
                                        </Badge>
                                    </div>
                                )
                            ) : (
                                <Badge
                                    variant="outline"
                                    className={`${STATUS_BADGE_BASE} text-gray-500 border-white/10`}
                                >
                                    Не подключено
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* VK Live статус */}
            <Card
                className={`h-full card-glass transition-colors duration-300 ${vkEnabled ? 'bg-red-500/10 border-red-500/20' : ''}`}
            >
                <CardContent className={CARD_BODY_CLASS}>
                    <div className="flex h-full items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <VKIcon
                                className={`h-7 w-7 flex-shrink-0 ${vkEnabled ? 'text-[#FF4444]' : 'text-muted-foreground'}`}
                                aria-label="VK Live"
                            />
                            {renderPlatformInfo('VK Live', vkStream?.viewerCount)}
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2">
                            {vkEnabled ? (
                                vkStream?.isLive ? (
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge
                                            variant="secondary"
                                            className={`${STATUS_BADGE_BASE} bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1`}
                                        >
                                            <Wifi className="h-3 w-3" />
                                            <span>В эфире</span>
                                        </Badge>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge
                                            variant="outline"
                                            className={`${STATUS_BADGE_BASE} text-gray-400 border-white/10 flex items-center gap-1`}
                                        >
                                            <WifiOff className="h-3 w-3" />
                                            <span>Не в эфире</span>
                                        </Badge>
                                    </div>
                                )
                            ) : (
                                <Badge
                                    variant="outline"
                                    className={`${STATUS_BADGE_BASE} text-gray-500 border-white/10 self-center`}
                                >
                                    Не подключено
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StreamStatus;
