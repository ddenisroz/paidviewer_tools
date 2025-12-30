// frontend/src/components/MessageContent.tsx
/**
 * MessageContent - Рендеринг сообщений чата с эмодзи, ссылками и картинками
 * Оптимизирован с React.memo и useMemo
 */
import React, { memo, useMemo } from 'react';

import { processEmotes } from '../utils/emotes';
import { sanitizeHtml } from '../utils/sanitize';

interface EmoteData {
    id: string;
    name: string;
    url: string;
    animated: boolean;
}

interface MessageContentProps {
    message: string;
    channelEmotes?: Map<string, EmoteData>;
    globalEmotes?: Map<string, EmoteData>;
    showLinks?: boolean;
    autoLoadImages?: boolean;
}

// Regex для URL - создаем один раз
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;

// Проверка, является ли URL изображением
const isImageUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        return IMAGE_EXTENSIONS.test(urlObj.pathname.toLowerCase());
    } catch {
        return false;
    }
};

// Сокращение URL для отображения
const shortenUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.length > 20 
            ? `${urlObj.pathname.substring(0, 20)  }...` 
            : urlObj.pathname;
        return urlObj.hostname + path;
    } catch {
        return '[ссылка]';
    }
};

// Компонент для изображения с fallback на ссылку
const ChatImage: React.FC<{ src: string }> = memo(({ src }) => (
    <span className="inline-block my-1">
        <img
            src={src}
            alt="Изображение"
            loading="lazy"
            className="max-w-[200px] max-h-[200px] rounded"
            onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const link = document.createElement('a');
                link.href = src;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'text-cyan-400 underline';
                link.textContent = src;
                target.parentNode?.appendChild(link);
            }}
        />
    </span>
));
ChatImage.displayName = 'ChatImage';

// Компонент для ссылки
const ChatLink: React.FC<{ href: string }> = memo(({ href }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-400 underline hover:text-cyan-300"
    >
        {href}
    </a>
));
ChatLink.displayName = 'ChatLink';

// Рендер части сообщения (текст, ссылка или картинка)
const renderPart = (
    part: string, 
    index: number, 
    showLinks: boolean, 
    autoLoadImages: boolean
): React.ReactNode => {
    // Проверяем, является ли часть URL
    if (URL_REGEX.test(part)) {
        URL_REGEX.lastIndex = 0; // Reset regex state
        
        if (!showLinks) {
            return <span key={index}>{shortenUrl(part)}</span>;
        }
        
        if (autoLoadImages && isImageUrl(part)) {
            return <ChatImage key={index} src={part} />;
        }
        
        return <ChatLink key={index} href={part} />;
    }
    
    return <span key={index}>{part}</span>;
};

// Рендер сообщения с эмодзи
const renderMessageWithEmotes = (
    processedMessage: string, 
    showLinks: boolean, 
    autoLoadImages: boolean
): React.ReactNode[] => {
    const parts = processedMessage.split(/(<img[^>]*\/>)/);
    
    return parts.map((part, index) => {
        // Если это img тег (эмодзи)
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
                        loading="lazy"
                    />
                );
            }
        }
        
        // Проверяем на URL
        if (URL_REGEX.test(part)) {
            URL_REGEX.lastIndex = 0;
            
            if (!showLinks) {
                const replacedText = part.replace(URL_REGEX, shortenUrl);
                return <span key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(replacedText) }} />;
            }
            
            if (autoLoadImages && isImageUrl(part)) {
                return <ChatImage key={index} src={part} />;
            }
            
            return <ChatLink key={index} href={part} />;
        }
        
        // Обычный текст с sanitize
        return <span key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(part) }} />;
    });
};

const MessageContent: React.FC<MessageContentProps> = memo(({ 
    message, 
    channelEmotes, 
    globalEmotes, 
    showLinks = true, 
    autoLoadImages = true 
}) => {
    // Мемоизация обработки сообщения
    const content = useMemo(() => {
        if (!message) return null;

        // Обрабатываем эмодзи
        const withEmotes = processEmotes(
            message, 
            channelEmotes || new Map(), 
            globalEmotes || new Map()
        );
        
        // Если есть эмодзи (img теги)
        if (withEmotes.includes('<img')) {
            return (
                <span className="break-words">
                    {renderMessageWithEmotes(withEmotes, showLinks, autoLoadImages)}
                </span>
            );
        }
        
        // Обработка ссылок
        if (!showLinks) {
            const processed = message.replace(URL_REGEX, shortenUrl);
            return <span className="break-words">{processed}</span>;
        }
        
        // Разбиваем на части и рендерим
        const parts = message.split(URL_REGEX);
        return (
            <span className="break-words inline-flex flex-wrap items-center gap-1">
                {parts.map((part, index) => renderPart(part, index, showLinks, autoLoadImages))}
            </span>
        );
    }, [message, channelEmotes, globalEmotes, showLinks, autoLoadImages]);

    return content;
});

MessageContent.displayName = 'MessageContent';

export default MessageContent;
