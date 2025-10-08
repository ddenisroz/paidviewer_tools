// frontend/src/components/MessageContent.jsx
import React from 'react';
import { processEmotes } from '../utils/emotes';

const MessageContent = ({ message, channelEmotes, globalEmotes }) => {
    if (!message) return null;

    // 🎭 Processing message:', message, 'Channel emotes:', channelEmotes.size, 'Global emotes:', globalEmotes.size);
    const processedMessage = processEmotes(message, channelEmotes, globalEmotes);
    // 🎭 Processed message:', processedMessage);
    
    // Если есть HTML теги (эмодзи), рендерим как HTML
    if (processedMessage.includes('<img')) {
        return (
            <span 
                className="break-words" 
                dangerouslySetInnerHTML={{ __html: processedMessage }}
            />
        );
    }
    
    // Иначе обычный текст
    return <span className="break-words">{message}</span>;
};

export default MessageContent;
