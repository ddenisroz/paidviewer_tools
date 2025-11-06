// frontend/src/components/MessageContent.jsx
import React from 'react';
import { processEmotes } from '../utils/emotes';

const MessageContent = ({ message, channelEmotes, globalEmotes, showLinks = true }) => {
    if (!message) return null;

    // Обрабатываем ссылки
    let processedMessage = message;
    if (!showLinks) {
        // Скрываем ссылки, заменяя их на текст
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        processedMessage = processedMessage.replace(urlRegex, (url) => {
            try {
                const urlObj = new URL(url);
                return urlObj.hostname + (urlObj.pathname.length > 20 ? urlObj.pathname.substring(0, 20) + '...' : urlObj.pathname);
            } catch {
                return '[ссылка]';
            }
        });
    }

    // 🎭 Processing message:', message, 'Channel emotes:', channelEmotes.size, 'Global emotes:', globalEmotes.size);
    const processedMessageWithEmotes = processEmotes(processedMessage, channelEmotes, globalEmotes);
    // 🎭 Processed message:', processedMessageWithEmotes);
    
    // Если есть HTML теги (эмодзи), создаем элементы безопасно
    if (processedMessageWithEmotes.includes('<img')) {
        return (
            <span className="break-words">
                {renderMessageWithEmotes(processedMessageWithEmotes, showLinks)}
            </span>
        );
    }
    
    // Иначе обычный текст с возможными ссылками
    if (showLinks) {
        // Делаем ссылки кликабельными
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const parts = processedMessage.split(urlRegex);
        return (
            <span className="break-words">
                {parts.map((part, index) => {
                    if (part.match(urlRegex)) {
                        return (
                            <a
                                key={index}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#00d4ff', textDecoration: 'underline' }}
                            >
                                {part}
                            </a>
                        );
                    }
                    return part;
                })}
            </span>
        );
    }
    
    return <span className="break-words">{processedMessage}</span>;
};

// Безопасная функция для рендеринга сообщений с эмодзи
const renderMessageWithEmotes = (processedMessage, showLinks = true) => {
    // Разбиваем сообщение на части по тегам img и ссылкам
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
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
        
        // Если это ссылка и showLinks=true, делаем её кликабельной
        if (showLinks && part.match(urlRegex)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#00d4ff', textDecoration: 'underline' }}
                >
                    {part}
                </a>
            );
        }
        
        // Обычный текст
        return <span key={index}>{part}</span>;
    });
};

export default MessageContent;
