/**
 * Input Sanitization Utilities
 *
 * Provides XSS prevention and input sanitization functions.
 * Uses DOMPurify for HTML and regex for specific fields.
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
 */
export function sanitizeHtml(html: string, config?: Record<string, unknown>): string {
    if (!html || typeof html !== 'string') {
        return '';
    }
    const finalConfig = config ? { ...DEFAULT_CONFIG, ...(config as object) } : DEFAULT_CONFIG;
    return DOMPurify.sanitize(html, finalConfig) as string;
}

/**
 * Очищает URL для безопасного использования
 */
export function sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
        return '';
    }
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    try {
        const urlObj = new URL(url, window.location.origin);
        if (allowedProtocols.includes(urlObj.protocol)) {
            return DOMPurify.sanitize(url, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: [],
            }) as string;
        }
        return '';
    } catch {
        return '';
    }
}

/**
 * Sanitize input for general use
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
    if (!input) return '';
    let sanitized = input;
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    sanitized = sanitized.replace(/[<>"`]/g, '');
    sanitized = sanitized.trim();
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
}

/**
 * Sanitize stream title
 */
export function sanitizeStreamTitle(title: string): string {
    if (!title) return '';
    let sanitized = title.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    sanitized = sanitized.trim();
    if (sanitized.length > 140) {
        sanitized = sanitized.substring(0, 140);
    }
    return sanitized;
}

/**
 * Sanitize username
 */
export function sanitizeUsername(username: string): string {
    if (!username) return '';
    let sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');
    sanitized = sanitized.trim();
    if (sanitized.length > 50) {
        sanitized = sanitized.substring(0, 50);
    }
    return sanitized;
}

/**
 * Sanitize command name
 */
export function sanitizeCommandName(commandName: string): string {
    if (!commandName) return '';
    let sanitized = commandName
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase()
        .trim();
    if (sanitized.length > 25) {
        sanitized = sanitized.substring(0, 25);
    }
    return sanitized;
}

/**
 * Sanitize voice name
 */
export function sanitizeVoiceName(voiceName: string): string {
    if (!voiceName) return '';
    let sanitized = voiceName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s_-]/g, '').trim();
    if (sanitized.length > 50) {
        sanitized = sanitized.substring(0, 50);
    }
    return sanitized;
}

/**
 * Sanitize TTS message
 */
export function sanitizeTtsMessage(message: string): string {
    if (!message) return '';
    let sanitized = message.replace(/<[^>]*>/g, '');
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '').trim();
    if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 500);
    }
    return sanitized;
}

/**
 * Strip all HTML tags from input
 */
export function stripHtmlTags(input: string): string {
    if (!input) return '';
    let stripped = input.replace(/<[^>]*>/g, '');
    stripped = stripped
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&amp;/g, '&');
    return stripped.trim();
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
    if (!email) return '';
    const sanitized = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(sanitized) || sanitized.length > 254) {
        return '';
    }
    return sanitized;
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
    if (!fileName) return '';
    // eslint-disable-next-line no-useless-escape
    let sanitized = fileName.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '').trim();
    if (sanitized.length > 255) {
        sanitized = sanitized.substring(0, 255);
    }
    return sanitized;
}
