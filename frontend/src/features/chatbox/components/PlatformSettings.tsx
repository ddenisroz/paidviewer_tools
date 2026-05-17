import React from 'react';

import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';

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
    onChatWidthChange,
}) => {
    return (
        <div className="space-y-6">
            {/* Visual Settings Group */}
            <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Отображение</h4>

                <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">Иконки платформ</Label>
                        <Switch checked={showPlatformIcons} onCheckedChange={onShowPlatformIconsChange} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">Значки (badges)</Label>
                        <Switch checked={showBadges} onCheckedChange={onShowBadgesChange} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">7TV Эмодзи</Label>
                        <Switch checked={show7tvEmotes} onCheckedChange={onShow7tvEmotesChange} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">Ссылки</Label>
                        <Switch checked={showLinks} onCheckedChange={onShowLinksChange} />
                    </div>
                </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Layout Group */}
            <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Макет</h4>

                {/* Chat Width */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">Ширина окна</Label>
                        <span className="text-sm text-muted-foreground w-12 text-right">{chatWidth}%</span>
                    </div>
                    <Slider
                        defaultValue={[chatWidth]}
                        min={50}
                        max={100}
                        step={1}
                        onValueChange={(val) => onChatWidthChange(val[0])}
                    />
                </div>

                {/* Chat Direction */}
                <div className="space-y-2">
                    <Label className="text-foreground">Направление</Label>
                    <select
                        value={chatDirection}
                        onChange={(e) => onChatDirectionChange(e.target.value)}
                        className="w-full bg-black/20 text-foreground border border-white/10 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                    >
                        <option value="vertical">Снизу вверх (стандарт)</option>
                        <option value="vertical-reverse">Сверху вниз</option>
                    </select>
                </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Message Behavior Group */}
            <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Сообщения</h4>

                {/* Max Messages */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">Лимит сообщений</Label>
                        <span className="text-sm text-muted-foreground w-12 text-right">{maxMessages}</span>
                    </div>
                    <Slider
                        defaultValue={[maxMessages]}
                        min={5}
                        max={50}
                        step={1}
                        onValueChange={(val) => onMaxMessagesChange(val[0])}
                    />
                </div>

                {/* Message Spacing */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">Отступ между сообщениями</Label>
                        <span className="text-sm text-muted-foreground w-12 text-right">{messageSpacing}px</span>
                    </div>
                    <Slider
                        defaultValue={[messageSpacing]}
                        min={0}
                        max={24}
                        step={1}
                        onValueChange={(val) => onMessageSpacingChange(val[0])}
                    />
                </div>
            </div>
        </div>
    );
};

export default PlatformSettings;
