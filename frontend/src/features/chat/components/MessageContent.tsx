// src/features/chat/components/MessageContent.tsx
/**
 * MessageContent - Рендеринг сообщений чата с эмодзи, ссылками и картинками
 * Оптимизирован с React.memo и useMemo
 */
import React, { memo, useMemo } from 'react';

import { processEmotes } from '@/features/chat/utils/emotes';
import { sanitizeHtml } from '@/shared/utils/sanitize';

import type { ChatEmote } from '@/types/chat';

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
    twitchEmotes?: ChatEmote[];
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

const removeUrls = (text: string): string => text.replace(URL_REGEX, '').replace(/\s{2,}/g, ' ').trim();

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

// Функция для обработки Twitch Native Emotes (по диапазонам)
const processTwitchEmotes = (text: string, emotes: ChatEmote[]): string => {
    if (!emotes || emotes.length === 0) return text;

    // Сортируем эмоты по позиции (с конца в начало, чтобы не сбить индексы)
    const sortedEmotes = [...emotes].sort((a, b) => b.start - a.start);

    let processedText = text;
    // Преобразуем строку в массив кодовых точек для корректной работы с эмодзи и unicode
    // Но так как индексы Twitch приходят для UTF-16 (обычно), JS string работает корректно.
    // Однако Twitch API иногда дает индексы по кодовым точкам.
    // Простейший вариант - string replace по индексам.

    for (const emote of sortedEmotes) {
        const start = emote.start;
        const end = emote.end + 1; // Twitch end is inclusive

        if (start < 0 || end > processedText.length) continue;

        const rawUrl = emote.url || `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`;
        const emoteUrl = encodeURI(rawUrl);
        const emoteName = emote.name || 'emote';
        const imgTag = `<img src="${emoteUrl}" alt="${emoteName}" class="inline-block w-6 h-6 align-middle object-contain" title="${emoteName}" />`;

        processedText = processedText.substring(0, start) + imgTag + processedText.substring(end);
    }

    return processedText;
};

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
            return null;
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
    // Разбиваем по тегам img
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

        // Проверяем на URL внутри текстовой части
        if (URL_REGEX.test(part)) {
            URL_REGEX.lastIndex = 0;

            if (!showLinks) {
                const removedText = removeUrls(part);
                return removedText ? <span key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(removedText) }} /> : null;
            }

            // Здесь сложность: мы не можем вернуть компонент ChatImage из dangerouslySetInnerHTML
            // Поэтому, если часть содержит URL, нам нужно её еще раз разбить или использовать renderPart
            // Но renderPart возвращает ReactNode, а мы внутри map.

            // Упрощение: если часть - это чистый URL
            if (part.match(URL_REGEX) && part.match(URL_REGEX)![0] === part) {
                if (autoLoadImages && isImageUrl(part)) {
                    return <ChatImage key={index} src={part} />;
                }
                return <ChatLink key={index} href={part} />;
            }

            // Если URL внутри текста - используем регулярку для split
            const subParts = part.split(URL_REGEX);
            return subParts.map((subPart, subIndex) => {
                if (URL_REGEX.test(subPart)) {
                    URL_REGEX.lastIndex = 0;
                    if (!showLinks) return null;
                    if (autoLoadImages && isImageUrl(subPart)) return <ChatImage key={`${index}-${subIndex}`} src={subPart} />;
                    return <ChatLink key={`${index}-${subIndex}`} href={subPart} />;
                }
                return <span key={`${index}-${subIndex}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(subPart) }} />;
            });
        }

        // Обычный текст с sanitize
        return <span key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(part) }} />;
    });
};

const MessageContent: React.FC<MessageContentProps> = memo(({
    message,
    channelEmotes,
    globalEmotes,
    twitchEmotes,
    showLinks = true,
    autoLoadImages = true
}) => {
    // Мемоизация обработки сообщения
    const content = useMemo(() => {
        if (!message) return null;

        // 1. Сначала обрабатываем Twitch Native Emotes (заменяем диапазоны на img)
        // Важно: делать это ПЕРЕД 7TV, так как они имеют приоритет и точные позиции
        let processedWithTwitch = message;
        if (twitchEmotes && twitchEmotes.length > 0) {
            processedWithTwitch = processTwitchEmotes(message, twitchEmotes);
        }

        // 2. Затем обрабатываем 7TV эмоты (заменяем текст на img)
        const withEmotes = processEmotes(
            processedWithTwitch,
            channelEmotes || new Map(),
            globalEmotes || new Map()
        );

        // Если есть эмодзи (img теги) - используем специальный рендерер
        if (withEmotes.includes('<img')) {
            return (
                <span className="break-words">
                    {renderMessageWithEmotes(withEmotes, showLinks, autoLoadImages)}
                </span>
            );
        }

        // Обработка ссылок (FALLBACK для сообщений без эмодзи)
        if (!showLinks) {
            const processed = removeUrls(message);
            return processed ? <span className="break-words">{processed}</span> : null;
        }

        // Разбиваем на части и рендерим
        const parts = message.split(URL_REGEX);
        return (
            <span className="break-words">
                {parts.map((part, index) => (
                    <span key={index} className="align-middle">
                        {renderPart(part, index, showLinks, autoLoadImages)}
                        {index < parts.length - 1 ? ' ' : ''}
                    </span>
                ))}
            </span>
        );
    }, [message, channelEmotes, globalEmotes, twitchEmotes, showLinks, autoLoadImages]);

    return content;
});

MessageContent.displayName = 'MessageContent';

export default MessageContent;
