// src/components/chat/ChatCardHeader.tsx
import React from 'react';

import { 
    ExternalLink,
    Eye,
    EyeOff,
    MessageSquare,
    Settings
} from 'lucide-react';

import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { CardTitle } from '@/shared/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';



interface ChatCardHeaderProps {
    twitchChatEnabled: boolean;
    vkChatEnabled: boolean;
    twitchChatVisible: boolean;
    vkChatVisible: boolean;
    chatMessagesVisible: boolean;
    showImages: boolean;
    onTwitchToggle: () => void;
    onVkToggle: () => void;
    onSettingsClick: () => void;
    onOpenChatWindow: () => void;
    onToggleImages: () => void;
    onToggleChatVisibility: () => void;
}

const ChatCardHeader: React.FC<ChatCardHeaderProps> = ({
    twitchChatEnabled,
    vkChatEnabled,
    twitchChatVisible,
    vkChatVisible,
    chatMessagesVisible,
    showImages,
    onTwitchToggle,
    onVkToggle,
    onSettingsClick,
    onOpenChatWindow,
    onToggleImages,
    onToggleChatVisibility
}) => {
    return (
        <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                ChatBox
            </CardTitle>
            
            <TooltipProvider>
                <div className="flex items-center gap-2">
                    {twitchChatEnabled && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onTwitchToggle}
                                    className={`h-10 w-10 p-0 transition-colors active:scale-100 ${
                                        twitchChatVisible 
                                            ? 'bg-purple-600/20 text-purple-400 border-purple-600 hover:bg-purple-600/30' 
                                            : 'text-gray-400 border-gray-600 hover:text-purple-400 hover:border-purple-600 hover:bg-purple-600/10'
                                    }`}
                                >
                                    <TwitchIcon className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {twitchChatVisible ? 'Выключить TTS и скрыть сообщения Twitch' : 'Включить TTS и показать сообщения Twitch'}
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {vkChatEnabled && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onVkToggle}
                                    className={`h-10 w-10 p-0 transition-colors active:scale-100 ${
                                        vkChatVisible 
                                            ? 'bg-rose-600/20 text-rose-400 border-rose-600 hover:bg-rose-600/30' 
                                            : 'text-gray-400 border-gray-600 hover:text-rose-400 hover:border-rose-600 hover:bg-rose-600/10'
                                    }`}
                                >
                                    <VKIcon className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {vkChatVisible ? 'Выключить TTS и скрыть сообщения VK' : 'Включить TTS и показать сообщения VK'}
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSettingsClick}
                                className="h-10 w-10 p-0 transition-colors active:scale-100 text-gray-400 border-gray-600 hover:text-blue-400 hover:border-blue-600 hover:bg-blue-600/10"
                            >
                                <Settings className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Настройки ChatBox для OBS
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onOpenChatWindow}
                                className="h-10 w-10 p-0 transition-colors active:scale-100 text-gray-400 border-gray-600 hover:text-green-400 hover:border-green-600 hover:bg-green-600/10"
                            >
                                <ExternalLink className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Открыть чат в отдельном окне
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onToggleImages}
                                className={`h-10 w-10 p-0 transition-colors active:scale-100 ${
                                    showImages 
                                        ? 'bg-blue-600/20 text-blue-400 border-blue-600 hover:bg-blue-600/30' 
                                        : 'text-gray-400 border-gray-600 hover:text-blue-400 hover:border-blue-600 hover:bg-blue-600/10'
                                }`}
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {showImages ? 'Скрыть картинки и ссылки' : 'Показать картинки и ссылки'}
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onToggleChatVisibility}
                                className={`h-10 w-10 p-0 transition-colors active:scale-100 ${
                                    chatMessagesVisible 
                                        ? 'bg-gray-600/20 text-gray-300 border-gray-600 hover:bg-gray-600/30' 
                                        : 'text-gray-400 border-gray-600 hover:text-gray-300 hover:border-gray-500 hover:bg-gray-600/10'
                                }`}
                            >
                                {chatMessagesVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {chatMessagesVisible ? 'Скрыть сообщения чата' : 'Показать сообщения чата'}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </div>
    );
};

export default ChatCardHeader;
