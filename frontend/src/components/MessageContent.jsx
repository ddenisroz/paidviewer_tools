// frontend/src/components/MessageContent.jsx
import React from 'react';
import { processEmotes } from '../utils/emotes';

const MessageContent = ({ message, channelEmotes, globalEmotes }) => {
    if (!message) return null;

    // 🎭 Processing message:', message, 'Channel emotes:', channelEmotes.size, 'Global emotes:', globalEmotes.size);
    const processedMessage = processEmotes(message, channelEmotes, globalEmotes);
    // 🎭 Processed message:', processedMessage);
    
    // Если есть HTML теги (эмодзи), создаем элементы безопасно
    if (processedMessage.includes('<img')) {
        return (
            <span className="break-words">
                {renderMessageWithEmotes(processedMessage)}
            </span>
        );
    }
    
    // Иначе обычный текст
    return <span className="break-words">{message}</span>;
};

// Безопасная функция для рендеринга сообщений с эмодзи
const renderMessageWithEmotes = (processedMessage) => {
    // Разбиваем сообщение на части по тегам img
    const parts = processedMessage.split(/(<img[^>]*\/>)/);
    
    return parts.map((part, index) => {
        // Если это img тег, создаем React элемент
        if (part.startsWith('<img') && part.endsWith('/>')) {
            const imgMatch = part.match(/<img\s+src="([^"]*)"\s+alt="([^"]*)"[^>]*class="([^"]*)"[^>]*title="([^"]*)"[^>]*\/>/);
            if (imgMatch) {
                const [, src, alt, className, title] = imgMatch;
                return (
                    <img
                        key={index}
                        src={src}
                        alt={alt}
                        className={className}
                        title={title}
                    />
                );
            }
        }
        
        // Обычный текст
        return part;
    });
};

export default MessageContent;
