// src/components/chatbox/PlatformSettings.tsx
import React from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface PlatformSettingsProps {
    showPlatformIcons: boolean;
    showBadges: boolean;
    show7tvEmotes: boolean;
    showLinks: boolean;
    maxMessages: number;
    messageSpacing: number;
    chatDirection: string;
    chatWidth: number;
    onShowPlatformIconsChange: (value: boolean) => void;
    onShowBadgesChange: (value: boolean) => void;
    onShow7tvEmotesChange: (value: boolean) => void;
    onShowLinksChange: (value: boolean) => void;
    onMaxMessagesChange: (value: number) => void;
    onMessageSpacingChange: (value: number) => void;
    onChatDirectionChange: (value: string) => void;
    onChatWidthChange: (value: number) => void;
}

const PlatformSettings: React.FC<PlatformSettingsProps> = ({
    showPlatformIcons,
    showBadges,
    show7tvEmotes,
    showLinks,
    maxMessages,
    messageSpacing,
    chatDirection,
    chatWidth,
    onShowPlatformIconsChange,
    onShowBadgesChange,
    onShow7tvEmotesChange,
    onShowLinksChange,
    onMaxMessagesChange,
    onMessageSpacingChange,
    onChatDirectionChange,
    onChatWidthChange
}) => {
    return (
        <div className="space-y-6">
            {/* Max Messages */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Максимум сообщений</Label>
                    <span className="text-sm text-gray-400">{maxMessages}</span>
                </div>
                <input
                    type="range"
                    min="5"
                    max="50"
                    value={maxMessages}
                    onChange={(e) => onMaxMessagesChange(parseInt(e.target.value) || 20)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((maxMessages - 5) / 45) * 100}%, #374151 ${((maxMessages - 5) / 45) * 100}%, #374151 100%)`
                    }}
                />
            </div>
            
            {/* Message Spacing */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Отступ между сообщениями</Label>
                    <span className="text-sm text-gray-400">{messageSpacing}px</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="16"
                    value={messageSpacing}
                    onChange={(e) => onMessageSpacingChange(parseInt(e.target.value) || 4)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(messageSpacing / 16) * 100}%, #374151 ${(messageSpacing / 16) * 100}%, #374151 100%)`
                    }}
                />
            </div>
            
            {/* Chat Direction */}
            <div className="space-y-2">
                <Label className="text-white">Направление чата</Label>
                <select
                    value={chatDirection}
                    onChange={(e) => onChatDirectionChange(e.target.value)}
                    className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-2"
                >
                    <option value="vertical">Вертикальное (снизу вверх)</option>
                    <option value="vertical-reverse">Вертикальное (сверху вниз)</option>
                </select>
            </div>
            
            {/* Chat Width */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Ширина чата</Label>
                    <span className="text-sm text-gray-400">{chatWidth}%</span>
                </div>
                <input
                    type="range"
                    min="50"
                    max="100"
                    value={chatWidth}
                    onChange={(e) => onChatWidthChange(parseInt(e.target.value) || 100)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((chatWidth - 50) / 50) * 100}%, #374151 ${((chatWidth - 50) / 50) * 100}%, #374151 100%)`
                    }}
                />
            </div>
            
            {/* Toggle Settings */}
            <div className="space-y-4 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Показывать иконки платформ</Label>
                    <Switch
                        checked={showPlatformIcons}
                        onCheckedChange={onShowPlatformIconsChange}
                    />
                </div>
                
                <div className="flex items-center justify-between">
                    <Label className="text-white">Показывать значки (badges)</Label>
                    <Switch
                        checked={showBadges}
                        onCheckedChange={onShowBadgesChange}
                    />
                </div>
                
                <div className="flex items-center justify-between">
                    <Label className="text-white">Показывать 7TV эмодзи</Label>
                    <Switch
                        checked={show7tvEmotes}
                        onCheckedChange={onShow7tvEmotesChange}
                    />
                </div>
                
                <div className="flex items-center justify-between">
                    <Label className="text-white">Показывать ссылки</Label>
                    <Switch
                        checked={showLinks}
                        onCheckedChange={onShowLinksChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default PlatformSettings;
