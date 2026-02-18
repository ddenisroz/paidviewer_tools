// src/features/chat/components/MessageContent.tsx
/**
 * MessageContent - Рендеринг сообщений чата с эмодзи, ссылками и картинками
 * Оптимизирован с React.memo и useMemo
 */
import React, { memo, useMemo } from 'react';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
const INLINE_EMOTE_CLASS = 'chat-inline-emote';

const tryVkAssetFallback = (img: HTMLImageElement): boolean => {
    const src = img.src || '';
    if (!src.includes('images.live.vkvideo.ru')) return false;

    if (src.includes('/size/large')) {
        img.src = src.replace('/size/large', '/size/medium');
        return true;
    }
    if (src.includes('/size/medium')) {
        img.src = src.replace('/size/medium', '/size/small');
        return true;
    }
    return false;
};

const normalizeInlineEmoteUrl = (url: string): string => {
    if (!url) return url;
    // VK smiles often arrive as /size/small and look tiny in chat.
    if (url.includes('images.live.vkvideo.ru') && url.includes('/size/small')) {
        return url.replace('/size/small', '/size/large');
    }
    if (url.includes('static-cdn.jtvnw.net/emoticons/v2/')) {
        return url.replace(/\/(?:1|2)\.0$/, '/3.0');
    }
    if (url.includes('cdn.7tv.app/emote/')) {
        return url
            .replace(/\/1x\.(avif|webp|gif)$/i, '/4x.$1')
            .replace(/\/2x\.(avif|webp|gif)$/i, '/4x.$1')
            .replace(/\/3x\.(avif|webp|gif)$/i, '/4x.$1');
    }
    return url;
};

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

const TWITCH_TEXT_EMOTES: Record<string, { id: string; name: string }> = {
    ':)': { id: '1', name: 'Smile' },
};

// Компонент для изображения с fallback на ссылку
const ChatImage: React.FC<{ src: string }> = memo(({ src }) => (
    <span className="inline-block my-1">
        <img
            src={src}
            alt="Изображение"
            loading="lazy"
            className="max-w-[min(200px,45vw)] max-h-[min(200px,45vw)] rounded"
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

        const rawUrl = normalizeInlineEmoteUrl(emote.url || `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`);
        const emoteUrl = encodeURI(rawUrl);
        const emoteName = emote.name || 'emote';
        const imgTag = `<img src="${emoteUrl}" alt="${emoteName}" class="${INLINE_EMOTE_CLASS}" title="${emoteName}" />`;

        processedText = processedText.substring(0, start) + imgTag + processedText.substring(end);
    }

    return processedText;
};

const processTwitchTextEmotes = (text: string): string => {
    let processed = text;
    for (const [code, meta] of Object.entries(TWITCH_TEXT_EMOTES)) {
        const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\s)(${escapedCode})(?=\\s|$|[.,!?])`, 'g');
        processed = processed.replace(regex, (_match, leading, matchedCode) => {
            const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${meta.id}/default/dark/3.0`;
            return `${leading}<img src="${emoteUrl}" alt="${meta.name}" class="${INLINE_EMOTE_CLASS}" title="${matchedCode}" />`;
        });
    }
    return processed;
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
            const src = part.match(/\bsrc="([^"]*)"/)?.[1];
            const alt = part.match(/\balt="([^"]*)"/)?.[1] || 'emote';
            const className = part.match(/\bclass="([^"]*)"/)?.[1] || INLINE_EMOTE_CLASS;
            const title = part.match(/\btitle="([^"]*)"/)?.[1] || alt;
            if (src) {
                return (
                    <img
                        key={index}
                        src={src}
                        alt={alt}
                        className={className}
                        title={title}
                        style={{
                            width: '1.35em',
                            height: '1.35em',
                            minWidth: '1.35em',
                            minHeight: '1.35em',
                            display: 'inline-block',
                            verticalAlign: 'middle',
                            objectFit: 'contain',
                            marginInline: '0.1em'
                        }}
                        loading="lazy"
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (tryVkAssetFallback(target)) return;
                            const fallback = document.createElement('span');
                            fallback.textContent = '';
                            fallback.className = 'text-xs opacity-80';
                            target.replaceWith(fallback);
                        }}
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
        processedWithTwitch = processTwitchTextEmotes(processedWithTwitch);

        // 2. Затем обрабатываем 7TV эмоты (заменяем текст на img)
        const withEmotes = processEmotes(
            processedWithTwitch,
            channelEmotes || new Map(),
            globalEmotes || new Map()
        );

        // Если есть эмодзи (img теги) - используем специальный рендерер
        if (withEmotes.includes('<img')) {
            return (
                <span className="chat-message-content break-words">
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
            <span className="chat-message-content break-words">
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
