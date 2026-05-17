export const truncateString = (str: string, maxLength: number = 50): string => {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= maxLength) return str;
    return `${str.substring(0, maxLength)}...`;
};

export const capitalize = (str: string): string => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const capitalizeWords = (str: string): string => {
    if (!str || typeof str !== 'string') return '';
    return str
        .split(' ')
        .map((word) => capitalize(word))
        .join(' ');
};

export const trimSpaces = (str: string): string => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/\s+/g, ' ').trim();
};

export const generateRandomString = (length: number = 8): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const isEmpty = (str: string): boolean => {
    return !str || str.trim().length === 0;
};

export const isNotEmpty = (str: string): boolean => {
    return !!str && str.trim().length > 0;
};

export const countWords = (str: string): number => {
    if (!str || typeof str !== 'string') return 0;
    return str
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
};

export const countCharacters = (str: string): number => {
    if (!str || typeof str !== 'string') return 0;
    return str.length;
};

export const replaceAll = (str: string, search: string, replace: string): string => {
    if (!str || typeof str !== 'string') return '';
    return str.split(search).join(replace);
};

export const stripHtml = (str: string): string => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '');
};

export default {
    truncateString,
    capitalize,
    capitalizeWords,
    trimSpaces,
    generateRandomString,
    isEmpty,
    isNotEmpty,
    countWords,
    countCharacters,
    replaceAll,
    stripHtml,
};
