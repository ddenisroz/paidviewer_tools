import { logger } from '../utils/prodLogger';

// src/utils/formatUtils.js

/**
 * Форматирование даты
 * @param {string|Date} date - Дата
 * @param {string} locale - Локаль
 * @returns {string} - Отформатированная дата
 */
export const formatDate = (date, locale = 'ru-RU') => {
    if (!date) return 'Не указано';
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleString(locale);
    } catch (error) {
        logger.error('Error formatting date:', error);
        return 'Неверная дата';
    }
};

/**
 * Форматирование времени относительно текущего момента
 * @param {string|Date} date - Дата
 * @returns {string} - Относительное время
 */
export const formatRelativeTime = (date) => {
    if (!date) return 'Нет данных';
    
    try {
        const now = new Date();
        const targetDate = typeof date === 'string' ? new Date(date) : date;
        const diffMinutes = Math.round((now - targetDate) / (1000 * 60));

        if (diffMinutes < 1) return 'Только что';
        if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
        if (diffMinutes < 24 * 60) return `${Math.round(diffMinutes / 60)} ч. назад`;
        return `${Math.round(diffMinutes / (24 * 60))} дн. назад`;
    } catch (error) {
        logger.error('Error formatting relative time:', error);
        return 'Неверная дата';
    }
};

/**
 * Форматирование размера файла
 * @param {number} bytes - Размер в байтах
 * @returns {string} - Отформатированный размер
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Форматирование числа с разделителями
 * @param {number} num - Число
 * @param {string} locale - Локаль
 * @returns {string} - Отформатированное число
 */
export const formatNumber = (num, locale = 'ru-RU') => {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString(locale);
};

/**
 * Форматирование времени в секундах
 * @param {number} seconds - Секунды
 * @returns {string} - Отформатированное время
 */
export const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Форматирование процентов
 * @param {number} value - Значение
 * @param {number} total - Общее значение
 * @param {number} decimals - Количество знаков после запятой
 * @returns {string} - Отформатированный процент
 */
export const formatPercentage = (value, total, decimals = 1) => {
    if (typeof value !== 'number' || typeof total !== 'number' || total === 0) return '0%';
    
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
};

export default {
    formatDate,
    formatRelativeTime,
    formatFileSize,
    formatNumber,
    formatTime,
    formatPercentage
};

