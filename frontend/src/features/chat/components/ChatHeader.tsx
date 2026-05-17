/**
 * ChatHeader - Кнопки управления чатом
 * Вынесено из ChatCard.tsx для улучшения читаемости
 */
import React from 'react';

import { ExternalLink, Eye, EyeOff, MessageSquare, Settings } from 'lucide-react';

import { BUTTON_SIZES, TRANSITIONS } from '@/constants/designSystem';
import { cn } from '@/lib/utils';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { CardTitle } from '@/shared/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

// Иконка картинки
const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
    </svg>
);

interface ChatHeaderProps {
    // Состояние платформ
    twitchChatEnabled: boolean;
    vkChatEnabled: boolean;
    twitchChatVisible: boolean;
    vkChatVisible: boolean;
    // Состояние UI
    showImages: boolean;
    chatMessagesVisible: boolean;
    // Обработчики
    onTwitchToggle: () => void;
    onVkToggle: () => void;
    onSettingsClick: () => void;
    onImagesToggle: () => void;
    onVisibilityToggle: () => void;
}

// Стили кнопок
const buttonBase = `${BUTTON_SIZES.icon} ${TRANSITIONS.colors} active:scale-100`;

const ChatHeader: React.FC<ChatHeaderProps> = ({
    twitchChatEnabled,
    vkChatEnabled,
    twitchChatVisible,
    vkChatVisible,
    showImages,
    chatMessagesVisible,
    onTwitchToggle,
    onVkToggle,
    onSettingsClick,
    onImagesToggle,
    onVisibilityToggle,
}) => {
    // Открыть чат в отдельном окне
    const handleOpenWindow = () => {
        const width = 600;
        const height = 800;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
            '/chat-window',
            'ChatWindow',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
        );
    };

    return (
        <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                ChatBox
            </CardTitle>

            <TooltipProvider>
                <div className="flex items-center gap-2">
                    {/* Twitch Toggle */}
                    {twitchChatEnabled && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onTwitchToggle}
                                    className={cn(
                                        buttonBase,
                                        twitchChatVisible
                                            ? 'bg-purple-600/20 text-purple-400 border-purple-600 hover:bg-purple-600/30'
                                            : 'text-gray-400 border-gray-600 hover:text-purple-400 hover:border-purple-600 hover:bg-purple-600/10'
                                    )}
                                >
                                    <TwitchIcon className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {twitchChatVisible ? 'Выключить TTS и скрыть Twitch' : 'Включить TTS и показать Twitch'}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {/* VK Toggle */}
                    {vkChatEnabled && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onVkToggle}
                                    className={cn(
                                        buttonBase,
                                        vkChatVisible
                                            ? 'bg-rose-600/20 text-rose-400 border-rose-600 hover:bg-rose-600/30'
                                            : 'text-gray-400 border-gray-600 hover:text-rose-400 hover:border-rose-600 hover:bg-rose-600/10'
                                    )}
                                >
                                    <VKIcon className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {vkChatVisible ? 'Выключить TTS и скрыть VK' : 'Включить TTS и показать VK'}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {/* Settings */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSettingsClick}
                                className={cn(
                                    buttonBase,
                                    'text-gray-400 border-gray-600 hover:text-blue-400 hover:border-blue-600 hover:bg-blue-600/10'
                                )}
                            >
                                <Settings className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Настройки ChatBox для OBS</TooltipContent>
                    </Tooltip>

                    {/* External Window */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenWindow}
                                className={cn(
                                    buttonBase,
                                    'text-gray-400 border-gray-600 hover:text-green-400 hover:border-green-600 hover:bg-green-600/10'
                                )}
                            >
                                <ExternalLink className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Открыть в отдельном окне</TooltipContent>
                    </Tooltip>

                    {/* Images Toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onImagesToggle}
                                className={cn(
                                    buttonBase,
                                    showImages
                                        ? 'bg-blue-600/20 text-blue-400 border-blue-600 hover:bg-blue-600/30'
                                        : 'text-gray-400 border-gray-600 hover:text-blue-400 hover:border-blue-600 hover:bg-blue-600/10'
                                )}
                            >
                                <ImageIcon className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{showImages ? 'Скрыть картинки' : 'Показать картинки'}</TooltipContent>
                    </Tooltip>

                    {/* Visibility Toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onVisibilityToggle}
                                className={cn(
                                    buttonBase,
                                    chatMessagesVisible
                                        ? 'bg-gray-600/20 text-gray-300 border-gray-600 hover:bg-gray-600/30'
                                        : 'text-gray-400 border-gray-600 hover:text-gray-300 hover:border-gray-500 hover:bg-gray-600/10'
                                )}
                            >
                                {chatMessagesVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{chatMessagesVisible ? 'Скрыть чат' : 'Показать чат'}</TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </div>
    );
};

export default ChatHeader;
