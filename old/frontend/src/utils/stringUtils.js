// src/utils/stringUtils.js

/**
 * Обрезка строки с многоточием
 * @param {string} str - Строка
 * @param {number} maxLength - Максимальная длина
 * @returns {string} - Обрезанная строка
 */
export const truncateString = (str, maxLength = 50) => {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
};

/**
 * Первая буква заглавная
 * @param {string} str - Строка
 * @returns {string} - Строка с заглавной первой буквой
 */
export const capitalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Первая буква каждого слова заглавная
 * @param {string} str - Строка
 * @returns {string} - Строка с заглавными первыми буквами слов
 */
export const capitalizeWords = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.split(' ').map(word => capitalize(word)).join(' ');
};

/**
 * Удаление лишних пробелов
 * @param {string} str - Строка
 * @returns {string} - Строка без лишних пробелов
 */
export const trimSpaces = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/\s+/g, ' ').trim();
};

/**
 * Генерация случайной строки
 * @param {number} length - Длина строки
 * @returns {string} - Случайная строка
 */
export const generateRandomString = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Проверка на пустую строку
 * @param {string} str - Строка
 * @returns {boolean} - Пустая ли строка
 */
export const isEmpty = (str) => {
    return !str || str.trim().length === 0;
};

/**
 * Проверка на непустую строку
 * @param {string} str - Строка
 * @returns {boolean} - Непустая ли строка
 */
export const isNotEmpty = (str) => {
    return str && str.trim().length > 0;
};

/**
 * Подсчет слов
 * @param {string} str - Строка
 * @returns {number} - Количество слов
 */
export const countWords = (str) => {
    if (!str || typeof str !== 'string') return 0;
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Подсчет символов
 * @param {string} str - Строка
 * @returns {number} - Количество символов
 */
export const countCharacters = (str) => {
    if (!str || typeof str !== 'string') return 0;
    return str.length;
};

/**
 * Замена всех вхождений
 * @param {string} str - Строка
 * @param {string} search - Что искать
 * @param {string} replace - На что заменить
 * @returns {string} - Строка с заменой
 */
export const replaceAll = (str, search, replace) => {
    if (!str || typeof str !== 'string') return '';
    return str.split(search).join(replace);
};

/**
 * Удаление HTML тегов
 * @param {string} str - Строка с HTML
 * @returns {string} - Строка без HTML
 */
export const stripHtml = (str) => {
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
    stripHtml
};

