/**
 * HTML Sanitization Utility
 *
 * Использует DOMPurify для защиты от XSS атак при рендеринге HTML контента
 */
import DOMPurify from 'dompurify';

/**
 * Безопасные HTML теги для контента
 */
const ALLOWED_TAGS = [
    'b',
    'i',
    'em',
    'strong',
    'u',
    's',
    'strike',
    'p',
    'br',
    'span',
    'div',
    'a',
    'img',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'code',
    'pre',
    'blockquote',
];

/**
 * Безопасные атрибуты для HTML тегов
 */
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class', 'id'];

/**
 * Конфигурация DOMPurify по умолчанию
 */
const DEFAULT_CONFIG = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
};

/**
 * Очищает HTML контент от потенциально опасных элементов
 *
 * @param html - HTML строка для очистки
 * @param config - Дополнительная конфигурация DOMPurify (опционально)
 * @returns Очищенная HTML строка
 *
 * @example
 * ```ts
 * const userInput = '<script>alert("XSS")</script><p>Safe content</p>';
 * const safe = sanitizeHtml(userInput);
 * // Результат: '<p>Safe content</p>'
 * ```
 */
export function sanitizeHtml(html: string, config?: Record<string, unknown>): string {
    if (!html || typeof html !== 'string') {
        return '';
    }

    const finalConfig = config ? { ...DEFAULT_CONFIG, ...(config as object) } : DEFAULT_CONFIG;

    return DOMPurify.sanitize(html, finalConfig) as string;
}

/**
 * Очищает HTML контент, разрешая только текст (удаляет все теги)
 *
 * @param html - HTML строка для очистки
 * @returns Текст без HTML тегов
 *
 * @example
 * ```ts
 * const userInput = '<p>Hello <b>World</b></p>';
 * const text = sanitizeText(userInput);
 * // Результат: 'Hello World'
 * ```
 */
export function sanitizeText(html: string): string {
    if (!html || typeof html !== 'string') {
        return '';
    }

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
    });
}

/**
 * Очищает URL для безопасного использования в href/src
 *
 * @param url - URL для очистки
 * @returns Очищенный URL или пустая строка если URL небезопасен
 *
 * @example
 * ```ts
 * const safeUrl = sanitizeUrl('https://example.com');
 * const unsafeUrl = sanitizeUrl('javascript:alert("XSS")');
 * // unsafeUrl будет пустой строкой
 * ```
 */
export function sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
        return '';
    }

    // Разрешаем только http, https, mailto протоколы
    const allowedProtocols = ['http:', 'https:', 'mailto:'];

    try {
        const urlObj = new URL(url, window.location.origin);

        if (allowedProtocols.includes(urlObj.protocol)) {
            return DOMPurify.sanitize(url, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: [],
            });
        }

        return '';
    } catch {
        // Невалидный URL
        return '';
    }
}

/**
 * Проверяет, содержит ли строка потенциально опасный контент
 *
 * @param html - HTML строка для проверки
 * @returns true если контент был изменен при очистке (содержал опасные элементы)
 */
export function containsDangerousContent(html: string): boolean {
    if (!html || typeof html !== 'string') {
        return false;
    }

    const cleaned = sanitizeHtml(html);
    return cleaned !== html;
}
