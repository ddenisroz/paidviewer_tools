import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

import { logger } from '@/shared/utils/prodLogger';

export const formatDate = (date: string | Date, locale: string = 'ru-RU'): string => {
    if (!date) return 'Не указано';
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleString(locale);
    } catch (error) {
        logger.error('Error formatting date:', error);
        return 'Неверная дата';
    }
};

export const formatRelativeTime = (date: string | Date): string => {
    if (!date) return 'Нет данных';
    try {
        const targetDate = typeof date === 'string' ? new Date(date) : date;
        return formatDistanceToNow(targetDate, { addSuffix: true, locale: ru });
    } catch (error) {
        logger.error('Error formatting relative time:', error);
        return 'Неверная дата';
    }
};

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatNumber = (num: number, locale: string = 'ru-RU'): string => {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString(locale);
};

export const formatTime = (seconds: number): string => {
    if (typeof seconds !== 'number' || seconds < 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatPercentage = (value: number, total: number, decimals: number = 1): string => {
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
    formatPercentage,
};
