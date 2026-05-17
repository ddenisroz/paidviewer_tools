import React from 'react';

import { Eye, EyeOff, Image as ImageIcon, Settings } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { Switch } from '@/shared/components/ui/switch';

interface ChatComplexSettingsProps {
    showImages: boolean;
    onToggleImages: () => void;
    chatMessagesVisible: boolean;
    onToggleChatVisibility: () => void;
    onOpenOBSSettings: () => void;
}

export const ChatComplexSettings: React.FC<ChatComplexSettingsProps> = ({
    showImages,
    onToggleImages,
    chatMessagesVisible,
    onToggleChatVisibility,
    onOpenOBSSettings,
}) => {
    return (
        <div className="space-y-4 w-72">
            <div className="space-y-2">
                <h4 className="font-medium leading-none text-foreground">Настройки чата</h4>
                <p className="text-xs text-muted-foreground">Управление отображением элементов чата</p>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
                {/* Visibility Toggle */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-sm text-foreground flex items-center gap-2">
                            {chatMessagesVisible ? (
                                <Eye className="w-4 h-4 text-green-400" />
                            ) : (
                                <EyeOff className="w-4 h-4 text-muted-foreground" />
                            )}
                            Сообщения
                        </Label>
                        <p className="text-xs text-muted-foreground">Показывать сообщения чата</p>
                    </div>
                    <Switch checked={chatMessagesVisible} onCheckedChange={onToggleChatVisibility} />
                </div>

                {/* Images Toggle */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-sm text-foreground flex items-center gap-2">
                            <ImageIcon
                                className={`w-4 h-4 ${showImages ? 'text-blue-400' : 'text-muted-foreground'}`}
                            />
                            Картинки и ссылки
                        </Label>
                        <p className="text-xs text-muted-foreground">Отображать медиа в чате</p>
                    </div>
                    <Switch checked={showImages} onCheckedChange={onToggleImages} />
                </div>
            </div>

            <Separator className="bg-border" />

            {/* OBS Settings Link */}
            <Button
                variant="outline"
                className="w-full justify-start gap-2 border-border hover:bg-accent hover:text-accent-foreground"
                onClick={onOpenOBSSettings}
            >
                <Settings className="w-4 h-4" />
                Настройки OBS Overlay
            </Button>
        </div>
    );
};
