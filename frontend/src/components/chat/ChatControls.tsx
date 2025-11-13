// src/components/chat/ChatControls.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
    MessageSquare, 
    Settings,
    Twitch,
    MessageCircle,
    Copy
} from 'lucide-react';
import { VKIcon } from '../PlatformIcons';
import { toast } from 'sonner';

interface Integration {
    enabled?: boolean;
    username?: string;
}

interface Integrations {
    twitch?: Integration;
    vk?: Integration;
}

interface ChatControlsProps {
    twitchChatEnabled: boolean;
    setTwitchChatEnabled: (enabled: boolean) => void;
    vkChatEnabled: boolean;
    setVkChatEnabled: (enabled: boolean) => void;
    showObsSettings: boolean;
    setShowObsSettings: (show: boolean) => void;
    integrations: Integrations;
    generateObsUrl: () => string;
}

const ChatControls: React.FC<ChatControlsProps> = ({
    twitchChatEnabled,
    setTwitchChatEnabled,
    vkChatEnabled,
    setVkChatEnabled,
    showObsSettings,
    setShowObsSettings,
    integrations,
    generateObsUrl
}) => {
    const twitchEnabled = integrations.twitch?.enabled;
    const vkEnabled = integrations.vk?.enabled;

    const handleTwitchToggle = (enabled: boolean) => {
        setTwitchChatEnabled(enabled);
    };

    const handleVkToggle = (enabled: boolean) => {
        setVkChatEnabled(enabled);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Управление чатом
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Переключатели платформ */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Switch
                                id="twitchChat"
                                checked={twitchChatEnabled}
                                onCheckedChange={handleTwitchToggle}
                                disabled={!twitchEnabled}
                            />
                            <div className="flex items-center space-x-2">
                                <Twitch className="h-4 w-4 text-purple-500" />
                                <Label htmlFor="twitchChat">Twitch чат</Label>
                            </div>
                        </div>
                        <span className="text-sm text-gray-400">
                            {twitchEnabled ? `@${integrations.twitch?.username}` : 'Не подключен'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Switch
                                id="vkChat"
                                checked={vkChatEnabled}
                                onCheckedChange={handleVkToggle}
                                disabled={!vkEnabled}
                            />
                            <div className="flex items-center space-x-2">
                                <VKIcon className="h-4 w-4 text-blue-500" />
                                <Label htmlFor="vkChat">VK Live чат</Label>
                            </div>
                        </div>
                        <span className="text-sm text-gray-400">
                            {vkEnabled ? `@${integrations.vk?.username}` : 'Не подключен'}
                        </span>
                    </div>

                </div>

                <Separator />

                {/* Действия */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Действия</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowObsSettings(!showObsSettings)}
                            className="flex items-center gap-2"
                        >
                            <Settings className="h-4 w-4" />
                            Настройки OBS
                        </Button>
                        
                        <Button
                            variant="outline"
                            onClick={() => {
                                // Логика открытия чата в отдельном окне
                                const chatWindow = window.open(
                                    '/chat-window',
                                    'chatWindow',
                                    'width=400,height=600,scrollbars=yes,resizable=yes'
                                );
                                if (chatWindow) {
                                    chatWindow.focus();
                                }
                            }}
                            className="flex items-center gap-2"
                        >
                            <MessageCircle className="h-4 w-4" />
                            Открыть в окне
                        </Button>
                    </div>
                </div>

                <Separator />

                {/* URL для OBS */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">URL для OBS</h3>
                    
                    {/* Универсальный URL с автоматической фильтрацией */}
                    <div className="space-y-2 p-3 border rounded-lg bg-blue-500/10">
                        <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-sm">Универсальный чат</span>
                            <span className="text-xs text-muted-foreground">
                                (автоматически фильтрует по включенным платформам)
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => {
                                    const url = generateObsUrl();
                                    navigator.clipboard.writeText(url);
                                    toast.success('URL скопирован в буфер обмена');
                                }}
                            >
                                <Copy className="h-4 w-4 mr-1" />
                                Сгенерировать и скопировать URL
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground italic">
                            Нажмите кнопку выше чтобы сгенерировать URL с текущими настройками
                        </div>
                        <div className="text-xs text-muted-foreground">
                            <strong>Текущая фильтрация:</strong> {
                                twitchChatEnabled && vkChatEnabled ? 'Объединенный чат (Twitch + VK Live)' :
                                twitchChatEnabled ? 'Только Twitch' :
                                vkChatEnabled ? 'Только VK Live' :
                                'Все платформы'
                            }
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ChatControls;

