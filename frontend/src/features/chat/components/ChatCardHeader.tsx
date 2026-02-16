// src/components/chat/ChatCardHeader.tsx
import React from 'react';

import {
    ExternalLink,
    Eye,
    EyeOff,
    Image,
    ImageOff,
    MessageSquare,
    Settings
} from 'lucide-react';

import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { CardTitle } from '@/shared/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Switch } from '@/shared/components/ui/switch';
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
            <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5" />
                ChatBox
            </CardTitle>

            <TooltipProvider>
                <div className="flex items-center gap-1.5">
                    {/* OBS Widget Settings Button - Visible and Prominent */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSettingsClick}
                                className="h-8 px-2.5 gap-1.5 transition-colors bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/50 hover:from-purple-600/30 hover:to-blue-600/30 hover:border-purple-400 text-purple-200 hover:text-white"
                            >
                                <Settings className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">OBS</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Настройки виджета для OBS
                        </TooltipContent>
                    </Tooltip>

                    {/* Chat Settings Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 transition-colors text-muted-foreground border-border hover:text-blue-400 hover:border-blue-600 hover:bg-blue-600/10"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="end">
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-white">Настройки чата</h4>

                                {/* Platform Filters */}
                                {(twitchChatEnabled || vkChatEnabled) && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-400 uppercase tracking-wider">Платформы</p>
                                        {twitchChatEnabled && (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <TwitchIcon className="h-4 w-4 text-[#9146FF]" />
                                                    <span className="text-sm">Twitch</span>
                                                </div>
                                                <Switch
                                                    checked={twitchChatVisible}
                                                    onCheckedChange={onTwitchToggle}
                                                />
                                            </div>
                                        )}
                                        {vkChatEnabled && (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <VKIcon className="h-4 w-4 text-[#FF4444]" />
                                                    <span className="text-sm">VK Live</span>
                                                </div>
                                                <Switch
                                                    checked={vkChatVisible}
                                                    onCheckedChange={onVkToggle}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Display Settings */}
                                <div className="space-y-2 pt-2 border-t border-gray-700">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider">Отображение</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {showImages ? <Image className="h-4 w-4 text-cyan-400" /> : <ImageOff className="h-4 w-4 text-gray-400" />}
                                            <span className="text-sm">Изображения</span>
                                        </div>
                                        <Switch
                                            checked={showImages}
                                            onCheckedChange={onToggleImages}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {chatMessagesVisible ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                                            <span className="text-sm">Сообщения</span>
                                        </div>
                                        <Switch
                                            checked={chatMessagesVisible}
                                            onCheckedChange={onToggleChatVisibility}
                                        />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Open in New Window */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onOpenChatWindow}
                                className="h-8 w-8 p-0 transition-colors text-gray-400 border-gray-600 hover:text-green-400 hover:border-green-600 hover:bg-green-600/10"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Открыть чат в отдельном окне
                        </TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </div>
    );
};

export default ChatCardHeader;
