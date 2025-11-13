// frontend/src/components/MessageContent.tsx
import React from 'react';
import { processEmotes } from '../utils/emotes';

interface MessageContentProps {
    message: string;
    channelEmotes?: Map<string, string>;
    globalEmotes?: Map<string, string>;
    showLinks?: boolean;
    autoLoadImages?: boolean;
}

// Проверка, является ли URL изображением или гифкой
const isImageUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        return pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) !== null;
    } catch {
        return false;
    }
};

const MessageContent: React.FC<MessageContentProps> = ({ message, channelEmotes, globalEmotes, showLinks = true, autoLoadImages = true }) => {
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
    const processedMessageWithEmotes = processEmotes(processedMessage, channelEmotes || new Map(), globalEmotes || new Map());
    // 🎭 Processed message:', processedMessageWithEmotes);
    
    // Если есть HTML теги (эмодзи), создаем элементы безопасно
    if (processedMessageWithEmotes.includes('<img')) {
        return (
            <span className="break-words">
                {renderMessageWithEmotes(processedMessageWithEmotes, showLinks, autoLoadImages)}
            </span>
        );
    }
    
    // Иначе обычный текст с возможными ссылками и картинками
    if (showLinks) {
        // Делаем ссылки кликабельными, а картинки - отображаемыми
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const parts = processedMessage.split(urlRegex);
        return (
            <span className="break-words inline-flex flex-wrap items-center gap-1">
                {parts.map((part, index) => {
                    if (part.match(urlRegex)) {
                        // ✅ Проверяем, является ли URL изображением
                        if (autoLoadImages && isImageUrl(part)) {
                            return (
                                <span key={index} className="inline-block my-1">
                                    <img
                                        src={part}
                                        alt="Изображение из чата"
                                        style={{
                                            maxWidth: '200px',
                                            maxHeight: '200px',
                                            borderRadius: '4px',
                                            display: 'block'
                                        }}
                                        onError={(e) => {
                                            // Если изображение не загрузилось, показываем ссылку
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const link = document.createElement('a');
                                            link.href = part;
                                            link.target = '_blank';
                                            link.rel = 'noopener noreferrer';
                                            link.style.color = '#00d4ff';
                                            link.style.textDecoration = 'underline';
                                            link.textContent = part;
                                            if (target.parentNode) {
                                                target.parentNode.appendChild(link);
                                            }
                                        }}
                                    />
                                </span>
                            );
                        }
                        
                        // Обычная ссылка
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
                    return <span key={index}>{part}</span>;
                })}
            </span>
        );
    }
    
    return <span className="break-words">{processedMessage}</span>;
};

// Безопасная функция для рендеринга сообщений с эмодзи
const renderMessageWithEmotes = (processedMessage: string, showLinks = true, autoLoadImages = true): React.ReactNode[] => {
    // Разбиваем сообщение на части по тегам img и ссылкам
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = processedMessage.split(/(<img[^>]*\/>)/);
    
    return parts.map((part, index) => {
        // Если это img тег (7TV эмодзи), создаем React элемент
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
        
        // Если это ссылка и showLinks=true
        if (showLinks && part.match(urlRegex)) {
            // ✅ Проверяем, является ли URL изображением
            if (autoLoadImages && isImageUrl(part)) {
                return (
                    <span key={index} className="inline-block my-1">
                        <img
                            src={part}
                            alt="Изображение из чата"
                            style={{
                                maxWidth: '200px',
                                maxHeight: '200px',
                                borderRadius: '4px',
                                display: 'block'
                            }}
                            onError={(e) => {
                                // Если изображение не загрузилось, показываем ссылку
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const link = document.createElement('a');
                                link.href = part;
                                link.target = '_blank';
                                link.rel = 'noopener noreferrer';
                                link.style.color = '#00d4ff';
                                link.style.textDecoration = 'underline';
                                link.textContent = part;
                                if (target.parentNode) {
                                    target.parentNode.appendChild(link);
                                }
                            }}
                        />
                    </span>
                );
            }
            
            // Обычная ссылка
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
        return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
    });
};

export default MessageContent;

