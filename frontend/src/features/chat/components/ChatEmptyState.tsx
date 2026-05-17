/**
 * ChatEmptyState - Пустое состояние чата
 */
import React from 'react';

import { MessageSquare } from 'lucide-react';

interface ChatEmptyStateProps {
    isConnected: boolean;
}

const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({ isConnected }) => (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">Нет сообщений</p>
        <p className="text-xs mt-1">{isConnected ? 'Ожидание сообщений...' : 'Ожидание подключения...'}</p>
    </div>
);

export default ChatEmptyState;
