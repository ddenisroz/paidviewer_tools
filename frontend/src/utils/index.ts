import { REGEX, TIMEOUTS, VALIDATION } from '@/constants';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    formatDate as formatDateUtil,
    formatRelativeTime as formatRelativeTimeUtil,
} from '../shared/utils/formatUtils';
import {
    capitalize as capitalizeUtil,
    stripHtml as stripHtmlUtil,
    truncateString as truncateUtil,
} from '../shared/utils/stringUtils';

import { logger } from './prodLogger';

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export const validateUsername = (username: string): ValidationResult => {
    if (!username) {
        return { isValid: false, error: 'Имя пользователя обязательно' };
    }
    if (username.length < VALIDATION.USERNAME.MIN_LENGTH) {
        return { isValid: false, error: `Минимум ${VALIDATION.USERNAME.MIN_LENGTH} символов` };
    }
    if (username.length > VALIDATION.USERNAME.MAX_LENGTH) {
        return { isValid: false, error: `Максимум ${VALIDATION.USERNAME.MAX_LENGTH} символов` };
    }
    if (!VALIDATION.USERNAME.PATTERN.test(username)) {
        return { isValid: false, error: 'Только буквы, цифры и подчеркивание' };
    }
    return { isValid: true };
};

export const validateVerificationCode = (code: string): ValidationResult => {
    if (!code) {
        return { isValid: false, error: 'Код верификации обязателен' };
    }
    if (code.length < VALIDATION.VERIFICATION_CODE.MIN_LENGTH) {
        return { isValid: false, error: `Минимум ${VALIDATION.VERIFICATION_CODE.MIN_LENGTH} символов` };
    }
    if (code.length > VALIDATION.VERIFICATION_CODE.MAX_LENGTH) {
        return { isValid: false, error: `Максимум ${VALIDATION.VERIFICATION_CODE.MAX_LENGTH} символов` };
    }
    if (!VALIDATION.VERIFICATION_CODE.PATTERN.test(code)) {
        return { isValid: false, error: 'Только заглавные буквы и цифры' };
    }
    return { isValid: true };
};

export const validateEmail = (email: string): ValidationResult => {
    if (!email) {
        return { isValid: false, error: 'Email обязателен' };
    }
    if (!REGEX.EMAIL.test(email)) {
        return { isValid: false, error: 'Неверный формат email' };
    }
    return { isValid: true };
};

export const validateUrl = (url: string): ValidationResult => {
    if (!url) {
        return { isValid: false, error: 'URL обязателен' };
    }
    if (!REGEX.URL.test(url)) {
        return { isValid: false, error: 'Неверный формат URL' };
    }
    return { isValid: true };
};

export const safeGet = <T, D>(obj: T | null | undefined, path: string, defaultValue: D = null as D): D | unknown => {
    if (!obj || !path) return defaultValue;
    const keys = path.split('.');
    let result: Record<string, unknown> | unknown = obj;
    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key as keyof typeof result];
        } else {
            return defaultValue;
        }
    }
    return result;
};

export const deepClone = <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (Array.isArray(obj)) return obj.map((item) => deepClone(item)) as unknown as T;
    const clonedObj: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>).forEach((key) => {
        clonedObj[key] = deepClone((obj as Record<string, unknown>)[key]);
    });
    return clonedObj as T;
};

export const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
    const cleaned: Partial<T> = {};
    Object.keys(obj).forEach((key) => {
        if (obj[key] !== undefined) {
            (cleaned as Record<string, unknown>)[key] = obj[key];
        }
    });
    return cleaned;
};

export const formatString = (template: string, values: Record<string, string | number>): string => {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
    });
};

// Re-export capitalize from stringUtils to avoid duplication
export const capitalize = capitalizeUtil;

// Re-export truncate from stringUtils to avoid duplication
export const truncate = truncateUtil;

// Re-export stripHtml from stringUtils to avoid duplication
export const stripHtml = stripHtmlUtil;

// Re-export formatDate from formatUtils to avoid duplication
export const formatDate = formatDateUtil;

// Re-export getRelativeTime from formatUtils to avoid duplication
export const getRelativeTime = formatRelativeTimeUtil;

export const createTimer = (callback: () => void, delay: number): (() => void) => {
    const timerId = setTimeout(callback, delay);
    return () => clearTimeout(timerId);
};

export const getUrlParams = (url: string = window.location.href): Record<string, string> => {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    for (const [key, value] of urlObj.searchParams.entries()) {
        params[key] = value;
    }
    return params;
};

export const buildUrl = (
    base: string,
    params: Record<string, string | number | boolean | null | undefined> = {}
): string => {
    const url = new URL(base, window.location.origin);
    Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
};

export const getCookie = (name: string): string | undefined | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        try {
            return JSON.parse(decodeURIComponent(parts.pop()!.split(';').shift()!));
        } catch (error) {
            logger.warn(`Failed to parse cookie ${name}:`, error);
            return null;
        }
    }
    return null;
};

interface CookieOptions {
    path?: string;
    maxAge?: number;
    expires?: Date | string;
    domain?: string;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

export const setCookie = (name: string, value: string | number | boolean, options: CookieOptions = {}): void => {
    const defaults: CookieOptions = { path: '/', maxAge: 86400 * 30 };
    const opts = { ...defaults, ...options };
    let cookieString = `${name}=${encodeURIComponent(JSON.stringify(value))}`;

    Object.entries(opts).forEach(([key, val]) => {
        if (val !== undefined) {
            if (key === 'expires' && val instanceof Date) {
                cookieString += `; ${key}=${val.toUTCString()}`;
            } else {
                cookieString += `; ${key}=${val}`;
            }
        }
    });

    document.cookie = cookieString;
};

export const removeCookie = (name: string, path: string = '/'): void => {
    document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

export const debounce = <Args extends unknown[]>(
    func: (...args: Args) => void,
    wait: number = TIMEOUTS.DEBOUNCE_DELAY
) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return function executedFunction(this: unknown, ...args: Args) {
        const later = () => {
            if (timeout) clearTimeout(timeout);
            func.apply(this, args);
        };
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

export const throttle = <Args extends unknown[]>(func: (...args: Args) => void, limit: number) => {
    let inThrottle = false;
    return function throttled(this: unknown, ...args: Args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
    } catch (error) {
        logger.error('Error copying to clipboard:', error);
        return false;
    }
};

export const generateId = (length: number = 8): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const formatNumber = (num: number): string => {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString('ru-RU');
};

export const formatBytes = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
