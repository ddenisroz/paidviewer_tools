// src/components/chat/ChatCardFooter.tsx
import React from 'react';

import { EyeOff, MessageSquare } from 'lucide-react';

interface ChatCardFooterProps {
    twitchEnabled: boolean;
    vkEnabled: boolean;
    chatMessagesVisible: boolean;
    isOnHomePage: boolean;
}

const ChatCardFooter: React.FC<ChatCardFooterProps> = ({
    twitchEnabled,
    vkEnabled,
    chatMessagesVisible,
    isOnHomePage,
}) => {
    if (!chatMessagesVisible && isOnHomePage) {
        return (
            <div className="min-h-[200px] flex items-center justify-center">
                <div className="text-center text-muted-foreground py-8">
                    <EyeOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Чат скрыт</p>
                    <p className="text-xs mt-2">Нажмите "Показать чат" для отображения сообщений</p>
                </div>
            </div>
        );
    }

    if (!isOnHomePage) {
        return (
            <div className="min-h-[200px] flex items-center justify-center">
                <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Чат активен только на главной странице</p>
                    <p className="text-xs mt-2">Перейдите на главную для просмотра сообщений</p>
                </div>
            </div>
        );
    }

    if (!twitchEnabled && !vkEnabled) {
        return (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Подключите Twitch или VK Live для использования чата</p>
            </div>
        );
    }

    return null;
};

export default ChatCardFooter;
